/**
 * Sticky Note Component
 * Replicates the look and behavior from shader_material_guide
 * Uses Shadow DOM for style isolation
 */

export interface StickyNoteData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  backgroundColor: string;
  textColor: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface StickyNoteOptions {
  data: StickyNoteData;
  onUpdate?: (data: StickyNoteData) => void;
  onDelete?: (id: string) => void;
  onFocus?: (id: string) => void;
  onDragStart?: (id: string, offsetX: number, offsetY: number) => void;
  onDragEnd?: (id: string) => void;
}

export class StickyNote {
  private container: HTMLDivElement;
  private shadow: ShadowRoot;
  private data: StickyNoteData;
  private options: StickyNoteOptions;

  // DOM elements
  private noteElement: HTMLDivElement | null = null;
  private headerElement: HTMLDivElement | null = null;
  private contentElement: HTMLDivElement | null = null;
  private bgColorInput: HTMLInputElement | null = null;
  private textColorInput: HTMLInputElement | null = null;

  // Drag state
  private isDragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;

  // Resize observer
  private resizeObserver: ResizeObserver | null = null;

  constructor(options: StickyNoteOptions) {
    this.options = options;
    this.data = { ...options.data };

    // Create container with shadow DOM
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: fixed;
      z-index: 10000;
      pointer-events: none;
    `;

    this.shadow = this.container.attachShadow({ mode: 'open' });

    this.render();
    this.attachEventListeners();
    this.setupResizeObserver();
  }

  private render(): void {
    const { x, y, width, height, content, backgroundColor, textColor } = this.data;

    this.shadow.innerHTML = `
      <style>
        * {
          box-sizing: border-box;
        }

        .sticky-note {
          position: fixed;
          width: ${width}px;
          min-width: 150px;
          max-width: 400px;
          height: ${height}px;
          min-height: 120px;
          background: ${backgroundColor};
          color: ${textColor};
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

        .sticky-note-content::-webkit-scrollbar {
          width: 4px;
        }

        .sticky-note-content::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
        }

        .sticky-note-content::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 2px;
        }

        .color-picker {
          position: absolute;
          width: 0;
          height: 0;
          opacity: 0;
          pointer-events: none;
        }
      </style>

