/**
 * DOM Replicator Types
 * Framework-agnostic DOM replication
 */

export interface DOMDelta {
  entityId: string;
  timestamp: number;
  changes: DOMChange[];
}

export interface DOMChange {
  type: 'attribute' | 'style' | 'text' | 'create' | 'delete';
  property?: string;
  value?: any;
  oldValue?: any;
}

export interface ReplicationConfig {
  /**
   * Selector for elements to replicate (default: '[data-replicate]')
   */
  selector?: string;

  /**
   * Batch interval in ms (default: 16ms for ~60fps)
   */
  batchInterval?: number;

  /**
   * Callback when deltas are ready to send
   */
  onDeltasReady?: (deltas: DOMDelta[]) => void;

  /**
   * Filter function to exclude certain changes
   */
  shouldReplicate?: (element: Element, change: DOMChange) => boolean;
}

export interface DOMReplicatorStats {
  totalDeltas: number;
  totalBytes: number;
  lastBatchSize: number;
  observedElements: number;
}
