import { Elysia } from "elysia";
import { auth } from "../lib/auth";

/**
 * Authentication routes using BetterAuth
 * Handles sign-up, sign-in, sign-out, and session management
 */
export const authRoutes = new Elysia({ prefix: "/api/auth" })
  // Mount all BetterAuth routes (sign-in, sign-up, sign-out, etc.)
  .all("/*", ({ request }) => auth.handler(request))

  // Get current user session
  .get("/session", async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session) {
      return {
        user: null,
        session: null,
      };
    }

    return {
      user: session.user,
      session: session.session,
    };
  });
