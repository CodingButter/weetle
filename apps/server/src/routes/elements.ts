/**
 * Elements API Routes
 */

import { Elysia, t } from 'elysia';
import * as elementService from '../services/element.service';

export const elementsRoutes = new Elysia({ prefix: '/elements' })
  /**
   * GET /elements/:layerId
   * Fetch all elements for a layer
   */
  .get(
    '/:layerId',
    async ({ params }) => {
      const { layerId } = params;
      const state = await elementService.getLayerElements(layerId);
      return state;
    },
    {
      params: t.Object({
        layerId: t.String(),
      }),
    }
  )

  /**
   * POST /elements
   * Upsert a single element
   */
  .post(
    '/',
    async ({ body }) => {
      await elementService.upsertElement(body);
      return { success: true };
    },
    {
      body: t.Object({
        id: t.String(),
        layerId: t.String(),
        parentId: t.Optional(t.String()),
        elementType: t.String(),
        data: t.String(), // JSON string
        createdBy: t.String(),
      }),
    }
  )

  /**
   * POST /elements/batch
   * Upsert multiple elements
   */
  .post(
    '/batch',
    async ({ body }) => {
      await elementService.upsertElements(body.elements);
      return { success: true };
    },
    {
      body: t.Object({
        elements: t.Array(
          t.Object({
            id: t.String(),
            layerId: t.String(),
            parentId: t.Optional(t.String()),
            elementType: t.String(),
            data: t.String(),
            createdBy: t.String(),
          })
        ),
      }),
    }
  )

  /**
   * DELETE /elements/:id
   * Delete an element
   */
  .delete(
    '/:id',
    async ({ params }) => {
      await elementService.deleteElement(params.id);
      return { success: true };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    }
  )

  /**
   * POST /elements/delete-batch
   * Delete multiple elements
   */
  .post(
    '/delete-batch',
    async ({ body }) => {
      await elementService.deleteElements(body.ids);
      return { success: true };
    },
    {
      body: t.Object({
        ids: t.Array(t.String()),
      }),
    }
  );
