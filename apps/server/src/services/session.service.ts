import { PrismaClient } from "@weetle/db";
import {
  sessionStorage,
  SessionEvent,
  EventType,
} from "@weetle/db/session-storage";
import { Database } from "bun:sqlite";
import { resolve } from "path";
import { stat } from "fs/promises";

const prisma = new PrismaClient();

/**
 * Session Service
 * Handles session recording, event storage, and replay
 */
export class SessionService {
  private activeSessions = new Map<string, Database>();

  /**
   * Start a new session for a layer
   */
  async startSession(layerId: string, userId: string) {
    // Check if user has access to the layer
    const layer = await prisma.layer.findUnique({
      where: { id: layerId },
      include: {
        circle: {
          include: {
            memberships: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!layer || layer.circle.memberships.length === 0) {
      throw new Error("Layer not found or you don't have access");
    }

    // Create session record in main database
    const session = await prisma.sessionRecord.create({
      data: {
        layerId,
        filePath: "", // Will update after creating file
        startedAt: new Date(),
      },
    });

    // Create session file
    const db = await sessionStorage.createSession(session.id);
    this.activeSessions.set(session.id, db);

    // Update session record with file path
    const filePath = sessionStorage.getSessionPath(session.id);
    await prisma.sessionRecord.update({
      where: { id: session.id },
      data: { filePath },
    });

    return session;
  }

  /**
   * Append events to an active session
   */
  async appendEvents(sessionId: string, events: SessionEvent[]) {
    // Get or open session database
    let db = this.activeSessions.get(sessionId);

    if (!db) {
      // Session not in memory, open it
      db = sessionStorage.openSession(sessionId);
      this.activeSessions.set(sessionId, db);
    }

    // Append events to session file
    sessionStorage.appendEvents(db, events);

    // Update session metadata
    const metadata = sessionStorage.getSessionMetadata(db);
    await prisma.sessionRecord.update({
      where: { id: sessionId },
      data: {
        eventCount: metadata.eventCount,
      },
    });

    return { success: true, eventCount: metadata.eventCount };
  }

  /**
   * End a session
   */
  async endSession(sessionId: string) {
    const db = this.activeSessions.get(sessionId);

    if (db) {
      // Get final metadata
      const metadata = sessionStorage.getSessionMetadata(db);

      // Close the database
      sessionStorage.closeSession(db);
      this.activeSessions.delete(sessionId);

      // Get file size
      const filePath = sessionStorage.getSessionPath(sessionId);
      const fileStats = await stat(filePath);

      // Update session record
      await prisma.sessionRecord.update({
        where: { id: sessionId },
        data: {
          endedAt: new Date(),
          eventCount: metadata.eventCount,
          duration: metadata.duration
            ? Math.floor(metadata.duration / 1000)
            : null,
          fileSize: fileStats.size,
        },
      });
    }

    return { success: true };
  }

  /**
   * Get events from a session for replay
   */
  async getSessionEvents(
    sessionId: string,
    userId: string,
    startTimestamp?: number,
    limit: number = 100
  ) {
    // Check if session exists and user has access
    const session = await prisma.sessionRecord.findUnique({
      where: { id: sessionId },
      include: {
        layer: {
          include: {
            circle: {
              include: {
                memberships: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.layer.circle.memberships.length === 0) {
      throw new Error("Session not found or you don't have access");
    }

    // Open session database
    const db = sessionStorage.openSession(sessionId);

    // Get events
    const events = startTimestamp
      ? sessionStorage.getEventsFromTimestamp(db, startTimestamp, limit)
      : sessionStorage.getAllEvents(db);

    // Close database
    sessionStorage.closeSession(db);

    return {
      session: {
        id: session.id,
        layerId: session.layerId,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        duration: session.duration,
        eventCount: session.eventCount,
      },
      events,
    };
  }

  /**
   * Get session file path for download
   */
  async getSessionFilePath(sessionId: string, userId: string) {
    const session = await prisma.sessionRecord.findUnique({
      where: { id: sessionId },
      include: {
        layer: {
          include: {
            circle: {
              include: {
                memberships: {
                  where: { userId },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.layer.circle.memberships.length === 0) {
      throw new Error("Session not found or you don't have access");
    }

    return session.filePath;
  }

  /**
   * Get all sessions for a layer
   */
  async getLayerSessions(layerId: string, userId: string) {
    // Check if user has access
    const layer = await prisma.layer.findUnique({
      where: { id: layerId },
      include: {
        circle: {
          include: {
            memberships: {
              where: { userId },
            },
          },
        },
      },
    });

    if (!layer || layer.circle.memberships.length === 0) {
      throw new Error("Layer not found or you don't have access");
    }

    const sessions = await prisma.sessionRecord.findMany({
      where: { layerId },
      orderBy: {
        startedAt: "desc",
      },
    });

    return sessions;
  }
}

export const sessionService = new SessionService();
