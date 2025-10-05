/**
 * DragSystem
 * Handles dragging elements with the 'draggable' component
 */

import { System } from '../System';
import type { World } from '../World';
import type { EECSElement } from '../types';
import type { StateSyncSystem } from './StateSyncSystem';

export interface DragSystemConfig {
  /**
   * Reference to StateSyncSystem for batching updates
   */
  stateSyncSystem?: StateSyncSystem;
}

export class DragSystem extends System {
  private draggedElement: EECSElement | null = null;
  private dragOffset = { x: 0, y: 0 };
  private unsubscribers: (() => void)[] = [];
  private stateSyncSystem?: StateSyncSystem;

  constructor(world: World, config: DragSystemConfig = {}) {
    super(world);
    this.stateSyncSystem = config.stateSyncSystem;
  }

  init(): void {
    // Listen for mouse events
    const onMouseDown = this.on('mousedown', this.handleMouseDown.bind(this));
    const onMouseMove = this.on('mousemove', this.handleMouseMove.bind(this));
    const onMouseUp = this.on('mouseup', this.handleMouseUp.bind(this));

    this.unsubscribers.push(onMouseDown, onMouseMove, onMouseUp);
  }

  destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  private handleMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Find draggable element
    const draggableElements = this.query({ components: ['draggable'] });

    for (const element of draggableElements) {
      const nativeEl = element.native as HTMLElement;

      if (nativeEl.contains(target)) {
        this.draggedElement = element;

        const pos = this.getPosition(element);
        this.dragOffset = {
          x: event.clientX - pos.x,
          y: event.clientY - pos.y,
        };

        // Queue drag start event
        this.queueStateChange({
          entityId: element.id,
          entityType: element.type,
          changeType: 'update',
          data: {
            dragging: true,
            dragOffsetX: this.dragOffset.x,
            dragOffsetY: this.dragOffset.y,
          },
          timestamp: performance.now(),
        });

        event.preventDefault();
        break;
      }
    }
  }

  private handleMouseMove(event: MouseEvent): void {
    if (!this.draggedElement) return;

    const newX = event.clientX - this.dragOffset.x;
    const newY = event.clientY - this.dragOffset.y;

    // Update position locally
    this.setPosition(this.draggedElement, newX, newY);

    // Queue position update for batching
    this.queueStateChange({
      entityId: this.draggedElement.id,
      entityType: this.draggedElement.type,
      changeType: 'update',
      data: {
        x: newX,
        y: newY,
        dragging: true,
      },
      timestamp: performance.now(),
    });
  }

  private handleMouseUp(_event: MouseEvent): void {
    if (!this.draggedElement) return;

    const pos = this.getPosition(this.draggedElement);

    // Queue final position update
    this.queueStateChange({
      entityId: this.draggedElement.id,
      entityType: this.draggedElement.type,
      changeType: 'update',
      data: {
        x: pos.x,
        y: pos.y,
        dragging: false,
      },
      timestamp: performance.now(),
    });

    this.draggedElement = null;
  }

  private queueStateChange(change: any): void {
    if (this.stateSyncSystem) {
      this.stateSyncSystem.queueChange(change);
    } else {
      // Fallback: emit directly if no batch system
      this.emit('state:change', change);
    }
  }
}
