import type {FastifyInstance} from "fastify";

type WebSocketPlus = WebSocket & { send_handle: typeof send_handle }

const connectionList: {[key: number]: WebSocketPlus} = {}

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


const HANDLERS: { [key: string]:  (conn: WebSocketPlus, payload: Object, fastify: FastifyInstance, user_id: number) => Promise<void> } = {
    "CREATE-GAME": async (conn, payload, fastify, user_id) => {
        // console.log(payload);
        // console.log(connectionList);
        const result = await fastify.pg.query("SELECT create_game ($1)", [user_id]);
        const join_code = result.rows[0].create_game; // TODO: add error handling
        conn.send_handle("JOIN-CODE", {join_code}) //TODO: replace ANS type
    },

    "JOIN-GAME": async (conn, payload, fastify, user_id) => {
        // console.log(payload?.join_code);
        const join_code = (payload as {join_code: string}).join_code;
        const result = await fastify.pg.query("SELECT start_game ($1, $2)", [user_id, join_code]);
        // TODO: add error handling
        const success: boolean = result.rows[0].start_game;
        if (!success) {
            conn.send_handle("ERROR", {error: "Invalid join code"}) // TODO: replace event type
            return;
        }
        const opponent_user_id = await get_opponent_user_id(fastify, user_id);

        conn.send_handle("START-GAME", {success})
        const opponent_connection = connectionList[opponent_user_id];
        if (opponent_connection == undefined) {
            console.log("opponent connection undefined")
            return
        }
        opponent_connection.send_handle("START-GAME", {success})
        // TODO: add sending to the second player
    },

    "PLACE-SHIPS": async (conn, payload, fastify, user_id) => {
        const coordinates = (payload as {"coordinates": string[]}).coordinates;

        const result = await fastify.pg.query("SELECT create_grid ($1, $2)", [coordinates, user_id]);
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
        // const opponent_id = code;
        const opponent_connection = connectionList[code];
        if (!opponent_connection) {
            fastify.log.error("opponent connection undefined")
            return;
        }
        conn.send_handle("PLACE-DONE", {});
        opponent_connection.send_handle("PLACE-DONE", {});
        // TODO: add sending TURN-INFO
    },

    "QUESTIONS-GET": async (conn, payload, fastify, user_id) =>  {
        const ans = await fastify.pg.query("SELECT get_questions ($1)", [user_id]);
        const questions = ans.rows[0].get_questions; // TODO: send questions text too
        conn.send_handle("QUESTIONS-SEND", {questions})
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
            connectionList[user_id] = connection;

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
                if (user_id in connectionList) {
                    if (connectionList[user_id] === connection) {
                        delete connectionList[user_id];
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