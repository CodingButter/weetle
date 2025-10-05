# @weetle/platform

Platform abstraction layer for Weetle - works in both Chrome extension and web environments.

## Purpose

Provides a unified API that works across different environments:
- Chrome Extension (MV3)
- Standalone Web Application

The platform automatically detects the environment and uses the appropriate implementation.

## Installation

```bash
bun add @weetle/platform
```

## Usage

### Auto-Detection

```typescript
import { platform } from "@weetle/platform";

// Automatically uses Chrome APIs or web equivalents
await platform.storage.set("key", "value");
const value = await platform.storage.get("key");

// Send messages across the app
platform.messaging.send({
  type: "user:action",
  data: { action: "click" },
});

// Listen for messages
const unsubscribe = platform.messaging.listen("user:action", (msg) => {
  console.log("Received:", msg);
});

// Get runtime info
console.log("Platform:", platform.runtime.type); // "extension" | "web"
console.log("Is Extension:", platform.runtime.isExtension);
```

### Manual Platform Creation

```typescript
import { createPlatform, detectPlatform } from "@weetle/platform";

const platformType = detectPlatform();
console.log("Running on:", platformType);

const platform = createPlatform();
// Use platform...
```

## API Reference

### IPlatformStorage

Storage abstraction that works across environments:

**Extension**: Uses `chrome.storage.local`
**Web**: Uses `IndexedDB` via `idb` library

```typescript
interface IPlatformStorage {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}
```

### IPlatformMessaging

Message passing abstraction:

**Extension**: Uses `chrome.runtime.sendMessage/onMessage`
**Web**: Uses `CustomEvent` with `window.dispatchEvent`

```typescript
interface IPlatformMessaging {
  send<T = any>(message: PlatformMessage<T>): Promise<void>;
  listen<T = any>(type: string, handler: MessageHandler<T>): () => void;
  listenAll(handler: MessageHandler): () => void;
}

interface PlatformMessage<T = any> {
  type: string;
  data: T;
  id?: string;
  timestamp?: number;
}
```

### IPlatformRuntime

Runtime information and utilities:

```typescript
interface IPlatformRuntime {
  type: PlatformType; // "extension" | "web"
  isExtension: boolean;
  isWeb: boolean;
  getManifest(): any | null;
  getURL(path: string): string;
}
```

## Examples

### Storage Example

```typescript
import { platform } from "@weetle/platform";

// Save user preferences
await platform.storage.set("user:preferences", {
  theme: "dark",
  notifications: true,
});

// Load preferences
const prefs = await platform.storage.get("user:preferences");
console.log(prefs); // { theme: "dark", notifications: true }

// List all keys
const keys = await platform.storage.keys();
console.log(keys); // ["user:preferences", ...]

// Remove item
await platform.storage.remove("user:preferences");

// Clear all
await platform.storage.clear();
```

### Messaging Example

```typescript
import { platform } from "@weetle/platform";

// Component A: Send message
platform.messaging.send({
  type: "circle:joined",
  data: {
    circleId: "abc123",
    userId: "user456",
  },
});

// Component B: Listen for messages
const unsubscribe = platform.messaging.listen("circle:joined", (msg) => {
  console.log("User joined circle:", msg.data.circleId);
  // Update UI...
});

// Later: Stop listening
unsubscribe();
```

### Runtime Example

```typescript
import { platform } from "@weetle/platform";

if (platform.runtime.isExtension) {
  // Extension-specific code
  const manifest = platform.runtime.getManifest();
  console.log("Extension version:", manifest.version);

  // Get extension resource URL
  const iconUrl = platform.runtime.getURL("icons/icon-128.png");
} else {
  // Web-specific code
  const iconUrl = platform.runtime.getURL("/icons/icon-128.png");
}
```

## Implementation Details

### Chrome Extension (chrome/*)

- **Storage**: `chrome.storage.local` API
- **Messaging**: `chrome.runtime.sendMessage/onMessage`
- **Runtime**: `chrome.runtime` API

### Web Browser (web/*)

- **Storage**: `IndexedDB` via `idb` library
  - Database name: `weetle-storage`
  - Store name: `keyval`
- **Messaging**: `CustomEvent` API
  - Event name: `weetle:message`
  - Dispatched on `window`
- **Runtime**: Web platform APIs
  - URL construction via `window.location.origin`

## Type Definitions

```typescript
type PlatformType = "extension" | "web";

type MessageHandler<T = any> = (message: PlatformMessage<T>) => void;

interface IPlatform {
  storage: IPlatformStorage;
  messaging: IPlatformMessaging;
  runtime: IPlatformRuntime;
}
```

## Adding New Platform Capabilities

To add new platform-specific functionality:

1. **Define interface** in `types.ts`:
```typescript
export interface IPlatformNotifications {
  send(title: string, message: string): Promise<void>;
  onClicked(handler: () => void): () => void;
}
```

2. **Implement for Chrome** in `chrome/notifications.ts`:
```typescript
export class ChromeNotifications implements IPlatformNotifications {
  async send(title: string, message: string) {
    await chrome.notifications.create({ ... });
  }
  // ...
}
```

3. **Implement for Web** in `web/notifications.ts`:
```typescript
export class WebNotifications implements IPlatformNotifications {
  async send(title: string, message: string) {
    new Notification(title, { body: message });
  }
  // ...
}
```

4. **Add to IPlatform** interface:
```typescript
export interface IPlatform {
  storage: IPlatformStorage;
  messaging: IPlatformMessaging;
  runtime: IPlatformRuntime;
  notifications: IPlatformNotifications; // New!
}
```

5. **Update createPlatform** in `index.ts`

## Testing

The platform package is designed to be easily mockable for testing:

```typescript
import type { IPlatform } from "@weetle/platform";

const mockPlatform: IPlatform = {
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    // ...
  },
  messaging: {
    send: vi.fn(),
    listen: vi.fn(),
    // ...
  },
  runtime: {
    type: "web",
    isExtension: false,
    isWeb: true,
    getManifest: () => null,
    getURL: (path) => path,
  },
};
```

## Contributing

When adding new platform capabilities:
1. Define the interface first
2. Implement for both Chrome and Web
3. Update the IPlatform interface
4. Document in this README
5. Add tests

## License

MIT
