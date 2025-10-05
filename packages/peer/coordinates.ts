/**
 * Coordinate conversion utilities for viewport-independent positioning
 */

/**
 * Pixel coordinates
 */
export interface PixelCoordinates {
  x: number;
  y: number;
}

/**
 * Normalized UV coordinates (0-1)
 */
export interface UVCoordinates {
  u: number;
  v: number;
}

/**
 * Viewport dimensions
 */
export interface ViewportDimensions {
  width: number;
  height: number;
}

/**
 * Convert pixel coordinates to normalized UV coordinates
 *
 * @param pixel - Pixel coordinates (x, y)
 * @param viewport - Viewport dimensions
 * @returns Normalized UV coordinates (0-1)
 *
 * @example
 * ```typescript
 * const uv = pixelToUV(
 *   { x: 960, y: 540 },
 *   { width: 1920, height: 1080 }
 * );
 * // Result: { u: 0.5, v: 0.5 }
 * ```
 */
export function pixelToUV(
  pixel: PixelCoordinates,
  viewport: ViewportDimensions
): UVCoordinates {
  return {
    u: Math.max(0, Math.min(1, pixel.x / viewport.width)),
    v: Math.max(0, Math.min(1, pixel.y / viewport.height)),
  };
}

/**
 * Convert normalized UV coordinates to pixel coordinates
 *
 * @param uv - Normalized UV coordinates (0-1)
 * @param viewport - Viewport dimensions
 * @returns Pixel coordinates (x, y)
 *
 * @example
 * ```typescript
 * const pixel = uvToPixel(
 *   { u: 0.5, v: 0.5 },
 *   { width: 1920, height: 1080 }
 * );
 * // Result: { x: 960, y: 540 }
 * ```
 */
export function uvToPixel(
  uv: UVCoordinates,
  viewport: ViewportDimensions
): PixelCoordinates {
  return {
    x: uv.u * viewport.width,
    y: uv.v * viewport.height,
  };
}

/**
 * Convert pixel velocity to normalized velocity
 * Velocity is the change in position over time
 *
 * @param pixelVelocity - Velocity in pixels per second
 * @param viewport - Viewport dimensions
 * @returns Normalized velocity (units per second)
 *
 * @example
 * ```typescript
 * // Moving 500 pixels/sec on 1920px wide screen
 * const normalizedVelocity = pixelVelocityToNormalized(
 *   500,
 *   { width: 1920, height: 1080 }
 * );
 * // Result: ~0.26 (500/1920)
 * ```
 */
export function pixelVelocityToNormalized(
  pixelVelocity: number,
  viewport: ViewportDimensions
): number {
  // Use diagonal length for direction-independent velocity
  const diagonalLength = Math.sqrt(
    viewport.width ** 2 + viewport.height ** 2
  );
  return pixelVelocity / diagonalLength;
}

/**
 * Convert normalized velocity to pixel velocity
 *
 * @param normalizedVelocity - Normalized velocity (units per second)
 * @param viewport - Viewport dimensions
 * @returns Velocity in pixels per second
 */
export function normalizedVelocityToPixel(
  normalizedVelocity: number,
  viewport: ViewportDimensions
): number {
  const diagonalLength = Math.sqrt(
    viewport.width ** 2 + viewport.height ** 2
  );
  return normalizedVelocity * diagonalLength;
}

/**
 * Get current viewport dimensions
 *
 * @returns Current viewport width and height
 */
export function getViewportDimensions(): ViewportDimensions {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Get current scroll position
 *
 * @returns Current scroll x and y
 */
export function getScrollPosition(): { scrollX: number; scrollY: number } {
  return {
    scrollX: window.scrollX || window.pageXOffset,
    scrollY: window.scrollY || window.pageYOffset,
  };
}

/**
 * Convert page coordinates (including scroll) to viewport UV coordinates
 *
 * @param pageX - X coordinate on the page (including scroll)
 * @param pageY - Y coordinate on the page (including scroll)
 * @returns UV coordinates relative to current viewport
 */
export function pageToViewportUV(
  pageX: number,
  pageY: number
): UVCoordinates {
  const scroll = getScrollPosition();
  const viewport = getViewportDimensions();

  const viewportX = pageX - scroll.scrollX;
  const viewportY = pageY - scroll.scrollY;

  return pixelToUV({ x: viewportX, y: viewportY }, viewport);
}

/**
 * Convert viewport UV coordinates to page coordinates (including scroll)
 *
 * @param uv - UV coordinates relative to viewport
 * @returns Page coordinates (including scroll)
 */
export function viewportUVToPage(
  uv: UVCoordinates
): { pageX: number; pageY: number } {
  const scroll = getScrollPosition();
  const viewport = getViewportDimensions();

  const pixel = uvToPixel(uv, viewport);

  return {
    pageX: pixel.x + scroll.scrollX,
    pageY: pixel.y + scroll.scrollY,
  };
}

/**
 * Clamp UV coordinates to valid range (0-1)
 */
export function clampUV(uv: UVCoordinates): UVCoordinates {
  return {
    u: Math.max(0, Math.min(1, uv.u)),
    v: Math.max(0, Math.min(1, uv.v)),
  };
}

/**
 * Calculate distance between two UV coordinates
 * Returns normalized distance (0-1, where 1 is diagonal corner to corner)
 */
export function uvDistance(a: UVCoordinates, b: UVCoordinates): number {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  return Math.sqrt(du * du + dv * dv);
}
