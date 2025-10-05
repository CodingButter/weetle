/**
 * DOMReplicator
 * Universal DOM replication using MutationObserver
 * Works with EECS, React, Vue, vanilla JS, or any framework
 */

import type { DOMDelta, DOMChange, ReplicationConfig, DOMReplicatorStats } from './types';

export class DOMReplicator {
  private config: Required<ReplicationConfig>;
  private observer: MutationObserver | null = null;
  private pendingDeltas = new Map<string, DOMDelta>();
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private ignoreNextMutation = false;
  private stats: DOMReplicatorStats = {
    totalDeltas: 0,
    totalBytes: 0,
    lastBatchSize: 0,
    observedElements: 0,
  };

  constructor(config: ReplicationConfig = {}) {
    this.config = {
      selector: config.selector || '[data-replicate]',
      batchInterval: config.batchInterval ?? 16, // ~60fps
      onDeltasReady: config.onDeltasReady || (() => {}),
      shouldReplicate: config.shouldReplicate || (() => true),
    };
  }

  /**
   * Start observing DOM changes
   */
  start(): void {
    // Create MutationObserver
    this.observer = new MutationObserver((mutations) => {
      if (this.ignoreNextMutation) {
        this.ignoreNextMutation = false;
        return;
      }

      this.handleMutations(mutations);
    });

    // Observe all elements matching selector
    const elements = document.querySelectorAll(this.config.selector);
    elements.forEach(el => {
      this.observer!.observe(el, {
        attributes: true,
        attributeOldValue: true,
        childList: true,
        characterData: true,
        characterDataOldValue: true,
        subtree: true,
      });
    });

    this.stats.observedElements = elements.length;

    // Start batch timer
    this.batchTimer = setInterval(() => {
      this.flushDeltas();
    }, this.config.batchInterval);

    console.log(`[DOMReplicator] Started observing ${elements.length} elements`);
  }

  /**
   * Stop observing
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.pendingDeltas.clear();
  }

  /**
   * Handle mutation records
   */
  private handleMutations(mutations: MutationRecord[]): void {
    for (const mutation of mutations) {
      const target = mutation.target as Element;

      // Get entity ID from target or closest replicated element
      const entityId = this.getEntityId(target);
      if (!entityId) continue;

      // Create or get existing delta
      if (!this.pendingDeltas.has(entityId)) {
        this.pendingDeltas.set(entityId, {
          entityId,
          timestamp: performance.now(),
          changes: [],
        });
      }

      const delta = this.pendingDeltas.get(entityId)!;

      // Convert mutation to change
      const change = this.mutationToChange(mutation);
      if (change && this.config.shouldReplicate(target, change)) {
        delta.changes.push(change);
      }
    }
  }

  /**
   * Convert MutationRecord to DOMChange
   */
  private mutationToChange(mutation: MutationRecord): DOMChange | null {
    switch (mutation.type) {
      case 'attributes':
        const attrName = mutation.attributeName!;
        const target = mutation.target as Element;

        // Handle style attribute specially
        if (attrName === 'style') {
          return {
            type: 'style',
            property: 'cssText',
            value: (target as HTMLElement).style.cssText,
            oldValue: mutation.oldValue,
          };
        }

        return {
          type: 'attribute',
          property: attrName,
          value: target.getAttribute(attrName),
          oldValue: mutation.oldValue,
        };

      case 'characterData':
        return {
          type: 'text',
          value: mutation.target.textContent,
          oldValue: mutation.oldValue,
        };

      case 'childList':
        // For now, we'll handle this as a full element sync
        // TODO: More granular child node tracking
        return null;

      default:
        return null;
    }
  }

  /**
   * Get entity ID from element
   */
  private getEntityId(element: Element | Node): string | null {
    let el: Element | null;

    if (!(element instanceof Element)) {
      el = element.parentElement;
      if (!el) return null;
    } else {
      el = element;
    }

    // Check for data-replicate-id or data-weetle-id
    const htmlEl = el as HTMLElement;
    return htmlEl.dataset?.replicateId || htmlEl.dataset?.weetleId || null;
  }

  /**
   * Flush pending deltas
   */
  private flushDeltas(): void {
    if (this.pendingDeltas.size === 0) {
      return;
    }

    const deltas = Array.from(this.pendingDeltas.values());
    this.pendingDeltas.clear();

    // Update stats
    this.stats.totalDeltas += deltas.length;
    this.stats.lastBatchSize = deltas.length;
    const serialized = JSON.stringify(deltas);
    this.stats.totalBytes += serialized.length;

    // Send deltas
    this.config.onDeltasReady(deltas);
  }

  /**
   * Apply received deltas to local DOM
   * IMPORTANT: This bypasses the MutationObserver to prevent ping-pong
   */
  applyDeltas(deltas: DOMDelta[]): void {
    // Temporarily ignore mutations
    this.ignoreNextMutation = true;

    for (const delta of deltas) {
      const element = this.findElement(delta.entityId);
      if (!element) {
        console.warn(`[DOMReplicator] Element not found: ${delta.entityId}`);
        continue;
      }

      for (const change of delta.changes) {
        this.applyChange(element, change);
      }
    }
  }

  /**
   * Find element by ID
   */
  private findElement(entityId: string): HTMLElement | null {
    // Try data-replicate-id first
    let el = document.querySelector(`[data-replicate-id="${entityId}"]`);

    // Fallback to data-weetle-id
    if (!el) {
      el = document.querySelector(`[data-weetle-id="${entityId}"]`);
    }

    return el as HTMLElement | null;
  }

  /**
   * Apply a single change to an element
   */
  private applyChange(element: HTMLElement, change: DOMChange): void {
    switch (change.type) {
      case 'attribute':
        if (change.property && change.value !== undefined) {
          element.setAttribute(change.property, change.value);
        }
        break;

      case 'style':
        if (change.property === 'cssText' && change.value !== undefined) {
          element.style.cssText = change.value;
        }
        break;

      case 'text':
        if (change.value !== undefined) {
          element.textContent = change.value;
        }
        break;
    }
  }

  /**
   * Observe a new element
   */
  observeElement(element: Element): void {
    if (this.observer) {
      this.observer.observe(element, {
        attributes: true,
        attributeOldValue: true,
        childList: true,
        characterData: true,
        characterDataOldValue: true,
        subtree: true,
      });
      this.stats.observedElements++;
    }
  }

  /**
   * Get replication stats
   */
  getStats(): DOMReplicatorStats {
    return { ...this.stats };
  }

  /**
   * Force immediate flush
   */
  flush(): void {
    this.flushDeltas();
  }
}
