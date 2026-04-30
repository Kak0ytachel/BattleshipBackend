

/**
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function websocket_routes(fastify, options) {
    fastify.get('/websocket', { websocket: true },
        (connection /* SocketStream */, req /* FastifyRequest */) => {

            console.log(connection)
            connection.on('message', (message) => {
                // message.toString() === 'hi from client'
                connection.send('hi from server');
            });
        }
    );
}

export default websocket_routes;