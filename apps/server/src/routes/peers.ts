import { Elysia, t } from "elysia";
import { circleService } from "../services/circle.service";
import { layerService } from "../services/layer.service";
import { PrismaClient } from "@weetle/db";

const prisma = new PrismaClient();

/**
 * Peer discovery routes
 * Handles peer registration and discovery for P2P connections
 * These routes are unauthenticated to support anonymous mode
 */

// Clean up stale anonymous participants (not seen in > 30 seconds)
const STALE_THRESHOLD = 30000;
setInterval(async () => {
  const staleTime = new Date(Date.now() - STALE_THRESHOLD);

  try {
    const result = await prisma.anonymousParticipant.updateMany({
      where: {
        lastSeenAt: { lt: staleTime },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count > 0) {
      console.log(`[Peers] Marked ${result.count} stale peers as inactive`);
    }
  } catch (error) {
    console.error("[Peers] Error cleaning up stale peers:", error);
  }
}, 10000); // Clean every 10 seconds

export const peerRoutes = new Elysia({ prefix: "/api/peers" })
  /**
   * Register a peer for a page URL and get list of other peers
   * POST /api/peers/register
   */
  .post(
    "/register",
    async ({ body }) => {
      const { pageUrl, peerId, userId, displayName } = body;

      // Get or create public circle for this page
      const circle = await circleService.getOrCreatePublicCircle(pageUrl);

      // Get or create layer for this circle and page
      // For anonymous mode, we use a system user ID (null is not allowed, so use a placeholder)
      const ANONYMOUS_SYSTEM_USER = "anonymous-system";
      const layer = await layerService.getOrCreateLayer(
        circle.id,
        pageUrl,
        ANONYMOUS_SYSTEM_USER
      );

      // Register or update anonymous participant
      const participant = await prisma.anonymousParticipant.upsert({
        where: { peerId },
        update: {
          lastSeenAt: new Date(),
          isActive: true,
        },
        create: {
          peerId,
          displayName,
          layerId: layer.id,
          isActive: true,
        },
      });

      console.log(
        `[Peers] Registered peer ${peerId} (${displayName}) on layer ${layer.id}`
      );

      // Get other active peers on this layer
      const otherPeers = await prisma.anonymousParticipant.findMany({
        where: {
          layerId: layer.id,
          isActive: true,
          peerId: { not: peerId },
        },
        select: {
          peerId: true,
          displayName: true,
          joinedAt: true,
        },
      });

      return {
        success: true,
        circleId: circle.id,
        layerId: layer.id,
        peers: otherPeers,
        totalPeers: otherPeers.length + 1,
      };
    },
    {
      body: t.Object({
        pageUrl: t.String(),
        peerId: t.String(),
        userId: t.String(),
        displayName: t.Optional(t.String()),
      }),
    }
  )

  /**
   * Heartbeat to keep peer registration alive
   * POST /api/peers/heartbeat
   */
  .post(
    "/heartbeat",
    async ({ body }) => {
      const { peerId } = body;

      try {
        await prisma.anonymousParticipant.update({
          where: { peerId },
          data: {
            lastSeenAt: new Date(),
            isActive: true,
          },
        });

        return { success: true };
      } catch (error) {
        return { success: false, error: "Peer not found" };
      }
    },
    {
      body: t.Object({
        peerId: t.String(),
      }),
    }
  )

  /**
   * Get list of active peers on a layer
   * GET /api/peers/:layerId
   */
  .get("/:layerId", async ({ params }) => {
    const peers = await prisma.anonymousParticipant.findMany({
      where: {
        layerId: params.layerId,
        isActive: true,
      },
      select: {
        peerId: true,
        displayName: true,
        joinedAt: true,
      },
    });

    return {
      peers,
      totalPeers: peers.length,
    };
  })

  /**
   * Unregister a peer
   * DELETE /api/peers/:peerId
   */
  .delete("/:peerId", async ({ params }) => {
    try {
      await prisma.anonymousParticipant.update({
        where: { peerId: params.peerId },
        data: { isActive: false },
      });

      console.log(`[Peers] Unregistered peer ${params.peerId}`);

      return { success: true };
    } catch (error) {
      return { success: false, error: "Peer not found" };
    }
  });
