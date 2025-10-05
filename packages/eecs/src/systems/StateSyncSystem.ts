/**
 * StateSyncSystem
 * Batches state changes and broadcasts them on a timer
 */

import { System } from '../System';
import type { World } from '../World';
import { DefaultBatchCollector, type BatchCollector, type StateChange, type StateUpdateBatch } from '../batching';

export interface StateSyncConfig {
  /**
   * Batch interval in milliseconds (default: 16ms for ~60fps)
   */
  batchInterval?: number;

  /**
   * Custom batch collector (defaults to DefaultBatchCollector)
   */
  batchCollector?: BatchCollector;

  /**
   * Callback for broadcasting batches
   */
  onBatchReady?: (batch: StateUpdateBatch) => void;
}

export class StateSyncSystem extends System {
  private batchCollector: BatchCollector;
  private batchInterval: number;
  private intervalId?: ReturnType<typeof setInterval>;
  private onBatchReady?: (batch: StateUpdateBatch) => void;

  constructor(world: World, config: StateSyncConfig = {}) {
    super(world);
    this.batchCollector = config.batchCollector || new DefaultBatchCollector();
    this.batchInterval = config.batchInterval ?? 16; // ~60fps
    this.onBatchReady = config.onBatchReady;
  }

  init(): void {
    // Start the batch timer
    this.intervalId = setInterval(() => {
      this.flushBatch();
    }, this.batchInterval);
  }

  destroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Queue a state change to be included in the next batch
   */
  queueChange(change: StateChange): void {
    this.batchCollector.queueChange(change);
  }

  /**
   * Flush pending changes and broadcast them
   */
  private flushBatch(): void {
    const pendingChanges = this.batchCollector.flush();

    if (pendingChanges.length === 0) {
      return; // Nothing to send
    }

    const optimizedChanges = this.batchCollector.optimize(pendingChanges);

    const batch: StateUpdateBatch = {
      timestamp: Date.now(),
      changes: optimizedChanges,
    };

    // Broadcast via callback
    if (this.onBatchReady) {
      this.onBatchReady(batch);
    }

    // Also emit as event
    this.emit('state:batch', batch);
  }

  /**
   * Force immediate flush (useful for critical updates)
   */
  forceFlush(): void {
    this.flushBatch();
  }
}
