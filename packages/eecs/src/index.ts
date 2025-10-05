/**
 * EECS - Element Event Component System
 * A DOM-native ECS for collaborative web applications
 */

// Core types
export type {
  EECSElement,
  Component,
  EventMetadata,
  SystemHooks,
  QueryOptions,
  EnvironmentAdapter,
} from './types';

// Batching types
export type {
  StateChange,
  StateUpdateBatch,
  BatchCollector,
} from './batching';

export { DefaultBatchCollector } from './batching';

// Core classes
export { World } from './World';
export { System } from './System';

// Systems
export { StateSyncSystem } from './systems/StateSyncSystem';
export { DragSystem } from './systems/DragSystem';

// Adapters
export { DOMAdapter } from './adapters/DOMAdapter';
export { CanvasAdapter } from './adapters/CanvasAdapter';
