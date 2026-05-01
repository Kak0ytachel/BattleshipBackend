import Fastify from 'fastify'
import routes from './route.ts'
import websocket_routes from './websocket.ts'
import dbConnector from './postgres-connector.ts'
import fastifyWebsocket from "@fastify/websocket";

const fastify = Fastify({
    logger: {
        transport: {
            target: 'pino-pretty'
        },
        level: 'debug',
    }
})



// fastify.get('/', async (request, reply) => {
//     return { hello: 'world' }
// })

fastify.register(dbConnector)
fastify.register(fastifyWebsocket)
fastify.register(routes)
fastify.register(websocket_routes)

const start = async () => {
    // try {
        await fastify.listen({ port: 3000, host: '0.0.0.0'})
    // } catch (err) {
    //     fastify.log.error(err)
    //     process.exit(1)
    // }
}
start()


