import { IPlatformMessaging, PlatformMessage, MessageHandler } from "../types";

/**
 * Chrome extension messaging implementation
 * Uses chrome.runtime messaging API
 */
export class ChromeMessaging implements IPlatformMessaging {
  private listeners = new Map<string, Set<MessageHandler>>();
  private allListeners = new Set<MessageHandler>();

  constructor() {
    // Set up Chrome runtime message listener
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message);
      return false; // Don't keep the channel open
    });
  }

  async send<T = any>(message: PlatformMessage<T>): Promise<void> {
    await chrome.runtime.sendMessage(message);
  }

  listen<T = any>(type: string, handler: MessageHandler<T>): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }

    this.listeners.get(type)!.add(handler as MessageHandler);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(handler as MessageHandler);
    };
  }

  listenAll(handler: MessageHandler): () => void {
    this.allListeners.add(handler);

    // Return unsubscribe function
    return () => {
      this.allListeners.delete(handler);
    };
  }

  private handleMessage(message: PlatformMessage): void {
    // Call type-specific listeners
    const typeListeners = this.listeners.get(message.type);
    if (typeListeners) {
      typeListeners.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          console.error("Error in message handler:", error);
        }
      });
    }

    // Call global listeners
    this.allListeners.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error("Error in global message handler:", error);
      }
    });
  }
}
