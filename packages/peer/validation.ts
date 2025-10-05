import { z } from "zod";
import type { PeerEventType } from "./types";

/**
 * Security limits from config
 */
export interface ValidationLimits {
  maxStringLength: number;
  maxArrayLength: number;
  maxObjectDepth: number;
}

/**
 * Default validation limits
 */
export const DEFAULT_LIMITS: ValidationLimits = {
  maxStringLength: 10000,
  maxArrayLength: 1000,
  maxObjectDepth: 10,
};

/**
 * Create bounded string schema
 */
const boundedString = (maxLength: number = DEFAULT_LIMITS.maxStringLength) =>
  z.string().max(maxLength);

/**
 * Create bounded array schema
 */
const boundedArray = <T extends z.ZodTypeAny>(
  itemSchema: T,
  maxLength: number = DEFAULT_LIMITS.maxArrayLength
) => z.array(itemSchema).max(maxLength);

/**
 * Base event schema
 */
const baseEventSchema = z.object({
  type: z.string(),
  userId: boundedString(100),
  layerId: boundedString(100),
  timestamp: z.number().int().positive(),
  sequence: z.number().int().nonnegative(),
  payload: z.unknown(),
});

/**
 * Mouse move event schema (UV coordinates)
 */
const mouseMoveSchema = z.object({
  u: z.number().min(0).max(1), // normalized x coordinate
  v: z.number().min(0).max(1), // normalized y coordinate
  velocity: z.number().min(0).max(10).optional(), // normalized velocity
  scrollX: z.number().min(0).optional(),
  scrollY: z.number().min(0).optional(),
});

/**
 * Mouse click event schema (UV coordinates)
 */
const mouseClickSchema = z.object({
  u: z.number().min(0).max(1), // normalized x coordinate
  v: z.number().min(0).max(1), // normalized y coordinate
  button: z.number().int().min(0).max(2), // 0=left, 1=middle, 2=right
  elementSelector: boundedString(1000).optional(),
  scrollX: z.number().min(0).optional(),
  scrollY: z.number().min(0).optional(),
});

/**
 * Keyboard input event schema
 */
const keyboardInputSchema = z.object({
  key: boundedString(50),
  code: boundedString(50),
  altKey: z.boolean(),
  ctrlKey: z.boolean(),
  metaKey: z.boolean(),
  shiftKey: z.boolean(),
  elementSelector: boundedString(1000).optional(),
  inputValue: boundedString(10000).optional(),
});

/**
 * Scroll event schema
 */
const scrollSchema = z.object({
  scrollX: z.number().min(0).max(1000000),
  scrollY: z.number().min(0).max(1000000),
  scrollHeight: z.number().int().positive().max(1000000),
  scrollWidth: z.number().int().positive().max(1000000),
});

/**
 * Sticky note data schema
 */
const stickyNoteSchema = z.object({
  id: boundedString(100),
  x: z.number().min(0),
  y: z.number().min(0),
  width: z.number().min(50).max(2000),
  height: z.number().min(50).max(2000),
  content: boundedString(10000),
  backgroundColor: boundedString(50), // hex color
  textColor: boundedString(50), // hex color
  createdBy: boundedString(100),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

/**
 * Mark create/update schema (legacy for other mark types)
 */
const markSchema = z.object({
  markId: boundedString(100),
  kind: z.enum(["STICKY_NOTE", "HIGHLIGHT", "STROKE", "SHAPE"]),
  payload: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    text: boundedString(5000).optional(),
    color: boundedString(50).optional(),
    points: boundedArray(
      z.object({
        x: z.number(),
        y: z.number(),
      }),
      1000
    ).optional(),
  }),
});

/**
 * Mark delete schema
 */
const markDeleteSchema = z.object({
  id: boundedString(100).optional(), // For sticky notes
  markId: boundedString(100).optional(), // For legacy marks
});

/**
 * Page navigate schema
 */
const pageNavigateSchema = z.object({
  url: boundedString(2000),
  title: boundedString(500).optional(),
});

/**
 * Control event schema
 */
