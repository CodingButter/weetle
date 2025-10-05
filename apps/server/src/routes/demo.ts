import { Elysia, t } from "elysia"

const Demo = new Elysia({ prefix: "/demo" })
  .get("/hello", () => ({
    message: "Hello from Weetle API!",
  }))
  .get("/protected", ({ user }) => ({
    message: `Hello ${user.name}!`,
    user,
  }), {
    auth: true,
  })

export default Demo
