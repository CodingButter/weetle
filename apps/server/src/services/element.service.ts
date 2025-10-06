/**
 * Element Service
 * Handles element CRUD operations with caching
 */

import { PrismaClient } from '@weetle/db';

const prisma = new PrismaClient();

// In-memory cache for layer states
const stateCache = new Map<string, any>();

export interface ElementData {
  id: string;
  layerId: string;
  parentId?: string;
  elementType: string;
  data: string; // JSON serialized
  createdBy: string;
}

/**
 * Get cache key for layer
 */
function getCacheKey(layerId: string): string {
  return `layer:${layerId}:state`;
}

/**
 * Invalidate layer cache
 */
function invalidateCache(layerId: string): void {
  const key = getCacheKey(layerId);
  stateCache.delete(key);
  console.log('[ElementService] Invalidated cache for:', layerId);
}

/**
 * Fetch all elements for a layer (with caching)
 */
export async function getLayerElements(layerId: string): Promise<any> {
  const cacheKey = getCacheKey(layerId);

  // Check cache
  if (stateCache.has(cacheKey)) {
    console.log('[ElementService] Cache HIT for:', layerId);
    return stateCache.get(cacheKey);
  }

  console.log('[ElementService] Cache MISS for:', layerId);

  // Query database
  const elements = await prisma.element.findMany({
    where: { layerId },
    orderBy: { createdAt: 'asc' },
  });

  // Build state object
  const state = {
    layerId,
    elements: elements.map(el => ({
      id: el.id,
      parentId: el.parentId,
      elementType: el.elementType,
      data: JSON.parse(el.data),
      createdBy: el.createdBy,
      createdAt: el.createdAt.getTime(),
      updatedAt: el.updatedAt.getTime(),
    })),
    version: 1,
    updatedAt: Date.now(),
  };

  // Cache it
  stateCache.set(cacheKey, state);

  return state;
}

/**
 * Upsert an element
 */
export async function upsertElement(elementData: ElementData): Promise<void> {
  await prisma.element.upsert({
    where: { id: elementData.id },
    create: {
      id: elementData.id,
      layerId: elementData.layerId,
      parentId: elementData.parentId,
      elementType: elementData.elementType,
      data: elementData.data,
      createdBy: elementData.createdBy,
    },
    update: {
      data: elementData.data,
      updatedAt: new Date(),
    },
  });

  // Invalidate cache
  invalidateCache(elementData.layerId);
}

/**
 * Upsert multiple elements (batch)
 */
export async function upsertElements(elements: ElementData[]): Promise<void> {
  if (elements.length === 0) return;

  // Use transaction for atomicity
  await prisma.$transaction(
    elements.map(el =>
      prisma.element.upsert({
        where: { id: el.id },
        create: {
          id: el.id,
          layerId: el.layerId,
          parentId: el.parentId,
          elementType: el.elementType,
          data: el.data,
          createdBy: el.createdBy,
        },
        update: {
          data: el.data,
          updatedAt: new Date(),
        },
      })
    )
  );

  // Invalidate cache for all affected layers
  const layerIds = new Set(elements.map(el => el.layerId));
  layerIds.forEach(invalidateCache);
}

/**
 * Delete an element (and its children via cascade)
 */
export async function deleteElement(id: string): Promise<void> {
  const element = await prisma.element.findUnique({ where: { id } });
  if (!element) return;

  await prisma.element.delete({ where: { id } });

  // Invalidate cache
  invalidateCache(element.layerId);
}

/**
 * Delete multiple elements
 */
export async function deleteElements(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  // Get affected layers before deletion
  const elements = await prisma.element.findMany({
    where: { id: { in: ids } },
    select: { layerId: true },
  });

  await prisma.element.deleteMany({
    where: { id: { in: ids } },
  });

  // Invalidate cache for affected layers
  const layerIds = new Set(elements.map(el => el.layerId));
  layerIds.forEach(invalidateCache);
}
