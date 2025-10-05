import { PrismaClient, Role, CircleVisibility } from "@weetle/db";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

/**
 * Circle Service
 * Handles all business logic for Circle operations
 */
export class CircleService {
  /**
   * Create a new circle with the creator as owner
   */
  async createCircle(userId: string, name: string, description?: string) {
    return await prisma.circle.create({
      data: {
        name,
        description,
        memberships: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get all circles a user belongs to
   */
  async getUserCircles(userId: string) {
    const memberships = await prisma.circleMembership.findMany({
      where: { userId },
      include: {
        circle: {
          include: {
            memberships: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    image: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.circle,
      myRole: m.role,
    }));
  }

  /**
   * Get a specific circle by ID
   */
  async getCircle(circleId: string, userId: string) {
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    if (!circle) {
      return null;
    }

    // Check if user is a member
    const membership = circle.memberships.find((m) => m.userId === userId);
    if (!membership) {
      return null; // User is not a member
    }

    return {
      ...circle,
      myRole: membership.role,
    };
  }

  /**
   * Create an invite code for a circle
   */
  async createInvite(
    circleId: string,
    userId: string,
    expiresAt?: Date,
    maxUses?: number
  ) {
    // Check if user is owner or admin
    const membership = await prisma.circleMembership.findFirst({
      where: {
        circleId,
        userId,
        role: { in: [Role.OWNER, Role.ADMIN] },
      },
    });

    if (!membership) {
      throw new Error("Only owners and admins can create invites");
    }

    return await prisma.invite.create({
      data: {
        circleId,
        code: nanoid(10), // 10-character random code
        expiresAt,
        maxUses,
      },
    });
  }

  /**
   * Accept an invite and join a circle
   */
  async acceptInvite(inviteCode: string, userId: string) {
    const invite = await prisma.invite.findUnique({
      where: { code: inviteCode },
      include: { circle: true },
    });

    if (!invite) {
      throw new Error("Invalid invite code");
    }

    // Check if invite is expired
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new Error("Invite has expired");
    }

    // Check if invite has reached max uses
    if (invite.maxUses && invite.useCount >= invite.maxUses) {
      throw new Error("Invite has reached maximum uses");
    }

    // Check if user is already a member
    const existingMembership = await prisma.circleMembership.findFirst({
      where: {
        circleId: invite.circleId,
        userId,
      },
    });

    if (existingMembership) {
      throw new Error("You are already a member of this circle");
    }

    // Create membership and increment invite use count
    const [membership] = await prisma.$transaction([
      prisma.circleMembership.create({
        data: {
          userId,
          circleId: invite.circleId,
          role: Role.MEMBER,
        },
        include: {
          circle: true,
        },
      }),
      prisma.invite.update({
        where: { id: invite.id },
        data: { useCount: { increment: 1 } },
      }),
    ]);

    return membership.circle;
  }

  /**
   * Remove a member from a circle
   */
  async removeMember(
    circleId: string,
    userId: string,
    targetUserId: string
  ) {
    // Check if requesting user is owner or admin
    const membership = await prisma.circleMembership.findFirst({
      where: {
        circleId,
        userId,
        role: { in: [Role.OWNER, Role.ADMIN] },
      },
    });

    if (!membership) {
      throw new Error("Only owners and admins can remove members");
    }

    // Can't remove yourself
    if (userId === targetUserId) {
      throw new Error("Cannot remove yourself");
    }

    // Can't remove owner
    const targetMembership = await prisma.circleMembership.findFirst({
      where: {
        circleId,
        userId: targetUserId,
      },
    });

    if (targetMembership?.role === Role.OWNER) {
      throw new Error("Cannot remove the circle owner");
    }

    await prisma.circleMembership.delete({
      where: { id: targetMembership!.id },
    });

    return { success: true };
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    circleId: string,
    userId: string,
    targetUserId: string,
    newRole: Role
  ) {
    // Only owner can change roles
    const membership = await prisma.circleMembership.findFirst({
      where: {
        circleId,
        userId,
        role: Role.OWNER,
      },
    });

    if (!membership) {
      throw new Error("Only the owner can change member roles");
    }

    // Can't change your own role
    if (userId === targetUserId) {
      throw new Error("Cannot change your own role");
    }

    const targetMembership = await prisma.circleMembership.findFirst({
      where: {
        circleId,
        userId: targetUserId,
      },
    });

    if (!targetMembership) {
      throw new Error("User is not a member of this circle");
    }

    return await prisma.circleMembership.update({
      where: { id: targetMembership.id },
      data: { role: newRole },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });
  }

  /**
   * Get or create an anonymous public circle for a specific page URL
   * Used for instant collaboration without authentication
   */
  async getOrCreatePublicCircle(pageUrl: string) {
    // Normalize URL (remove query params and hash)
    const url = new URL(pageUrl);
    const normalizedUrl = `${url.protocol}//${url.host}${url.pathname}`;

    // Try to find existing public circle for this URL
    let circle = await prisma.circle.findFirst({
      where: {
        visibility: CircleVisibility.ANONYMOUS,
        name: normalizedUrl,
      },
    });

    // Create if doesn't exist
    if (!circle) {
      circle = await prisma.circle.create({
        data: {
          name: normalizedUrl,
          description: `Public collaboration for ${normalizedUrl}`,
          visibility: CircleVisibility.ANONYMOUS,
        },
      });

      console.log(`[Circle] Created public circle for ${normalizedUrl}`);
    }

    return circle;
  }
}

export const circleService = new CircleService();
