/**
 * Sticky Notes Manager
 * Manages sticky note creation, updates, and deletion
 * Uses RPC for peer synchronization
 */

import { StickyNote, type StickyNoteData } from './stickyNote';
import type { RPCBridge } from './rpc';
import { StateManager, type SerializableElement } from './stateManager';

export class StickyNotesManager {
  private notes = new Map<string, StickyNote>();
  private rpc: RPCBridge;
  private stateManager: StateManager;

  constructor(rpc: RPCBridge, pageKey: string, circleId: string, circlePassword?: string) {
    this.rpc = rpc;
    this.stateManager = new StateManager(pageKey, circleId, circlePassword);

    // Register RPC handlers
    this.rpc.register('createStickyNote', this.createNoteLocal.bind(this));
    this.rpc.register('updateStickyNote', this.updateNoteLocal.bind(this));
    this.rpc.register('deleteStickyNote', this.deleteNoteLocal.bind(this));

    // Setup state persistence callback
    this.stateManager.onSave((state) => {
      console.log('[StickyNotes] Saving state:', state);
      this.saveToLocalStorage(state);
    });

    // Setup hydration callback to recreate notes from server
    this.stateManager.onHydrate((elements) => {
      console.log('[StickyNotes] Hydrating elements from server:', elements.length);
      // Reuse existing hydration logic
      this.hydrateState({ elements });
    });
  }

  /**
   * Create a new sticky note (calls RPC to sync with peers)
   */
  createNote(userId: string, x?: number, y?: number): string {
    const data: StickyNoteData = {
      id: crypto.randomUUID(),
      x: x ?? window.innerWidth / 2 - 90,
      y: y ?? window.innerHeight / 2 - 75,
      width: 180,
      height: 150,
      content: '',
      backgroundColor: '#fff3cd',
      textColor: '#000000',
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Use RPC to create locally and broadcast
    this.rpc.call('createStickyNote', data);
    return data.id;
  }

  /**
   * Update sticky note (calls RPC to sync with peers)
   */
  updateNote(id: string, updates: Partial<StickyNoteData>): void {
    this.rpc.call('updateStickyNote', id, updates);
  }

  /**
   * Delete sticky note (calls RPC to sync with peers)
   */
  deleteNote(id: string): void {
    this.rpc.call('deleteStickyNote', id);
  }

  /**
   * Create note locally (called by RPC)
   */
  private createNoteLocal(data: StickyNoteData): void {
    if (this.notes.has(data.id)) {
      console.warn('[StickyNotes] Note already exists:', data.id);
      return;
    }

    const note = new StickyNote({
      data,
      onUpdate: (updatedData) => {
        // When note updates locally, sync via RPC
        this.rpc.call('updateStickyNote', updatedData.id, updatedData);
      },
      onDelete: (id) => {
        // When note deleted locally, sync via RPC
        this.rpc.call('deleteStickyNote', id);
      },
    });

    note.mount(document.body);
    this.notes.set(data.id, note);

    // Update state manager
    this.stateManager.updateElement(this.serializeNote(data));
  }

  /**
   * Update note locally (called by RPC)
   */
  private updateNoteLocal(id: string, updates: Partial<StickyNoteData>): void {
    const note = this.notes.get(id);
    if (!note) {
      console.warn('[StickyNotes] Note not found for update:', id);
      return;
    }

    note.update(updates);

    // Update state manager with full note data
    const fullData = note.getData();
    this.stateManager.updateElement(this.serializeNote(fullData));
  }

  /**
   * Delete note locally (called by RPC)
   */
  private deleteNoteLocal(id: string): void {
    const note = this.notes.get(id);
    if (!note) {
      console.warn('[StickyNotes] Note not found for deletion:', id);
      return;
    }

    note.destroy();
    this.notes.delete(id);

    // Remove from state manager
    this.stateManager.removeElement(id);
  }

  /**
   * Serialize note data to element format
   */
  private serializeNote(data: StickyNoteData): SerializableElement {
    return {
      id: data.id,
      type: 'sticky-note',
      data: {
        x: data.x,
        y: data.y,
        width: data.width,
        height: data.height,
        content: data.content,
        backgroundColor: data.backgroundColor,
        textColor: data.textColor,
      },
      createdBy: data.createdBy,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /**
   * Save state to localStorage (temp until server is ready)
   */
  private saveToLocalStorage(state: any): void {
    const key = `weetle:layer:${state.circleId}:${state.pageKey}`;
    console.log('[StickyNotes] Saving to localStorage with key:', key, 'elements:', state.elements?.length || 0);
    localStorage.setItem(key, JSON.stringify(state));
  }

  /**
   * Load state from localStorage
   */
  loadFromLocalStorage(): void {
    const key = `weetle:layer:${this.stateManager['circleId']}:${this.stateManager['pageKey']}`;
    console.log('[StickyNotes] Loading from localStorage with key:', key);
    const stored = localStorage.getItem(key);
    if (stored) {
      try {
        const state = JSON.parse(stored);
        console.log('[StickyNotes] Found stored state for circle:', this.stateManager['circleId'], 'elements:', state.elements?.length || 0);
        this.hydrateState(state);
      } catch (err) {
        console.error('[StickyNotes] Failed to load state:', err);
      }
    } else {
      console.log('[StickyNotes] No stored state found for circle:', this.stateManager['circleId']);
    }
  }

  /**
   * Hydrate state - recreate all elements from stored data
   */
  private hydrateState(state: any): void {
    state.elements.forEach((el: SerializableElement) => {
      if (el.type === 'sticky-note') {
        const noteData: StickyNoteData = {
          id: el.id,
          x: el.data.x,
          y: el.data.y,
          width: el.data.width,
          height: el.data.height,
          content: el.data.content,
          backgroundColor: el.data.backgroundColor,
          textColor: el.data.textColor,
          createdBy: el.createdBy,
          createdAt: el.createdAt,
          updatedAt: el.updatedAt,
        };
        this.createNoteLocal(noteData);
      }
    });
  }

  /**
   * Get a note by ID
   */
  getNote(id: string): StickyNote | undefined {
    return this.notes.get(id);
  }

  /**
   * Destroy all notes
   */
  destroy(): void {
    this.notes.forEach(note => note.destroy());
    this.notes.clear();
  }
}
