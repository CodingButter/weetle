import { IPlatformRuntime } from "../types";

/**
 * Chrome extension runtime implementation
 */
export class ChromeRuntime implements IPlatformRuntime {
  readonly type = "extension" as const;
  readonly isExtension = true;
  readonly isWeb = false;

  getManifest() {
    return chrome.runtime.getManifest();
  }

  getURL(path: string): string {
    return chrome.runtime.getURL(path);
  }
}
