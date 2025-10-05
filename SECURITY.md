# Security in Weetle

Weetle implements comprehensive security measures to protect against malicious peers in the P2P network.

## Overview

Since Weetle uses WebRTC for direct peer-to-peer communication, we cannot rely solely on server-side validation. Every client must validate incoming data to prevent attacks.

## Security Layers

### 1. Event Validation (Zod Schemas)

All incoming peer events are validated against strict TypeScript schemas using Zod.

**Location**: `packages/peer/validation.ts`

```typescript
import { validateEvent } from "@weetle/peer";

// Validate incoming event
const result = validateEvent(incomingData);

if (!result.success) {
  console.error("Invalid event:", result.error);
  // Reject and potentially report peer
  return;
}

// Safe to process
handleValidEvent(result.data);
```

**Validation includes**:
- Type checking (string, number, boolean, etc.)
- Bounds checking (min/max values)
- Length limits (strings, arrays)
- Allowed values (enums)
- Object depth limits

**Example schemas**:
- Mouse events: Limited to reasonable viewport bounds (0-10000px)
- Text content: Max 5000 characters for notes, 500 for filenames
- Arrays: Max 1000 items (prevents memory exhaustion)
- File transfers: Max 100MB, limited chunk count

### 2. Data Sanitization

Even after validation, all user-generated content is sanitized before display.

```typescript
import { sanitizeString, sanitizeUrl } from "@weetle/peer";

// Sanitize text content (prevents XSS)
const safeText = sanitizeString(userInput);

// Validate URLs (prevents javascript: and data: schemes)
const safeUrl = sanitizeUrl(userProvidedUrl);
if (!safeUrl) {
  // Reject invalid URL
}
```

**Sanitization features**:
- HTML entity encoding (prevents XSS)
- Null byte removal
- Length truncation
- URL scheme validation (only http/https allowed)

### 3. Rate Limiting

Prevent spam and DoS attacks by limiting event frequency per peer.

**Configuration** (`weetle.config.json`):
```json
{
  "security": {
    "rateLimiting": {
      "enabled": true,
      "maxEventsPerSecond": 60,
      "maxEventsPerMinute": 1000
    }
  }
}
```

**How it works**:
- Track events per peer using sliding window
- Reject events exceeding limits
- Automatic reporting of repeat offenders

### 4. Reputation System

Democratic peer reporting with automatic blocking.

**Database Models**:
- `PeerReport`: Track individual reports
- `PeerReputation`: Aggregate reputation scores

**Report Types**:
- `SPAM`: Sending too many events
- `MALICIOUS_DATA`: Invalid or harmful data
- `HARASSMENT`: Inappropriate behavior
- `IMPERSONATION`: Pretending to be someone else
- `OTHER`: Other reasons

**How it works**:
1. Users can report malicious peers
2. Reports include evidence (event data, timestamps)
3. After N reports (default: 5), peer is auto-blocked
4. Reports expire after 30 days (configurable)
5. Reputation scores decrease with reports

**Usage**:
```typescript
// Report a peer
await reportPeer({
  reporterId: currentUser.id,
  reportedId: maliciousPeer.id,
  layerId: currentLayer.id,
  reason: "MALICIOUS_DATA",
  description: "Sending invalid mouse coordinates",
  evidence: JSON.stringify(invalidEvent),
});

// Check if peer is blocked
const reputation = await getPeerReputation(peerId);
if (reputation.isBlocked) {
  // Refuse connection
}
```

### 5. Object Depth Protection

Prevent stack overflow from deeply nested objects.

```typescript
import { checkObjectDepth } from "@weetle/peer";

if (!checkObjectDepth(incomingPayload, maxDepth)) {
  console.error("Object too deeply nested");
  return;
}
```

**Configuration**:
```json
{
  "security": {
    "sanitization": {
      "maxObjectDepth": 10
    }
  }
}
```

## Configuration

All security settings are configurable in `weetle.config.json`:

```json
{
  "security": {
    "validation": {
      "enabled": true,
      "strictMode": true
    },
    "rateLimiting": {
      "enabled": true,
      "maxEventsPerSecond": 60,
      "maxEventsPerMinute": 1000
    },
    "reporting": {
      "enabled": true,
      "autoBlockThreshold": 5,
      "reportExpiryDays": 30
    },
    "sanitization": {
      "maxStringLength": 10000,
      "maxArrayLength": 1000,
      "maxObjectDepth": 10
    }
  }
}
```

**Settings explained**:

