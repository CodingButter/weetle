/**
 * Canvas Environment Adapter
 * Implements EECS interface for HTML Canvas / Game Engines
 */

import type { EnvironmentAdapter, EECSElement, QueryOptions } from '../types';

interface CanvasObject {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  components: Set<string>;
  metadata: Record<string, any>;
}

export class CanvasAdapter implements EnvironmentAdapter {
  private objects = new Map<string, CanvasObject>();
  private eventHandlers = new Map<string, Set<(event: any) => void>>();

  constructor(private canvas: HTMLCanvasElement) {}

  query(options: QueryOptions): EECSElement[] {
    let results = Array.from(this.objects.values());

    if (options.entityType) {
      results = results.filter(obj => obj.type === options.entityType);
    }

    if (options.components) {
      results = results.filter(obj =>
        options.components!.every(comp => obj.components.has(comp))
      );
    }

    return results.map(obj => this.wrapObject(obj));
  }

  getElementById(id: string): EECSElement | null {
    const obj = this.objects.get(id);
    return obj ? this.wrapObject(obj) : null;
  }

  setPosition(element: EECSElement, x: number, y: number): void {
    const obj = element.native as CanvasObject;
    obj.x = x;
    obj.y = y;
  }

  getPosition(element: EECSElement): { x: number; y: number } {
    const obj = element.native as CanvasObject;
    return { x: obj.x, y: obj.y };
  }

  on(eventType: string, handler: (event: any) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler);

    // Canvas event listener
    this.canvas.addEventListener(eventType, handler);

    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
      this.canvas.removeEventListener(eventType, handler);
    };
  }

  emit(eventType: string, data: any): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  createElement(type: string, components: string[]): EECSElement {
    const obj: CanvasObject = {
      id: crypto.randomUUID(),
      type,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      components: new Set(components),
      metadata: {},
    };

    this.objects.set(obj.id, obj);
    return this.wrapObject(obj);
  }

  removeElement(element: EECSElement): void {
    this.objects.delete(element.id);
  }

  hasComponent(element: EECSElement, component: string): boolean {
    return element.components.has(component);
  }

  addComponent(element: EECSElement, component: string): void {
    const obj = element.native as CanvasObject;
    obj.components.add(component);
    element.components.add(component);
  }

  removeComponent(element: EECSElement, component: string): void {
    const obj = element.native as CanvasObject;
    obj.components.delete(component);
    element.components.delete(component);
  }

  private wrapObject(obj: CanvasObject): EECSElement {
    return {
      id: obj.id,
      type: obj.type,
      components: new Set(obj.components),
      metadata: { ...obj.metadata },
      native: obj,
    };
  }
}
