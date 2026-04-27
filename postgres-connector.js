// ESM
import fastifyPlugin from 'fastify-plugin'
import fastifyPostgres from '@fastify/postgres'

/**
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function dbConnector (fastify, options) {
    fastify.register(fastifyPostgres, {
        connectionString: 'postgres://postgres@localhost:5432/postgres?password=1111'
    }) // TODO: move password to env variable
}

// Wrapping a plugin function with fastify-plugin exposes the decorators
// and hooks, declared inside the plugin to the parent scope.
export default fastifyPlugin(dbConnector)
