import Fastify from 'fastify'
import routes from './route.js'
import dbConnector from './postgres-connector.js'


/**
 * @type {import('fastify').FastifyInstance} Instance of Fastify
 */
const fastify = Fastify({
    logger: true
})



// fastify.get('/', async (request, reply) => {
//     return { hello: 'world' }
// })

fastify.register(dbConnector)
fastify.register(routes)

const start = async () => {
    // try {
        await fastify.listen({ port: 3000, host: '0.0.0.0'})
    // } catch (err) {
    //     fastify.log.error(err)
    //     process.exit(1)
    // }
}
start()


