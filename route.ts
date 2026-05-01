import type {FastifyInstance, RouteShorthandOptions} from "fastify";

async function routes (fastify: FastifyInstance, options: Object) {
    const opts: RouteShorthandOptions = {
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
            request.log.debug(err, res.rows[0])
            console.log(err, res.rows[0])
        });
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

    fastify.get<{Querystring: {name?: string};}>('/create-user', async (request, reply) => {
        const { name: name } = request.query;
        let user_id = -1;
        fastify.pg.query('SELECT create_user ($1);', [name], (err, res) => {
            console.log(err, res.rows[0]);
            user_id = res.rows[0]['create_user'];
        })
        if (user_id === -1) throw new Error() // TODO: add error description
        console.log(user_id)

        return { user_id }
    })
}

export default routes;
