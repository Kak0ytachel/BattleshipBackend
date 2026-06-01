import type {FastifyInstance} from "fastify";
import answersData from "./answers.json" with { type: 'json' };

type WebSocketPlus = WebSocket & { send_handle: typeof send_handle }

const connectionList: {[key: string]: WebSocketPlus} = {}

function send_handle(this: WebSocket, type: string, payload: Object) {
    // console.log(this, type, payload)
    this.send(
        JSON.stringify({
            type: type,
            payload: payload
        })
    )
}

async function get_opponent_user_id(fastify: FastifyInstance, user_id: number) {
    const result2 = await fastify.pg.query("SELECT get_opponent ($1)", [user_id])
    const opponent_user_id: number = result2.rows[0].get_opponent;
    return opponent_user_id;
}

function check_answer(index: number, answer: string)  {
    const val = Math.random();
    const isCorrect = (val < 0.9);
    const answers: Map<string, string> = new Map(Object.entries(answersData))
    const correctAnswer = answers.get(String(index));
    return {isCorrect, correctAnswer};
    // TODO: implement
}


const HANDLERS: { [key: string]:  (conn: WebSocketPlus, payload: Object, fastify: FastifyInstance, user_id: number) => Promise<void> } = {
    "CREATE-GAME": async (conn, payload, fastify, user_id) => {
        // console.log(payload);
        // console.log(connectionList);
        try {
            const result = await fastify.pg.query("SELECT create_game ($1)", [user_id]);
            const join_code = result.rows[0].create_game; // TODO: add error handling
            conn.send_handle("JOIN-CODE", {join_code}) //TODO: replace ANS type
        } catch (e: any ) {
            return;
        }


    },

    "JOIN-GAME": async (conn, payload, fastify, user_id) => {
        // console.log(payload?.join_code);
        const join_code = (payload as {join_code: string}).join_code;
        const result = await fastify.pg.query("SELECT start_game ($1, $2)", [user_id, join_code]);
        // TODO: add error handling
        const success: boolean = result.rows[0].start_game;
        if (!success) {
            conn.send_handle("ERROR-CODE", {error: "Invalid join code"}) // TODO: replace event type
            return;
        }
        const opponent_user_id = await get_opponent_user_id(fastify, user_id);

        conn.send_handle("START-GAME", {success})
        const opponent_connection = connectionList[String(opponent_user_id)];
        if (opponent_connection == undefined) {
            console.log("opponent connection undefined")
            return
        }
        opponent_connection.send_handle("START-GAME", {success})
    },

    "PLACE-SHIPS": async (conn, payload, fastify, user_id) => {
        const coordinates = (payload as {"coordinates": string[]}).coordinates;
        const coordinatesJson = JSON.stringify(coordinates);
        const result = await fastify.pg.query("SELECT create_grid ($1, $2)", [coordinatesJson, user_id]);
        const code: number = result.rows[0].create_grid;
        if (code === -1) {
            fastify.log.error("create_grid failed")
            return;
        }
        if (code == 1) {
            // added but opponent not done yet
            conn.send_handle("PLACE-WAIT", {})
            return;
        }
        const opponent_id = code;
        const opponent_connection = connectionList[String(opponent_id)];
        if (!opponent_connection) {
            fastify.log.error("opponent connection undefined")

            console.log("opponent_user_id ", opponent_id)
            console.log("connectionList ", connectionList)
            return;
        }
        conn.send_handle("PLACE-DONE", {});
        opponent_connection.send_handle("PLACE-DONE", {});

        const empty_grid: {[index: string]: {}} = {};
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < 6; j++) {
                const name: string =`${i + 1}${String.fromCharCode(65 + j)}`;
                empty_grid[name] = {"is_shot": false, "has_ship": false, "attempted": false};
            }
        }


        conn.send_handle("TURN-INFO", {"current_turn": user_id,  "next_turn": opponent_id, "grid": empty_grid, "event": "START", "cell": "1A"});
        opponent_connection.send_handle("TURN-INFO", {"current_turn": user_id,  "next_turn": opponent_id, "grid": empty_grid, "event": "START", "cell": "1A"});

        // first turn is of the player, who has placed the first, -> opponent is 1st here
        // TODO: add sending TURN-INFO
    },

    "QUESTIONS-GET": async (conn, payload, fastify, user_id) =>  {
        const ans = await fastify.pg.query("SELECT get_questions ($1)", [user_id]);
        const questions = ans.rows[0].get_questions; // TODO: send questions text too
        console.log(questions)
        conn.send_handle("QUESTIONS-SEND", {questions})
    },

    "SHOOT": async (conn, payload, fastify, user_id) => {
        const {questionIndex, answer, coordinate } = payload as {questionIndex: number, answer: string, coordinate: string}
        const {isCorrect, correctAnswer} = check_answer(questionIndex, answer);
        const result = await fastify.pg.query("SELECT save_shot ($1, $2, $3)", [user_id, coordinate, isCorrect]);

        const ans: {grid: {}, opponent_id: number} = result.rows[0].save_shot;
        if ("error" in ans) {
            conn.send_handle("ERROR", {"error": "wrong turn"});
            return
        }
        console.log(ans);
        const grid: Record<string, {"is_shot": boolean, "has_ship": boolean, "attempted": boolean}> = ans.grid;

        const has_ship = grid[coordinate]?.has_ship;

        const base_x: number = Number(coordinate.split("")[0]); // 1-based
        const base_y: number = Number(coordinate.charCodeAt(1) - 64); // 1-based

        let has_left = false;

        function checkNeighbours(base_x: number, base_y: number): [number, number, boolean] {
            let [x_i, y_i] = [0, 0];
            for (let x = Math.max(1, base_x - 1); x <= Math.min(base_x + 1, 6); x++) {
                for (let y = Math.max(1, base_y - 1); y <= Math.min(base_y + 1, 6); y++) {
                    if (x === base_x && y === base_y) {
                        continue;
                    }
                    const code = `${x}${String.fromCharCode(64 + y)}`;
                    if (grid[code]?.has_ship) {
                        const is_left = !grid[code]?.is_shot;
                        if (is_left) {
                            return [x, y, is_left];
                        } else {
                            x_i = x;
                            y_i = y;
                        }
                    }
                }
            }
            return [x_i, y_i, false];
        }

        const [x_a, y_a, l_a] = checkNeighbours(base_x, base_y);
        if (x_a == 0) {
            has_left = false;
        } else {
            if (l_a) {
                has_left = true;
            } else {
                const [x_b, y_b, l_b] = checkNeighbours(x_a, y_a);
                has_left = l_b;
            }
        }


        let event = "";
        if (isCorrect) {
            if (has_ship) {
                if (has_left) {
                    event = "HIT";
                } else {
                    event = "SUNK";
                }
            } else {
                event = "EMPTY";
            }
        } else {
            event = "MISTAKE";
        }

        let leftShips = false;
        for (const [cell, info] of Object.entries(grid)) {
            if (info.has_ship && !info.is_shot) {
                leftShips = true;
                break;
            }
        }

        const opponent_id = Number(ans.opponent_id);
        conn.send_handle("TURN-INFO", {"current_turn": user_id,  "next_turn": leftShips? opponent_id : -1, "grid": grid, "event": "SHOOT", "cell": coordinate, "question": questionIndex, "answer": answer, "correct": correctAnswer, "result": event});
        // TODO: replace event type and cell
        const opponent_conn = connectionList[String(opponent_id)];

        opponent_conn?.send_handle("TURN-INFO", {"current_turn": user_id,  "next_turn": leftShips? opponent_id : -1, "grid": grid, "event": "SHOOT", "cell": coordinate, "result": event});

        if (!leftShips) {
            const result2 = await fastify.pg.query("SELECT end_game ($1)", [user_id]);
            const stats = result2.rows[0].end_game;

            conn.send_handle("END-GAME", {"winner": user_id, "stats": stats });
            opponent_conn?.send_handle("END-GAME", {"winner": user_id, "stats": stats});
        }


    },

    PING: async (conn, payload, fastify, user_id) => {
        conn.send_handle("PONG", {
            date: Date.now(),
            user_id: user_id
        })
    }
}

