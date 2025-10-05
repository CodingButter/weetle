import { Elysia, t } from "elysia";
import { circleService } from "../services/circle.service";
import { auth } from "../lib/auth";
import { Role } from "@weetle/db";

/**
 * Circle routes
 * Handles circle CRUD, invites, and member management
 */
export const circleRoutes = new Elysia({ prefix: "/api/circles" })
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

  // Get all circles for current user
  .get("/", async ({ userId }) => {
    const circles = await circleService.getUserCircles(userId);
    return { circles };
  })

  // Create a new circle
  .post(
    "/",
    async ({ userId, body }) => {
      const circle = await circleService.createCircle(
        userId,
        body.name,
        body.description
      );
      return { circle };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String({ maxLength: 500 })),
      }),
    }
  )

  // Get a specific circle
  .get("/:circleId", async ({ userId, params }) => {
    const circle = await circleService.getCircle(params.circleId, userId);

    if (!circle) {
      throw new Error("Circle not found or you don't have access");
    }

    return { circle };
  })

  // Create an invite for a circle
  .post(
    "/:circleId/invite",
    async ({ userId, params, body }) => {
      const invite = await circleService.createInvite(
        params.circleId,
        userId,
        body.expiresAt ? new Date(body.expiresAt) : undefined,
        body.maxUses
      );

      return { invite };
    },
    {
      body: t.Object({
        expiresAt: t.Optional(t.String()),
        maxUses: t.Optional(t.Number()),
      }),
    }
  )

  // Accept an invite
  .post(
    "/join/:inviteCode",
    async ({ userId, params }) => {
      const circle = await circleService.acceptInvite(
        params.inviteCode,
        userId
      );

      return { circle };
    }
  )

  // Remove a member from a circle
  .delete(
    "/:circleId/members/:memberId",
    async ({ userId, params }) => {
      const result = await circleService.removeMember(
        params.circleId,
        userId,
        params.memberId
      );

      return result;
    }
  )

  // Update a member's role
  .patch(
    "/:circleId/members/:memberId/role",
    async ({ userId, params, body }) => {
      const member = await circleService.updateMemberRole(
        params.circleId,
        userId,
        params.memberId,
        body.role
      );

      return { member };
    },
    {
      body: t.Object({
        role: t.Enum(Role),
      }),
    }
  );
