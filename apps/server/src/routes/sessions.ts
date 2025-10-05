import { Elysia, t } from "elysia";
import { sessionService } from "../services/session.service";
import { auth } from "../lib/auth";
import { createEvent, EventType } from "@weetle/db/session-events";

/**
 * Session routes
 * Handles session recording and replay
 */
export const sessionRoutes = new Elysia({ prefix: "/api/sessions" })
  // Middleware to require authentication
  .derive(async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    return {
      userId: session.user.id,
      user: session.user,
    };
  })

  // Start a new session
  .post(
    "/start",
    async ({ userId, body }) => {
      const session = await sessionService.startSession(
        body.layerId,
        userId
      );

      return { session };
    },
    {
      body: t.Object({
        layerId: t.String(),
      }),
    }
  )

  // Append events to a session
  .post(
    "/:sessionId/events",
    async ({ params, body }) => {
      const result = await sessionService.appendEvents(
        params.sessionId,
        body.events
      );

      return result;
    },
    {
      body: t.Object({
        events: t.Array(
          t.Object({
            id: t.String(),
            userId: t.String(),
            eventType: t.String(),
            payload: t.Any(),
            timestamp: t.Number(),
            sequence: t.Number(),
          })
        ),
      }),
    }
  )

  // End a session
  .post("/:sessionId/end", async ({ params }) => {
    const result = await sessionService.endSession(params.sessionId);
    return result;
  })

  // Get events from a session (for replay)
  .get(
    "/:sessionId/events",
    async ({ userId, params, query }) => {
      const result = await sessionService.getSessionEvents(
        params.sessionId,
        userId,
        query.startTimestamp ? Number(query.startTimestamp) : undefined,
        query.limit ? Number(query.limit) : 100
      );

      return result;
    },
    {
      query: t.Object({
        startTimestamp: t.Optional(t.String()),
        limit: t.Optional(t.String()),
      }),
    }
  )

  // Download a session file
  .get("/:sessionId/download", async ({ userId, params }) => {
    const filePath = await sessionService.getSessionFilePath(
      params.sessionId,
      userId
    );

    return Bun.file(filePath);
  })

  // Get all sessions for a layer
  .get(
    "/layer/:layerId",
    async ({ userId, params }) => {
      const sessions = await sessionService.getLayerSessions(
        params.layerId,
        userId
      );

      return { sessions };
    }
  );
