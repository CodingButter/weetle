import { Elysia, t } from "elysia";
import { layerService } from "../services/layer.service";
import { auth } from "../lib/auth";
import { MarkKind } from "@weetle/db";

/**
 * Layer routes
 * Handles layer creation, marks, and messages
 */
export const layerRoutes = new Elysia({ prefix: "/api/layers" })
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

  // Get or create a layer for a circle and page
  .post(
    "/",
    async ({ userId, body }) => {
      const layer = await layerService.getOrCreateLayer(
        body.circleId,
        body.pageUrl,
        userId
      );

      return { layer };
    },
    {
      body: t.Object({
        circleId: t.String(),
        pageUrl: t.String(),
      }),
    }
  )

  // Get a specific layer
  .get("/:layerId", async ({ userId, params }) => {
    const layer = await layerService.getLayer(params.layerId, userId);

    if (!layer) {
      throw new Error("Layer not found or you don't have access");
    }

    return { layer };
  })

  // Create a mark on a layer
  .post(
    "/:layerId/marks",
    async ({ userId, params, body }) => {
      const mark = await layerService.createMark(
        params.layerId,
        userId,
        body.kind,
        body.payload
      );

      return { mark };
    },
    {
      body: t.Object({
        kind: t.Enum(MarkKind),
        payload: t.Any(),
      }),
    }
  )

  // Update a mark
  .patch(
    "/marks/:markId",
    async ({ userId, params, body }) => {
      const mark = await layerService.updateMark(
        params.markId,
        userId,
        body.payload
      );

      return { mark };
    },
    {
      body: t.Object({
        payload: t.Any(),
      }),
    }
  )

  // Delete a mark
  .delete("/marks/:markId", async ({ userId, params }) => {
    const result = await layerService.deleteMark(params.markId, userId);
    return result;
  })

  // Post a chat message
  .post(
    "/:layerId/messages",
    async ({ userId, params, body }) => {
      const message = await layerService.postMessage(
        params.layerId,
        userId,
        body.text
      );

      return { message };
    },
    {
      body: t.Object({
        text: t.String({ minLength: 1, maxLength: 1000 }),
      }),
    }
  );
