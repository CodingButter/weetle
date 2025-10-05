import Peer, { DataConnection } from "peerjs";
import type {
  PeerConfig,
  PeerEvent,
  PeerEventType,
  PeerInfo,
  PeerStatus,
} from "./types";
import { AdaptiveThrottle, DEFAULT_THROTTLE_CONFIG } from "./throttle";
import type { IPlatform } from "@weetle/platform";

/**
 * Event handler type
 */
type EventHandler<T = any> = (event: PeerEvent<T>, peerId: string) => void;

/**
 * Peer connection manager
 * Handles P2P connections, event broadcasting, and connection lifecycle
 */
export class PeerConnectionManager {
  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private peers = new Map<string, PeerInfo>();
  private eventHandlers = new Map<PeerEventType, Set<EventHandler>>();
  private globalHandlers = new Set<EventHandler>();
  private sequenceNumber = 0;
  private userId: string;
  private layerId: string;
  private platform: IPlatform;
  private config: PeerConfig;

  // Throttles for different event types
  private mouseThrottle: AdaptiveThrottle<{ u: number; v: number }>;
  private scrollThrottle: AdaptiveThrottle<{ x: number; y: number }>;

  constructor(userId: string, layerId: string, platform: IPlatform, config: PeerConfig = {}) {
    this.userId = userId;
    this.layerId = layerId;
    this.platform = platform;
    this.config = config;

    // Initialize throttles with config or defaults
    this.mouseThrottle = new AdaptiveThrottle(
      config.throttling?.mouseMove || DEFAULT_THROTTLE_CONFIG.mouseMove
    );
    this.scrollThrottle = new AdaptiveThrottle(
      config.throttling?.scroll || DEFAULT_THROTTLE_CONFIG.scroll
    );
  }

  /**
   * Initialize peer connection
   */
  async initialize(): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: any = {
        debug: 2,
      };

      // Add server config if provided
      if (this.config.serverHost) {
        options.host = this.config.serverHost;
        options.port = this.config.serverPort || 9000;
        options.path = this.config.serverPath || "/peer";
        options.secure = this.config.secure ?? false; // Default to false for localhost
      }

      this.peer = new Peer(this.config.peerId, options);

      this.peer.on("open", (id) => {
        console.log("[Peer] Connected with ID:", id);
        resolve(id);
      });

      this.peer.on("error", (error) => {
        console.error("[Peer] Error:", error);
        reject(error);
      });

      this.peer.on("connection", (conn) => {
        this.handleIncomingConnection(conn);
      });

