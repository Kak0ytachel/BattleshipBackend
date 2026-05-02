import Fastify from 'fastify'
import routes from './route.ts'
import websocket_routes from './websocket.ts'
import dbConnector from './postgres-connector.ts'
import fastifyWebsocket from "@fastify/websocket";
import cors from "@fastify/cors";

const fastify = Fastify({
    logger: {
        transport: {
            target: 'pino-pretty'
        },
        level: 'debug',
    }
})


fastify.register(dbConnector)
fastify.register(fastifyWebsocket)
fastify.register(routes)
fastify.register(websocket_routes)
fastify.register(cors, {
    origin: (origin: any, cb) => {
        const hostname = new URL(origin).hostname
        if(hostname === "localhost"){
            //  Request from localhost will pass
            cb(null, true)
            return
        }
        // Generate an error on other origins, disabling access
        cb(new Error("Not allowed"), false)
    }
})

const start = async () => {
    // try {
        await fastify.listen({ port: 3000, host: '0.0.0.0'})
    // } catch (err) {
    //     fastify.log.error(err)
    //     process.exit(1)
    // }
}
start()