- **validation.enabled**: Enable/disable event validation (should always be true)
- **validation.strictMode**: Reject events that don't exactly match schema
- **rateLimiting.maxEventsPerSecond**: Max events from single peer per second
- **rateLimiting.maxEventsPerMinute**: Max events from single peer per minute
- **reporting.autoBlockThreshold**: Number of reports before auto-blocking
- **reporting.reportExpiryDays**: Days until reports expire
- **sanitization.maxStringLength**: Maximum string length (prevents memory attacks)
- **sanitization.maxArrayLength**: Maximum array length
- **sanitization.maxObjectDepth**: Maximum object nesting depth

## Security Best Practices

### For Users

1. **Report suspicious behavior** - Use the report feature if you encounter malicious peers
2. **Review permissions** - Check circle and layer permissions regularly
3. **Be cautious with file transfers** - Only accept files from trusted peers
4. **Monitor sessions** - Watch for unusual activity in session replays

### For Developers

1. **Always validate** - Never trust incoming peer data
2. **Sanitize before display** - All user content must be sanitized
3. **Use TypeScript** - Type safety prevents many vulnerabilities
4. **Test edge cases** - Test with malicious inputs
5. **Follow principle of least privilege** - Grant minimal permissions needed

### Adding New Event Types

When adding new peer event types, follow this checklist:

1. ✅ Define Zod schema in `packages/peer/validation.ts`
2. ✅ Add to `eventSchemas` object
3. ✅ Set appropriate bounds (min/max values)
4. ✅ Add sanitization if handling user text
5. ✅ Test with malicious inputs
6. ✅ Document in README

**Example**:
```typescript
// 1. Define schema
const newFeatureSchema = z.object({
  featureId: boundedString(100),
  value: z.number().min(0).max(1000),
  tags: boundedArray(boundedString(50), 20),
});

// 2. Add to schemas
export const eventSchemas = {
  // ... existing schemas
  "feature:new": newFeatureSchema,
};

// 3. Usage
const result = validateEventPayload("feature:new", payload);
if (result.success) {
  // Process safe data
}
```

## Threat Model

### Threats We Protect Against

✅ **XSS (Cross-Site Scripting)** - HTML entity encoding
✅ **DoS (Denial of Service)** - Rate limiting, bounds checking
✅ **Memory Exhaustion** - Array/string length limits
✅ **Stack Overflow** - Object depth limits
✅ **Data Injection** - Type validation, schema enforcement
✅ **URL Hijacking** - URL scheme validation
✅ **Spam** - Rate limiting, reputation system

### Out of Scope

❌ **Network-level attacks** - Use HTTPS/WSS for the PeerJS server
❌ **Man-in-the-middle** - WebRTC encrypts data channels
❌ **Server compromise** - Standard server security practices apply
❌ **Social engineering** - User education needed

## Security Monitoring

### Metrics to Track

1. **Validation failures per peer** - High rate indicates attack
2. **Report frequency** - Spike might indicate coordinated attack
3. **Blocked peers** - Monitor auto-blocking rate
4. **Event rate per peer** - Detect rate limit violations

### Incident Response

If you detect malicious activity:

1. **Report the peer** - Use the reporting system
2. **Block locally** - Disconnect from the peer immediately
3. **Save evidence** - Export session data with malicious events
4. **Notify circle owner** - Alert other members
5. **File issue** - Report to Weetle maintainers if it's a new attack vector

## Compliance

### Data Protection

- **No PII in events** - Keep personally identifiable information out of peer events
- **End-to-end encrypted** - WebRTC data channels are encrypted
- **Local storage** - Session data stored locally, not on server
- **Right to deletion** - Users can delete their data

### Privacy

- **Minimal data collection** - Only collect what's necessary
- **User consent** - Users agree to terms before joining circles
- **Data retention** - Session data can be deleted
- **Transparent** - Users can inspect all data in sessions

## Updates and Patches

Security is an ongoing process. Stay updated:

1. **Monitor issues** - Watch GitHub for security issues
2. **Update regularly** - Keep Weetle updated
3. **Review config** - Periodically review security settings
4. **Report vulnerabilities** - Responsible disclosure to maintainers

## Contact

To report security vulnerabilities:
- **Email**: security@weetle.dev (when available)
- **GitHub**: Create a security advisory
- **Discord**: @security channel (when available)

Do NOT create public issues for security vulnerabilities.

## Acknowledgments

Security features inspired by:
- OWASP Top 10
- WebRTC Security Best Practices
- Peer-to-peer security research
- Real-world attack patterns
