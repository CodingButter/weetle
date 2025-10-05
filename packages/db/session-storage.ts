import { Database } from "bun:sqlite";
import { join } from "path";
import { mkdir } from "fs/promises";

/**
 * Session Event Types
 */
export type EventType =
  | "CREATE_NOTE"
  | "MOVE_NOTE"
  | "EDIT_NOTE"
  | "DELETE_NOTE"
  | "CREATE_STROKE"
  | "DELETE_STROKE"
  | "CREATE_HIGHLIGHT"
  | "DELETE_HIGHLIGHT"
  | "PAGE_SCROLL"
  | "PAGE_CLICK"
  | "CHAT_MESSAGE"
  | "USER_JOIN"
  | "USER_LEAVE"
  | "CONTROL_GRANT"
  | "CONTROL_RELEASE";

/**
 * Session Event Structure
 */
export interface SessionEvent {
  id: string;
  userId: string;
  eventType: EventType;
  payload: Record<string, any>;
  timestamp: number; // Unix timestamp in milliseconds
  sequence: number; // Auto-incrementing sequence number
}

/**
 * Session Storage Manager
 * Handles creating, writing to, and reading from session SQLite files
 */
export class SessionStorage {
  private sessionsDir: string;

  constructor(sessionsDir: string = "./sessions") {
    this.sessionsDir = sessionsDir;
  }

  /**
   * Initialize a new session file
   */
  async createSession(sessionId: string): Promise<Database> {
    // Ensure sessions directory exists
    await mkdir(this.sessionsDir, { recursive: true });

    const filePath = this.getSessionPath(sessionId);
    const db = new Database(filePath);

    // Create events table with indexes for fast seeking
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        eventType TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        sequence INTEGER NOT NULL
      );
    `);

    // Index on timestamp for seeking to specific times
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp);
    `);

    // Index on sequence for ordered playback
    db.run(`
      CREATE INDEX IF NOT EXISTS idx_sequence ON events(sequence);
    `);

    return db;
  }

  /**
   * Open an existing session file
   */
  openSession(sessionId: string): Database {
    const filePath = this.getSessionPath(sessionId);
    return new Database(filePath);
  }

  /**
   * Append events to a session file
   */
  appendEvents(db: Database, events: SessionEvent[]): void {
    const stmt = db.prepare(`
      INSERT INTO events (id, userId, eventType, payload, timestamp, sequence)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((events: SessionEvent[]) => {
      for (const event of events) {
        stmt.run(
          event.id,
          event.userId,
          event.eventType,
          JSON.stringify(event.payload),
          event.timestamp,
          event.sequence
        );
      }
    });

    insertMany(events);
  }

  /**
   * Get events starting from a specific timestamp
   */
  getEventsFromTimestamp(
    db: Database,
    startTimestamp: number,
    limit: number = 100
  ): SessionEvent[] {
    const stmt = db.prepare(`
      SELECT * FROM events
      WHERE timestamp >= ?
      ORDER BY sequence ASC
      LIMIT ?
    `);

    const rows = stmt.all(startTimestamp, limit) as any[];

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      eventType: row.eventType as EventType,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
      sequence: row.sequence,
    }));
  }

  /**
   * Get events by sequence number (for ordered playback)
   */
  getEventsBySequence(
    db: Database,
    startSequence: number,
    limit: number = 100
  ): SessionEvent[] {
    const stmt = db.prepare(`
      SELECT * FROM events
      WHERE sequence >= ?
      ORDER BY sequence ASC
      LIMIT ?
    `);

    const rows = stmt.all(startSequence, limit) as any[];

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      eventType: row.eventType as EventType,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
      sequence: row.sequence,
    }));
  }

  /**
   * Get all events in a session
   */
  getAllEvents(db: Database): SessionEvent[] {
    const stmt = db.prepare(`
      SELECT * FROM events
      ORDER BY sequence ASC
    `);

    const rows = stmt.all() as any[];

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      eventType: row.eventType as EventType,
      payload: JSON.parse(row.payload),
      timestamp: row.timestamp,
      sequence: row.sequence,
    }));
  }

  /**
   * Get session metadata (first/last event, count, duration)
   */
  getSessionMetadata(db: Database): {
    eventCount: number;
    firstTimestamp: number | null;
    lastTimestamp: number | null;
    duration: number | null; // in milliseconds
  } {
    const countStmt = db.prepare("SELECT COUNT(*) as count FROM events");
    const count = (countStmt.get() as any).count;

    if (count === 0) {
      return {
        eventCount: 0,
        firstTimestamp: null,
        lastTimestamp: null,
        duration: null,
      };
    }

    const rangeStmt = db.prepare(`
      SELECT MIN(timestamp) as first, MAX(timestamp) as last FROM events
    `);
    const range = rangeStmt.get() as any;

    return {
      eventCount: count,
      firstTimestamp: range.first,
      lastTimestamp: range.last,
      duration: range.last - range.first,
    };
  }

  /**
   * Get the path to a session file
   */
  getSessionPath(sessionId: string): string {
    return join(this.sessionsDir, `${sessionId}.db`);
  }

  /**
   * Close a session database
   */
  closeSession(db: Database): void {
    db.close();
  }
}

/**
 * Global session storage instance
 */
export const sessionStorage = new SessionStorage();
