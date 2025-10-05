/**
 * GlobalState
 * Single source of truth for all input and system state
 * Updated by event handlers, queried by systems
 */

import type { EECSElement } from './types';

export interface MouseState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  buttons: {
    left: boolean;
    right: boolean;
    middle: boolean;
  };
  target: EECSElement | null;
  wheel: number;
}

export interface KeyboardState {
  keys: Set<string>;
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

export interface DragState {
  dragging: EECSElement | null; // Element being dragged, or null
  offset: { x: number; y: number };
  startPosition: { x: number; y: number };
}

export interface EventSource {
  type: 'local-user' | 'from-peer';
  peerId?: string;
}

export class GlobalState {
  mouse: MouseState = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    buttons: {
      left: false,
      right: false,
      middle: false,
    },
    target: null,
    wheel: 0,
  };

  keyboard: KeyboardState = {
    keys: new Set(),
    modifiers: {
      shift: false,
      ctrl: false,
      alt: false,
      meta: false,
    },
  };

  drag: DragState = {
    dragging: null,
    offset: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
  };

  // Track source of last state update
  source: EventSource = {
    type: 'local-user',
  };

  // Previous state snapshot for delta comparison
  private previousState: string | null = null;

  /**
   * Check if state has changed since last snapshot
   */
  hasChanged(): boolean {
    const current = this.serialize();
    const changed = current !== this.previousState;
    if (changed) {
      this.previousState = current;
    }
    return changed;
  }

  /**
   * Serialize state for comparison
   */
  private serialize(): string {
    return JSON.stringify({
      mouse: {
        ...this.mouse,
        target: this.mouse.target?.id || null, // Only serialize ID
      },
      keyboard: {
        keys: Array.from(this.keyboard.keys),
        modifiers: this.keyboard.modifiers,
      },
      drag: {
        dragging: this.drag.dragging?.id || null, // Only serialize ID
        offset: this.drag.offset,
        startPosition: this.drag.startPosition,
      },
    });
  }

  /**
   * Create a snapshot for delta comparison
   */
  snapshot(): void {
    this.previousState = this.serialize();
  }

  /**
   * Reset state (useful for testing or cleanup)
   */
  reset(): void {
    this.mouse.position = { x: 0, y: 0 };
    this.mouse.velocity = { x: 0, y: 0 };
    this.mouse.buttons = { left: false, right: false, middle: false };
    this.mouse.target = null;
    this.mouse.wheel = 0;

    this.keyboard.keys.clear();
    this.keyboard.modifiers = { shift: false, ctrl: false, alt: false, meta: false };

    this.drag.dragging = null;
    this.drag.offset = { x: 0, y: 0 };
    this.drag.startPosition = { x: 0, y: 0 };

    this.source = { type: 'local-user' };
    this.previousState = null;
  }
}
