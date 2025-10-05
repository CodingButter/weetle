/**
 * EECS World
 * Central orchestrator for systems and elements
 */

import type { EnvironmentAdapter, EECSElement, QueryOptions } from './types';
import type { System } from './System';

export class World {
  private systems: System[] = [];
  private adapter: EnvironmentAdapter;

  constructor(adapter: EnvironmentAdapter) {
    this.adapter = adapter;
  }

  /**
   * Register a system
   */
  registerSystem(system: System): void {
    this.systems.push(system);
    system.init?.();
  }

  /**
   * Unregister a system
   */
  unregisterSystem(system: System): void {
    const index = this.systems.indexOf(system);
    if (index !== -1) {
      system.destroy?.();
      this.systems.splice(index, 1);
    }
  }

  /**
   * Query elements using the adapter
   */
  query(options: QueryOptions): EECSElement[] {
    return this.adapter.query(options);
  }

  /**
   * Get element by ID
   */
  getElementById(id: string): EECSElement | null {
    return this.adapter.getElementById(id);
  }

  /**
   * Create element
   */
  createElement(type: string, components: string[] = []): EECSElement {
    return this.adapter.createElement(type, components);
  }

  /**
   * Remove element
   */
  removeElement(element: EECSElement): void {
    this.adapter.removeElement(element);
  }

  /**
   * Get the adapter (for systems to access environment-specific operations)
   */
  getAdapter(): EnvironmentAdapter {
    return this.adapter;
  }

  /**
   * Destroy world and all systems
   */
  destroy(): void {
    this.systems.forEach(system => system.destroy?.());
    this.systems = [];
  }
}
