import { IPlatformStorage } from "../types";

/**
 * Chrome extension storage implementation
 * Uses chrome.storage.local API
 */
export class ChromeStorage implements IPlatformStorage {
  async get<T = any>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return result[key] ?? null;
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }

  async keys(): Promise<string[]> {
    const all = await chrome.storage.local.get(null);
    return Object.keys(all);
  }
}
