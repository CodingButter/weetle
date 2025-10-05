/**
 * Viewport synchronization system
 * Handles different viewport modes for collaborative browsing
 */

export type ViewportMode = "natural" | "match-host" | "hybrid";

export interface ViewportState {
  mode: ViewportMode;
  hostWidth: number;
  hostHeight: number;
  hostDevicePixelRatio: number;
  isHost: boolean;
}

export interface ViewportDimensions {
  width: number;
  height: number;
  devicePixelRatio: number;
}

/**
 * Viewport manager handles synchronizing viewport dimensions across peers
 */
export class ViewportManager {
  private mode: ViewportMode = "natural";
  private hostDimensions: ViewportDimensions | null = null;
  private scaleWrapper: HTMLElement | null = null;
  private originalMetaViewport: string | null = null;
  private isHost = false;

  /**
   * Set viewport mode
   */
  setMode(mode: ViewportMode): void {
    if (this.mode === mode) return;

    // Clean up previous mode
    this.cleanup();

    this.mode = mode;

    // Apply new mode if we have host dimensions
    if (this.hostDimensions && !this.isHost) {
      this.applyMode();
    }
  }

  /**
   * Set host dimensions (called when receiving host viewport info)
   */
  setHostDimensions(dimensions: ViewportDimensions): void {
    this.hostDimensions = dimensions;

    if (!this.isHost && this.mode !== "natural") {
      this.applyMode();
    }
  }

