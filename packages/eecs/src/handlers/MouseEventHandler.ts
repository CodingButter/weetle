/**
 * MouseEventHandler
 * Captures mouse events and updates GlobalState
 * This is NOT a system - just pure input capture
 */

import type { GlobalState } from '../GlobalState';
import type { EnvironmentAdapter } from '../types';

export class MouseEventHandler {
  private state: GlobalState;
  private adapter: EnvironmentAdapter;
  private lastPosition = { x: 0, y: 0 };
  private lastTime = 0;
  private unsubscribers: (() => void)[] = [];

  constructor(state: GlobalState, adapter: EnvironmentAdapter) {
    this.state = state;
    this.adapter = adapter;
  }

  /**
   * Start listening to mouse events
   */
  start(): void {
    const handleMouseMove = (e: MouseEvent) => {
      const now = performance.now();
      const dt = now - this.lastTime;

      // Update velocity
      if (dt > 0) {
        this.state.mouse.velocity.x = (e.clientX - this.lastPosition.x) / dt;
        this.state.mouse.velocity.y = (e.clientY - this.lastPosition.y) / dt;
      }

      // Update position
      this.state.mouse.position.x = e.clientX;
      this.state.mouse.position.y = e.clientY;

      // Update target element (walk up to find EECS entity)
      this.updateTarget(e.target as HTMLElement);

      // Mark as local user
      this.state.source.type = 'local-user';

      this.lastPosition.x = e.clientX;
      this.lastPosition.y = e.clientY;
      this.lastTime = now;
    };

    const handleMouseDown = (e: MouseEvent) => {
      this.updateButtonState(e.button, true);
      this.updateTarget(e.target as HTMLElement);
      this.state.source.type = 'local-user';
    };

    const handleMouseUp = (e: MouseEvent) => {
      this.updateButtonState(e.button, false);
      this.state.source.type = 'local-user';
    };

    const handleWheel = (e: WheelEvent) => {
      this.state.mouse.wheel += e.deltaY;
      this.state.source.type = 'local-user';
    };

    // Attach listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('wheel', handleWheel, { passive: true });

    // Store unsubscribers
    this.unsubscribers.push(
      () => document.removeEventListener('mousemove', handleMouseMove),
      () => document.removeEventListener('mousedown', handleMouseDown),
      () => document.removeEventListener('mouseup', handleMouseUp),
      () => document.removeEventListener('wheel', handleWheel)
    );
  }

  /**
   * Stop listening to mouse events
   */
  stop(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  /**
   * Update which button is pressed/released
   */
  private updateButtonState(button: number, pressed: boolean): void {
    switch (button) {
      case 0:
        this.state.mouse.buttons.left = pressed;
        break;
      case 1:
        this.state.mouse.buttons.middle = pressed;
        break;
      case 2:
        this.state.mouse.buttons.right = pressed;
        break;
    }
  }

  /**
   * Update target element (finds EECS element under cursor)
   */
  private updateTarget(htmlElement: HTMLElement | null): void {
    if (!htmlElement) {
      this.state.mouse.target = null;
      return;
    }

    // Walk up DOM tree to find EECS entity
    let current: HTMLElement | null = htmlElement;
    while (current) {
      if (current.dataset.weetleEntity) {
        const entityId = current.dataset.weetleId;
        if (entityId) {
          this.state.mouse.target = this.adapter.getElementById(entityId);
          return;
        }
      }
      current = current.parentElement;
    }

    this.state.mouse.target = null;
  }

  /**
   * Update mouse state from remote peer
   */
  updateFromPeer(peerState: {
    position?: { x: number; y: number };
    buttons?: { left?: boolean; right?: boolean; middle?: boolean };
  }): void {
    if (peerState.position) {
      this.state.mouse.position = { ...peerState.position };
    }
    if (peerState.buttons) {
      this.state.mouse.buttons = { ...this.state.mouse.buttons, ...peerState.buttons };
    }

    // Mark as from peer
    this.state.source.type = 'from-peer';
  }
}
