import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { sessionStorage, SessionEvent } from "@weetle/db/session-storage";
import { Database } from "bun:sqlite";
import { rm, mkdir } from "fs/promises";

const TEST_DIR = "./test-sessions";

describe("SessionStorage", () => {
  beforeAll(async () => {
    // Create test directory
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("should create a new session file", async () => {
    const storage = new (sessionStorage.constructor as any)(TEST_DIR);
    const sessionId = "test-session-1";

    const db = await storage.createSession(sessionId);

    expect(db).toBeDefined();
    expect(db instanceof Database).toBe(true);

    storage.closeSession(db);
  });

  test("should append events to session", async () => {
    const storage = new (sessionStorage.constructor as any)(TEST_DIR);
    const sessionId = "test-session-2";

    const db = await storage.createSession(sessionId);

    const events: SessionEvent[] = [
      {
        id: "event-1",
        userId: "user-1",
        eventType: "CREATE_NOTE",
        payload: { noteId: "note-1", position: { x: 100, y: 100 }, content: "Hello" },
        timestamp: Date.now(),
        sequence: 1,
      },
      {
        id: "event-2",
        userId: "user-1",
        eventType: "MOVE_NOTE",
        payload: { noteId: "note-1", position: { x: 150, y: 150 } },
        timestamp: Date.now() + 1000,
        sequence: 2,
      },
    ];

    storage.appendEvents(db, events);

    const allEvents = storage.getAllEvents(db);
    expect(allEvents).toHaveLength(2);
    expect(allEvents[0].eventType).toBe("CREATE_NOTE");
    expect(allEvents[1].eventType).toBe("MOVE_NOTE");

    storage.closeSession(db);
  });

  test("should retrieve events by timestamp", async () => {
    const storage = new (sessionStorage.constructor as any)(TEST_DIR);
    const sessionId = "test-session-3";

    const db = await storage.createSession(sessionId);

    const now = Date.now();
    const events: SessionEvent[] = [
      {
        id: "event-1",
        userId: "user-1",
        eventType: "CREATE_NOTE",
        payload: {},
        timestamp: now,
        sequence: 1,
      },
      {
        id: "event-2",
        userId: "user-1",
        eventType: "MOVE_NOTE",
        payload: {},
        timestamp: now + 5000,
        sequence: 2,
      },
      {
        id: "event-3",
        userId: "user-1",
        eventType: "DELETE_NOTE",
        payload: {},
        timestamp: now + 10000,
        sequence: 3,
      },
    ];

    storage.appendEvents(db, events);

    // Get events from middle timestamp
    const eventsFromMid = storage.getEventsFromTimestamp(db, now + 5000, 10);
    expect(eventsFromMid).toHaveLength(2);
    expect(eventsFromMid[0].eventType).toBe("MOVE_NOTE");

    storage.closeSession(db);
  });

  test("should get session metadata", async () => {
    const storage = new (sessionStorage.constructor as any)(TEST_DIR);
    const sessionId = "test-session-4";

    const db = await storage.createSession(sessionId);

    const now = Date.now();
    const events: SessionEvent[] = [
      {
        id: "event-1",
        userId: "user-1",
        eventType: "CREATE_NOTE",
        payload: {},
        timestamp: now,
        sequence: 1,
      },
      {
        id: "event-2",
        userId: "user-1",
        eventType: "MOVE_NOTE",
        payload: {},
        timestamp: now + 5000,
        sequence: 2,
      },
    ];

    storage.appendEvents(db, events);

    const metadata = storage.getSessionMetadata(db);
    expect(metadata.eventCount).toBe(2);
    expect(metadata.firstTimestamp).toBe(now);
    expect(metadata.lastTimestamp).toBe(now + 5000);
    expect(metadata.duration).toBe(5000);

    storage.closeSession(db);
  });
});
