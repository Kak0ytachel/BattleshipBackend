import type {FastifyInstance} from "fastify";


function send_handle(this: WebSocket, type: string, payload: Object) {
    // console.log(this, type, payload)
    this.send(
        JSON.stringify({
            type: type,
            payload: payload
        })
    )
}

const HANDLERS: { [key: string]: (conn: WebSocket & { send_handle: typeof send_handle }, payload: Object, user_id: number) => void } = {
    START: (conn, payload, user_id) => {
        console.log(payload);
    },

    PING: (conn, payload, user_id) => {
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
                connection.close();
                connection.send_handle("ERROR", {"error": "No ticket provided"})
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
            const user_id = payload.user_id;
            console.log("user_id ", user_id);

            // console.log("headers ", connection.headers);
            connection.on('message', (message: string) => {
                const messageObject: {type: string, payload: Object} = JSON.parse(message);
                const { type, payload } = messageObject;
                if (type in HANDLERS) {
                    HANDLERS[type]?.(connection, payload, user_id)
                }
                else {
                    console.log('Unknown message type')
                    connection.send_handle("ERROR", {"error": "Unknown message type"})
                }
            });
            connection.send_handle("HELLO", {})
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
        const ticket = fastify.jwt.sign({ user_id, type: "ticket" }, { expiresIn: '10m' })
        return {ticket: ticket};
    })
}

export default websocket_routes;