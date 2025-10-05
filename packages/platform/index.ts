import { IPlatform, PlatformType } from "./types";
import { ChromeStorage } from "./chrome/storage";
import { ChromeMessaging } from "./chrome/messaging";
import { ChromeRuntime } from "./chrome/runtime";
import { WebStorage } from "./web/storage";
import { WebMessaging } from "./web/messaging";
import { WebRuntime } from "./web/runtime";

/**
 * Detect the current platform environment
 */
export function detectPlatform(): PlatformType {
  // Check if chrome.runtime exists and is an extension
  if (
    typeof chrome !== "undefined" &&
    chrome.runtime &&
    chrome.runtime.id
  ) {
    return "extension";
  }

  return "web";
}

/**
 * Create platform instance based on detected environment
 */
export function createPlatform(): IPlatform {
  const platformType = detectPlatform();

  if (platformType === "extension") {
    return {
      storage: new ChromeStorage(),
      messaging: new ChromeMessaging(),
      runtime: new ChromeRuntime(),
    };
  }

  return {
    storage: new WebStorage(),
    messaging: new WebMessaging(),
    runtime: new WebRuntime(),
  };
}

/**
 * Global platform instance
 * Use this throughout the application
 */
export const platform = createPlatform();

/**
 * Re-export types
 */
export * from "./types";
