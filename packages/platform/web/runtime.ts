import { IPlatformRuntime } from "../types";

/**
 * Web runtime implementation
 */
export class WebRuntime implements IPlatformRuntime {
  readonly type = "web" as const;
  readonly isExtension = false;
  readonly isWeb = true;

  getManifest() {
    return null;
  }

  getURL(path: string): string {
    // In web mode, return the path as-is or construct from base URL
    const base = window.location.origin;
    return new URL(path, base).toString();
  }
}
