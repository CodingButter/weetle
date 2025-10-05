import type { PeerConnectionManager } from "./manager";
import type {
  FileTransferStart,
  FileTransferChunk,
  FileTransferComplete,
} from "./types";

/**
 * File transfer state
 */
interface FileTransfer {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  chunks: Map<number, ArrayBuffer>;
  totalChunks: number;
  receivedChunks: number;
  startTime: number;
  fromPeerId: string;
}

/**
 * File transfer progress callback
 */
type ProgressCallback = (fileId: string, progress: number, fileName: string) => void;

/**
 * File transfer complete callback
 */
type CompleteCallback = (fileId: string, file: Blob, fileName: string) => void;

/**
 * File transfer manager
 * Handles chunked file transfers over WebRTC data channels
 */
export class FileTransferManager {
  private peerManager: PeerConnectionManager;
  private activeTransfers = new Map<string, FileTransfer>();
  private chunkSize = 16 * 1024; // 16KB chunks
  private progressCallbacks = new Set<ProgressCallback>();
  private completeCallbacks = new Set<CompleteCallback>();

  constructor(peerManager: PeerConnectionManager) {
    this.peerManager = peerManager;
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for file transfer events
   */
  private setupEventHandlers(): void {
    this.peerManager.on("file:transfer:start", (event, peerId) => {
      this.handleTransferStart(event.payload, peerId);
    });

    this.peerManager.on("file:transfer:chunk", (event, peerId) => {
      this.handleTransferChunk(event.payload, peerId);
    });

    this.peerManager.on("file:transfer:complete", (event, peerId) => {
      this.handleTransferComplete(event.payload, peerId);
    });
  }

  /**
   * Send file to all peers
   */
  async broadcastFile(file: File): Promise<string> {
    const fileId = crypto.randomUUID();
    const chunkCount = Math.ceil(file.size / this.chunkSize);

    // Send start event
    const startPayload: FileTransferStart = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      chunkCount,
    };

    this.peerManager.broadcast("file:transfer:start", startPayload);

    // Send chunks
    await this.sendFileChunks(file, fileId, chunkCount);

    // Send complete event
    this.peerManager.broadcast("file:transfer:complete", {
      fileId,
      success: true,
    });

    return fileId;
  }

  /**
   * Send file to specific peer
   */
  async sendFile(peerId: string, file: File): Promise<string> {
    const fileId = crypto.randomUUID();
    const chunkCount = Math.ceil(file.size / this.chunkSize);

    // Send start event
    const startPayload: FileTransferStart = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      chunkCount,
    };

    this.peerManager.send(peerId, "file:transfer:start", startPayload);

    // Send chunks
    await this.sendFileChunks(file, fileId, chunkCount, peerId);

    // Send complete event
    this.peerManager.send(peerId, "file:transfer:complete", {
      fileId,
      success: true,
    });

