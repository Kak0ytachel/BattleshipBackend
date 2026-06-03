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
    const result2 = await fastify.pg.query("SELECT battleship.get_opponent ($1)", [user_id])
    const opponent_user_id: number = result2.rows[0].get_opponent;
    return opponent_user_id;
}

function check_answer(index: number, answer: string)  {
    // const val = Math.random();
    const answers: Map<string, string> = new Map(Object.entries(answersData))
    const correctAnswer = answers.get(String(index)) || "ERROR";
    const isCorrect: boolean = spellChecker(answer, correctAnswer)//(val < 0.9);
    return {isCorrect, correctAnswer};
}

function spellChecker(s: string, p: string): boolean {
    const pairs = {"ż": "z", "ź": "z", "ę": "e", "ó": "o", "ą": "a", "ś": "s", "ł": "l", "ć": "c", "ń": "n"};
    function clean(a: string): string {
        a = a.toLowerCase().trim();
        for (let [s1, s2] of Object.entries(pairs)) {
            a = a.replace(s1, s2);
        }
        return a;
    }
    return (clean(s) === clean(p));
}

const HANDLERS: { [key: string]:  (conn: WebSocketPlus, payload: Object, fastify: FastifyInstance, user_id: number) => Promise<void> } = {
    "CREATE-GAME": async (conn, payload, fastify, user_id) => {
        // console.log(payload);
        // console.log(connectionList);
        try {
            const result = await fastify.pg.query("SELECT battleship.create_game ($1)", [user_id]);
            const join_code = result.rows[0].create_game; // TODO: add error handling
            conn.send_handle("JOIN-CODE", {join_code}) //TODO: replace ANS type
        } catch (e: any ) {
            return;
        }


    },

    "JOIN-GAME": async (conn, payload, fastify, user_id) => {
        // console.log(payload?.join_code);
        const join_code = (payload as {join_code: string}).join_code;
        const result = await fastify.pg.query("SELECT battleship.start_game ($1, $2)", [user_id, join_code]);
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
        const result = await fastify.pg.query("SELECT battleship.create_grid ($1, $2)", [coordinatesJson, user_id]);
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
        const ans = await fastify.pg.query("SELECT battleship.get_questions ($1)", [user_id]);
        const questions = ans.rows[0].get_questions;
        console.log(questions)
        conn.send_handle("QUESTIONS-SEND", {questions})
    },

    "TOPICS-GET": async (conn, payload, fastify, user_id) =>  {
        const ans = await fastify.pg.query("SELECT battleship.get_topics ($1)", [user_id]);
        const topics = ans.rows[0].get_topics;
        console.log(topics)
        conn.send_handle("TOPICS-SEND", {topics})
    },

    "SHOOT": async (conn, payload, fastify, user_id) => {
        const {questionIndex, answer, coordinate } = payload as {questionIndex: number, answer: string, coordinate: string}
        const {isCorrect, correctAnswer} = check_answer(questionIndex, answer);
        const result = await fastify.pg.query("SELECT battleship.save_shot ($1, $2, $3)", [user_id, coordinate, isCorrect]);

        const ans: {grid: {}, opponent_id: number, next: number} = result.rows[0].save_shot;
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
        const next = ans.next;

        const opponent_id = Number(ans.opponent_id);
        conn.send_handle("TURN-INFO", {"current_turn": user_id,  "next_turn": leftShips? next : -1, "grid": grid, "event": "SHOOT", "cell": coordinate, "question": questionIndex, "answer": answer, "correct": correctAnswer, "result": event});
        // TODO: replace event type and cell
        const opponent_conn = connectionList[String(opponent_id)];

        opponent_conn?.send_handle("TURN-INFO", {"current_turn": user_id,  "next_turn": leftShips? next : -1, "grid": grid, "event": "SHOOT", "cell": coordinate, "result": event});

        if (!leftShips) {
            const result2 = await fastify.pg.query("SELECT battleship.end_game ($1)", [user_id]);
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
    },
    "REQUEST-BOMBING": async (conn, payload, fastify, user_id: number) => {
        const topic = (payload as {topic: number}).topic;
        const ans = await fastify.pg.query("SELECT battleship.request_bombing($1, $2)", [user_id, topic])
        const opponent_id = ans.rows[0].request_bombing;
        connectionList[opponent_id]?.send_handle("REQUEST-RATE", {"topic": topic});
    },
    "RATE-DONE": async (conn, payload, fastify, user_id: number) => {
        const grade = (payload as {grade: number}).grade;
        const ans = await fastify.pg.query("SELECT battleship.rate_done($1, $2)", [user_id, grade])
        const opponent_id = ans.rows[0].rate_done;
        connectionList[opponent_id]?.send_handle("BOMBING-READY", {});
    },
    "BOMB": async (conn, payload, fastify, user_id: number) =>{
        const cell = (payload as {cell: string, grade: number}).cell;

        const normalize = (x: number) => {return Math.max(2, Math.min(5, x));}
        const base_x: number = normalize(Number(cell.split("")[0])); // 1-based
        const base_y: number = normalize(Number(cell.charCodeAt(1) - 64)); // 1-based

        const cells: string[] = [];
        for (let x = base_x - 1; x <= base_x + 1; x++) {
            for (let y = base_y - 1; y <= base_y + 1; y++) {
                const code = `${x}${String.fromCharCode(64 + y)}`;
                cells.push(code);
            }
        }
        cells.sort((a, b) => Math.random() - 0.5);

        const grade = (payload as {cell: string, grade: number}).grade;
        const ans = await fastify.pg.query("SELECT battleship.BOMB($1, $2, $3)", [user_id, cells, grade]);
        const result = ans.rows[0].bomb as {grid: Object, opponent_id: number, power: number, cells: string[], next: number}

        const grid = result.grid;
        const opponent_id = result.opponent_id;
        const power = result.power;
        const result_cells = result.cells;

        let leftShips = false;
        for (const [cell, info_] of Object.entries(grid)) {
            const info = info_ as {has_ship: boolean, is_shot: boolean}
            if (info.has_ship && !info.is_shot) {
                leftShips = true;
                break;
            }
        }
        const next = result.next;

        conn.send_handle("TURN-INFO", {"current_turn": user_id,  "next_turn": leftShips? next : -1, "grid": grid, "event": "BOMB", "cells": result_cells, "power": power});
        connectionList[String(opponent_id)]?.send_handle("TURN-INFO", {"current_turn": user_id,  "next_turn": leftShips? next : -1, "grid": grid, "event": "BOMB", "cells": result_cells, "power": power})

        if (!leftShips) {
            const result2 = await fastify.pg.query("SELECT battleship.end_game ($1)", [user_id]);
            const stats = result2.rows[0].end_game;

            conn.send_handle("END-GAME", {"winner": user_id, "stats": stats });
            connectionList[String(opponent_id)]?.send_handle("END-GAME", {"winner": user_id, "stats": stats});
        }
    },
    "CHECK-GAME": async (conn: WebSocketPlus, payload, fastify: FastifyInstance, user_id: number) => {
        const ans = await fastify.pg.query("SELECT battleship.check_game($1)", [user_id]);
        const game_id = ans.rows[0].check_game;
        conn.send_handle("GAME-INFO", {"game_id": game_id});
    },
    "TERMINATE-GAME": async (conn: WebSocketPlus, payload, fastify: FastifyInstance, user_id: number) => {
        const ans1 = await fastify.pg.query("SELECT battleship.get_opponent($1)", [user_id]);
        const opponent_id = ans1.rows[0].get_opponent;

        const ans2 = await fastify.pg.query("SELECT battleship.end_game($1)", [opponent_id]);
        const stats = ans2.rows[0].end_game;
        conn.send_handle("TERMINATE-DONE", {});
        connectionList[String(opponent_id)]?.send_handle("END-GAME", {"winner": opponent_id, "stats": stats, "terminated": true});
    },
    "STATS-GET": async (conn: WebSocketPlus, payload, fastify: FastifyInstance, user_id: number) => {
        const ans = await fastify.pg.query("SELECT user_id, name, games_won, games_lost, correct_answers, wrong_answers FROM battleship.users");
        const rows = ans.rows;

        conn.send_handle("STATS-SEND", {"stats": rows});
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
                    console.log('Unknown message type:', type)
                    connection.send_handle("ERROR", {"error": "Unknown message type: " + type})
                    console.log(type, payload);
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