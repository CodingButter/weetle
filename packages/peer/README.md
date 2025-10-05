# @weetle/peer

WebRTC peer-to-peer connection management for Weetle.

## Features

- 🔗 **PeerJS Integration** - Simplified WebRTC connections
- 🚀 **Adaptive Throttling** - Velocity-based event sampling
- 📁 **File Transfer** - Chunked file transfers over data channels
- 🎯 **Type-Safe Events** - Fully typed event system
- 🔄 **Position Interpolation** - Smooth cursor movement rendering

## Installation

```bash
bun add @weetle/peer
```

## Usage

### Basic Setup

```typescript
import { PeerConnectionManager } from "@weetle/peer";
import { platform } from "@weetle/platform";

const peerManager = new PeerConnectionManager(
  userId,
  layerId,
  platform,
  {
    serverHost: "localhost",
    serverPort: 9000,
  }
);

// Initialize connection
const peerId = await peerManager.initialize();
console.log("Connected with peer ID:", peerId);
```

### Connect to Peers

```typescript
// Connect to another peer
peerManager.connect(targetPeerId, {
  peerId: targetPeerId,
  userId: targetUserId,
  role: "MEMBER",
  hasControl: false,
});
```

### Event Handling

```typescript
// Listen for specific events
peerManager.on("mouse:move", (event, fromPeerId) => {
  console.log("Mouse moved:", event.payload);
});

// Listen for all events
peerManager.onAll((event, fromPeerId) => {
  console.log("Event from", fromPeerId, ":", event);
});
```

### Broadcasting Events

```typescript
// Broadcast mouse movement with automatic throttling
peerManager.broadcastMouseMove(x, y, viewportWidth, viewportHeight);

// Broadcast custom events
peerManager.broadcast("mark:create", {
  markId: "123",
  kind: "STICKY_NOTE",
  payload: { text: "Hello!" },
});
```

### File Transfer

```typescript
import { FileTransferManager } from "@weetle/peer";

const fileTransfer = new FileTransferManager(peerManager);

// Send file to all peers
const fileId = await fileTransfer.broadcastFile(file);

// Listen for incoming files
fileTransfer.onComplete((fileId, blob, fileName) => {
  console.log("Received file:", fileName);
  // Download or display the file
  const url = URL.createObjectURL(blob);
  // ...
});

// Track progress
fileTransfer.onProgress((fileId, progress, fileName) => {
  console.log(`${fileName}: ${progress.toFixed(1)}%`);
});
```

### Adaptive Throttling

The adaptive throttling system automatically adjusts event frequency based on velocity:

```typescript
import { AdaptiveThrottle, DEFAULT_THROTTLE_CONFIG } from "@weetle/peer";

const throttle = new AdaptiveThrottle(DEFAULT_THROTTLE_CONFIG.mouseMove);

// In your event handler
const throttled = throttle.throttle({ x, y }, timestamp);
if (throttled) {
  // Event should be sent
  sendEvent(throttled);
}
```

**How it works:**
- Fast movements (>500 px/s): ~16ms interval (~60fps)
- Slow movements (<500 px/s): ~100ms interval (~10fps)
- Automatically calculates velocity
- Includes velocity in payload for smooth interpolation

### Position Interpolation

Smooth out received positions on the client side:

```typescript
import { PositionInterpolator } from "@weetle/peer";

const interpolator = new PositionInterpolator();

// When receiving mouse move event
peerManager.on("mouse:move", (event) => {
  interpolator.setTarget(
    event.payload.x,
    event.payload.y,
    event.payload.velocity
  );
});

// In render loop (requestAnimationFrame)
function render() {
  const { x, y } = interpolator.getPosition();
  // Draw cursor at interpolated position
  requestAnimationFrame(render);
}
```

## Type Definitions

### PeerEventType

```typescript
type PeerEventType =
  | "mouse:move"
  | "mouse:click"
  | "scroll"
  | "mark:create"
  | "mark:update"
  | "mark:delete"
  | "page:navigate"
  | "control:request"
  | "control:grant"
  | "control:revoke"
  | "chat:message"
  | "file:transfer:start"
  | "file:transfer:chunk"
  | "file:transfer:complete";
```

### PeerEvent

```typescript
interface PeerEvent<T = any> {
  type: PeerEventType;
  userId: string;
  layerId: string;
  timestamp: number;
  sequence: number;
  payload: T;
}
```

### Configuration

```typescript
interface PeerConfig {
  peerId?: string;
  serverHost?: string;
  serverPort?: number;
  serverPath?: string;
  throttling?: {
    mouseMove?: ThrottleConfig;
    scroll?: ThrottleConfig;
  };
}

interface ThrottleConfig {
  minInterval: number;     // minimum ms between events
  maxInterval: number;     // maximum ms between events
  velocityThreshold: number; // velocity that triggers min interval
}
```

## Architecture

### Event Flow

1. **Local Event** → Adaptive Throttle → **Network Event**
2. **Network Event** → Event Handler → **Application State**
3. **Remote Position** → Interpolator → **Smooth Rendering**

### Network Topology

Currently uses **full mesh** topology:
- Each peer connects to every other peer
- Direct P2P communication
- No single point of failure

Future: **Relay mesh** with spanning tree for scalability

## API Reference

### PeerConnectionManager

- `initialize()` - Connect to PeerJS server
- `connect(peerId, info)` - Connect to peer
- `broadcast(type, payload)` - Broadcast event to all
- `send(peerId, type, payload)` - Send to specific peer
- `on(type, handler)` - Listen for event type
- `onAll(handler)` - Listen for all events
- `getPeers()` - Get connected peers
- `disconnect(peerId)` - Disconnect peer
- `destroy()` - Clean up

### FileTransferManager

- `broadcastFile(file)` - Send file to all peers
- `sendFile(peerId, file)` - Send file to specific peer
- `onProgress(callback)` - Track transfer progress
- `onComplete(callback)` - Handle completed transfers
- `getActiveTransfers()` - Get ongoing transfers
- `cancelTransfer(fileId)` - Cancel transfer

### AdaptiveThrottle

- `throttle(event, timestamp)` - Process event
- `flush()` - Force emit last event
- `reset()` - Clear state

### PositionInterpolator

- `setTarget(x, y, velocity)` - Set target position
- `getPosition(timestamp)` - Get interpolated position
- `reset()` - Clear state

## Contributing

When adding new event types:

1. Add to `PeerEventType` in `types.ts`
2. Define payload interface in `types.ts`
3. Document in this README
4. Add tests if applicable

## License

MIT
