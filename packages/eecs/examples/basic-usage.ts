/**
 * EECS Basic Usage Example
 * Shows how to set up a world with batched state sync and drag system
 */

import { World, DOMAdapter, StateSyncSystem, DragSystem } from '../src';
import type { StateUpdateBatch } from '../src';

// Create the world with DOM adapter
const world = new World(new DOMAdapter());

// Create state sync system with batch broadcasting
const stateSyncSystem = new StateSyncSystem(world, {
  batchInterval: 16, // ~60fps
  onBatchReady: (batch: StateUpdateBatch) => {
    console.log('Broadcasting batch:', batch);

    // This is where you'd send to peers via WebRTC/PeerJS
    // peerConnection.broadcast('state:batch', batch);
  },
});

// Create drag system (will use state sync for batching)
const dragSystem = new DragSystem(world, {
  stateSyncSystem,
});

// Register systems
world.registerSystem(stateSyncSystem);
world.registerSystem(dragSystem);

// Create a draggable element
const stickyNote = world.createElement('sticky-note', ['draggable', 'resizable']);

console.log('EECS world initialized with batched state sync!');

// Receiving batches from peers
function handleRemoteBatch(batch: StateUpdateBatch) {
  batch.changes.forEach(change => {
    const element = world.getElementById(change.entityId);

    if (!element) {
      // Element doesn't exist, create it
      if (change.changeType === 'create') {
        world.createElement(change.entityType, []);
      }
      return;
    }

    // Apply the changes
    if (change.data.x !== undefined && change.data.y !== undefined) {
      world.getAdapter().setPosition(element, change.data.x, change.data.y);
    }

    if (change.data.dragging !== undefined) {
      if (change.data.dragging) {
        world.getAdapter().addComponent(element, 'dragging');
      } else {
        world.getAdapter().removeComponent(element, 'dragging');
      }
    }
  });
}

// Cleanup
window.addEventListener('beforeunload', () => {
  world.destroy();
});
