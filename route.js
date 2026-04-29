
/**
 * Encapsulates the routes
 * @param {FastifyInstance} fastify  Encapsulated Fastify Instance
 * @param {Object} options plugin options, refer to https://fastify.dev/docs/latest/Reference/Plugins/#plugin-options
 */
async function routes (fastify, options) {
    /**
     * @type {import('fastify').RouteShorthandOptions}
     * @const
     */
    const opts = {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    someKey: { type: 'string' },
                    someOtherKey: { type: 'number' }
                },
                required: ['someKey']
            }
        }
    }

    fastify.get('/', opts, async (request, reply) => {
        fastify.pg.query('SELECT * FROM USERS ORDER BY USER_ID ASC;', [], (err, res) => {

            console.log(err, res.rows[0])
        });
        console.log(request.query)
        return { hello: 'world' }
    })

    const create_user_opts = {
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                },
            }
        }
    }

    fastify.get('/create-user', async (request, reply) => {
        const { name: name } = request.query;
        let user_id = -1;
        fastify.pg.query('SELECT create_user ($1);', [name], (err, res) => {
            console.log(err, res.rows[0]);
            user_id = res.rows[0]['create_user'];
        })
        if (user_id === -1) throw new Error() // TODO: add error description
        // console.log(name)
        // console.log(request.query)
        console.log(user_id)
        return { user_id }
    })
}

export default routes;
