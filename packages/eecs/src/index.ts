/**
 * EECS - Element Event Component System
 * A DOM-native ECS for local interactions
 * Use @weetle/dom-replicator for network sync
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

// Core classes
export { World } from './World';
export { System } from './System';

// Reactive Architecture
export { GlobalState } from './GlobalState';
export type {
  MouseState,
  KeyboardState,
  DragState,
  EventSource,
} from './GlobalState';

export { MouseEventHandler } from './handlers/MouseEventHandler';

// Systems
export { DragSystem } from './systems/DragSystemReactive';
export type { DragSystemConfig } from './systems/DragSystemReactive';

// Adapters
export { DOMAdapter } from './adapters/DOMAdapter';
export { CanvasAdapter } from './adapters/CanvasAdapter';