    return fileId;
  }

  /**
   * Send file chunks
   */
  private async sendFileChunks(
    file: File,
    fileId: string,
    chunkCount: number,
    peerId?: string
  ): Promise<void> {
    for (let i = 0; i < chunkCount; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, file.size);
      const chunk = file.slice(start, end);
      const arrayBuffer = await chunk.arrayBuffer();

      const chunkPayload: FileTransferChunk = {
        fileId,
        chunkIndex: i,
        data: arrayBuffer,
      };

      if (peerId) {
        this.peerManager.send(peerId, "file:transfer:chunk", chunkPayload);
      } else {
        this.peerManager.broadcast("file:transfer:chunk", chunkPayload);
      }

      // Small delay to prevent overwhelming the connection
      if (i < chunkCount - 1) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Handle transfer start event
   */
  private handleTransferStart(payload: FileTransferStart, fromPeerId: string): void {
    const transfer: FileTransfer = {
      fileId: payload.fileId,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      fileType: payload.fileType,
      chunks: new Map(),
      totalChunks: payload.chunkCount,
      receivedChunks: 0,
      startTime: Date.now(),
      fromPeerId,
    };

    this.activeTransfers.set(payload.fileId, transfer);
    console.log(
      `[FileTransfer] Receiving file: ${payload.fileName} (${payload.fileSize} bytes, ${payload.chunkCount} chunks)`
    );
  }

  /**
   * Handle transfer chunk event
   */
  private handleTransferChunk(payload: FileTransferChunk, fromPeerId: string): void {
    const transfer = this.activeTransfers.get(payload.fileId);
    if (!transfer) {
      console.warn("[FileTransfer] Received chunk for unknown transfer:", payload.fileId);
      return;
    }

    // Store chunk
    transfer.chunks.set(payload.chunkIndex, payload.data);
    transfer.receivedChunks++;

    // Calculate and emit progress
    const progress = (transfer.receivedChunks / transfer.totalChunks) * 100;
    this.emitProgress(payload.fileId, progress, transfer.fileName);

    // Check if transfer is complete
    if (transfer.receivedChunks === transfer.totalChunks) {
      this.assembleFile(transfer);
    }
  }

  /**
   * Handle transfer complete event
   */
  private handleTransferComplete(payload: FileTransferComplete, fromPeerId: string): void {
    if (!payload.success) {
      console.error("[FileTransfer] Transfer failed:", payload.error);
      this.activeTransfers.delete(payload.fileId);
    }
  }

  /**
   * Assemble file from chunks
   */
  private assembleFile(transfer: FileTransfer): void {
    console.log(`[FileTransfer] Assembling file: ${transfer.fileName}`);

    // Sort chunks by index and combine
    const sortedChunks: ArrayBuffer[] = [];
    for (let i = 0; i < transfer.totalChunks; i++) {
      const chunk = transfer.chunks.get(i);
      if (!chunk) {
        console.error(`[FileTransfer] Missing chunk ${i} for file ${transfer.fileId}`);
        return;
      }
      sortedChunks.push(chunk);
    }

    // Create blob
    const blob = new Blob(sortedChunks, { type: transfer.fileType });
    const duration = Date.now() - transfer.startTime;

    console.log(
      `[FileTransfer] File assembled: ${transfer.fileName} in ${duration}ms (${blob.size} bytes)`
    );

    // Emit complete event
    this.emitComplete(transfer.fileId, blob, transfer.fileName);

    // Clean up
    this.activeTransfers.delete(transfer.fileId);
  }

  /**
   * Emit progress event
   */
  private emitProgress(fileId: string, progress: number, fileName: string): void {
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(fileId, progress, fileName);
      } catch (error) {
        console.error("[FileTransfer] Error in progress callback:", error);
      }
    });
  }

  /**
   * Emit complete event
   */
  private emitComplete(fileId: string, file: Blob, fileName: string): void {
    this.completeCallbacks.forEach((callback) => {
      try {
        callback(fileId, file, fileName);
      } catch (error) {
        console.error("[FileTransfer] Error in complete callback:", error);
      }
    });
  }

  /**
   * Register progress callback
   */
  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  /**
   * Register complete callback
   */
  onComplete(callback: CompleteCallback): () => void {
    this.completeCallbacks.add(callback);
    return () => this.completeCallbacks.delete(callback);
  }

  /**
   * Get active transfers
   */
  getActiveTransfers(): FileTransfer[] {
    return Array.from(this.activeTransfers.values());
  }

  /**
   * Cancel transfer
   */
  cancelTransfer(fileId: string): void {
    const transfer = this.activeTransfers.get(fileId);
    if (transfer) {
      this.peerManager.send(transfer.fromPeerId, "file:transfer:complete", {
        fileId,
        success: false,
        error: "Transfer cancelled",
      });
      this.activeTransfers.delete(fileId);
    }
  }

  /**
   * Set chunk size
   */
  setChunkSize(size: number): void {
    this.chunkSize = size;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.activeTransfers.clear();
    this.progressCallbacks.clear();
    this.completeCallbacks.clear();
  }
}