      <div class="sticky-note" style="left: ${x}px; top: ${y}px;">
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
        <div class="sticky-note-content" contenteditable="true">${this.escapeHtml(content)}</div>
        <input type="color" class="color-picker bg-color-picker" value="${backgroundColor}">
        <input type="color" class="color-picker text-color-picker" value="${textColor}">
      </div>
    `;

    // Store references
    this.noteElement = this.shadow.querySelector('.sticky-note');
    this.headerElement = this.shadow.querySelector('.sticky-note-header');
    this.contentElement = this.shadow.querySelector('.sticky-note-content');
    this.bgColorInput = this.shadow.querySelector('.bg-color-picker');
    this.textColorInput = this.shadow.querySelector('.text-color-picker');
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private attachEventListeners(): void {
    if (!this.noteElement || !this.headerElement || !this.contentElement) return;

    // Drag functionality
    this.headerElement.addEventListener('mousedown', this.handleDragStart);

    // Content editing
    this.contentElement.addEventListener('input', this.handleContentChange);
    this.contentElement.addEventListener('focus', this.handleFocus);

    // Color pickers
    const bgColorBtn = this.shadow.querySelector('.sticky-note-bg-color');
    const textColorBtn = this.shadow.querySelector('.sticky-note-text-color');
    const deleteBtn = this.shadow.querySelector('.sticky-note-delete');

    bgColorBtn?.addEventListener('click', () => this.bgColorInput?.click());
    textColorBtn?.addEventListener('click', () => this.textColorInput?.click());
    deleteBtn?.addEventListener('click', this.handleDelete);

    this.bgColorInput?.addEventListener('change', this.handleBgColorChange);
    this.textColorInput?.addEventListener('change', this.handleTextColorChange);

    // Prevent clicks from propagating to page
    this.noteElement.addEventListener('click', (e) => e.stopPropagation());
    this.noteElement.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  private handleDragStart = (e: MouseEvent): void => {
    if (!this.noteElement) return;

    e.preventDefault();
    e.stopPropagation();

    this.isDragging = true;
    this.noteElement.classList.add('dragging');

    const rect = this.noteElement.getBoundingClientRect();
    this.dragOffsetX = e.clientX - rect.left;
    this.dragOffsetY = e.clientY - rect.top;

    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);

    this.options.onFocus?.(this.data.id);

    // Notify that dragging started
    this.options.onDragStart?.(this.data.id, this.dragOffsetX, this.dragOffsetY);
  };

  private handleDragMove = (e: MouseEvent): void => {
    if (!this.isDragging || !this.noteElement) return;

    e.preventDefault();

    const x = e.clientX - this.dragOffsetX;
    const y = e.clientY - this.dragOffsetY;

    this.data.x = x;
    this.data.y = y;
    this.data.updatedAt = Date.now();

    this.noteElement.style.left = `${x}px`;
    this.noteElement.style.top = `${y}px`;

    // Throttle broadcasts during drag (30fps = ~33ms)
    const now = Date.now();
    if (now - this.lastDragBroadcast >= 33) {
      this.lastDragBroadcast = now;
      this.notifyUpdate();
    }
  };

  private handleDragEnd = (e: MouseEvent): void => {
    if (!this.noteElement) return;

    e.preventDefault();

    this.isDragging = false;
    this.noteElement.classList.remove('dragging');

    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);

    this.notifyUpdate();
  };

  private handleContentChange = (): void => {
    if (!this.contentElement) return;

    this.data.content = this.contentElement.textContent || '';
    this.data.updatedAt = Date.now();
    this.notifyUpdate();
  };

  private handleBgColorChange = (e: Event): void => {
    if (!this.noteElement || !this.bgColorInput) return;

    this.data.backgroundColor = this.bgColorInput.value;
    this.noteElement.style.backgroundColor = this.data.backgroundColor;
    this.data.updatedAt = Date.now();
    this.notifyUpdate();
  };

  private handleTextColorChange = (e: Event): void => {
    if (!this.noteElement || !this.textColorInput) return;

    this.data.textColor = this.textColorInput.value;
    this.noteElement.style.color = this.data.textColor;
    this.data.updatedAt = Date.now();
    this.notifyUpdate();
  };

  private handleDelete = (): void => {
    this.options.onDelete?.(this.data.id);
    this.destroy();
  };

  private handleFocus = (): void => {
    this.options.onFocus?.(this.data.id);
  };

  private setupResizeObserver(): void {
    if (!this.noteElement) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.data.width = width;
        this.data.height = height;
        this.data.updatedAt = Date.now();
        this.notifyUpdate();
      }
    });

    this.resizeObserver.observe(this.noteElement);
  }

  private notifyUpdate(): void {
    this.options.onUpdate?.(this.data);
  }

  public getData(): StickyNoteData {
    return { ...this.data };
  }

  public updateData(data: Partial<StickyNoteData>): void {
    this.data = { ...this.data, ...data };
    this.render();
    this.attachEventListeners();
    this.setupResizeObserver();
  }

  public mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.container);
  }

  public destroy(): void {
    this.resizeObserver?.disconnect();
    this.container.remove();
  }
}

/**
 * Sticky Notes Manager
 * Manages all sticky notes on the page
 */
export class StickyNotesManager {
  private notes = new Map<string, StickyNote>();
  private onUpdate?: (data: StickyNoteData) => void;
  private onDelete?: (id: string) => void;
  private onCreate?: (data: StickyNoteData) => void;

  constructor(callbacks?: {
    onUpdate?: (data: StickyNoteData) => void;
    onDelete?: (id: string) => void;
    onCreate?: (data: StickyNoteData) => void;
  }) {
    this.onUpdate = callbacks?.onUpdate;
    this.onDelete = callbacks?.onDelete;
    this.onCreate = callbacks?.onCreate;
  }

  public createNote(userId: string, initialX?: number, initialY?: number): StickyNote {
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

    const note = new StickyNote({
      data,
      onUpdate: (updated) => {
        this.onUpdate?.(updated);
      },
      onDelete: (id) => {
        this.deleteNote(id);
        this.onDelete?.(id);
      },
      onFocus: (id) => {
        this.bringToFront(id);
      },
    });

    note.mount();
    this.notes.set(data.id, note);
    this.onCreate?.(data);

    return note;
  }

  public addNote(data: StickyNoteData): StickyNote {
    const note = new StickyNote({
      data,
      onUpdate: (updated) => {
        this.onUpdate?.(updated);
      },
      onDelete: (id) => {
        this.deleteNote(id);
        this.onDelete?.(id);
      },
      onFocus: (id) => {
        this.bringToFront(id);
      },
    });

    note.mount();
    this.notes.set(data.id, note);

    return note;
  }

  public deleteNote(id: string): void {
    const note = this.notes.get(id);
    if (note) {
      note.destroy();
      this.notes.delete(id);
    }
  }

  public updateNote(id: string, data: Partial<StickyNoteData>): void {
    const note = this.notes.get(id);
    if (note) {
      note.updateData(data);
    }
  }

  public getNote(id: string): StickyNote | undefined {
    return this.notes.get(id);
  }

  public getAllNotes(): StickyNote[] {
    return Array.from(this.notes.values());
  }

  private bringToFront(id: string): void {
    // Could implement z-index management here if needed
  }

  public clear(): void {
    this.notes.forEach((note) => note.destroy());
    this.notes.clear();
  }
}
