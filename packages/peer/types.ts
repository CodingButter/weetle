import type { DataConnection } from "peerjs";

/**
 * Event types that can be sent over peer connections
 */
export type PeerEventType =
  | "mouse:move"
  | "mouse:click"
  | "keyboard:input"
  | "scroll"
  | "mark:create"
  | "mark:update"
  | "mark:delete"
  | "page:navigate"
  | "control:request"
  | "control:grant"
  | "control:revoke"
  | "chat:message"
  | "file:transfer:start"
  | "file:transfer:chunk"
  | "file:transfer:complete"
  | "peer:disconnect";

/**
 * Base peer event structure
 */
export interface PeerEvent<T = any> {
  type: PeerEventType;
  userId: string;
  layerId: string;
  timestamp: number;
  sequence: number;
  payload: T;
}

/**
 * Mouse movement event with velocity-based throttling
 * Uses normalized UV coordinates (0-1) for viewport-independent positioning
 */
export interface MouseMoveEvent {
  u: number; // normalized x (0-1)
  v: number; // normalized y (0-1)
  velocity?: number; // normalized units per second
  scrollX?: number; // for page position context
  scrollY?: number;
  // Drag metadata - piggybacks on mouse move to avoid extra events
  draggingType?: 'sticky-note' | 'drawing' | 'shape'; // type of element being dragged
  draggingId?: string; // ID of the element being dragged
  dragOffsetX?: number; // offset from cursor to element origin
  dragOffsetY?: number; // offset from cursor to element origin
}

/**
 * Mouse click event
 * Uses normalized UV coordinates (0-1) for viewport-independent positioning
 */
export interface MouseClickEvent {
  u: number; // normalized x (0-1)
  v: number; // normalized y (0-1)
  button: number;
  elementSelector?: string; // CSS selector for the clicked element
  scrollX?: number; // page scroll position
  scrollY?: number;
}

/**
 * Keyboard input event
 * Captures keyboard input with element context
 */
export interface KeyboardInputEvent {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  elementSelector?: string; // CSS selector for focused element
  inputValue?: string; // current value of input element
}

/**
 * Scroll event
 */
export interface ScrollEvent {
  scrollX: number;
  scrollY: number;
  scrollHeight: number;
  scrollWidth: number;
}

/**
 * Control request/grant events
 */
export interface ControlEvent {
  targetUserId?: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

/**
 * File transfer events
 */
export interface FileTransferStart {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  chunkCount: number;
}

export interface FileTransferChunk {
  fileId: string;
  chunkIndex: number;
  data: ArrayBuffer;
}

export interface FileTransferComplete {
  fileId: string;
  success: boolean;
  error?: string;
}

/**
 * Peer connection status
 */
export type PeerStatus = "disconnected" | "connecting" | "connected" | "error";

/**
 * Peer info
 */
export interface PeerInfo {
  peerId: string;
  userId: string;
  username?: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  hasControl: boolean;
  connection: DataConnection;
  status: PeerStatus;
  lastSeen: number;
}

/**
 * Throttle configuration for different event types
 */
export interface ThrottleConfig {
  minInterval: number; // minimum ms between events
  maxInterval: number; // maximum ms between events
  velocityThreshold: number; // velocity that triggers min interval
}

/**
 * Peer connection manager configuration
 */
export interface PeerConfig {
  peerId?: string;
  serverHost?: string;
  serverPort?: number;
  serverPath?: string;
  secure?: boolean; // Use secure WebSocket (wss://) - defaults to false
  throttling?: {
    mouseMove?: ThrottleConfig;
    scroll?: ThrottleConfig;
  };
}
