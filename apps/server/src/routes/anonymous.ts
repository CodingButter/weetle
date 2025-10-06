/**
 * Anonymous Routes
 * Unauthenticated endpoints for anonymous collaboration
 */

import { Elysia, t } from 'elysia';
import { PrismaClient, CircleVisibility } from '@weetle/db';

const prisma = new PrismaClient();

export const anonymousRoutes = new Elysia({ prefix: '/anonymous' })
  /**
   * POST /anonymous/circles
   * Get or create an anonymous circle for a page
   */
  .post(
    '/circles',
    async ({ body }) => {
      const { pageKey } = body;

      // Use pageKey as the circle identifier for anonymous mode
      // This way everyone on the same page joins the same circle
      const circleId = `anon-${Buffer.from(pageKey).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20)}`;

      // Check if circle exists
      let circle = await prisma.circle.findUnique({
        where: { id: circleId },
      });

      // Create if doesn't exist
      if (!circle) {
        circle = await prisma.circle.create({
          data: {
            id: circleId,
            name: `Anonymous - ${pageKey}`,
            description: 'Anonymous collaboration circle',
            visibility: CircleVisibility.ANONYMOUS,
          },
        });
      }

      return { circle };
    },
    {
      body: t.Object({
        pageKey: t.String(),
      }),
    }
  )

  /**
   * POST /anonymous/layers
   * Get or create a layer for a circle and page
   */
  .post(
    '/layers',
    async ({ body }) => {
      const { circleId, pageKey } = body;

      // Check if layer exists
      let layer = await prisma.layer.findUnique({
        where: {
          circleId_pageKey: {
            circleId,
            pageKey,
          },
        },
      });

      // Create if doesn't exist
      if (!layer) {
        layer = await prisma.layer.create({
          data: {
            circleId,
            pageKey,
            title: pageKey,
          },
        });
      }

      return { layer };
    },
    {
      body: t.Object({
        circleId: t.String(),
        pageKey: t.String(),
      }),
    }
  );
