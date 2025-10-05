import { PrismaClient, Role, Permission } from "@weetle/db";

const prisma = new PrismaClient();

/**
 * Layer Service
 * Handles all business logic for Layer operations
 */
export class LayerService {
  /**
   * Canonicalize a URL to create a consistent pageKey
   */
  canonicalizeUrl(url: string): string {
    const parsed = new URL(url);

    // Remove fragment
    parsed.hash = "";

    // Remove tracking params
    const trackerParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "msclkid",
    ];

    trackerParams.forEach((param) => parsed.searchParams.delete(param));

    // Sort remaining params
    const sortedParams = new URLSearchParams(
      Array.from(parsed.searchParams.entries()).sort()
    );

    const queryString = sortedParams.toString();
    return `${parsed.origin}${parsed.pathname}${queryString ? "?" + queryString : ""}`;
  }

  /**
   * Get or create a layer for a circle and page
   */
  async getOrCreateLayer(circleId: string, pageUrl: string, userId: string) {
    // Get circle to check visibility
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
    });

    if (!circle) {
      throw new Error("Circle not found");
    }

    // Only check membership for non-anonymous circles
    if (circle.visibility !== "ANONYMOUS") {
      const membership = await prisma.circleMembership.findFirst({
        where: {
          circleId,
          userId,
        },
      });

      if (!membership) {
        throw new Error("You are not a member of this circle");
      }
    }

    const pageKey = this.canonicalizeUrl(pageUrl);

    // Try to find existing layer
    let layer = await prisma.layer.findUnique({
      where: {
        circleId_pageKey: {
          circleId,
          pageKey,
        },
      },
      include: {
        marks: true,
        messages: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50, // Last 50 messages
        },
        sessions: {
          orderBy: {
            startedAt: "desc",
          },
          take: 10, // Last 10 sessions
        },
      },
    });

    // Create if doesn't exist
    if (!layer) {
      layer = await prisma.layer.create({
        data: {
          circleId,
          pageKey,
          title: pageUrl,
        },
        include: {
          marks: true,
          messages: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  image: true,
                },
              },
            },
          },
          sessions: true,
        },
      });
    }

    return layer;
  }

  /**
   * Get a layer by ID
   */
  async getLayer(layerId: string, userId: string) {
    const layer = await prisma.layer.findUnique({
      where: { id: layerId },
      include: {
        circle: {
          include: {
            memberships: {
              where: { userId },
            },
          },
        },
        marks: true,
        messages: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
        sessions: {
          orderBy: {
            startedAt: "desc",
          },
          take: 10,
        },
      },
    });

    if (!layer) {
      return null;
    }

    // Check if user is a member
    if (layer.circle.memberships.length === 0) {
      return null;
    }

    return layer;
  }

  /**
   * Create a mark (sticky note, highlight, etc.)
   */
  async createMark(
    layerId: string,
    userId: string,
    kind: string,
    payload: any
  ) {
    // Check if user has access
    const layer = await this.getLayer(layerId, userId);
    if (!layer) {
      throw new Error("Layer not found or you don't have access");
    }

    // Check permissions (if set)
    if (layer.permissionLevel) {
      const membership = layer.circle.memberships[0];
      const canEdit = this.checkPermission(
        membership.role,
        layer.permissionLevel
      );

      if (!canEdit) {
        throw new Error("You don't have permission to edit this layer");
      }
    }

    return await prisma.mark.create({
      data: {
        layerId,
        kind: kind as any,
        payload: JSON.stringify(payload),
        createdBy: userId,
      },
    });
  }

  /**
   * Update a mark
   */
  async updateMark(markId: string, userId: string, payload: any) {
    const mark = await prisma.mark.findUnique({
      where: { id: markId },
      include: {
        layer: {
          include: {
            circle: {
              include: {
                memberships: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!mark) {
      throw new Error("Mark not found");
    }

    // Check if user has access
    if (mark.layer.circle.memberships.length === 0) {
      throw new Error("You don't have access to this layer");
    }

    // Check permissions
    if (mark.layer.permissionLevel) {
      const membership = mark.layer.circle.memberships[0];
      const canEdit = this.checkPermission(
        membership.role,
        mark.layer.permissionLevel
      );

      if (!canEdit) {
        throw new Error("You don't have permission to edit this layer");
      }
    }

    return await prisma.mark.update({
      where: { id: markId },
      data: {
        payload: JSON.stringify(payload),
      },
    });
  }

  /**
   * Delete a mark
   */
  async deleteMark(markId: string, userId: string) {
    const mark = await prisma.mark.findUnique({
      where: { id: markId },
      include: {
        layer: {
          include: {
            circle: {
              include: {
                memberships: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!mark) {
      throw new Error("Mark not found");
    }

    // Check if user has access
    if (mark.layer.circle.memberships.length === 0) {
      throw new Error("You don't have access to this layer");
    }

    // Check if user is owner or admin, or if they created the mark
    const membership = mark.layer.circle.memberships[0];
    const isOwnerOrAdmin = [Role.OWNER, Role.ADMIN].includes(membership.role);
    const isCreator = mark.createdBy === userId;

    if (!isOwnerOrAdmin && !isCreator) {
      throw new Error("You can only delete your own marks");
    }

    await prisma.mark.delete({
      where: { id: markId },
    });

    return { success: true };
  }

  /**
   * Check if a role satisfies a permission level
   */
  private checkPermission(role: Role, permissionLevel: Permission): boolean {
    switch (permissionLevel) {
      case Permission.OWNER_ONLY:
        return role === Role.OWNER;
      case Permission.ADMIN_AND_ABOVE:
        return [Role.OWNER, Role.ADMIN].includes(role);
      case Permission.MEMBER_AND_ABOVE:
        return [Role.OWNER, Role.ADMIN, Role.MEMBER].includes(role);
      case Permission.ALL:
        return true;
      default:
        return false;
    }
  }

  /**
   * Post a chat message
   */
  async postMessage(layerId: string, userId: string, text: string) {
    // Check if user has access
    const layer = await this.getLayer(layerId, userId);
    if (!layer) {
      throw new Error("Layer not found or you don't have access");
    }

    return await prisma.chatMessage.create({
      data: {
        layerId,
        userId,
        text,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });
  }
}

export const layerService = new LayerService();
