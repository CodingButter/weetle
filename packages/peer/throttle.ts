import type { ThrottleConfig } from "./types";

/**
 * Adaptive throttle that adjusts rate based on velocity
 * Fast movements = higher sample rate, slow movements = lower sample rate
 * Works with both pixel coordinates and UV coordinates
 */
export class AdaptiveThrottle<T extends { u: number; v: number } | { x: number; y: number }> {
  private lastEvent: T | null = null;
  private lastEmitTime = 0;
  private lastPosition: { x: number; y: number } = { x: 0, y: 0 };
  private lastMoveTime = 0;
  private config: ThrottleConfig;

  constructor(config: ThrottleConfig) {
    this.config = config;
  }

  /**
   * Calculate velocity (supports both pixel and UV coordinates)
   * For UV coordinates, velocity is in normalized units per second
   * For pixel coordinates, velocity is in pixels per second
   */
  private calculateVelocity(current: T, timestamp: number): number {
    if (!this.lastMoveTime) {
      this.lastPosition = this.extractPosition(current);
      this.lastMoveTime = timestamp;
      return 0;
    }

    const currentPos = this.extractPosition(current);
    const deltaX = currentPos.x - this.lastPosition.x;
    const deltaY = currentPos.y - this.lastPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const deltaTime = (timestamp - this.lastMoveTime) / 1000; // convert to seconds

    this.lastPosition = currentPos;
    this.lastMoveTime = timestamp;

    return deltaTime > 0 ? distance / deltaTime : 0;
  }

  /**
   * Extract position from event (supports both u/v and x/y)
   */
  private extractPosition(event: T): { x: number; y: number } {
    if ('u' in event && 'v' in event) {
      return { x: event.u, y: event.v };
    }
    return { x: (event as any).x, y: (event as any).y };
  }

  /**
   * Get throttle interval based on velocity
   * Higher velocity = shorter interval (more frequent updates)
   * Lower velocity = longer interval (less frequent updates)
   */
  private getThrottleInterval(velocity: number): number {
    const { minInterval, maxInterval, velocityThreshold } = this.config;

    if (velocity >= velocityThreshold) {
      return minInterval;
    }

    // Linear interpolation between min and max interval based on velocity
    const ratio = velocity / velocityThreshold;
    return maxInterval - ratio * (maxInterval - minInterval);
  }

  /**
   * Process event with adaptive throttling
   * Returns the event if it should be emitted, null otherwise
   */
  throttle(event: T, timestamp: number = Date.now()): (T & { velocity: number }) | null {
    const velocity = this.calculateVelocity(event, timestamp);
    const throttleInterval = this.getThrottleInterval(velocity);
    const timeSinceLastEmit = timestamp - this.lastEmitTime;

    if (timeSinceLastEmit >= throttleInterval) {
      this.lastEmitTime = timestamp;
      this.lastEvent = event;
      return { ...event, velocity };
    }

    // Store but don't emit
    this.lastEvent = event;
    return null;
  }

  /**
   * Force emit the last stored event
   * Useful for ensuring final position is sent when movement stops
   */
  flush(): (T & { velocity: number }) | null {
    if (this.lastEvent && this.lastEvent !== this.lastPosition) {
      const event = { ...this.lastEvent, velocity: 0 };
      this.lastEvent = null;
      return event;
    }
    return null;
  }

  /**
   * Reset throttle state
   */
  reset(): void {
    this.lastEvent = null;
    this.lastEmitTime = 0;
    this.lastPosition = { x: 0, y: 0 };
    this.lastMoveTime = 0;
  }
}

/**
 * Interpolation helper for smooth client-side rendering
 * Eases between received positions for smooth cursor movement
 * Works with both pixel and UV coordinates
 */
export class PositionInterpolator {
  private currentPosition = { x: 0, y: 0 };
  private targetPosition = { x: 0, y: 0 };
  private lastUpdateTime = 0;
  private velocity = 0;

  /**
   * Update target position from network event
   * Can use either pixel or UV coordinates (just pass the values)
   */
  setTarget(x: number, y: number, velocity: number = 0): void {
    this.targetPosition = { x, y };
    this.velocity = velocity;
    this.lastUpdateTime = Date.now();
  }

  /**
   * Get interpolated position for current frame
   * Uses easing based on velocity for smooth movement
   * Returns same coordinate system as input (pixels or UV)
   */
  getPosition(timestamp: number = Date.now()): { x: number; y: number } {
    const deltaTime = timestamp - this.lastUpdateTime;
    const distance = Math.sqrt(
      Math.pow(this.targetPosition.x - this.currentPosition.x, 2) +
        Math.pow(this.targetPosition.y - this.currentPosition.y, 2)
    );

    // Threshold depends on coordinate system
    // For UV (0-1): use 0.001, for pixels: use 1
    const threshold = this.targetPosition.x <= 1 ? 0.001 : 1;

    if (distance < threshold) {
      this.currentPosition = { ...this.targetPosition };
      return this.currentPosition;
    }

    // Adaptive easing factor based on velocity
    // Higher velocity = faster interpolation
    const baseLerpFactor = 0.1;
    const velocityBoost = Math.min(this.velocity / 1000, 0.3); // cap at 0.3
    const lerpFactor = baseLerpFactor + velocityBoost;

    this.currentPosition = {
      x: this.currentPosition.x + (this.targetPosition.x - this.currentPosition.x) * lerpFactor,
      y: this.currentPosition.y + (this.targetPosition.y - this.currentPosition.y) * lerpFactor,
    };

    return this.currentPosition;
  }

  /**
   * Reset interpolator state
   */
  reset(): void {
    this.currentPosition = { x: 0, y: 0 };
    this.targetPosition = { x: 0, y: 0 };
    this.lastUpdateTime = 0;
    this.velocity = 0;
  }
}

/**
 * Default throttle configurations
 */
export const DEFAULT_THROTTLE_CONFIG: Record<string, ThrottleConfig> = {
  mouseMove: {
    minInterval: 16, // ~60fps for fast movements
    maxInterval: 100, // ~10fps for slow movements
    velocityThreshold: 500, // 500 pixels/second
  },
  scroll: {
    minInterval: 50, // ~20fps for fast scrolling
    maxInterval: 200, // ~5fps for slow scrolling
    velocityThreshold: 1000, // 1000 pixels/second
  },
};
