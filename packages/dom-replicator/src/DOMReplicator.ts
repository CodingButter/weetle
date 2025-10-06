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
        // Handle element creation and deletion
        const changes: DOMChange[] = [];

        // Check for added nodes (creation)
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) {
            const entityId = this.getEntityId(node);
            if (entityId) {
              // New element with entity ID - send create event
              changes.push({
                type: 'create',
                value: this.serializeElement(node as HTMLElement),
              });
            }
          }
        });

        // Check for removed nodes (deletion)
        mutation.removedNodes.forEach(node => {
          if (node instanceof Element) {
            const entityId = this.getEntityId(node);
            if (entityId) {
              // Element removed - send delete event
              changes.push({
                type: 'delete',
                property: 'entityId',
                value: entityId,
              });
            }
          }
        });

        return changes.length > 0 ? changes[0] : null; // Return first change for now

      default:
        return null;
    }
  }

  /**
   * Serialize an element for creation delta
   */
  private serializeElement(element: HTMLElement): any {
    const serialized: any = {
      entityId: element.dataset?.weetleId || element.dataset?.replicateId,
      entityType: element.dataset?.weetleEntity,
      tagName: element.tagName.toLowerCase(),
      attributes: {},
      style: element.style.cssText,
      textContent: element.textContent,
    };

    // Capture all data attributes
    for (let i = 0; i < element.attributes.length; i++) {
      const attr = element.attributes[i];
      if (attr.name.startsWith('data-')) {
        serialized.attributes[attr.name] = attr.value;
      }
    }

    return serialized;
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
      for (const change of delta.changes) {
        // Handle create/delete without needing existing element
        if (change.type === 'create' || change.type === 'delete') {
          this.applyChange(null, change);
          continue;
        }

        // For other changes, find the element
        const element = this.findElement(delta.entityId);
        if (!element) {
          console.warn(`[DOMReplicator] Element not found: ${delta.entityId}`);
          continue;
        }

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
  private applyChange(element: HTMLElement | null, change: DOMChange): void {
    switch (change.type) {
      case 'create':
        // Create new element from serialized data
        if (change.value) {
          this.createElement(change.value);
        }
        break;

      case 'delete':
        // Remove element by ID
        if (change.value) {
          const elToDelete = this.findElement(change.value);
          if (elToDelete) {
            elToDelete.remove();
          }
        }
        break;

      case 'attribute':
        if (element && change.property && change.value !== undefined) {
          element.setAttribute(change.property, change.value);
        }
        break;

      case 'style':
        if (element && change.property === 'cssText' && change.value !== undefined) {
          element.style.cssText = change.value;
        }
        break;

      case 'text':
        if (element && change.value !== undefined) {
          element.textContent = change.value;
        }
        break;
    }
  }

  /**
   * Create element from serialized data
   */
  private createElement(data: any): void {
    const element = document.createElement(data.tagName || 'div');

    // Set data attributes
    if (data.attributes) {
      for (const [key, value] of Object.entries(data.attributes)) {
        element.setAttribute(key, value as string);
      }
    }

    // Set style
    if (data.style) {
      element.style.cssText = data.style;
    }

    // Set text content
    if (data.textContent) {
      element.textContent = data.textContent;
    }

    // Append to body
    document.body.appendChild(element);
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
