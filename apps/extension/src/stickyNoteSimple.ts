/**
 * Simple Sticky Notes - Just DOM elements
 * DOMReplicator handles all the network sync
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

export class SimpleStickyNote {
  private container: HTMLElement;
  private shadow: ShadowRoot;
  public id: string;

  constructor(data: StickyNoteData) {
    this.id = data.id;

    // Container is the EECS/replication target
    this.container = document.createElement('div');

    // Add data attributes for DOMReplicator
    this.container.dataset.weetleEntity = 'sticky-note';
    this.container.dataset.weetleId = data.id;
    this.container.dataset.replicate = 'true'; // Tell DOMReplicator to watch this

    // Position the container
    this.container.style.cssText = `
      position: fixed;
      left: ${data.x}px;
      top: ${data.y}px;
      z-index: 10000;
      pointer-events: auto;
    `;

    // Shadow DOM for style isolation
    this.shadow = this.container.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = this.getHTML(data);

    // Attach event listeners
    this.attachEventListeners(data);
  }

  private getHTML(data: StickyNoteData): string {
    return `
      <style>
        * {
          box-sizing: border-box;
        }

        .sticky-note {
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

  private attachEventListeners(data: StickyNoteData): void {
    const noteElement = this.shadow.querySelector('.sticky-note') as HTMLElement;
    const header = this.shadow.querySelector('.sticky-note-header') as HTMLElement;
    const contentElement = this.shadow.querySelector('.sticky-note-content') as HTMLElement;
    const bgColorBtn = this.shadow.querySelector('.sticky-note-bg-color');
    const textColorBtn = this.shadow.querySelector('.sticky-note-text-color');
    const deleteBtn = this.shadow.querySelector('.sticky-note-delete');
    const bgColorInput = this.shadow.querySelector('.bg-color-picker') as HTMLInputElement;
    const textColorInput = this.shadow.querySelector('.text-color-picker') as HTMLInputElement;

    // Drag functionality (updates container position - DOMReplicator will detect this!)
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    header.addEventListener('mousedown', (e) => {
      isDragging = true;
      noteElement.classList.add('dragging');

      const rect = this.container.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      e.preventDefault();
    });

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - offsetX;
      const newY = e.clientY - offsetY;

      // Update container position - DOMReplicator watches this!
      this.container.style.left = `${newX}px`;
      this.container.style.top = `${newY}px`;
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        noteElement.classList.remove('dragging');
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Content editing - updates contentElement.textContent (DOMReplicator watches this!)
    contentElement.addEventListener('blur', () => {
      // Update is automatically captured by MutationObserver
    });

    // Color pickers - update style (DOMReplicator watches this!)
    bgColorBtn?.addEventListener('click', () => bgColorInput?.click());
    textColorBtn?.addEventListener('click', () => textColorInput?.click());

    bgColorInput?.addEventListener('change', () => {
      noteElement.style.backgroundColor = bgColorInput.value;
    });

    textColorInput?.addEventListener('change', () => {
      noteElement.style.color = textColorInput.value;
    });

    // Delete
    deleteBtn?.addEventListener('click', () => {
      this.destroy();
    });

    // Prevent clicks from propagating
    noteElement.addEventListener('click', (e) => e.stopPropagation());
    noteElement.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  public mount(): void {
    document.body.appendChild(this.container);
  }

  public destroy(): void {
    this.container.remove();
  }

  public getElement(): HTMLElement {
    return this.container;
  }
}

/**
 * Manager for creating/tracking sticky notes
 */
export class SimpleStickyNotesManager {
  private notes = new Map<string, SimpleStickyNote>();

  public createNote(userId: string, x?: number, y?: number): string {
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

    const note = new SimpleStickyNote(data);
    note.mount();
    this.notes.set(data.id, note);

    return data.id;
  }

  public deleteNote(id: string): void {
    const note = this.notes.get(id);
    if (note) {
      note.destroy();
      this.notes.delete(id);
    }
  }

  public getNote(id: string): SimpleStickyNote | undefined {
    return this.notes.get(id);
  }

  public destroy(): void {
    this.notes.forEach(note => note.destroy());
    this.notes.clear();
  }
}
