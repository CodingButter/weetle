# WEETLE – Collaborative Web Sessions Platform

**Name:** Weetle (W-E-E-T-L-E)

**Tagline:** _"Remote Desktop × Zoom × Discord × Excalidraw"_

---

## 🎯 The Vision

**Turn any web page into a live, collaborative workspace where teams, students, and communities can:**

- **Browse together** – One person drives, everyone follows. Scroll, click, navigate, and control the page for the entire group
- **Annotate everything** – Sticky notes, highlights, drawings, and clips that persist on the page across time
- **Communicate live** – Voice/video chat, text messages, presence indicators, and cursors
- **Record and replay** – Every action is an event. Miss the live session? Watch the playback at any speed
- **Clip and share** – Twitch-style moments, pinned to pages, shareable across your circles
- **Cross-page creativity** – Drag elements from one page to another, build visual collections
- **Control media together** – Pause YouTube for everyone, add commentary, continue together

### Use Cases

- **Education** – Professors demonstrate concepts on live web pages; students watch recordings later
- **Tech Companies** – Client demos, product walkthroughs, collaborative debugging sessions
- **Remote Teams** – Shared browsing for research, design reviews, documentation sessions
- **Communities** – Study groups, book clubs, watch parties with collaborative annotations

---

## 🏗️ Core Architecture Principles

### 1. Event Sourcing for Everything

**Instead of saving state, we save operations.**

- Every action (create note, move note, draw stroke, send message, scroll page) is an **event**
- Events are timestamped and sequenced
- Current state is the **materialized view** of all events
- Events can be **replayed** to reconstruct any point in time
- Playback can be sped up, slowed down, paused, and scrubbed through

**Benefits:**
- Tiny storage footprint (operations vs. video)
- Perfect session replay for education and training
- Time-travel debugging and review
- Audit trail of all collaboration

### 2. Peer-to-Peer Real-Time (PeerJS)

**Minimize server load by using P2P data channels for live collaboration.**

- **PeerJS** handles WebRTC connections and signaling
- **Real-time events** flow peer-to-peer via data channels
- **Voice/Video** uses WebRTC media streams (mesh or SFU later)
- **Server's job:** Store events for persistence, handle auth, manage circle membership

**Benefits:**
- Scalable real-time without server costs
- Low latency for live collaboration
- Server handles persistence and orchestration only

#### Mesh Network Relay (Future Optimization)

**Scale to large sessions using peer relay topology.**

Instead of the presenter streaming to all participants directly (which doesn't scale beyond ~20 people), we implement a **spanning tree** or **gossip protocol**:

- **Presenter** streams to 2-3 closest peers (measured by latency)
- **Those peers relay** the data to their closest neighbors
- **Tree-like propagation** - data flows down branches, not star topology
- **Loop prevention** - each event has a unique ID, peers track seen events
- **Self-healing** - if a relay node drops, peers reconnect to alternate routes

**Benefits:**
- Support hundreds of participants without bandwidth bottleneck
- Automatic load distribution across participant machines
- Reduced latency for geographically distributed users
- Fault tolerance through redundant paths

**Implementation notes:**
- Design event system with relay in mind from day one (event IDs, deduplication)
- Start with simple P2P for MVP, add mesh topology in Phase 2
- PeerJS supports custom routing - we just need the logic layer
- Consider **libp2p** for production-grade mesh networking

### 3. Role-Based Control ("Pass the Mic")

**Circle owners control permissions; control can be delegated dynamically.**

- **Owner** – Full control over circle, can set permissions
- **Presenter** – Can control the page for everyone (scroll, click, navigate)
- **Contributor** – Can add annotations, chat, but can't control page
- **Viewer** – Can see everything, can't modify

**Permissions can be:**
- Set at the **Circle level** (applies to all pages)
- Overridden at the **Page/Layer level** (specific to one page)
- **Delegated on the fly** ("pass the mic" to another user)

---

## 📦 Tech Stack

### Monorepo (Bun Workspace)

```
weetle/
├── apps/
│   ├── extension/        # Chrome MV3 Extension (React + TS + Tailwind v4)
│   └── server/           # Elysia (Bun) API + PeerJS signaling server
├── packages/
│   ├── db/               # Prisma schema, client, types (SQLite dev → Postgres prod)
│   ├── ui/               # Shared UI components (shadcn/ui)
│   └── config/           # Shared configs (TS, Tailwind, etc.)
```

### Key Technologies

- **Extension:** Chrome Manifest v3, React, TypeScript, Tailwind v4, shadcn/ui
- **Server:** Elysia (Bun), BetterAuth, Prisma ORM
- **Database:** SQLite (dev), PostgreSQL (production)
- **Real-time:** PeerJS (P2P WebRTC), WebSockets (signaling/fallback)
- **Auth:** BetterAuth with session cookies
- **Styling:** Tailwind v4, shadcn/ui component library

---

## 🗄️ Data Model

### Core Entities

**User**
- Managed by BetterAuth (email, sessions, accounts)
- Can belong to multiple Circles
- Creates Marks and Messages

**Circle**
- A group/team/class (membership container)
- Has many members with roles (Owner, Admin, Member)
- Has many Layers (one per page)

**Layer**
- The collaboration surface for a `(Circle, PageKey)` pair
- Contains all events/marks for that circle on that page
- Has a permissions model (inherit from Circle or override)

**Event** (new concept - event sourcing)
- Immutable record of every action
- Types: `CREATE_NOTE`, `MOVE_NOTE`, `EDIT_NOTE`, `DELETE_NOTE`, `DRAW_STROKE`, `PAGE_SCROLL`, `PAGE_CLICK`, `CHAT_MESSAGE`, etc.
- Has: `id`, `layerId`, `userId`, `eventType`, `payload`, `timestamp`, `sequence`

**Mark** (derived/materialized view of events)
- Current state of annotations: StickyNote, Highlight, Stroke, Pin, Clip
- Reconstructed from events for quick loading
- Can be regenerated from event stream

**Session** (for replay)
- A recorded collaboration session
- Has: `id`, `layerId`, `startedAt`, `endedAt`, `duration`, `eventCount`
- Can be played back at any speed
- Can include A/V recordings (optional)

### Prisma Schema (Extended)

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  output   = "../generated/prisma"
}

