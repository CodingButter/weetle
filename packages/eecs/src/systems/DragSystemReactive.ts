/**
 * DragSystem (Reactive)
 * Pure logic system - no event listeners
 * Queries GlobalState to determine drag behavior
 */

import { System } from '../System';
import type { World } from '../World';
import type { GlobalState } from '../GlobalState';

export interface DragSystemConfig {
  globalState: GlobalState;
}

export class DragSystem extends System {
  private state: GlobalState;

  constructor(world: World, config: DragSystemConfig) {
    super(world);
    this.state = config.globalState;
  }

  /**
   * Update cycle - runs every frame
   * Pure logic, queries state, updates entities
   */
  update(): void {
    const { mouse, drag, source } = this.state;

    // Only process local user input (not peer updates)
    if (source.type === 'from-peer') {
      return;
    }

    // Check if we should start dragging
    if (!drag.dragging && mouse.buttons.left && mouse.target) {
      // Check if target is draggable
      if (this.hasComponent(mouse.target, 'draggable')) {
        this.startDrag(mouse.target);
      }
    }

    // Update drag position
    if (drag.dragging && mouse.buttons.left) {
      this.updateDrag();
    }

    // Stop dragging
    if (drag.dragging && !mouse.buttons.left) {
      this.stopDrag();
    }
  }

  /**
   * Start dragging an element
   */
  private startDrag(element: any): void {
    const pos = this.getPosition(element);
    const { mouse } = this.state;

    // Update drag state
    this.state.drag.dragging = element;
    this.state.drag.offset = {
      x: mouse.position.x - pos.x,
      y: mouse.position.y - pos.y,
    };
    this.state.drag.startPosition = { ...pos };

    // Queue state change
    this.queueStateChange({
      entityId: element.id,
      entityType: element.type,
      changeType: 'update',
      data: {
        dragging: true,
        dragOffsetX: this.state.drag.offset.x,
        dragOffsetY: this.state.drag.offset.y,
      },
      timestamp: performance.now(),
    });
  }

  /**
   * Update element position during drag
   */
  private updateDrag(): void {
    const { mouse, drag } = this.state;
    if (!drag.dragging) return;

    const newX = mouse.position.x - drag.offset.x;
    const newY = mouse.position.y - drag.offset.y;

    // Update position locally
    this.setPosition(drag.dragging, newX, newY);

    // Queue position update for batching
    this.queueStateChange({
      entityId: drag.dragging.id,
      entityType: drag.dragging.type,
      changeType: 'update',
      data: {
        x: newX,
        y: newY,
        dragging: true,
      },
      timestamp: performance.now(),
    });
  }

  /**
   * Stop dragging
   */
  private stopDrag(): void {
    const { drag } = this.state;
    if (!drag.dragging) return;

    const pos = this.getPosition(drag.dragging);

    // Queue final position
    this.queueStateChange({
      entityId: drag.dragging.id,
      entityType: drag.dragging.type,
      changeType: 'update',
      data: {
        x: pos.x,
        y: pos.y,
        dragging: false,
      },
      timestamp: performance.now(),
    });

    // Clear drag state
    this.state.drag.dragging = null;
    this.state.drag.offset = { x: 0, y: 0 };
    this.state.drag.startPosition = { x: 0, y: 0 };
  }

  /**
   * Emit state change as event
   * EECS is now purely local - no network sync
   * Use DOMReplicator to sync DOM changes over network
   */
  private queueStateChange(change: any): void {
    this.emit('state:change', change);
  }
}
