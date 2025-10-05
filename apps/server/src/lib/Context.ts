import { Elysia } from "elysia"
import { staticPlugin } from "@elysiajs/static"
import { cors } from "@elysiajs/cors"
import { auth } from "./auth"
import { prisma } from "./utils"

const betterAuth = new Elysia({ name: "better-auth" })
  .use(cors())
  .mount(auth.handler)
  .macro({
    auth: {
      async resolve({ status, request: { headers } }) {
        const session = await auth.api.getSession({
          headers,
        })

        if (!session) return status(401)

        return {
          user: session.user,
          session: session.session,
        }
      },
    },
  })

const fileServe = new Elysia().use(
  staticPlugin({
    assets: `${process.cwd()}/uploads`,
    prefix: "/uploads",
  })
)

const app = new Elysia()
  .use(betterAuth)
  .use(fileServe)
  .macro({
    db: {
      resolve() {
        return { prisma }
      },
    },
  })

export default app
