# Anonymous Mode

Allow users to join public circles and participate in live sessions without creating an account.

## Overview

Anonymous mode enables frictionless collaboration for presentations, demos, and public sessions. Users can join with just a display name and participate fully in real-time, with local session storage for personal playback.

## User Experience

### Joining Anonymously

1. User visits a page with an **Anonymous Circle** active
2. Extension detects public circle availability
3. User clicks "Join Anonymously"
4. Prompted to enter a display name (stored in Chrome storage)
5. Joins immediately - no signup, no email, no password

### Display Name Persistence

- Display name saved to `chrome.storage.local`
- Reused for future anonymous sessions
- Can be changed anytime in settings
- Format: User-chosen name or "Anonymous User" by default

### Capabilities

**✅ Can Do:**
- See live cursors, clicks, scrolls from other users
- Create, edit, delete sticky notes in real-time
- See current state of all marks (notes, highlights, drawings)
- Participate in live chat
- **Replay sessions they joined** (stored locally)
- Save settings and preferences locally

**❌ Cannot Do:**
- Access historical sessions from before they joined
- Download server-stored session archives
- Create circles or manage permissions
- View private or account-only circles

## Architecture

### Data Storage

**Server Side:**
- Track anonymous participants in `AnonymousParticipant` table
- Store peer ID and display name temporarily
- Clean up inactive participants after timeout
- **No session storage on server for anonymous users**

**Client Side (Chrome Storage):**
- Display name preference
- Anonymous-specific settings
- **Local session storage** - full event history for sessions they participated in
- Marks and annotations they created

### Database Schema

```prisma
model Circle {
  visibility  CircleVisibility @default(PRIVATE)
  // ...
}

enum CircleVisibility {
  PRIVATE         // Invite-only, requires account
  PUBLIC          // Anyone with link can join, requires account
  ANONYMOUS       // Anyone can join without account (live only, no playback)
}

model AnonymousParticipant {
  id           String   @id @default(cuid())
  peerId       String   @unique  // PeerJS ID
  displayName  String?
  layerId      String
  joinedAt     DateTime @default(now())
  lastSeenAt   DateTime @updatedAt
  isActive     Boolean  @default(true)
}
```

### Session Playback

**For Anonymous Users:**
1. Events received via WebRTC are stored in `chrome.storage.local`
2. Local SQLite-like structure (using IndexedDB) mirrors server format
3. Can replay any session they participated in
4. Sessions persist across browser restarts
5. User controls retention (can clear old sessions)

**Storage Format:**
```typescript
interface AnonymousSessionStorage {
  sessionId: string;
  layerId: string;
  startedAt: number;
  events: SessionEvent[];
  metadata: {
    displayName: string;
    joinedAt: number;
    peersPresent: string[];
  };
}
```

## Security Considerations

### Spam Prevention

1. **Rate Limiting** - Anonymous users subject to stricter rate limits
2. **Reputation** - Can be reported and blocked by authenticated users
3. **Auto-cleanup** - Inactive participants removed after 5 minutes
4. **Session Limits** - Max concurrent anonymous users per circle (configurable)

### Privacy

- Anonymous users see only current state + events from their join time forward
- No access to historical data or archived sessions
- Display names are not unique (multiple "Bob" allowed)
- No email, no tracking across sessions (unless they reuse display name)

### Moderation

Circle owners can:
- Disable anonymous access (switch to PUBLIC or PRIVATE)
- Kick anonymous participants
- Block specific peer IDs
- Set anonymous user permissions (read-only, can create marks, etc.)

## Implementation

### Phase 1: Basic Anonymous Join

```typescript
// Check if user is authenticated
const isAuthenticated = await checkAuth();

if (!isAuthenticated && circle.visibility === "ANONYMOUS") {
  // Get or prompt for display name
  let displayName = await platform.storage.get("anonymous_display_name");

  if (!displayName) {
    displayName = await promptForDisplayName();
    await platform.storage.set("anonymous_display_name", displayName);
  }

  // Join as anonymous
  const peerId = await peerManager.initialize();

  await fetch("/api/anonymous/join", {
    method: "POST",
    body: JSON.stringify({
      peerId,
      displayName,
      layerId,
    }),
  });
}
```

### Phase 2: Local Session Storage

```typescript
// Store events locally for anonymous users
peerManager.onAll((event) => {
  if (isAnonymous) {
    await storeEventLocally(currentSessionId, event);
  }
});

// Replay from local storage
async function replayLocalSession(sessionId: string) {
  const events = await getLocalSessionEvents(sessionId);
  // Use same replay logic as server-based sessions
  replayEvents(events);
}
```

## Use Cases

### 1. Educational Presentations
**Scenario:** Professor teaching 100 students

- Professor creates ANONYMOUS circle for lecture
- Students join without accounts
- Everyone sees professor's annotations in real-time
- Students can take personal notes (stored locally)
- Students can replay lecture from their local storage

### 2. Public Demos
**Scenario:** Product demo at a conference

- Company sets up public demo circle
- Attendees scan QR code, join anonymously
- See live product walkthrough with annotations
- Can replay demo later from their device

### 3. Community Support
**Scenario:** Volunteer helping someone troubleshoot

- Create temporary anonymous circle
- Person being helped joins without signup friction
- Both collaborate on webpage
- Session saved locally for reference

## Configuration

```json
{
  "features": {
    "anonymousMode": {
      "enabled": true,
      "maxAnonymousPerCircle": 50,
      "inactiveTimeoutMinutes": 5,
      "defaultPermissions": "VIEWER",
      "allowLocalStorage": true,
      "localStorageRetentionDays": 30
    }
  },
  "security": {
    "anonymousRateLimiting": {
      "enabled": true,
      "maxEventsPerSecond": 10,
      "maxEventsPerMinute": 100
    }
  }
}
```

## API Endpoints

### POST `/api/anonymous/join`
Join a layer anonymously

**Request:**
```json
{
  "peerId": "peer-abc123",
  "displayName": "Alice",
  "layerId": "layer-xyz"
}
```

**Response:**
```json
{
  "participantId": "anon-123",
  "layer": { /* layer data */ },
  "currentState": { /* marks, messages */ },
  "permissions": "VIEWER"
}
```

### POST `/api/anonymous/heartbeat`
Keep anonymous session alive

### DELETE `/api/anonymous/leave`
Explicitly leave (auto-cleanup otherwise)

## Future Enhancements

1. **Guest Accounts** - Upgrade anonymous to guest account (email only, no password)
2. **Session Sharing** - Anonymous users can share their local replays via link
3. **Temporary Persistence** - Server stores anonymous sessions for 24 hours
4. **Voice/Video** - Allow anonymous users in voice channels
5. **Cross-Device** - Sync local storage across devices (via opt-in cloud backup)

## Privacy Policy Note

**Important:** Anonymous mode should be clearly explained in privacy policy:

- "Anonymous participants are identified by display name only"
- "Session data stored locally on your device"
- "No account creation or email collection for anonymous use"
- "Circle owners can see your display name and peer ID while active"
- "No tracking across sessions unless you reuse the same display name"