const controlSchema = z.object({
  targetUserId: boundedString(100).optional(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
});

/**
 * Chat message schema
 */
const chatMessageSchema = z.object({
  messageId: boundedString(100),
  text: boundedString(5000),
  replyToId: boundedString(100).optional(),
});

/**
 * File transfer start schema
 */
const fileTransferStartSchema = z.object({
  fileId: boundedString(100),
  fileName: boundedString(500),
  fileSize: z.number().int().positive().max(104857600), // 100MB max
  fileType: boundedString(100),
  chunkCount: z.number().int().positive().max(10000),
});

/**
 * File transfer chunk schema
 */
const fileTransferChunkSchema = z.object({
  fileId: boundedString(100),
  chunkIndex: z.number().int().nonnegative(),
  data: z.instanceof(ArrayBuffer),
});

/**
 * File transfer complete schema
 */
const fileTransferCompleteSchema = z.object({
  fileId: boundedString(100),
  success: z.boolean(),
  error: boundedString(500).optional(),
});

/**
 * Peer info schema
 */
const peerInfoSchema = z.object({
  peerId: boundedString(100),
  userId: boundedString(100),
  username: boundedString(100).optional(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
  hasControl: z.boolean(),
});

/**
 * Peer disconnect schema
 */
const peerDisconnectSchema = z.object({
  peerId: boundedString(100),
});

/**
 * Event payload schemas by type
 */
export const eventSchemas: Record<PeerEventType | "peer:info", z.ZodSchema> = {
  "mouse:move": mouseMoveSchema,
  "mouse:click": mouseClickSchema,
  "keyboard:input": keyboardInputSchema,
  scroll: scrollSchema,
  "mark:create": stickyNoteSchema, // Using sticky note schema for now
  "mark:update": stickyNoteSchema, // Using sticky note schema for now
  "mark:delete": markDeleteSchema,
  "page:navigate": pageNavigateSchema,
  "control:request": controlSchema,
  "control:grant": controlSchema,
  "control:revoke": controlSchema,
  "chat:message": chatMessageSchema,
  "file:transfer:start": fileTransferStartSchema,
  "file:transfer:chunk": fileTransferChunkSchema,
  "file:transfer:complete": fileTransferCompleteSchema,
  "peer:disconnect": peerDisconnectSchema,
  "peer:info": peerInfoSchema,
};

/**
 * Validation result
 */
export interface ValidationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validate event payload
 */
export function validateEventPayload<T = any>(
  type: string,
  payload: unknown
): ValidationResult<T> {
  const schema = eventSchemas[type as PeerEventType];

  if (!schema) {
    return {
      success: false,
      error: `Unknown event type: ${type}`,
    };
  }

  try {
    const validatedData = schema.parse(payload);
    return {
      success: true,
      data: validatedData as T,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`,
      };
    }
    return {
      success: false,
      error: `Validation error: ${error}`,
    };
  }
}

/**
 * Validate full event
 */
export function validateEvent(event: unknown): ValidationResult {
  try {
    const baseEvent = baseEventSchema.parse(event);

    // Validate payload
    const payloadResult = validateEventPayload(baseEvent.type, baseEvent.payload);

    if (!payloadResult.success) {
      return payloadResult;
    }

    return {
      success: true,
      data: {
        ...baseEvent,
        payload: payloadResult.data,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Event validation failed: ${error.errors.map((e) => e.message).join(", ")}`,
      };
    }
    return {
      success: false,
      error: `Event validation error: ${error}`,
    };
  }
}

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(str: string, maxLength: number = DEFAULT_LIMITS.maxStringLength): string {
  // Remove null bytes
  let sanitized = str.replace(/\0/g, "");

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Basic HTML entity encoding for display
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");

  return sanitized;
}

/**
 * Sanitize URL to prevent javascript: and data: schemes
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Only allow http, https, and relative URLs
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, it's invalid
    return null;
  }
}

/**
 * Check object depth to prevent stack overflow
 */
export function checkObjectDepth(obj: any, maxDepth: number = DEFAULT_LIMITS.maxObjectDepth): boolean {
  function getDepth(obj: any, currentDepth: number = 0): number {
    if (currentDepth > maxDepth) {
      return currentDepth;
    }

    if (obj === null || typeof obj !== "object") {
      return currentDepth;
    }

    const depths = Object.values(obj).map((value) => getDepth(value, currentDepth + 1));

    return Math.max(currentDepth, ...depths);
  }

  return getDepth(obj) <= maxDepth;
}
