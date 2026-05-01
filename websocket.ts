import type {FastifyInstance} from "fastify";


function send_handle(this: WebSocket, type: string, payload: Object) {
    console.log(this, type, payload)
    this.send(
        JSON.stringify({
            type: type,
            payload: payload
        })
    )
}

const HANDLERS: { [key: string]: (conn: WebSocket & { send_handle: typeof send_handle }, payload: Object) => void } = {
    START: (conn, payload) => {
        console.log(payload);
    },

    PING: (conn, payload) => {
        conn.send_handle("PONG", {
            date: Date.now()
        })
    }
}

async function websocket_routes(fastify: FastifyInstance, options: Object) {
    fastify.get('/websocket', { websocket: true },

        (connection: any, req) => {
            connection = connection as WebSocket & { send_handle: typeof send_handle }
            connection.send_handle = send_handle;
            connection.on('message', (message: string) => {
                const messageObject: {type: string, payload: Object} = JSON.parse(message);
                const { type, payload } = messageObject;
                if (type in HANDLERS) {
                    HANDLERS[type]?.(connection, payload)
                }
                else {
                    console.log('Unknown message type')
                    connection.send_handle("ERROR", {"error": "Unknown message type"})
                }
            });
            connection.send_handle("HELLO", {})
        }
    );
}

export default websocket_routes;