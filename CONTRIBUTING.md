# Contributing to Weetle

Thank you for your interest in contributing to Weetle! This guide will help you understand the project structure and development workflow.

## Project Structure

Weetle is organized as a monorepo using Bun workspaces:

```
weetle/
├── apps/
│   ├── extension/      # Chrome extension (MV3)
│   └── server/         # Elysia backend server
├── packages/
│   ├── config/         # Shared TypeScript config
│   ├── db/            # Prisma schema & database utilities
│   ├── peer/          # WebRTC P2P connection management
│   └── platform/      # Platform abstraction (extension/web)
├── ProjectDocs.md     # Detailed project documentation
└── PROGRESS.md        # Current progress & roadmap
```

## Tech Stack

- **Runtime**: Bun
- **Backend**: Elysia (Bun-based HTTP framework)
- **Database**: Prisma ORM (SQLite dev, PostgreSQL prod)
- **Auth**: BetterAuth
- **WebRTC**: PeerJS
- **Extension**: Chrome MV3
- **Frontend**: React + TypeScript

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed (`curl -fsSL https://bun.sh/install | bash`)
- Node.js 18+ (for some tooling compatibility)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/weetle.git
cd weetle

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate Prisma client
cd packages/db
bunx prisma generate
cd ../..

# Start development servers
bun run dev
```

This starts:
- Extension dev server on `http://localhost:3001`
- API server on `http://localhost:3000`
- PeerJS server on port `9000`

## Development Workflow

### Creating a New Feature

1. **Understand the architecture** - Read `ProjectDocs.md` for system design
2. **Find the right package** - Determine where your code belongs
3. **Follow TypeScript patterns** - See examples below
4. **Write tests** - Add tests for new functionality
5. **Update documentation** - Update relevant README files

### TypeScript Best Practices

#### 1. Dedicated Types Files

Each package should have a `types.ts` file:

```typescript
// packages/your-package/types.ts

/**
 * Clear, documented interface
 */
export interface YourInterface {
  id: string;
  name: string;
  // ... more fields
}

/**
 * Discriminated union for type safety
 */
export type YourEventType =
  | "event:one"
  | "event:two"
  | "event:three";

/**
 * Generic type for flexibility
 */
export interface GenericEvent<T = any> {
  type: YourEventType;
  payload: T;
}
```

#### 2. Clean Exports

Use index files for clean imports:

```typescript
// packages/your-package/index.ts

export { YourMainClass } from "./main";
export { YourHelper } from "./helpers";

export type {
  YourInterface,
  YourEventType,
  GenericEvent,
} from "./types";
```

#### 3. JSDoc Comments

Document all public APIs:

```typescript
/**
 * Brief description of the function
 *
 * @param userId - The user's unique identifier
 * @param options - Configuration options
 * @returns Promise resolving to the result
 * @throws Error if user not found
 *
 * @example
 * ```typescript
 * const result = await doSomething("user123", { option: true });
 * ```
 */
export async function doSomething(
  userId: string,
  options: Options
): Promise<Result> {
  // Implementation
}
```

#### 4. No `any` Types

Avoid `any` - use generics or proper types:

```typescript
// ❌ Bad
function handle(data: any) { }

// ✅ Good
function handle<T>(data: T) { }

// ✅ Also good
function handle(data: unknown) {
  if (typeof data === "string") {
    // TypeScript knows data is string here
  }
}
```

### Package-Specific Guidelines

#### @weetle/db

- All database models in `schema.prisma`
- Service classes in `services/`
- Type-safe event definitions in `session-events.ts`
- Tests in `*.test.ts` files

```typescript
// Example service pattern
export class YourService {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateInput): Promise<YourModel> {
    return this.prisma.yourModel.create({ data });
  }
}
```

#### @weetle/peer

- Event types in `types.ts`
- Manager classes for connection handling
- Utility classes (throttle, interpolation) separate
- Export everything from `index.ts`

```typescript
// Example event pattern
export interface YourEvent {
  eventId: string;
  timestamp: number;
  data: EventData;
}

peerManager.on("your:event", (event, peerId) => {
  // Handle event
});
```

#### @weetle/platform

- Interface definitions in `types.ts`
- Chrome implementation in `chrome/`
- Web implementation in `web/`
- Platform detection in `index.ts`

```typescript
// Example platform capability
export interface IPlatformYourFeature {
  doSomething(): Promise<void>;
}

// Chrome implementation
export class ChromeYourFeature implements IPlatformYourFeature {
  async doSomething() {
    await chrome.api.doSomething();
  }
}

// Web implementation
export class WebYourFeature implements IPlatformYourFeature {
  async doSomething() {
    // Web equivalent
  }
}
```

## Testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific package tests
cd packages/db
bun test

