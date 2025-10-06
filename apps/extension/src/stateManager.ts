/**
 * State Manager
 * Handles serialization, persistence, and hydration of page state
 */

export interface SerializableElement {
  id: string;
  type: string; // 'sticky-note', 'drawing', etc.
  data: any; // Element-specific data
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface PageState {
  pageKey: string;
  circleId: string;
  elements: SerializableElement[];
  version: number;
  updatedAt: number;
}

export class StateManager {
  private pageKey: string;
  private circleId: string;
  private circlePassword: string | null = null;
  private layerId: string | null = null;
  private elements = new Map<string, SerializableElement>();
  private saveCallback: ((state: PageState) => void) | null = null;
  private hydrateCallback: ((elements: SerializableElement[]) => void) | null = null;
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveDebounceMs = 1000; // Save 1 second after last change
  private apiUrl = 'http://localhost:3000'; // TODO: Get from env

  constructor(pageKey: string, circleId: string, circlePassword?: string) {
    this.pageKey = pageKey;
    this.circleId = circleId;
    this.circlePassword = circlePassword || null;
    this.initializeLayer();
  }

  /**
   * Initialize or fetch layer ID from server
   */
  private async initializeLayer(): Promise<void> {
    try {
      // Determine if we're using default circle or a specific one
      const isDefaultCircle = this.circleId === 'anonymous';

      if (isDefaultCircle) {
        // Get the default circle first to get its actual ID
        const defaultResponse = await fetch(`${this.apiUrl}/public/circles/default`);

        if (!defaultResponse.ok) {
          console.error('[StateManager] Failed to get default circle:', await defaultResponse.text());
          return;
        }

        const { circle } = await defaultResponse.json();
        console.log('[StateManager] Using default anonymous circle:', circle.id);
      } else {
        console.log('[StateManager] Using specific circle:', this.circleId);
      }

      // Get or create layer for this circle/page
      const layerResponse = await fetch(`${this.apiUrl}/public/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Don't send circleId if using default
          circleId: isDefaultCircle ? undefined : this.circleId,
          pageKey: this.pageKey,
          password: this.circlePassword,
        }),
      });

      if (!layerResponse.ok) {
        console.error('[StateManager] Failed to get layer:', await layerResponse.text());
        return;
      }

      const { layer } = await layerResponse.json();
      this.layerId = layer.id;
      console.log('[StateManager] Layer initialized:', this.layerId);

      // Load existing elements from server
      await this.loadFromServer();
    } catch (err) {
      console.error('[StateManager] Failed to initialize layer:', err);
    }
  }

  /**
   * Set callback for when state should be saved
   */
  onSave(callback: (state: PageState) => void): void {
    this.saveCallback = callback;
  }

  /**
   * Set callback for when elements are loaded from server
   */
  onHydrate(callback: (elements: SerializableElement[]) => void): void {
    this.hydrateCallback = callback;
  }

  /**
   * Add or update an element in state
   */
  updateElement(element: SerializableElement): void {
    this.elements.set(element.id, element);
    this.scheduleSave();
  }

  /**
   * Remove an element from state
   */
  removeElement(id: string): void {
    this.elements.delete(id);
    this.scheduleSave();

    // Delete from server immediately
    this.deleteFromServer(id);
  }

  /**
   * Delete element from server
   */
  private async deleteFromServer(id: string): Promise<void> {
    if (!this.layerId) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/elements/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('[StateManager] Deleted from server:', id);
      }
    } catch (err) {
      console.error('[StateManager] Failed to delete from server:', err);
    }
  }

  /**
   * Get current state snapshot
   */
  getState(): PageState {
    return {
      pageKey: this.pageKey,
      circleId: this.circleId,
      elements: Array.from(this.elements.values()),
      version: 1,
      updatedAt: Date.now(),
    };
  }

  /**
   * Load state from external source
   */
  loadState(state: PageState): void {
    this.elements.clear();
    state.elements.forEach(el => {
      this.elements.set(el.id, el);
    });
  }

  /**
   * Schedule debounced save
   */
  private scheduleSave(): void {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(() => {
      this.save();
    }, this.saveDebounceMs);
  }

  /**
   * Immediately save state
   */
  save(): void {
    // Legacy callback for localStorage
    if (this.saveCallback) {
      const state = this.getState();
      this.saveCallback(state);
    }

    // Send to server
    this.saveToServer();
  }

  /**
   * Save to server via API
   */
  private async saveToServer(): Promise<void> {
    if (!this.layerId) {
      // No layerId means server sync is disabled
      return;
    }

    try {
      const elements = Array.from(this.elements.values());

      // Send batch upsert to server
      const response = await fetch(`${this.apiUrl}/elements/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elements: elements.map(el => ({
            id: el.id,
            layerId: this.layerId,
            elementType: el.type,
            data: JSON.stringify(el.data),
            createdBy: el.createdBy,
          })),
        }),
      });

      if (response.ok) {
        console.log('[StateManager] Saved to server:', elements.length, 'elements');
      } else {
        console.error('[StateManager] Server save failed:', response.status);
      }
    } catch (err) {
      console.error('[StateManager] Failed to save to server:', err);
    }
  }

  /**
   * Load elements from server
   */
  private async loadFromServer(): Promise<void> {
    if (!this.layerId) {
      return;
    }

    try {
      const response = await fetch(`${this.apiUrl}/elements/${this.layerId}`);

      if (response.ok) {
        const state = await response.json();
        console.log('[StateManager] Loaded from server:', state.elements.length, 'elements');

        const loadedElements: SerializableElement[] = [];

        // Populate local state
        state.elements.forEach((el: any) => {
          const element: SerializableElement = {
            id: el.id,
            type: el.elementType,
            data: el.data,
            createdBy: el.createdBy,
            createdAt: el.createdAt,
            updatedAt: el.updatedAt,
          };
          this.elements.set(el.id, element);
          loadedElements.push(element);
        });

        // Notify hydration callback to recreate UI elements
        if (this.hydrateCallback && loadedElements.length > 0) {
          this.hydrateCallback(loadedElements);
        }
      }
    } catch (err) {
      console.error('[StateManager] Failed to load from server:', err);
    }
  }

  /**
   * Get all elements of a specific type
   */
  getElementsByType(type: string): SerializableElement[] {
    return Array.from(this.elements.values()).filter(el => el.type === type);
  }

  /**
   * Get element by ID
   */
  getElement(id: string): SerializableElement | undefined {
    return this.elements.get(id);
  }
}