async function websocket_routes(fastify: FastifyInstance, options: Object) {
    fastify.get<{Querystring: {ticket?: string}}>('/websocket', { websocket: true },

        (connection: any, req) => {

            connection = connection as WebSocket & { send_handle: typeof send_handle }
            connection.send_handle = send_handle;

            const ticket = req.query.ticket ?? "";
            if (ticket === "") {
                connection.send_handle("ERROR", {"error": "No ticket provided"});
                connection.close();
                return
            }
            let payload: { user_id: number }
            try {
                payload = fastify.jwt.verify(ticket);
            }
            catch (e) {
                fastify.log.error(e);
                connection.send_handle("ERROR", {"error": "Invalid ticket"})
                connection.close();
                return
            }
            const user_id: number = payload.user_id;
            console.log("user_id ", user_id);
            connectionList[String(user_id)] = connection;

            // console.log("headers ", connection.headers);
            connection.on('message', async (message: string) => {
                const messageObject: {type: string, payload: Object} = JSON.parse(message);
                const { type, payload } = messageObject;
                if (type in HANDLERS) {
                    const fun =  HANDLERS[type];
                    if (fun === undefined) {
                        fastify.log.error("Handler found, but undefined: " + type)
                        return
                    }

                    await fun(connection, payload, fastify, user_id);

                }
                else {
                    console.log('Unknown message type')
                    connection.send_handle("ERROR", {"error": "Unknown message type"})
                }
            });
            connection.send_handle("HELLO", {})

            connection.on('close', () => {
                if (String(user_id) in connectionList) {
                    if (connectionList[String(user_id)] === connection) {
                        delete connectionList[String(user_id)];
                    }
                }
            })
        }
    );

    fastify.get('/websocket-auth', (connection: any, req) => {
        console.log("headers ", connection.headers);
        const token = connection.headers.authorization?.split(" ")[1] ?? "";
        if (token === "") {
            return {error: "No token provided"}
        }
        const payload: { user_id: string } = fastify.jwt.verify(token);
        const user_id = payload.user_id;
        const ticket = fastify.jwt.sign({ user_id, type: "ticket" }, { expiresIn: '1m' })
        return {ticket: ticket};
    })
}

export default websocket_routes;