datasource db {
  provider = "sqlite" // postgres in production
  url      = env("DATABASE_URL")
}

// --- BetterAuth Models ---
model User {
  id            String              @id
  name          String
  email         String              @unique
  emailVerified Boolean             @default(false)
  image         String?
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt

  sessions      Session[]
  accounts      Account[]
  memberships   CircleMembership[]
  events        Event[]
  messages      ChatMessage[]

  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("verification")
}

// --- Weetle Core Models ---

model Circle {
  id          String              @id @default(cuid())
  name        String
  description String?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  memberships CircleMembership[]
  layers      Layer[]
  invites     Invite[]

  @@map("circle")
}

model CircleMembership {
  id       String   @id @default(cuid())
  userId   String
  circleId String
  role     Role     @default(MEMBER)

  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  circle   Circle   @relation(fields: [circleId], references: [id], onDelete: Cascade)

  @@unique([userId, circleId])
  @@map("circle_membership")
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

model Layer {
  id               String         @id @default(cuid())
  circleId         String
  pageKey          String         // Canonicalized URL
  title            String?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  // Permissions (null = inherit from circle)
  permissionLevel  Permission?

  circle           Circle         @relation(fields: [circleId], references: [id], onDelete: Cascade)
  events           Event[]
  marks            Mark[]         // Materialized view
  messages         ChatMessage[]
  sessions         SessionRecord[]

  @@unique([circleId, pageKey])
  @@index([circleId, pageKey])
  @@map("layer")
}

enum Permission {
  OWNER_ONLY
  ADMIN_AND_ABOVE
  MEMBER_AND_ABOVE
  ALL
}

// --- Event Sourcing ---

model Event {
  id        String   @id @default(cuid())
  layerId   String
  userId    String
  eventType String   // CREATE_NOTE, MOVE_NOTE, DRAW_STROKE, PAGE_SCROLL, etc.
  payload   String   // JSON payload
  timestamp DateTime @default(now())
  sequence  Int      // Auto-increment per layer for ordering

  layer     Layer    @relation(fields: [layerId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([layerId, sequence])
  @@index([layerId, timestamp])
  @@map("event")
}

// --- Materialized Views (for quick loading) ---

model Mark {
  id        String   @id @default(cuid())
  layerId   String
  kind      MarkKind
  payload   String   // JSON: position, content, style, etc.
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  layer     Layer    @relation(fields: [layerId], references: [id], onDelete: Cascade)

  @@map("mark")
}

enum MarkKind {
  STICKY_NOTE
  HIGHLIGHT
  STROKE
  PIN
  CLIP
}

model ChatMessage {
  id        String   @id @default(cuid())
  layerId   String
  userId    String
  text      String
  createdAt DateTime @default(now())

  layer     Layer    @relation(fields: [layerId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([layerId, createdAt])
  @@map("chat_message")
}

// --- Session Recording ---

model SessionRecord {
  id          String    @id @default(cuid())
  layerId     String
  startedAt   DateTime
  endedAt     DateTime?
  duration    Int?      // seconds
  eventCount  Int       @default(0)
  hasAudio    Boolean   @default(false)
  hasVideo    Boolean   @default(false)

  layer       Layer     @relation(fields: [layerId], references: [id], onDelete: Cascade)

  @@index([layerId, startedAt])
  @@map("session_record")
}

// --- Invites ---

model Invite {
  id        String    @id @default(cuid())
  circleId  String
  code      String    @unique
  createdAt DateTime  @default(now())
  expiresAt DateTime?
  maxUses   Int?
  useCount  Int       @default(0)

  circle    Circle    @relation(fields: [circleId], references: [id], onDelete: Cascade)

  @@map("invite")
}
```

---

## 🚀 Feature Breakdown

### MVP (Phase 1) – "Sticky Notes & Collaboration Basics"

**Goal:** Prove the core concept – collaborative browsing with persistent annotations.

1. **Authentication** – BetterAuth email/password (magic link optional)
   - **Anonymous Mode** – Join public circles without account (display name only)
2. **Circles** – Create, join via invite code, basic member list
   - **Visibility Modes**: Private (invite-only), Public (requires account), Anonymous (no account needed)
3. **Layers** – Auto-create for Circle + Page, select active circle
4. **Sticky Notes** – Create, edit, move, delete (P2P sync + persistence)
5. **Presence** – See who's online, basic cursors
6. **Chat** – Text messages in layer sidebar
7. **Event Persistence** – All actions stored as events, state materialized
   - **Anonymous Local Storage** – Anonymous users store sessions locally for playback
8. **Basic Replay** – View past sessions (simple timeline scrubber)
   - **Authenticated Users**: Access full server history
   - **Anonymous Users**: Replay sessions they participated in (local storage only)

**Exit Criteria:**
- Two users can join the same page, create sticky notes, see them sync in real-time
- Notes persist after refresh
- Can view a simple replay of the session

---

### Phase 2 – "Rich Annotations & Page Control"

**Features:**
1. **Highlights** – Select text, create persistent highlights with notes
2. **Drawing** – Freehand strokes with pen/highlighter tools
3. **Page Control** – "Pass the mic" – one user drives page for everyone
4. **Shared Scrolling** – When presenter scrolls, everyone follows
5. **Shared Clicks** – Presenter can click links/buttons for everyone (with safety limits)
6. **Voice/Video** – WebRTC A/V (P2P mesh, upgrade to SFU later)
7. **Improved Replay** – Speed controls (0.5x, 1x, 2x), pause, scrub

---

### Phase 3 – "Advanced Features & Integrations"

**Features:**
1. **Twitch-Style Clipping** – Clip last 30-60 seconds, pin to page
2. **Cross-Page Dragging** – Drag elements/images from one page to another
3. **Drag & Drop File Transfer** – Transfer files directly between participants via WebRTC data channels (documents, images, etc.)
4. **Media Control** – Control YouTube/video players for everyone
5. **Notion/Drive Integration** – Attach notes to Notion pages, save to Google Drive
6. **Element Capture** – Screenshot specific elements, add to layer
7. **Advanced Permissions** – Page-level overrides, temporary delegation
8. **Export Sessions** – Download as video, PDF, or event JSON

---

### Future/Experimental Ideas

**Ideas to explore later:**
- **CRDT for Offline** – Yjs for offline-first editing
- **AI Summaries** – Generate summary of session discussions
- **Translation** – Real-time translation of chat and annotations
- **Mobile App** – Native iOS/Android apps for viewing sessions
- **Embeddable Player** – Embed session replays in blog posts/docs
- **Collaborative Cursors** – See everyone's cursor position in real-time
- **Code Highlighting** – Special treatment for GitHub/docs with syntax highlighting
- **3D/AR Annotations** – Experimental AR markers on physical screens

---

## 🛠️ Development Roadmap

### Step 1: Foundation (Current)

- [x] Monorepo setup (Bun workspace)
- [x] BetterAuth configuration
- [x] Extend Prisma schema with Circles, Layers, SessionRecords
- [x] Session-per-file storage architecture (SQLite files)
- [x] Event sourcing data structures and helper functions
- [x] Database migrations
- [ ] Basic Elysia routes (health, auth, circles)

### Step 2: Extension Shell

- [ ] MV3 manifest with permissions
- [ ] Content script injection
- [ ] Shadow DOM overlay with React
- [ ] Panel UI (shadcn/ui)
- [ ] Circle/Layer selector

### Step 3: Sticky Notes MVP

- [ ] PeerJS integration (client + server signaling)
- [ ] Sticky note component (draggable, resizable, editable)
- [ ] Event emitter (CREATE_NOTE, MOVE_NOTE, etc.)
- [ ] P2P data channel sync
- [ ] Server persistence endpoints
- [ ] Event replay engine (basic)

### Step 4: Presence & Chat

- [ ] User presence tracking
- [ ] Cursor positions (P2P broadcast)
- [ ] Chat UI and message persistence
- [ ] Online/offline indicators

### Step 5: Replay & Page Control

- [ ] Session recording (event sequences)
- [ ] Playback UI (timeline, speed controls)
- [ ] "Pass the mic" permission system
- [ ] Shared page scrolling/clicking

---

## 🧪 Testing Strategy

### Unit Tests (Vitest)
- URL canonicalization logic
- Event reducer functions
- Permission checks
- Sticky note drag/resize calculations

### Integration Tests (Bun Test)
- API endpoints (auth, circles, layers, events)
- WebSocket message handling
- Event persistence and replay

### E2E Tests (Playwright)
- Extension loading and overlay injection
- Multi-browser collaboration (two Chrome instances)
- Sticky note creation and sync
- Session replay playback
- Permissions and role changes

---

## 📝 Development Guidelines

### Event Structure

All events follow this structure:

```typescript
interface Event {
  id: string;
  layerId: string;
  userId: string;
  eventType: EventType;
  payload: EventPayload;
  timestamp: Date;
  sequence: number;
}

type EventType =
  | 'CREATE_NOTE'
  | 'MOVE_NOTE'
  | 'EDIT_NOTE'
  | 'DELETE_NOTE'
  | 'CREATE_STROKE'
  | 'DELETE_STROKE'
  | 'CREATE_HIGHLIGHT'
  | 'DELETE_HIGHLIGHT'
  | 'PAGE_SCROLL'
  | 'PAGE_CLICK'
  | 'CHAT_MESSAGE'
  | 'USER_JOIN'
  | 'USER_LEAVE'
  | 'CONTROL_GRANT'
  | 'CONTROL_RELEASE';

interface EventPayload {
  // Varies by event type
  // Example for CREATE_NOTE:
  noteId: string;
  position: { x: number; y: number };
  content: string;
  style: { color: string; size: string };
}
```

### URL Canonicalization (PageKey)

```typescript
function canonicalizeUrl(url: string): string {
  const parsed = new URL(url);

  // Remove fragment
  parsed.hash = '';

  // Remove tracking params
  const trackerParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
  trackerParams.forEach(param => parsed.searchParams.delete(param));

  // Sort remaining params
  const sortedParams = new URLSearchParams(
    Array.from(parsed.searchParams.entries()).sort()
  );

  return `${parsed.origin}${parsed.pathname}?${sortedParams.toString()}`;
}
```

### PeerJS Connection Flow

```typescript
// Extension: Initialize PeerJS
const peer = new Peer(userId, {
  host: 'localhost',
  port: 9000,
  path: '/peerjs'
});

// Connect to other peers in the layer
const connections = new Map<string, DataConnection>();

peer.on('connection', (conn) => {
  connections.set(conn.peer, conn);

  conn.on('data', (data) => {
    handleIncomingEvent(data);
  });
});

// Broadcast event to all peers
function broadcastEvent(event: Event) {
  connections.forEach(conn => {
    conn.send(event);
  });

  // Also persist to server
  persistEvent(event);
}
```

### Replay Engine

```typescript
// Replay events at configurable speed
async function replaySession(
  sessionId: string,
  speed: number = 1.0
) {
  const events = await fetchSessionEvents(sessionId);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const nextEvent = events[i + 1];

    // Apply event to UI
    applyEvent(event);

    // Wait for time delta (adjusted by speed)
    if (nextEvent) {
      const delta = nextEvent.timestamp - event.timestamp;
      await sleep(delta / speed);
    }
  }
}
```

---

## 🎨 UI/UX Principles

### Extension Overlay Design

- **Non-intrusive** – Minimal UI, collapsible panel
- **Shadow DOM** – Completely isolated from page styles
- **Keyboard shortcuts** – Power users can navigate without mouse
- **Responsive** – Works on different viewport sizes
- **Accessible** – ARIA labels, keyboard navigation, high contrast mode

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+Shift+W` | Toggle Weetle panel |
| `N` | Create sticky note |
| `H` | Highlight mode |
| `D` | Draw mode |
| `C` | Open chat |
| `Esc` | Cancel current action |
| `Space` | Toggle page control |

### Permission Indicators

- **Presenter** – Crown icon, colored cursor
- **Contributor** – Pencil icon
- **Viewer** – Eye icon
- **You** – Always highlighted in participant list

---

## 🔐 Security Considerations

### Extension Security

- **Content Security Policy** – Strict CSP in manifest
- **Sandboxed iframes** – For untrusted content
- **Input sanitization** – All user input cleaned before storage
- **No eval()** – Avoid dynamic code execution

### Server Security

- **Session validation** – Every request checks session cookie
- **Circle membership** – Verify user can access layer
- **Rate limiting** – Prevent abuse of API endpoints
- **Size limits** – Max payload sizes for events, messages, uploads
- **CORS** – Locked to extension origin only

### Data Privacy

- **Public pages only** – MVP doesn't handle auth-gated content
- **Event encryption** – Consider E2E encryption for sensitive circles (future)
- **Data retention** – Configurable per-circle retention policies
- **GDPR compliance** – User data export and deletion

---

## 🚢 Deployment

### Development

```bash
# Install dependencies
bun install

# Generate Prisma client
bunx prisma generate

# Run migrations
bunx prisma migrate dev

# Start server
bun run dev:server

# Start extension build
bun run dev:ext

# Load extension in Chrome
# 1. Go to chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select apps/extension/dist
```

### Production

**Server:**
- Deploy to Fly.io, Railway, or Render
- Use PostgreSQL for database
- Set up TURN servers for WebRTC
- Configure proper CORS and CSP headers

**Extension:**
- Build for production: `bun run build:ext`
- Submit to Chrome Web Store
- Set up auto-update manifest

---

## 📊 Success Metrics

### MVP Success

- [ ] 10 users across 3 circles actively using sticky notes
- [ ] 100+ events persisted to database
- [ ] Session replay works smoothly (no lag, accurate playback)
- [ ] Zero data loss during real-time collaboration

### Phase 2 Success

- [ ] Users successfully "pass the mic" during live sessions
- [ ] Average session length > 15 minutes
- [ ] Replay feature used for 20%+ of sessions
- [ ] Voice/video quality rated 4+ stars

### Long-term Vision

- [ ] 1000+ active circles
- [ ] Integration with 3+ external tools (Notion, Drive, etc.)
- [ ] Education sector adoption (5+ universities)
- [ ] Enterprise customers (tech companies, agencies)

---

## 🤔 Open Questions & Decisions

### Technical Decisions

- **PeerJS vs. Custom WebRTC?** – Start with PeerJS, migrate if needed
- **SQLite vs. Postgres for dev?** – SQLite (current), migrate to Postgres for prod
- **Event storage format?** – JSON in TEXT column (SQLite), JSONB (Postgres)
- **Replay video recording?** – Optional, use MediaRecorder API if enabled

### Product Decisions

- **Free tier limits?** – TBD (circles, events, storage)
- **Pricing model?** – Freemium, pay per circle or storage
- **Privacy mode?** – Ephemeral layers that auto-delete?
- **Mobile support?** – Web viewer first, native apps later

---

## 🎯 North Star

**"Every web page can be a classroom, a meeting room, or a creative studio. Weetle makes the web collaborative."**

### Design Principles

1. **Simplicity First** – Complex features, simple UX
2. **Persistence Matters** – Every action is saved, nothing is lost
3. **Replay is Power** – The past is always accessible
4. **Peer-to-Peer** – Scalable, fast, decentralized where possible
5. **Extensible** – Built for plugins, integrations, and customization

---

## 📚 Resources

### Documentation

- [Bun Documentation](https://bun.sh/docs)
- [Elysia Documentation](https://elysiajs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [PeerJS Documentation](https://peerjs.com/docs)
- [Chrome Extension MV3](https://developer.chrome.com/docs/extensions/mv3/)
- [BetterAuth Documentation](https://www.better-auth.com)

### Inspiration

- **Figma** – Real-time cursors and collaboration
- **Miro** – Infinite canvas and sticky notes
- **Loom** – Async video for remote teams
- **Twitch** – Clipping and playback features
- **Excalidraw** – Simple, collaborative drawing
- **TogetherJS** – Shared browsing (legacy inspiration)

---

**Let's build this! 🚀**
