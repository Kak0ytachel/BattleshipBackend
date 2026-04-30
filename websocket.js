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
    // /**
    //  * @param {SocketStream} conn
    //  * @param {Object} payload
    //  * @constructor
    //  */
    START: (conn, payload) => {
        console.log(payload);
    },

    PING: (conn, payload) => {
        // conn.send(JSON.stringify({
        //     type: 'PONG',
        //     payload: {
        //         date: Date.now()
        //     }
        // }))
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
        (connection /* SocketStream */, req /* FastifyRequest */) => {
            // connection.send_handle = (...args) => {console.log(args); s};
            connection.send_handle = send_handle;
            // console.log(connection)
            connection.on('message', (message) => {
                message = JSON.parse(message);
                if (message.type in HANDLERS) HANDLERS[message.type](connection, message.payload)
                else console.log('Unknown message type')
                // message.toString() === 'hi from client'
                // connection.send('hi from server');
            });
        }
    );
}

export default websocket_routes;