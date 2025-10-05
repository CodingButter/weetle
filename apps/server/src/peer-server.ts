import { PeerServer } from "peer";

/**
 * Create standalone PeerJS server for WebRTC signaling
 * Runs on a separate port from the main API server
 */
export function createPeerServer(port: number = 9000) {
  const peerServer = PeerServer({
    port,
    path: "/peer",
    allow_discovery: true,
  });

  peerServer.on("connection", (client) => {
    console.log(`[PeerServer] Client connected: ${client.getId()}`);
  });

  peerServer.on("disconnect", (client) => {
    console.log(`[PeerServer] Client disconnected: ${client.getId()}`);
  });

  console.log(`🔗 PeerJS server running on port ${port} at /peer`);

  return peerServer;
}
