import  {type FastifyInstance, type RouteShorthandOptions} from "fastify";
import * as fastify from "fastify";

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

    function create_tokens(user_id: number) {
        const jwt_token = fastify.jwt.sign({ user_id, type: "access_token" })
        const refresh_token = fastify.jwt.sign({ user_id, type: "refresh_token" }, { expiresIn: '7d' })
        return {user_id: user_id, token: jwt_token, refresh_token: refresh_token}
    }

    fastify.get<{Querystring: {name?: string};}>('/create-user', async (request, reply) => {
        const { name: name } = request.query;
        const client = await fastify.pg.connect()
        const result: any = await client.query('SELECT create_user ($1);', [name]);
        client.release()
        const user_id = result.rows[0].create_user
        console.log(user_id)
        return create_tokens(user_id)
    })

    fastify.get('/update-token', async (request, reply) => {
        const refresh_token = request.headers.authorization?.split(" ")[1] ?? "";
        const payload: {user_id: number, type: string} = fastify.jwt.verify(refresh_token);
        console.log(payload)
        if (payload.type === "refresh_token") {
            const user_id = payload.user_id
            return create_tokens(user_id)
        }
        return {error: "Invalid token"}
        // console.log(typeof payload)
        // if (payload.type === "refresh_token") {

        // }

    })



}


export default routes;
