/**
 * Weetle Peer Package
 * WebRTC peer-to-peer connection management with PeerJS
 */

export { PeerConnectionManager } from "./manager";
export { FileTransferManager } from "./file-transfer";
export { AdaptiveThrottle, PositionInterpolator, DEFAULT_THROTTLE_CONFIG } from "./throttle";
export {
  validateEvent,
  validateEventPayload,
  sanitizeString,
  sanitizeUrl,
  checkObjectDepth,
  DEFAULT_LIMITS,
  eventSchemas,
} from "./validation";
export {
  pixelToUV,
  uvToPixel,
  pixelVelocityToNormalized,
  normalizedVelocityToPixel,
  getViewportDimensions,
  getScrollPosition,
  pageToViewportUV,
  viewportUVToPage,
  clampUV,
  uvDistance,
} from "./coordinates";

export type {
  PeerConfig,
  PeerEvent,
  PeerEventType,
  PeerInfo,
  PeerStatus,
  MouseMoveEvent,
  MouseClickEvent,
  ScrollEvent,
  ControlEvent,
  FileTransferStart,
  FileTransferChunk,
  FileTransferComplete,
  ThrottleConfig,
} from "./types";

export type { ValidationResult, ValidationLimits } from "./validation";
export type {
  PixelCoordinates,
  UVCoordinates,
  ViewportDimensions,
} from "./coordinates";
export type {
  ViewportMode,
  ViewportState,
} from "./viewport";

export { ViewportManager, createViewportEvent, onViewportChange } from "./viewport";
