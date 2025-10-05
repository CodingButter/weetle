/**
 * EECS System Base Class
 * Systems subscribe to events and manipulate elements
 */

import type { World } from './World';
import type { EECSElement, QueryOptions, SystemHooks } from './types';

export abstract class System implements SystemHooks {
  protected world: World;

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Initialize system (setup event listeners, etc.)
   */
  init?(): void;

  /**
   * Cleanup system (remove event listeners, etc.)
   */
  destroy?(): void;

  /**
   * Query elements from world
   */
  protected query(options: QueryOptions): EECSElement[] {
    return this.world.query(options);
  }

  /**
   * Get element by ID
   */
  protected getElementById(id: string): EECSElement | null {
    return this.world.getElementById(id);
  }

  /**
   * Subscribe to events via adapter
   */
  protected on(eventType: string, handler: (event: any) => void): () => void {
    return this.world.getAdapter().on(eventType, handler);
  }

  /**
   * Emit events via adapter
   */
  protected emit(eventType: string, data: any): void {
    this.world.getAdapter().emit(eventType, data);
  }

  /**
   * Set element position
   */
  protected setPosition(element: EECSElement, x: number, y: number): void {
    this.world.getAdapter().setPosition(element, x, y);
  }

  /**
   * Get element position
   */
  protected getPosition(element: EECSElement): { x: number; y: number } {
    return this.world.getAdapter().getPosition(element);
  }

  /**
   * Check if element has component
   */
  protected hasComponent(element: EECSElement, component: string): boolean {
    return this.world.getAdapter().hasComponent(element, component);
  }

  /**
   * Add component to element
   */
  protected addComponent(element: EECSElement, component: string): void {
    this.world.getAdapter().addComponent(element, component);
  }

  /**
   * Remove component from element
   */
  protected removeComponent(element: EECSElement, component: string): void {
    this.world.getAdapter().removeComponent(element, component);
  }
}
