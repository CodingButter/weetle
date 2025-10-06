import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { StateManager } from './stateManager';
import type { SerializableElement, PageState } from './stateManager';

describe('StateManager', () => {
  let stateManager: StateManager;
  const pageKey = 'https://example.com/test';
  const circleId = 'circle-123';

  beforeEach(() => {
    stateManager = new StateManager(pageKey, circleId);
  });

  describe('updateElement', () => {
    it('should add an element to state', () => {
      const element: SerializableElement = {
        id: 'note-1',
        type: 'sticky-note',
        data: { x: 100, y: 200, content: 'Test' },
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      stateManager.updateElement(element);

      const state = stateManager.getState();
      expect(state.elements).toHaveLength(1);
      expect(state.elements[0].id).toBe('note-1');
    });

    it('should update existing element', () => {
      const element: SerializableElement = {
        id: 'note-1',
        type: 'sticky-note',
        data: { x: 100, y: 200, content: 'Original' },
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      stateManager.updateElement(element);

      element.data.content = 'Updated';
      stateManager.updateElement(element);

      const state = stateManager.getState();
      expect(state.elements).toHaveLength(1);
      expect(state.elements[0].data.content).toBe('Updated');
    });

    it('should trigger save callback', (done) => {
      stateManager.onSave((state) => {
        expect(state.elements).toHaveLength(1);
        done();
      });

      const element: SerializableElement = {
        id: 'note-1',
        type: 'sticky-note',
        data: { x: 100, y: 200 },
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      stateManager.updateElement(element);
      stateManager.save(); // Force immediate save
    });
  });

  describe('removeElement', () => {
    it('should remove an element from state', () => {
      const element: SerializableElement = {
        id: 'note-1',
        type: 'sticky-note',
        data: { x: 100, y: 200 },
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      stateManager.updateElement(element);
      stateManager.removeElement('note-1');

      const state = stateManager.getState();
      expect(state.elements).toHaveLength(0);
    });
  });

  describe('loadState', () => {
    it('should load state from external source', () => {
      const externalState: PageState = {
        pageKey,
        circleId,
        elements: [
          {
            id: 'note-1',
            type: 'sticky-note',
            data: { x: 100, y: 200 },
            createdBy: 'user-1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            id: 'note-2',
            type: 'sticky-note',
            data: { x: 300, y: 400 },
            createdBy: 'user-1',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        version: 1,
        updatedAt: Date.now(),
      };

      stateManager.loadState(externalState);

      const state = stateManager.getState();
      expect(state.elements).toHaveLength(2);
    });
  });

  describe('getElementsByType', () => {
    it('should return elements of specific type', () => {
      stateManager.updateElement({
        id: 'note-1',
        type: 'sticky-note',
        data: {},
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      stateManager.updateElement({
        id: 'drawing-1',
        type: 'drawing',
        data: {},
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const notes = stateManager.getElementsByType('sticky-note');
      expect(notes).toHaveLength(1);
      expect(notes[0].id).toBe('note-1');
    });
  });

  describe('getElement', () => {
    it('should return element by ID', () => {
      const element: SerializableElement = {
        id: 'note-1',
        type: 'sticky-note',
        data: { x: 100, y: 200 },
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      stateManager.updateElement(element);

      const retrieved = stateManager.getElement('note-1');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('note-1');
    });

    it('should return undefined for non-existent element', () => {
      const retrieved = stateManager.getElement('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getState', () => {
    it('should return current state snapshot', () => {
      const element: SerializableElement = {
        id: 'note-1',
        type: 'sticky-note',
        data: { x: 100, y: 200 },
        createdBy: 'user-1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      stateManager.updateElement(element);

      const state = stateManager.getState();
      expect(state.pageKey).toBe(pageKey);
      expect(state.circleId).toBe(circleId);
      expect(state.elements).toHaveLength(1);
      expect(state.version).toBe(1);
    });
  });
});
