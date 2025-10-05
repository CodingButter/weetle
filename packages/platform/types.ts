/**
 * Platform abstraction types
 * Allows code to work in both Chrome extension and web environments
 */

export type PlatformType = "extension" | "web";

/**
 * Storage interface
 * Abstracts Chrome storage API vs IndexedDB/LocalStorage
 */
export interface IPlatformStorage {
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Message payload structure
 */
export interface PlatformMessage<T = any> {
  type: string;
  payload: T;
  id?: string;
  timestamp?: number;
}

/**
 * Message handler callback
 */
export type MessageHandler<T = any> = (message: PlatformMessage<T>) => void | Promise<void>;

/**
 * Messaging interface
 * Abstracts Chrome runtime messaging vs custom event bus
 */
export interface IPlatformMessaging {
  send<T = any>(message: PlatformMessage<T>): Promise<void>;
  listen<T = any>(type: string, handler: MessageHandler<T>): () => void;
  listenAll(handler: MessageHandler): () => void;
}

/**
 * Runtime interface
 * Environment detection and capabilities
 */
export interface IPlatformRuntime {
  type: PlatformType;
  isExtension: boolean;
  isWeb: boolean;
  getManifest?(): any;
  getURL?(path: string): string;
}

/**
 * Platform abstraction interface
 * Main entry point for platform-specific functionality
 */
export interface IPlatform {
  storage: IPlatformStorage;
  messaging: IPlatformMessaging;
  runtime: IPlatformRuntime;
}
