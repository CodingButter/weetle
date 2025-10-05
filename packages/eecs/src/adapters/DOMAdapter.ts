/**
 * DOM Environment Adapter
 * Implements EECS interface for browser DOM
 */

import type { EnvironmentAdapter, EECSElement, QueryOptions } from '../types';

export class DOMAdapter implements EnvironmentAdapter {
  private eventHandlers = new Map<string, Set<(event: any) => void>>();

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

    const elements = Array.from(document.querySelectorAll(selector));
    return elements.map(el => this.wrapElement(el as HTMLElement));
  }

  getElementById(id: string): EECSElement | null {
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
    (element.native as HTMLElement).remove();
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
