/**
 * EECS - Element Event Component System
 * Core type definitions (Environment Agnostic)
 */

/**
 * Generic Element interface
 * Abstracts away DOM/Canvas/Native specifics
 */
export interface EECSElement {
  id: string;
  type: string;
  components: Set<string>;
  metadata: Record<string, any>;

  // Environment-specific reference (DOM node, Canvas object, etc.)
  native: any;
}

/**
 * Component marker interface
 * Components are identified via data attributes
 */
export interface Component {
  type: string; // e.g., "draggable", "resizable", "colorable"
  element: EECSElement;
}

/**
 * Event enrichment metadata
 * Systems can add metadata to events before broadcast
 */
export interface EventMetadata {
  [key: string]: any;
}

/**
 * System lifecycle hooks
 */
export interface SystemHooks {
  init?(): void;
  destroy?(): void;
}

/**
 * Query options for finding elements
 */
export interface QueryOptions {
  /** Entity type filter */
  entityType?: string;
  /** Component filters (must have all) */
  components?: string[];
  /** Additional selector (environment-specific) */
  selector?: string;
}

/**
 * Environment Adapter Interface
 * Abstracts environment-specific operations
 */
export interface EnvironmentAdapter {
  /**
   * Query elements matching criteria
   */
  query(options: QueryOptions): EECSElement[];

  /**
   * Get element by ID
   */
  getElementById(id: string): EECSElement | null;

  /**
   * Set element position
   */
  setPosition(element: EECSElement, x: number, y: number): void;

  /**
   * Get element position
   */
  getPosition(element: EECSElement): { x: number; y: number };

  /**
   * Subscribe to events
   */
  on(eventType: string, handler: (event: any) => void): () => void;

  /**
   * Emit events
   */
  emit(eventType: string, data: any): void;

  /**
   * Create new element
   */
  createElement(type: string, components: string[]): EECSElement;

  /**
   * Remove element
   */
  removeElement(element: EECSElement): void;

  /**
   * Check if element has component
   */
  hasComponent(element: EECSElement, component: string): boolean;

  /**
   * Add component to element
   */
  addComponent(element: EECSElement, component: string): void;

  /**
   * Remove component from element
   */
  removeComponent(element: EECSElement, component: string): void;
}
