/**
 * Event payload types for different event kinds
 */

// Sticky Note Events
export interface CreateNotePayload {
  noteId: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: string;
  style: {
    backgroundColor: string;
    textColor: string;
    fontSize: string;
  };
}

export interface MoveNotePayload {
  noteId: string;
  position: { x: number; y: number };
}

export interface EditNotePayload {
  noteId: string;
  content: string;
}

export interface DeleteNotePayload {
  noteId: string;
}

// Drawing/Stroke Events
export interface CreateStrokePayload {
  strokeId: string;
  points: Array<{ x: number; y: number; pressure?: number }>;
  style: {
    color: string;
    width: number;
    opacity: number;
  };
}

export interface DeleteStrokePayload {
  strokeId: string;
}

// Highlight Events
export interface CreateHighlightPayload {
  highlightId: string;
  ranges: Array<{
    startContainer: string; // XPath or CSS selector
    startOffset: number;
    endContainer: string;
    endOffset: number;
  }>;
  color: string;
  note?: string;
}

export interface DeleteHighlightPayload {
  highlightId: string;
}

// Page Control Events
export interface PageScrollPayload {
  scrollX: number;
  scrollY: number;
}

export interface PageClickPayload {
  elementSelector: string;
  clickX: number;
  clickY: number;
}

// Chat Events
export interface ChatMessagePayload {
  messageId: string;
  text: string;
}

// User Presence Events
export interface UserJoinPayload {
  userName: string;
  userAvatar?: string;
}

export interface UserLeavePayload {
  reason?: "disconnect" | "close" | "timeout";
}

// Control Events
export interface ControlGrantPayload {
  grantedTo: string; // userId
  grantedBy: string; // userId
}

export interface ControlReleasePayload {
  releasedBy: string; // userId
}

/**
 * Union type of all event payloads
 */
export type EventPayload =
  | CreateNotePayload
  | MoveNotePayload
  | EditNotePayload
  | DeleteNotePayload
  | CreateStrokePayload
  | DeleteStrokePayload
  | CreateHighlightPayload
  | DeleteHighlightPayload
  | PageScrollPayload
  | PageClickPayload
  | ChatMessagePayload
  | UserJoinPayload
  | UserLeavePayload
  | ControlGrantPayload
  | ControlReleasePayload;

/**
 * Helper to create typed events
 */
export function createEvent<T extends EventPayload>(
  userId: string,
  eventType: string,
  payload: T,
  sequence: number
) {
  return {
    id: crypto.randomUUID(),
    userId,
    eventType,
    payload,
    timestamp: Date.now(),
    sequence,
  };
}