# Watch mode
bun test --watch
```

### Writing Tests

Use Bun's built-in test runner:

```typescript
import { describe, test, expect } from "bun:test";

describe("YourFeature", () => {
  test("should do something", () => {
    const result = doSomething();
    expect(result).toBe(expected);
  });

  test("should handle edge case", async () => {
    const result = await doSomethingAsync();
    expect(result).toMatchObject({ key: "value" });
  });
});
```

## Code Style

### Formatting

- Use Prettier (configuration in repo)
- 2 spaces for indentation
- Double quotes for strings
- Trailing commas in objects/arrays

### Naming Conventions

- **Files**: `kebab-case.ts`
- **Classes**: `PascalCase`
- **Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Types/Interfaces**: `PascalCase`, prefix interfaces with `I`

```typescript
// File: user-manager.ts

const MAX_RETRIES = 3;

export interface IUserManager {
  createUser(name: string): Promise<User>;
}

export class UserManager implements IUserManager {
  async createUser(name: string): Promise<User> {
    // Implementation
  }
}
```

## Git Workflow

### Branches

- `main` - Production-ready code
- `develop` - Integration branch
- `feature/your-feature` - Feature branches
- `fix/bug-description` - Bug fixes

### Commits

Use conventional commits:

```bash
feat: add file transfer progress tracking
fix: resolve peer connection timeout issue
docs: update contributing guide
refactor: simplify throttle calculation
test: add session storage tests
```

### Pull Requests

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Write/update tests
5. Update documentation
6. Submit PR with clear description

PR template:
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Screenshots (if applicable)

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Types properly defined
- [ ] No TypeScript errors
```

## Architecture Patterns

### Event Sourcing

Events are stored as immutable records:

```typescript
// Define event types
type SessionEventType = "CREATE_NOTE" | "MOVE_NOTE" | "DELETE_NOTE";

interface SessionEvent {
  id: string;
  type: SessionEventType;
  timestamp: number;
  sequence: number;
  payload: any;
}

// Append only, never modify
sessionStorage.appendEvents(db, [event]);
```

### Service Pattern

Business logic in service classes:

```typescript
export class CircleService {
  constructor(private prisma: PrismaClient) {}

  async createCircle(userId: string, data: CreateCircleInput) {
    // Validate
    // Create
    // Return
  }
}
```

### Platform Abstraction

Code works in both extension and web:

```typescript
import { platform } from "@weetle/platform";

// Works everywhere!
await platform.storage.set("key", value);
platform.messaging.send({ type: "event", data });
```

## Documentation

### Package README

Each package should have a `README.md` with:
- Purpose
- Installation
- Usage examples
- API reference
- Type definitions
- Contributing guidelines

See `packages/peer/README.md` for a good example.

### Code Comments

- **What**: Public APIs need JSDoc
- **Why**: Complex logic needs explanation
- **How**: Code should be self-documenting

```typescript
/**
 * Calculate adaptive throttle interval based on velocity
 *
 * Fast movements need higher sample rates for accuracy,
 * slow movements can use lower rates to save bandwidth.
 */
private getThrottleInterval(velocity: number): number {
  // Implementation is self-explanatory
  const ratio = velocity / this.velocityThreshold;
  return this.maxInterval - ratio * (this.maxInterval - this.minInterval);
}
```

## Getting Help

- **Documentation**: Start with `ProjectDocs.md`
- **Architecture Questions**: See `PROGRESS.md`
- **Package Usage**: Check package `README.md` files
- **Issues**: Search GitHub issues or create new one
- **Discussions**: GitHub Discussions for questions

## Core Concepts to Understand

Before contributing, familiarize yourself with:

1. **Event Sourcing** - How we store operations, not state
2. **WebRTC/PeerJS** - P2P communication
3. **Platform Abstraction** - Extension vs web compatibility
4. **Adaptive Throttling** - Velocity-based event sampling
5. **Role-Based Permissions** - Circle/Layer access control

## Performance Considerations

- **Throttling**: Use adaptive throttling for high-frequency events
- **Event Batching**: Batch events when possible
- **Lazy Loading**: Load data on-demand
- **Indexing**: Ensure database queries are indexed
- **Memory**: Clean up event listeners and connections

```typescript
// ✅ Good - adaptive throttling
const throttled = mouseThrottle.throttle({ x, y });
if (throttled) peerManager.broadcast("mouse:move", throttled);

// ✅ Good - cleanup
const unsubscribe = platform.messaging.listen("event", handler);
return () => unsubscribe(); // Cleanup in component unmount

// ❌ Bad - sending every mousemove
peerManager.broadcast("mouse:move", { x, y }); // Too much!
```

## Questions?

Feel free to:
- Open an issue for bugs
- Start a discussion for questions
- Submit a PR for improvements

We appreciate your contributions! 🎉
