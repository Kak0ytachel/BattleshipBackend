import 'dotenv/config';
import Fastify from 'fastify'
import fastifyWebsocket from "@fastify/websocket";
import fastifyCors from "@fastify/cors";
import fastifyJwt from "@fastify/jwt";
import {runner} from 'node-pg-migrate';
import routes from './route.ts'
import websocket_routes from './websocket.ts'
import dbConnector from './postgres-connector.ts'

const fastify = Fastify({
    logger: {
        transport: {
            target: 'pino-pretty'
        },
        level: 'debug',
    },
    trustProxy: true
})


fastify.register(dbConnector)
fastify.register(fastifyWebsocket)
fastify.register(routes)
fastify.register(websocket_routes)
fastify.register(fastifyCors, {
    origin: (origin, cb) => {
        cb(null, true)
        return
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
})
fastify.register(fastifyJwt, {
    secret: "abc", // TODO: replace with env variable
    sign: {
        expiresIn: '10h' // TODO: replace with higher value after propper testing
    }
})

const start = async () => {
    try {
        await runner({
            databaseUrl: process.env.DATABASE_URL,
            dir: 'migrations',
            direction: 'up',
            singleTransaction: true // Keep it atomic
        });
        await fastify.listen({ port: 3000, host: '0.0.0.0'})
    } catch (err) {
        fastify.log.error(err)
        // process.exit(1)
    }
}
start()
