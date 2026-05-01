import fastifyPlugin from 'fastify-plugin'
import fastifyPostgres from '@fastify/postgres'
import type {FastifyInstance} from "fastify";

async function dbConnector (fastify: FastifyInstance, options: Object) {
    fastify.register(fastifyPostgres, {
        connectionString: 'postgres://postgres@localhost:5432/postgres?password=1111'
    }) // TODO: move password to env variable
}

// Wrapping a plugin function with fastify-plugin exposes the decorators
// and hooks, declared inside the plugin to the parent scope.
export default fastifyPlugin(dbConnector)
