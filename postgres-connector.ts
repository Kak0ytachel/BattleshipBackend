import fastifyPlugin from 'fastify-plugin'
import fastifyPostgres from '@fastify/postgres'
import type {FastifyInstance} from "fastify";

async function dbConnector (fastify: FastifyInstance, options: Object) {
    fastify.register(fastifyPostgres, {
        connectionString: 'postgres://postgres@localhost:5432/postgres?password=1111&options=-csearch_path=battleship,public'
    }) // TODO: move password to env variable

    fastify.ready((err) => {
        if (err) throw err

        // Access the underlying node-postgres Pool instance
        fastify.pg.pool.on('connect', (client) => {
            // Listen for notices sent to this specific client
            client.on('notice', (msg) => {
                fastify.log.info({ pgNotice: msg }, `PostgreSQL Notice: ${msg.message}`)
            })
        })
    })
}

// Wrapping a plugin function with fastify-plugin exposes the decorators
// and hooks, declared inside the plugin to the parent scope.
export default fastifyPlugin(dbConnector)
