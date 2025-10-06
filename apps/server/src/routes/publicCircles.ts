/**
 * Public Circles Routes
 * Endpoints for managing public circles with optional password protection
 * No authentication required - uses circle passwords for access control
 */

import { Elysia, t } from 'elysia';
import { PrismaClient, CircleVisibility } from '@weetle/db';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Verify circle access (check password if protected)
 */
async function verifyCircleAccess(circleId: string, password?: string): Promise<boolean> {
  const circle = await prisma.circle.findUnique({
    where: { id: circleId },
    select: { passwordHash: true, visibility: true },
  });

  if (!circle) return false;

  // Only allow PUBLIC circles through this API
  if (circle.visibility !== CircleVisibility.PUBLIC) return false;

  // If no password set, it's open access
  if (!circle.passwordHash) return true;

  // If password required but not provided
  if (!password) return false;

  // Verify password
  return bcrypt.compare(password, circle.passwordHash);
}

/**
 * Get or create the default anonymous circle
 */
async function getDefaultCircle() {
  const DEFAULT_CIRCLE_ID = 'anonymous-default';

  let circle = await prisma.circle.findUnique({
    where: { id: DEFAULT_CIRCLE_ID },
  });

  // Create default circle if it doesn't exist
  if (!circle) {
    circle = await prisma.circle.create({
      data: {
        id: DEFAULT_CIRCLE_ID,
        name: 'Anonymous Collaboration',
        description: 'Default public circle for anonymous collaboration',
        visibility: CircleVisibility.PUBLIC,
        // No password for default circle
      },
    });
  }

  return circle;
}

export const publicCircleRoutes = new Elysia({ prefix: '/public' })
  /**
   * GET /public/circles/default
   * Get the default anonymous circle
   */
  .get('/circles/default', async () => {
    const circle = await getDefaultCircle();

    return {
      circle: {
        id: circle.id,
        name: circle.name,
        description: circle.description,
        isProtected: false,
      }
    };
  })

  /**
   * POST /public/circles/create
   * Create a new public circle
   */
  .post(
    '/circles/create',
    async ({ body }) => {
      const { name, description, password } = body;

      // Generate circle ID
      const circleId = `circle-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Hash password if provided
      let passwordHash: string | null = null;
      if (password) {
        passwordHash = await bcrypt.hash(password, 10);
      }

      const circle = await prisma.circle.create({
        data: {
          id: circleId,
          name,
          description: description || `Public circle: ${name}`,
          passwordHash,
          visibility: CircleVisibility.PUBLIC,
        },
      });

      return {
        circle: {
          id: circle.id,
          name: circle.name,
          description: circle.description,
          isProtected: !!circle.passwordHash,
        }
      };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String({ maxLength: 500 })),
        password: t.Optional(t.String({ minLength: 4, maxLength: 100 })),
      }),
    }
  )

  /**
   * POST /public/circles/join
   * Join a circle (verify password if needed)
   */
  .post(
    '/circles/join',
    async ({ body, set }) => {
      const { circleId, password } = body;

      const hasAccess = await verifyCircleAccess(circleId, password);

      if (!hasAccess) {
        set.status = 401;
        return { error: 'Invalid password or circle not found' };
      }

      const circle = await prisma.circle.findUnique({
        where: { id: circleId },
        select: {
          id: true,
          name: true,
          description: true,
          passwordHash: true,
        },
      });

      return {
        success: true,
        circle: {
          id: circle!.id,
          name: circle!.name,
          description: circle!.description,
          isProtected: !!circle!.passwordHash,
        }
      };
    },
    {
      body: t.Object({
        circleId: t.String(),
        password: t.Optional(t.String()),
      }),
    }
  )

  /**
   * GET /public/circles/:id
   * Get circle info (public info only)
   */
  .get(
    '/circles/:id',
    async ({ params, set }) => {
      const circle = await prisma.circle.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          name: true,
          description: true,
          passwordHash: true,
          visibility: true,
        },
      });

      if (!circle) {
        set.status = 404;
        return { error: 'Circle not found' };
      }

      // Only return PUBLIC circles
      if (circle.visibility !== CircleVisibility.PUBLIC) {
        set.status = 404;
        return { error: 'Circle not found' };
      }

      return {
        circle: {
          id: circle.id,
          name: circle.name,
          description: circle.description,
          isProtected: !!circle.passwordHash,
        }
      };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  /**
   * POST /public/layers
   * Get or create a layer for a circle and page (with auth)
   * If no circleId provided, uses default anonymous circle
   */
  .post(
    '/layers',
    async ({ body, set }) => {
      const { circleId, pageKey, password } = body;

      let actualCircleId = circleId;

      // If no circle ID provided, use default circle
      if (!circleId) {
        const defaultCircle = await getDefaultCircle();
        actualCircleId = defaultCircle.id;
      } else {
        // Verify access for non-default circles
        const hasAccess = await verifyCircleAccess(circleId, password);

        if (!hasAccess) {
          set.status = 401;
          return { error: 'Unauthorized' };
        }
      }

      // Check if layer exists
      let layer = await prisma.layer.findUnique({
        where: {
          circleId_pageKey: {
            circleId: actualCircleId,
            pageKey,
          },
        },
      });

      // Create if doesn't exist
      if (!layer) {
        layer = await prisma.layer.create({
          data: {
            circleId: actualCircleId,
            pageKey,
            title: pageKey,
          },
        });
      }

      return { layer };
    },
    {
      body: t.Object({
        circleId: t.Optional(t.String()),
        pageKey: t.String(),
        password: t.Optional(t.String()),
      }),
    }
  )

  /**
   * GET /public/circles
   * List all public circles (for discovery)
   */
  .get('/circles', async () => {
    const circles = await prisma.circle.findMany({
      where: {
        visibility: CircleVisibility.PUBLIC,
      },
      select: {
        id: true,
        name: true,
        description: true,
        passwordHash: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to recent 100
    });

    return {
      circles: circles.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        isProtected: !!c.passwordHash,
        createdAt: c.createdAt,
      })),
    };
  });