/**
 * MouseInputSystem
 * Input System that captures all mouse events and maintains global mouse state
 * Other systems query this state instead of adding their own event listeners
 */

import { System } from '../System';
import type { World } from '../World';
import type { EECSElement } from '../types';

export interface MouseState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  buttons: {
    left: boolean;
    right: boolean;
    middle: boolean;
  };
  target: EECSElement | null; // Element under cursor with EECS attributes
  wheel: number; // Accumulated wheel delta
  source: 'local-user' | 'from-peer'; // Track event source
}

export class MouseInputSystem extends System {
  private state: MouseState = {
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    buttons: {
      left: false,
      right: false,
      middle: false,
    },
    target: null,
    wheel: 0,
    source: 'local-user',
  };

  private lastPosition = { x: 0, y: 0 };
  private lastTime = 0;
  private unsubscribers: (() => void)[] = [];

  init(): void {
    // Single mousemove listener
    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const dt = now - this.lastTime;

      // Update velocity
      if (dt > 0) {
        this.state.velocity.x = (e.clientX - this.lastPosition.x) / dt;
        this.state.velocity.y = (e.clientY - this.lastPosition.y) / dt;
      }

      // Update position
      this.state.position.x = e.clientX;
      this.state.position.y = e.clientY;

      // Update target element
      this.updateTarget(e.target as HTMLElement);

      // Update source (local user interaction)
      this.state.source = 'local-user';

      this.lastPosition.x = e.clientX;
      this.lastPosition.y = e.clientY;
      this.lastTime = now;
    };

    // Mouse button listeners
    const handleMouseDown = (e: MouseEvent) => {
      this.updateButtonState(e.button, true);
      this.state.source = 'local-user';
      this.updateTarget(e.target as HTMLElement);
    };

    const handleMouseUp = (e: MouseEvent) => {
      this.updateButtonState(e.button, false);
      this.state.source = 'local-user';
    };

    // Wheel listener
    const handleWheel = (e: WheelEvent) => {
      this.state.wheel += e.deltaY;
      this.state.source = 'local-user';
    };

    // Context menu (right click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault(); // Prevent context menu for EECS elements
      this.state.source = 'local-user';
    };

    // Attach listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('wheel', handleWheel);
    document.addEventListener('contextmenu', handleContextMenu);

    // Store unsubscribers
    this.unsubscribers.push(
      () => document.removeEventListener('mousemove', handleMouseMove),
      () => document.removeEventListener('mousedown', handleMouseDown),
      () => document.removeEventListener('mouseup', handleMouseUp),
      () => document.removeEventListener('wheel', handleWheel),
      () => document.removeEventListener('contextmenu', handleContextMenu)
    );
  }

  destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  /**
   * Update which button is pressed/released
   */
  private updateButtonState(button: number, pressed: boolean): void {
    switch (button) {
      case 0:
        this.state.buttons.left = pressed;
        break;
      case 1:
        this.state.buttons.middle = pressed;
        break;
      case 2:
        this.state.buttons.right = pressed;
        break;
    }
  }

  /**
   * Update target element (finds EECS element under cursor)
   */
  private updateTarget(htmlElement: HTMLElement | null): void {
    if (!htmlElement) {
      this.state.target = null;
      return;
    }

    // Walk up DOM tree to find EECS entity
    let current: HTMLElement | null = htmlElement;
    while (current) {
      if (current.dataset.weetleEntity) {
        // Found EECS entity, get it from adapter
        const entityId = current.dataset.weetleId;
        if (entityId) {
          this.state.target = this.world.getAdapter().getElementById(entityId);
          return;
        }
      }
      current = current.parentElement;
    }

    this.state.target = null;
  }

  /**
   * Get current mouse state (read-only)
   */
  getState(): Readonly<MouseState> {
    return this.state;
  }

  /**
   * Update mouse state from remote peer
   */
  setStateFromPeer(peerState: Partial<MouseState>): void {
    // Merge peer state
    if (peerState.position) {
      this.state.position = { ...peerState.position };
    }
    if (peerState.buttons) {
      this.state.buttons = { ...peerState.buttons };
    }

    // Mark as from peer
    this.state.source = 'from-peer';
  }

  /**
   * Reset wheel accumulator (call after processing)
   */
  resetWheel(): void {
    this.state.wheel = 0;
  }
}
