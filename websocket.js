/**
 *
 * @this {SocketStream}
 * @param {string} type
 * @param {Object} payload
 */
function send_handle(type, payload) {
    console.log( type, payload)
    this.send(
        JSON.stringify({
            type: type,
            payload: payload
        })
    )
}

/**
 * @type {Object<string, ((conn: SocketStream, payload: Object) => Promise<void>)>}
 */
const HANDLERS = {
    START: (conn, payload) => {
        console.log(payload);
    },

    PING: (conn, payload) => {
        conn.send_handle("PONG", {
            date: Date.now()
        })
    }
}

/**
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function websocket_routes(fastify, options) {
    fastify.get('/websocket', { websocket: true },
        /**
         * @param {SocketStream} connection
         * @param {FastifyRequest} req
         */
        (connection, req) => {
            connection.send_handle = send_handle;
            connection.on('message', (message) => {
                message = JSON.parse(message);
                const { type, payload } = message;
                if (type in HANDLERS) HANDLERS[type](connection, payload)
                else {
                    console.log('Unknown message type')
                    connection.send_handle("ERROR", {"error": "Unknown message type"})
                }
            });
        }
    );
}

export default websocket_routes;