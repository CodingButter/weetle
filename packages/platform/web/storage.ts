import { openDB, IDBPDatabase } from "idb";
import { IPlatformStorage } from "../types";

/**
 * Web storage implementation
 * Uses IndexedDB for persistent storage
 */
export class WebStorage implements IPlatformStorage {
  private dbPromise: Promise<IDBPDatabase>;
  private dbName = "weetle-storage";
  private storeName = "keyval";

  constructor() {
    this.dbPromise = openDB(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("keyval")) {
          db.createObjectStore("keyval");
        }
      },
    });
  }

  async get<T = any>(key: string): Promise<T | null> {
    const db = await this.dbPromise;
    const value = await db.get(this.storeName, key);
    return value ?? null;
  }

  async set<T = any>(key: string, value: T): Promise<void> {
    const db = await this.dbPromise;
    await db.put(this.storeName, value, key);
  }

  async remove(key: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(this.storeName, key);
  }

  async clear(): Promise<void> {
    const db = await this.dbPromise;
    await db.clear(this.storeName);
  }

  async keys(): Promise<string[]> {
    const db = await this.dbPromise;
    return (await db.getAllKeys(this.storeName)) as string[];
  }
}
