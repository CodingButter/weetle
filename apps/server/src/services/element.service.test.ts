import { describe, it, expect, beforeEach, beforeAll } from 'bun:test';
import '../test-setup'; // Load environment variables
import * as elementService from './element.service';
import type { ElementData } from './element.service';
import { PrismaClient } from '@weetle/db';

const prisma = new PrismaClient();

describe('ElementService', () => {
  const testLayerId = 'test-layer-123';
  const testUserId = 'test-user-456';
  const testCircleId = 'test-circle-123';

  beforeAll(async () => {
    // Setup test data: create circle and layer
    await prisma.circle.upsert({
      where: { id: testCircleId },
      create: {
        id: testCircleId,
        name: 'Test Circle',
        visibility: 'PRIVATE',
      },
      update: {},
    });

    await prisma.layer.upsert({
      where: { id: testLayerId },
      create: {
        id: testLayerId,
        circleId: testCircleId,
        pageKey: 'https://example.com/test',
      },
      update: {},
    });
  });

  beforeEach(async () => {
    // Clear any existing test data
    const elements = await elementService.getLayerElements(testLayerId);
    if (elements.elements.length > 0) {
      const ids = elements.elements.map((el: any) => el.id);
      await elementService.deleteElements(ids);
    }
  });

  describe('upsertElement', () => {
    it('should create a new element', async () => {
      const elementData: ElementData = {
        id: 'note-1',
        layerId: testLayerId,
        elementType: 'sticky-note',
        data: JSON.stringify({ x: 100, y: 200, content: 'Test note' }),
        createdBy: testUserId,
      };

      await elementService.upsertElement(elementData);

      const state = await elementService.getLayerElements(testLayerId);
      expect(state.elements).toHaveLength(1);
      expect(state.elements[0].id).toBe('note-1');
      expect(state.elements[0].elementType).toBe('sticky-note');
    });

    it('should update an existing element', async () => {
      const elementData: ElementData = {
        id: 'note-1',
        layerId: testLayerId,
        elementType: 'sticky-note',
        data: JSON.stringify({ x: 100, y: 200, content: 'Original' }),
        createdBy: testUserId,
      };

      await elementService.upsertElement(elementData);

      // Update
      elementData.data = JSON.stringify({ x: 150, y: 250, content: 'Updated' });
      await elementService.upsertElement(elementData);

      const state = await elementService.getLayerElements(testLayerId);
      expect(state.elements).toHaveLength(1);
      expect(state.elements[0].data.content).toBe('Updated');
    });

    it('should invalidate cache on upsert', async () => {
      const elementData: ElementData = {
        id: 'note-1',
        layerId: testLayerId,
        elementType: 'sticky-note',
        data: JSON.stringify({ x: 100, y: 200 }),
        createdBy: testUserId,
      };

      // First fetch - cache miss
      await elementService.getLayerElements(testLayerId);

      // Upsert - should invalidate
      await elementService.upsertElement(elementData);

      // Second fetch - should get fresh data
      const state = await elementService.getLayerElements(testLayerId);
      expect(state.elements).toHaveLength(1);
    });
  });

  describe('upsertElements (batch)', () => {
    it('should create multiple elements', async () => {
      const elements: ElementData[] = [
        {
          id: 'note-1',
          layerId: testLayerId,
          elementType: 'sticky-note',
          data: JSON.stringify({ x: 100, y: 200 }),
          createdBy: testUserId,
        },
        {
          id: 'note-2',
          layerId: testLayerId,
          elementType: 'sticky-note',
          data: JSON.stringify({ x: 300, y: 400 }),
          createdBy: testUserId,
        },
      ];

      await elementService.upsertElements(elements);

      const state = await elementService.getLayerElements(testLayerId);
      expect(state.elements).toHaveLength(2);
    });
  });

  describe('getLayerElements', () => {
    it('should return cached state on second call', async () => {
      const elementData: ElementData = {
        id: 'note-1',
        layerId: testLayerId,
        elementType: 'sticky-note',
        data: JSON.stringify({ x: 100, y: 200 }),
        createdBy: testUserId,
      };

      await elementService.upsertElement(elementData);

      // First call - cache miss
      const state1 = await elementService.getLayerElements(testLayerId);

      // Second call - cache hit
      const state2 = await elementService.getLayerElements(testLayerId);

      expect(state1).toEqual(state2);
    });

    it('should return empty state for non-existent layer', async () => {
      const state = await elementService.getLayerElements('non-existent-layer');
      expect(state.elements).toHaveLength(0);
    });
  });

  describe('deleteElement', () => {
    it('should delete an element', async () => {
      const elementData: ElementData = {
        id: 'note-1',
        layerId: testLayerId,
        elementType: 'sticky-note',
        data: JSON.stringify({ x: 100, y: 200 }),
        createdBy: testUserId,
      };

      await elementService.upsertElement(elementData);
      await elementService.deleteElement('note-1');

      const state = await elementService.getLayerElements(testLayerId);
      expect(state.elements).toHaveLength(0);
    });

    it('should invalidate cache on delete', async () => {
      const elementData: ElementData = {
        id: 'note-1',
        layerId: testLayerId,
        elementType: 'sticky-note',
        data: JSON.stringify({ x: 100, y: 200 }),
        createdBy: testUserId,
      };

      await elementService.upsertElement(elementData);
      await elementService.getLayerElements(testLayerId); // Cache it

      await elementService.deleteElement('note-1');

      const state = await elementService.getLayerElements(testLayerId);
      expect(state.elements).toHaveLength(0);
    });
  });

  describe('deleteElements (batch)', () => {
    it('should delete multiple elements', async () => {
      const elements: ElementData[] = [
        {
          id: 'note-1',
          layerId: testLayerId,
          elementType: 'sticky-note',
          data: JSON.stringify({ x: 100, y: 200 }),
          createdBy: testUserId,
        },
        {
          id: 'note-2',
          layerId: testLayerId,
          elementType: 'sticky-note',
          data: JSON.stringify({ x: 300, y: 400 }),
          createdBy: testUserId,
        },
      ];

      await elementService.upsertElements(elements);
      await elementService.deleteElements(['note-1', 'note-2']);

      const state = await elementService.getLayerElements(testLayerId);
      expect(state.elements).toHaveLength(0);
    });
  });
});
