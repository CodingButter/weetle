/**
 * DOM Environment Adapter
 * Implements EECS interface for browser DOM
 */

import type { EnvironmentAdapter, EECSElement, QueryOptions } from '../types';

export class DOMAdapter implements EnvironmentAdapter {
  private eventHandlers = new Map<string, Set<(event: any) => void>>();
  private componentRegistry = new Map<string, HTMLElement>(); // Registry for shadow DOM components

  /**
   * Register a component (useful for shadow DOM elements)
   */
  registerComponent(element: HTMLElement): void {
    const id = element.dataset.weetleId;
    if (id) {
      this.componentRegistry.set(id, element);
    }
  }

  /**
   * Unregister a component
   */
  unregisterComponent(id: string): void {
    this.componentRegistry.delete(id);
  }

  query(options: QueryOptions): EECSElement[] {
    let selector = '[data-weetle-entity]';

    if (options.entityType) {
      selector += `[data-weetle-entity="${options.entityType}"]`;
    }

    if (options.components) {
      options.components.forEach(comp => {
        selector += `[data-weetle-${comp}]`;
      });
    }

    if (options.selector) {
      selector += options.selector;
    }

    // Query DOM elements
    const domElements = Array.from(document.querySelectorAll(selector));
    const results = domElements.map(el => this.wrapElement(el as HTMLElement));

    // Also check component registry
    const registryElements = Array.from(this.componentRegistry.values())
      .filter(el => {
        // Match entity type
        if (options.entityType && el.dataset.weetleEntity !== options.entityType) {
          return false;
        }

        // Match components
        if (options.components) {
          return options.components.every(comp => {
            const attrName = `weetle${comp.charAt(0).toUpperCase() + comp.slice(1)}`;
            return el.dataset[attrName] === 'true';
          });
        }

        return true;
      })
      .filter(el => !domElements.includes(el)); // Avoid duplicates

    results.push(...registryElements.map(el => this.wrapElement(el)));

    return results;
  }

  getElementById(id: string): EECSElement | null {
    // Check registry first (faster for shadow DOM components)
    const registryEl = this.componentRegistry.get(id);
    if (registryEl) {
      return this.wrapElement(registryEl);
    }

    // Fallback to DOM query
    const el = document.querySelector(`[data-weetle-id="${id}"]`);
    return el ? this.wrapElement(el as HTMLElement) : null;
  }

  setPosition(element: EECSElement, x: number, y: number): void {
    const el = element.native as HTMLElement;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

  getPosition(element: EECSElement): { x: number; y: number } {
    const el = element.native as HTMLElement;
    const rect = el.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  on(eventType: string, handler: (event: any) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)!.add(handler);

    // DOM event listener
    document.addEventListener(eventType, handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(eventType)?.delete(handler);
      document.removeEventListener(eventType, handler);
    };
  }

  emit(eventType: string, data: any): void {
    const event = new CustomEvent(eventType, { detail: data });
    document.dispatchEvent(event);
  }

  createElement(type: string, components: string[]): EECSElement {
    const el = document.createElement('div');
    el.dataset.weetleEntity = type;
    el.dataset.weetleId = crypto.randomUUID();

    components.forEach(comp => {
      el.dataset[`weetle${comp.charAt(0).toUpperCase() + comp.slice(1)}`] = 'true';
    });

    document.body.appendChild(el);
    return this.wrapElement(el);
  }

  removeElement(element: EECSElement): void {
    const el = element.native as HTMLElement;

    // Unregister from component registry if present
    if (element.id) {
      this.unregisterComponent(element.id);
    }

    el.remove();
  }

  hasComponent(element: EECSElement, component: string): boolean {
    return element.components.has(component);
  }

  addComponent(element: EECSElement, component: string): void {
    const el = element.native as HTMLElement;
    el.dataset[`weetle${component.charAt(0).toUpperCase() + component.slice(1)}`] = 'true';
    element.components.add(component);
  }

  removeComponent(element: EECSElement, component: string): void {
    const el = element.native as HTMLElement;
    delete el.dataset[`weetle${component.charAt(0).toUpperCase() + component.slice(1)}`];
    element.components.delete(component);
  }

  /**
   * Wrap DOM element in EECS element interface
   */
  private wrapElement(el: HTMLElement): EECSElement {
    const components = new Set<string>();

    // Extract components from data attributes
    Object.keys(el.dataset).forEach(key => {
      if (key.startsWith('weetle') && key !== 'weetleEntity' && key !== 'weetleId') {
        const componentName = key.replace('weetle', '').toLowerCase();
        components.add(componentName);
      }
    });

    return {
      id: el.dataset.weetleId || '',
      type: el.dataset.weetleEntity || '',
      components,
      metadata: { ...el.dataset },
      native: el,
    };
  }
}
