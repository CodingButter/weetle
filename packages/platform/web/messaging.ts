import { IPlatformMessaging, PlatformMessage, MessageHandler } from "../types";

/**
 * Web messaging implementation
 * Uses CustomEvent API with window.dispatchEvent
 */
export class WebMessaging implements IPlatformMessaging {
  private listeners = new Map<string, Set<MessageHandler>>();
  private allListeners = new Set<MessageHandler>();
  private eventName = "weetle:message";

  constructor() {
    // Set up global event listener
    window.addEventListener(this.eventName, ((event: CustomEvent) => {
      this.handleMessage(event.detail);
    }) as EventListener);
  }

  async send<T = any>(message: PlatformMessage<T>): Promise<void> {
    // Ensure message has required fields
    const fullMessage: PlatformMessage<T> = {
      ...message,
      id: message.id || crypto.randomUUID(),
      timestamp: message.timestamp || Date.now(),
    };

    const event = new CustomEvent(this.eventName, {
      detail: fullMessage,
    });

    window.dispatchEvent(event);
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
