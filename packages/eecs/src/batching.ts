/**
 * State Batching System
 * Collects and optimizes state changes before broadcasting
 */

export interface StateChange {
  entityId: string;
  entityType: string;
  changeType: 'create' | 'update' | 'delete' | 'component';
  data: Record<string, any>;
  timestamp: number; // Use performance.now() for microsecond precision
}

export interface StateUpdateBatch {
  timestamp: number;
  changes: StateChange[];
}

export interface BatchCollector {
  /**
   * Queue a state change to be sent in the next batch
   */
  queueChange(change: StateChange): void;

  /**
   * Get current pending changes and clear the queue
   */
  flush(): StateChange[];

  /**
   * Optimize changes (merge duplicates, remove redundant updates)
   */
  optimize(changes: StateChange[]): StateChange[];
}

export class DefaultBatchCollector implements BatchCollector {
  private pendingChanges: Map<string, StateChange> = new Map();

  queueChange(change: StateChange): void {
    // Use entity ID + change type as key to automatically dedupe
    const key = `${change.entityId}:${change.changeType}`;

    const existing = this.pendingChanges.get(key);

    if (existing && change.changeType === 'update') {
      // Merge update data
      existing.data = { ...existing.data, ...change.data };
      existing.timestamp = change.timestamp;
    } else {
      this.pendingChanges.set(key, change);
    }
  }

  flush(): StateChange[] {
    const changes = Array.from(this.pendingChanges.values());
    this.pendingChanges.clear();
    return changes;
  }

  optimize(changes: StateChange[]): StateChange[] {
    // Already optimized by the Map deduplication
    // But we can add more logic here if needed

    // Sort by timestamp for deterministic ordering
    return changes.sort((a, b) => a.timestamp - b.timestamp);
  }
}
