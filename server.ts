import Fastify from 'fastify'

import fastifyWebsocket from "@fastify/websocket";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";

import routes from './route.ts'
import websocket_routes from './websocket.ts'
import dbConnector from './postgres-connector.ts'

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
fastify.register(fastifyCors, {
    origin: (origin: any, cb) => {
        const hostname = (origin)?(new URL(origin).hostname): "";
        if(hostname === "localhost" || hostname === ""){
            //  Request from localhost will pass
            cb(null, true)
            return
        }
        // Generate an error on other origins, disabling access
        cb(new Error("Not allowed"), false)
    }
})
fastify.register(fastifyJwt, {
    secret: "abc", // TODO: replace with env variable
    sign: {
        expiresIn: '10m' // TODO: replace with higher value after propper testing
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