      this.peer.on("disconnected", () => {
        console.log("[Peer] Disconnected from server");
        this.reconnect();
      });
    });
  }

  /**
   * Connect to another peer
   */
  connect(peerId: string, peerInfo: Omit<PeerInfo, "connection" | "status" | "lastSeen">): void {
    if (!this.peer) {
      throw new Error("Peer not initialized");
    }

    if (this.connections.has(peerId)) {
      console.log("[Peer] Already connected to", peerId);
      return;
    }

    const conn = this.peer.connect(peerId, {
      reliable: true,
      serialization: "json",
    });

    this.setupConnection(conn, peerInfo);
  }

  /**
   * Handle incoming peer connection
   */
  private handleIncomingConnection(conn: DataConnection): void {
    console.log("[Peer] Incoming connection from", conn.peer);

    // Wait for first message to get peer info
    conn.on("open", () => {
      conn.once("data", (data: any) => {
        if (data.type === "peer:info") {
          this.setupConnection(conn, data.payload);
        }
      });
    });
  }

  /**
   * Setup connection event handlers
   */
  private setupConnection(
    conn: DataConnection,
    peerInfo: Omit<PeerInfo, "connection" | "status" | "lastSeen">
  ): void {
    const peerId = conn.peer;

    // Store connection
    this.connections.set(peerId, conn);
    this.peers.set(peerId, {
      ...peerInfo,
      connection: conn,
      status: "connecting",
      lastSeen: Date.now(),
    });

    conn.on("open", () => {
      console.log("[Peer] Connection opened to", peerId);
      this.updatePeerStatus(peerId, "connected");

      // Send our peer info
      conn.send({
        type: "peer:info",
        payload: {
          peerId: this.peer?.id,
          userId: this.userId,
          role: peerInfo.role,
          hasControl: peerInfo.hasControl,
        },
      });
    });

    conn.on("data", (data: any) => {
      this.handlePeerEvent(data, peerId);
    });

    conn.on("close", () => {
      console.log("[Peer] Connection closed to", peerId);
      this.handleDisconnect(peerId);
    });

    conn.on("error", (error) => {
      console.error("[Peer] Connection error with", peerId, error);
      this.updatePeerStatus(peerId, "error");
    });
  }

  /**
   * Handle received peer event
   */
  private handlePeerEvent(data: any, peerId: string): void {
    if (!data.type) return;

    // Update last seen
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.lastSeen = Date.now();
    }

    const event = data as PeerEvent;

    // Call type-specific handlers
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event, peerId);
        } catch (error) {
          console.error("[Peer] Error in event handler:", error);
        }
      });
    }

    // Call global handlers
    this.globalHandlers.forEach((handler) => {
      try {
        handler(event, peerId);
      } catch (error) {
        console.error("[Peer] Error in global handler:", error);
      }
    });
  }

  /**
   * Broadcast event to all connected peers
   */
  broadcast<T = any>(type: PeerEventType, payload: T): void {
    const event: PeerEvent<T> = {
      type,
      userId: this.userId,
      layerId: this.layerId,
      timestamp: Date.now(),
      sequence: this.sequenceNumber++,
      payload,
    };

    this.connections.forEach((conn) => {
      if (conn.open) {
        conn.send(event);
      }
    });
  }

  /**
   * Send event to specific peer
   */
  send<T = any>(peerId: string, type: PeerEventType, payload: T): void {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) {
      console.warn("[Peer] Cannot send to disconnected peer:", peerId);
      return;
    }

    const event: PeerEvent<T> = {
      type,
      userId: this.userId,
      layerId: this.layerId,
      timestamp: Date.now(),
      sequence: this.sequenceNumber++,
      payload,
    };

    conn.send(event);
  }

  /**
   * Broadcast mouse move with adaptive throttling
   * Uses normalized UV coordinates (0-1) for viewport independence
   */
  broadcastMouseMove(u: number, v: number, scrollX?: number, scrollY?: number): void {
    const throttled = this.mouseThrottle.throttle({ u, v });

    if (throttled) {
      this.broadcast("mouse:move", {
        u: throttled.u,
        v: throttled.v,
        velocity: throttled.velocity,
        scrollX,
        scrollY,
      });
    }
  }

  /**
   * Flush mouse move throttle (send final position)
   */
  flushMouseMove(scrollX?: number, scrollY?: number): void {
    const flushed = this.mouseThrottle.flush();

    if (flushed) {
      this.broadcast("mouse:move", {
        u: flushed.u,
        v: flushed.v,
        velocity: flushed.velocity,
        scrollX,
        scrollY,
      });
    }
  }

  /**
   * Register event handler for specific event type
   */
  on<T = any>(type: PeerEventType, handler: EventHandler<T>): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }

    this.eventHandlers.get(type)!.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.get(type)?.delete(handler as EventHandler);
    };
  }

  /**
   * Register global event handler (receives all events)
   */
  onAll(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);

    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  /**
   * Disconnect from specific peer
   */
  disconnect(peerId: string): void {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.close();
    }
    this.handleDisconnect(peerId);
  }

  /**
   * Emit event to registered handlers
   */
  private emitToHandlers<T = any>(type: PeerEventType, payload: T, peerId: string): void {
    const event: PeerEvent<T> = {
      type,
      userId: this.userId,
      layerId: this.layerId,
      timestamp: Date.now(),
      sequence: this.sequenceNumber++,
      payload,
    };

    // Call type-specific handlers
    const handlers = this.eventHandlers.get(type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(event, peerId);
        } catch (error) {
          console.error("[Peer] Error in event handler:", error);
        }
      });
    }

    // Call global handlers
    this.globalHandlers.forEach((handler) => {
      try {
        handler(event, peerId);
      } catch (error) {
        console.error("[Peer] Error in global handler:", error);
      }
    });
  }

  /**
   * Handle peer disconnect
   */
  private handleDisconnect(peerId: string): void {
    // Emit disconnect event before removing peer data
    this.emitToHandlers("peer:disconnect", { peerId }, peerId);

    this.connections.delete(peerId);
    this.peers.delete(peerId);
    console.log("[Peer] Removed peer:", peerId);
  }

  /**
   * Update peer status
   */
  private updatePeerStatus(peerId: string, status: PeerStatus): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.status = status;
    }
  }

  /**
   * Reconnect to peer server
   */
  private reconnect(): void {
    if (!this.peer || this.peer.destroyed) {
      console.log("[Peer] Attempting to reconnect...");
      this.initialize().catch((error) => {
        console.error("[Peer] Reconnection failed:", error);
        // Retry after delay
        setTimeout(() => this.reconnect(), 5000);
      });
    } else {
      this.peer.reconnect();
    }
  }

  /**
   * Get all connected peers
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get specific peer info
   */
  getPeer(peerId: string): PeerInfo | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Check if connected to peer
   */
  isConnected(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    return peer?.status === "connected" ?? false;
  }

  /**
   * Get current peer ID
   */
  getPeerId(): string | null {
    return this.peer?.id ?? null;
  }

  /**
   * Destroy peer connection manager
   */
  destroy(): void {
    // Close all connections
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    this.peers.clear();
    this.eventHandlers.clear();
    this.globalHandlers.clear();

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    console.log("[Peer] Manager destroyed");
  }
}
