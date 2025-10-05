# @weetle/dom-replicator

Universal DOM replication using MutationObserver. Works with any framework or vanilla JS.

## Features

- 🔍 **Framework Agnostic** - Works with EECS, React, Vue, or vanilla JS
- 🚀 **Minimal Bandwidth** - Only sends changed properties
- ⚡ **Batched Updates** - 16ms batching for ~60fps performance
- 🎯 **Zero Ping-Pong** - Direct DOM application bypasses observers
- 📊 **Built-in Stats** - Track deltas, bytes, and performance

## Installation

```bash
pnpm add @weetle/dom-replicator
```

## Quick Start

```typescript
import { DOMReplicator } from '@weetle/dom-replicator';

// Create replicator
const replicator = new DOMReplicator({
  selector: '[data-replicate]', // Elements to watch
  batchInterval: 16, // ~60fps
  onDeltasReady: (deltas) => {
    // Send over WebRTC, WebSocket, etc.
    peerConnection.send(JSON.stringify(deltas));
  },
});

// Start observing
replicator.start();

// Apply received deltas
peerConnection.on('message', (data) => {
  const deltas = JSON.parse(data);
  replicator.applyDeltas(deltas);
});
```

## Usage with EECS

```typescript
// Mark EECS entities for replication
const stickyNote = document.createElement('div');
stickyNote.dataset.weetleEntity = 'sticky-note';
stickyNote.dataset.weetleId = crypto.randomUUID();
stickyNote.dataset.replicate = 'true'; // Enable replication

// EECS updates DOM normally
stickyNote.style.left = '100px';

// DOMReplicator automatically captures and sends the change!
```

## How It Works

1. **MutationObserver** watches elements matching the selector
2. **Change Detection** converts mutations into minimal deltas
3. **Batching** collects deltas over batch interval
4. **Serialization** creates tiny JSON payloads
5. **Transport** sends via your network layer
6. **Application** directly updates DOM (bypasses observer)

## API

### DOMReplicator

#### Constructor

```typescript
new DOMReplicator(config?: ReplicationConfig)
```

#### Methods

- `start()` - Start observing DOM changes
- `stop()` - Stop observing
- `applyDeltas(deltas)` - Apply received deltas
- `observeElement(element)` - Observe additional element
- `flush()` - Force immediate delta flush
- `getStats()` - Get replication statistics

### Types

```typescript
interface DOMDelta {
  entityId: string;
  timestamp: number;
  changes: DOMChange[];
}

interface DOMChange {
  type: 'attribute' | 'style' | 'text';
  property?: string;
  value?: any;
  oldValue?: any;
}
```

## Examples

### With PeerJS

```typescript
const replicator = new DOMReplicator({
  onDeltasReady: (deltas) => {
    peerManager.broadcast('dom:update', deltas);
  },
});

peerManager.on('dom:update', (deltas) => {
  replicator.applyDeltas(deltas);
});
```

### With WebSocket

```typescript
const replicator = new DOMReplicator({
  onDeltasReady: (deltas) => {
    ws.send(JSON.stringify({ type: 'dom:update', deltas }));
  },
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.type === 'dom:update') {
    replicator.applyDeltas(msg.deltas);
  }
});
```

## License

MIT
