/**
 * EECS-Integrated Sticky Note System
 * Uses EECS architecture for state management and drag operations
 */

import { World, DOMAdapter, StateSyncSystem, DragSystem, type StateUpdateBatch } from '@weetle/eecs';
import type { StickyNoteData } from './stickyNote';

export class StickyNoteEECSSystem {
  private world: World;
  private stateSyncSystem: StateSyncSystem;
  private dragSystem: DragSystem;
  private notes = new Map<string, HTMLElement>();

  constructor(onBatchReady?: (batch: StateUpdateBatch) => void) {
    // Create EECS world with DOM adapter
    this.world = new World(new DOMAdapter());

    // Create state sync system with batching
    this.stateSyncSystem = new StateSyncSystem(this.world, {
      batchInterval: 16, // ~60fps
      onBatchReady: (batch) => {
        console.log('[EECS] Broadcasting batch:', batch);
        onBatchReady?.(batch);
      },
    });

    // Create drag system
    this.dragSystem = new DragSystem(this.world, {
      stateSyncSystem: this.stateSyncSystem,
    });

    // Register systems
    this.world.registerSystem(this.stateSyncSystem);
    this.world.registerSystem(this.dragSystem);
  }

  /**
   * Create a new sticky note as an EECS entity
   */
  public createNote(userId: string, initialX?: number, initialY?: number): string {
    const data: StickyNoteData = {
      id: crypto.randomUUID(),
      x: initialX ?? window.innerWidth / 2 - 90,
      y: initialY ?? window.innerHeight / 2 - 75,
      width: 180,
      height: 150,
      content: '',
      backgroundColor: '#fff3cd',
      textColor: '#000000',
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.addNoteElement(data);
    return data.id;
  }

  /**
   * Add a sticky note from received data
   */
  public addNote(data: StickyNoteData): void {
    if (this.notes.has(data.id)) {
      // Update existing note
      this.updateNote(data.id, data);
      return;
    }

    this.addNoteElement(data);
  }

  /**
   * Create the sticky note DOM element with EECS attributes
   */
  private addNoteElement(data: StickyNoteData): void {
    // Outer container is the EECS entity
    const container = document.createElement('div');

    // Add EECS attributes to container
    container.dataset.weetleEntity = 'sticky-note';
    container.dataset.weetleEntityId = data.id;
    container.dataset.weetleDraggable = 'true';

    // Position the container
    container.style.cssText = `
      position: fixed;
      left: ${data.x}px;
      top: ${data.y}px;
      z-index: 10000;
      pointer-events: auto;
    `;

    // Shadow DOM for style isolation
    const shadow = container.attachShadow({ mode: 'open' });
    shadow.innerHTML = this.getStickyNoteHTML(data);

    const noteElement = shadow.querySelector('.sticky-note') as HTMLElement;
    if (!noteElement) return;

    // Attach event listeners
    this.attachEventListeners(container, noteElement, shadow, data);

    // Mount to body
    document.body.appendChild(container);
    this.notes.set(data.id, container);

    // Notify state sync of creation
    this.stateSyncSystem.queueChange({
      entityId: data.id,
      entityType: 'sticky-note',
      changeType: 'create',
      data: data,
      timestamp: performance.now(),
    });
  }

  /**
   * Update sticky note from remote batch
   */
  public updateNote(id: string, data: Partial<StickyNoteData>): void {
    const container = this.notes.get(id);
    if (!container) return;

    const shadow = container.shadowRoot;
    if (!shadow) return;

    const noteElement = shadow.querySelector('.sticky-note') as HTMLElement;
    if (!noteElement) return;

    // Update position (container is positioned)
    if (data.x !== undefined && data.y !== undefined) {
      container.style.left = `${data.x}px`;
      container.style.top = `${data.y}px`;
    }

    // Update content
    if (data.content !== undefined) {
      const contentEl = shadow.querySelector('.sticky-note-content') as HTMLElement;
      if (contentEl) {
        contentEl.textContent = data.content;
      }
    }

    // Update colors
    if (data.backgroundColor !== undefined) {
      noteElement.style.backgroundColor = data.backgroundColor;
    }

    if (data.textColor !== undefined) {
      noteElement.style.color = data.textColor;
    }
  }

  /**
   * Delete sticky note
   */
  public deleteNote(id: string): void {
    const container = this.notes.get(id);
    if (!container) return;

    container.remove();
    this.notes.delete(id);

    // Notify state sync of deletion
    this.stateSyncSystem.queueChange({
      entityId: id,
      entityType: 'sticky-note',
      changeType: 'delete',
      data: {},
      timestamp: performance.now(),
    });
  }

  /**
   * Handle remote state batch
   */
  public handleRemoteBatch(batch: StateUpdateBatch): void {
    batch.changes.forEach((change) => {
      if (change.entityType !== 'sticky-note') return;

      switch (change.changeType) {
        case 'create':
          this.addNote(change.data as StickyNoteData);
          break;
        case 'update':
          this.updateNote(change.entityId, change.data);
          break;
        case 'delete':
          this.deleteNote(change.entityId);
          break;
      }
    });
  }

  private getStickyNoteHTML(data: StickyNoteData): string {
    return `
      <style>
        * {
          box-sizing: border-box;
        }

        .sticky-note {
          position: fixed;
          width: ${data.width}px;
          min-width: 150px;
          max-width: 400px;
          height: ${data.height}px;
          min-height: 120px;
          background: ${data.backgroundColor};
          color: ${data.textColor};
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 6px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          opacity: 0.95;
          display: flex;
          flex-direction: column;
          font-family: 'Comic Sans MS', 'Segoe Print', cursive;
          transition: box-shadow 0.2s, opacity 0.2s, transform 0.1s;
          cursor: move;
          resize: both;
          overflow: hidden;
          pointer-events: auto;
        }

        .sticky-note:hover {
          opacity: 1;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
          transform: scale(1.02);
        }

        .sticky-note.dragging {
          cursor: grabbing;
          opacity: 0.9;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
          z-index: 10001;
          transform: scale(1.05) rotate(2deg);
        }

        .sticky-note-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.05);
          border-bottom: 1px solid rgba(0, 0, 0, 0.1);
          cursor: grab;
          user-select: none;
        }

        .sticky-note-header:active {
          cursor: grabbing;
        }

        .sticky-note-drag-handle {
          font-size: 0.75rem;
          color: rgba(0, 0, 0, 0.4);
          user-select: none;
        }

        .sticky-note-controls {
          display: flex;
          gap: 0.25rem;
        }

        .sticky-note-control-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.75rem;
          padding: 0.25rem;
          border-radius: 3px;
          transition: background 0.2s;
          line-height: 1;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sticky-note-control-btn:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        .sticky-note-delete:hover {
          background: rgba(255, 0, 0, 0.2);
          color: #ff0000;
        }

        .sticky-note-content {
          flex: 1;
          padding: 0.75rem;
          overflow-y: auto;
          overflow-x: hidden;
          outline: none;
          font-size: 0.875rem;
          line-height: 1.4;
          word-wrap: break-word;
          white-space: pre-wrap;
          cursor: text;
        }

        .sticky-note-content:empty::before {
          content: 'Click to write...';
          color: rgba(0, 0, 0, 0.4);
          font-style: italic;
        }

        .color-picker {
          position: absolute;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
        }
      </style>

      <div class="sticky-note">
        <div class="sticky-note-header">
          <div class="sticky-note-drag-handle">☰☰</div>
          <div class="sticky-note-controls">
            <button class="sticky-note-control-btn sticky-note-bg-color" title="Background Color">
              🎨
            </button>
            <button class="sticky-note-control-btn sticky-note-text-color" title="Text Color">
              ✏️
            </button>
            <button class="sticky-note-control-btn sticky-note-delete" title="Delete">
              ✕
            </button>
          </div>
        </div>
        <div class="sticky-note-content" contenteditable="true">${this.escapeHtml(data.content)}</div>
        <input type="color" class="color-picker bg-color-picker" value="${data.backgroundColor}">
        <input type="color" class="color-picker text-color-picker" value="${data.textColor}">
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private attachEventListeners(container: HTMLElement, noteElement: HTMLElement, shadow: ShadowRoot, data: StickyNoteData): void {
    const contentElement = shadow.querySelector('.sticky-note-content') as HTMLElement;
    const bgColorBtn = shadow.querySelector('.sticky-note-bg-color');
    const textColorBtn = shadow.querySelector('.sticky-note-text-color');
    const deleteBtn = shadow.querySelector('.sticky-note-delete');
    const bgColorInput = shadow.querySelector('.bg-color-picker') as HTMLInputElement;
    const textColorInput = shadow.querySelector('.text-color-picker') as HTMLInputElement;

    // Content editing - queue through state sync
    contentElement?.addEventListener('input', () => {
      this.stateSyncSystem.queueChange({
        entityId: data.id,
        entityType: 'sticky-note',
        changeType: 'update',
        data: {
          content: contentElement.textContent || '',
        },
        timestamp: performance.now(),
      });
    });

    // Color pickers
    bgColorBtn?.addEventListener('click', () => bgColorInput?.click());
    textColorBtn?.addEventListener('click', () => textColorInput?.click());

    bgColorInput?.addEventListener('change', () => {
      noteElement.style.backgroundColor = bgColorInput.value;
      this.stateSyncSystem.queueChange({
        entityId: data.id,
        entityType: 'sticky-note',
        changeType: 'update',
        data: {
          backgroundColor: bgColorInput.value,
        },
        timestamp: performance.now(),
      });
    });

    textColorInput?.addEventListener('change', () => {
      noteElement.style.color = textColorInput.value;
      this.stateSyncSystem.queueChange({
        entityId: data.id,
        entityType: 'sticky-note',
        changeType: 'update',
        data: {
          textColor: textColorInput.value,
        },
        timestamp: performance.now(),
      });
    });

    deleteBtn?.addEventListener('click', () => {
      this.deleteNote(data.id);
    });

    // Prevent clicks from propagating
    noteElement.addEventListener('click', (e) => e.stopPropagation());
    noteElement.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  public destroy(): void {
    this.world.destroy();
    this.notes.forEach((note) => note.parentElement?.remove());
    this.notes.clear();
  }
}
