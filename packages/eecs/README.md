# @weetle/eecs

**Element Event Component System** - A DOM-native ECS architecture for collaborative web applications.

## What is EECS?

EECS (Element Event Component System) is a novel architecture that adapts Entity-Component-System patterns for DOM-based collaborative applications. Unlike traditional ECS libraries designed for game engines, EECS leverages the DOM as the world, browser events as the communication layer, and data attributes as component markers.

## Key Concepts

- **Elements** = Entities (DOM nodes with `data-weetle-entity` attributes)
- **Events** = System communication (DOM events + P2P broadcast)
- **Components** = Behaviors (marked with `data-weetle-*` attributes)
- **Systems** = Event processors that query and manipulate elements

## Why EECS?

Traditional ECS libraries like apeECS are built for game loops and canvas rendering. EECS is purpose-built for:

- Collaborative DOM applications
- Real-time multiplayer UI
- Browser extension development
- P2P synchronized interfaces

## Usage

```typescript
import { World, System } from '@weetle/eecs';

// Create a system
class DragSystem extends System {
  init() {
    document.addEventListener('mousedown', this.onMouseDown);
  }

  onMouseDown = (e: MouseEvent) => {
    // Query for draggable elements
    const entity = this.queryElement('[data-weetle-draggable]', e.target);
    if (entity) {
      // Handle drag logic
    }
  }
}

// Initialize world
const world = new World();
world.registerSystem(new DragSystem(world));
```

## License

MIT