  /**
   * Get current viewport dimensions
   */
  getCurrentDimensions(): ViewportDimensions {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  /**
   * Set as host (broadcasting viewport)
   */
  setAsHost(isHost: boolean): void {
    this.isHost = isHost;
    if (isHost) {
      this.cleanup(); // Hosts don't scale their own view
    }
  }

  /**
   * Apply current viewport mode
   */
  private applyMode(): void {
    if (!this.hostDimensions) return;

    switch (this.mode) {
      case "match-host":
        this.applyMatchHostMode();
        break;
      case "hybrid":
        this.applyHybridMode();
        break;
      case "natural":
      default:
        this.cleanup();
        break;
    }
  }

  /**
   * Match host mode - scale everything to match host viewport exactly
   */
  private applyMatchHostMode(): void {
    if (!this.hostDimensions) return;

    const current = this.getCurrentDimensions();
    const scaleX = current.width / this.hostDimensions.width;
    const scaleY = current.height / this.hostDimensions.height;

    // Use uniform scale (smaller of the two to fit content)
    const scale = Math.min(scaleX, scaleY);

    // Create wrapper if it doesn't exist
    if (!this.scaleWrapper) {
      this.createScaleWrapper();
    }

    if (this.scaleWrapper) {
      // Set the wrapper to match host dimensions
      this.scaleWrapper.style.width = `${this.hostDimensions.width}px`;
      this.scaleWrapper.style.height = `${this.hostDimensions.height}px`;
      this.scaleWrapper.style.transform = `scale(${scale})`;
      this.scaleWrapper.style.transformOrigin = "top left";

      // Center the scaled content
      const offsetX = (current.width - this.hostDimensions.width * scale) / 2;
      const offsetY = (current.height - this.hostDimensions.height * scale) / 2;
      this.scaleWrapper.style.marginLeft = `${offsetX}px`;
      this.scaleWrapper.style.marginTop = `${offsetY}px`;
    }

    // Update meta viewport to match host
    this.updateMetaViewport(this.hostDimensions.width);
  }

  /**
   * Hybrid mode - adjust viewport width to match host, allow natural height
   */
  private applyHybridMode(): void {
    if (!this.hostDimensions) return;

    // Just update meta viewport to match host width
    this.updateMetaViewport(this.hostDimensions.width);

    // Optionally add a width constraint
    const current = this.getCurrentDimensions();
    if (current.width !== this.hostDimensions.width) {
      if (!this.scaleWrapper) {
        this.createScaleWrapper();
      }

      if (this.scaleWrapper) {
        this.scaleWrapper.style.width = `${this.hostDimensions.width}px`;
        this.scaleWrapper.style.margin = "0 auto";
      }
    }
  }

  /**
   * Create scale wrapper element
   */
  private createScaleWrapper(): void {
    // Create wrapper
    this.scaleWrapper = document.createElement("div");
    this.scaleWrapper.id = "weetle-viewport-wrapper";
    this.scaleWrapper.style.cssText = `
      position: relative;
      overflow: hidden;
      box-sizing: border-box;
    `;

    // Move all body children into wrapper
    const bodyChildren = Array.from(document.body.children);
    bodyChildren.forEach((child) => {
      // Skip our own elements
      if (child.id === "weetle-viewport-wrapper" || child.id?.startsWith("weetle-")) {
        return;
      }
      this.scaleWrapper!.appendChild(child);
    });

    // Add wrapper to body
    document.body.insertBefore(this.scaleWrapper, document.body.firstChild);

    // Prevent body from scrolling (wrapper handles it)
    document.body.style.overflow = "hidden";
    document.body.style.margin = "0";
    document.body.style.padding = "0";
  }

  /**
   * Update meta viewport tag
   */
  private updateMetaViewport(width: number): void {
    let metaViewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;

    // Save original if we haven't yet
    if (!this.originalMetaViewport && metaViewport) {
      this.originalMetaViewport = metaViewport.content;
    }

    if (!metaViewport) {
      metaViewport = document.createElement("meta");
      metaViewport.name = "viewport";
      document.head.appendChild(metaViewport);
    }

    metaViewport.content = `width=${width}, initial-scale=1.0, user-scalable=no`;
  }

  /**
   * Restore original meta viewport
   */
  private restoreMetaViewport(): void {
    const metaViewport = document.querySelector('meta[name="viewport"]') as HTMLMetaElement;

    if (metaViewport && this.originalMetaViewport) {
      metaViewport.content = this.originalMetaViewport;
      this.originalMetaViewport = null;
    }
  }

  /**
   * Clean up viewport modifications
   */
  cleanup(): void {
    // Remove scale wrapper
    if (this.scaleWrapper) {
      // Move children back to body
      const wrapperChildren = Array.from(this.scaleWrapper.children);
      wrapperChildren.forEach((child) => {
        document.body.appendChild(child);
      });

      this.scaleWrapper.remove();
      this.scaleWrapper = null;

      // Restore body styles
      document.body.style.overflow = "";
      document.body.style.margin = "";
      document.body.style.padding = "";
    }

    // Restore meta viewport
    this.restoreMetaViewport();
  }

  /**
   * Convert event coordinates based on current viewport mode
   */
  convertEventCoordinates(
    clientX: number,
    clientY: number
  ): { x: number; y: number } {
    if (this.mode === "match-host" && this.scaleWrapper) {
      const rect = this.scaleWrapper.getBoundingClientRect();
      const transform = window.getComputedStyle(this.scaleWrapper).transform;

      // Extract scale from transform matrix
      let scale = 1;
      if (transform && transform !== "none") {
        const values = transform.split("(")[1].split(")")[0].split(",");
        scale = parseFloat(values[0]);
      }

      return {
        x: (clientX - rect.left) / scale,
        y: (clientY - rect.top) / scale,
      };
    }

    return { x: clientX, y: clientY };
  }

  /**
   * Get scale factor (for adjusting UI elements)
   */
  getScaleFactor(): number {
    if (this.mode === "match-host" && this.scaleWrapper) {
      const transform = window.getComputedStyle(this.scaleWrapper).transform;
      if (transform && transform !== "none") {
        const values = transform.split("(")[1].split(")")[0].split(",");
        return parseFloat(values[0]);
      }
    }
    return 1;
  }

  /**
   * Destroy viewport manager
   */
  destroy(): void {
    this.cleanup();
    this.hostDimensions = null;
    this.isHost = false;
  }
}

/**
 * Create viewport event for broadcasting
 */
export function createViewportEvent(mode: ViewportMode): {
  mode: ViewportMode;
  width: number;
  height: number;
  devicePixelRatio: number;
} {
  return {
    mode,
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}

/**
 * Listen for viewport changes
 */
export function onViewportChange(callback: (dimensions: ViewportDimensions) => void): () => void {
  const handler = () => {
    callback({
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    });
  };

  window.addEventListener("resize", handler);
  window.addEventListener("orientationchange", handler);

  return () => {
    window.removeEventListener("resize", handler);
    window.removeEventListener("orientationchange", handler);
  };
}
