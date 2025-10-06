/**
 * Weetle Content Script
 * Handles mouse tracking, peer connections, and remote cursor rendering
 */

import { PeerConnectionManager } from "@weetle/peer";
import { platform } from "@weetle/platform";
import { pixelToUV, getViewportDimensions, getScrollPosition } from "@weetle/peer";
import {
  getElementSelector,
  findElementBySelector,
  simulateClick,
  simulateKeyboardInput,
} from "./elementSelector";
import { StickyNotesManager } from "./stickyNotes";
import { RPCBridge } from "./rpc";
import type { RPCCall } from "./rpc";
import { DOMReplicator } from "@weetle/dom-replicator";
import type { DOMDelta } from "@weetle/dom-replicator";

console.log("[Weetle] Content script loaded on:", window.location.href);

// Inject marker element for extension detection
const extensionMarker = document.createElement('div');
extensionMarker.setAttribute('data-weetle-extension', 'true');
extensionMarker.style.display = 'none';
document.documentElement.appendChild(extensionMarker);

// Listen for extension check messages
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'WEETLE_EXTENSION_CHECK') {
    window.postMessage({ type: 'WEETLE_EXTENSION_PRESENT' }, '*');
  }
});

// Global state
let peerManager: PeerConnectionManager | null = null;
let currentUserId: string | null = null;
let currentCircleId: string = 'anonymous';
let currentLayerId: string | null = null;
let isAnonymous = false;
let isTemporaryCircle = false; // Track if using URL param circle
let remoteCursors = new Map<string, HTMLDivElement>();
let cursorScales = new Map<string, number>(); // Track scale for each cursor
let stickyNotesManager: StickyNotesManager | null = null;
let rpcBridge: RPCBridge | null = null; // RPC for Weetle components
let domReplicator: DOMReplicator | null = null; // DOM replication for page interactions
let audioEnabled = false; // Track if audio is enabled (after first user interaction)
let clickAudio: HTMLAudioElement | null = null;

// Store circle passwords in memory (later will be in extension storage)
const circlePasswords = new Map<string, string>();

// No more event deduplication needed!
// DOMReplicator handles ping-pong prevention with ignoreNextMutation

/**
 * Initialize Weetle on this page
 */
async function initializeWeetle() {
  console.log("[Weetle] Initializing...");

  // Get circle assignment from background worker
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_TAB_CIRCLE' });
    if (response?.circleId) {
      currentCircleId = response.circleId;
      console.log(`[Weetle] Using circle: ${currentCircleId}`);
    }
  } catch (err) {
    console.error('[Weetle] Failed to get circle from background:', err);
  }

  // Check if user is authenticated
  const authStatus = await checkAuthStatus();

  if (!authStatus.authenticated) {
    // Try anonymous mode
    await initializeAnonymousMode();
  } else {
    currentUserId = authStatus.userId;
    await initializeAuthenticatedMode();
  }
}

/**
 * Check authentication status
 */
async function checkAuthStatus(): Promise<{ authenticated: boolean; userId?: string }> {
  try {
    const response = await fetch("http://localhost:3000/api/auth/session", {
      credentials: "include",
    });

    if (response.ok) {
      const data = await response.json();
      return {
        authenticated: !!data.user,
        userId: data.user?.id,
      };
    }
  } catch (error) {
    console.log("[Weetle] Not authenticated:", error);
  }

  return { authenticated: false };
}

/**
 * Initialize anonymous mode
 */
async function initializeAnonymousMode() {
  console.log("[Weetle] Initializing anonymous mode...");

  isAnonymous = true;

  // Get or prompt for display name
  let displayName = await platform.storage.get<string>("anonymous_display_name");

  if (!displayName) {
    displayName = prompt("Enter your display name for anonymous browsing:") || "Anonymous User";
    await platform.storage.set("anonymous_display_name", displayName);
  }

  // Generate anonymous user ID (local only)
  currentUserId = `anon_${crypto.randomUUID()}`;

  // Use circle ID from background (could be URL param or default)
  // Layer ID combines circle and page
  currentLayerId = `${currentCircleId}-${window.location.hostname}`;

  console.log(`[Weetle] Anonymous mode initialized: ${displayName} in circle: ${currentCircleId}`);

  // Initialize peer connection
  await initializePeerConnection(displayName);
}

/**
 * Initialize authenticated mode
 */
async function initializeAuthenticatedMode() {
  console.log("[Weetle] Initializing authenticated mode...");

  // TODO: Get user's active circle and layer
  // For MVP, use test layer
  currentLayerId = "test-layer-" + window.location.hostname;

  await initializePeerConnection();
}

/**
 * Initialize peer connection manager
 */
async function initializePeerConnection(displayName?: string) {
  if (!currentUserId || !currentLayerId) {
    console.error("[Weetle] Missing userId or layerId");
    return;
  }

  // Get or generate persistent peer ID
  let storedPeerId = await platform.storage.get<string>("weetle_peer_id");

  if (!storedPeerId) {
    // Generate new peer ID and store it
    storedPeerId = crypto.randomUUID();
    await platform.storage.set("weetle_peer_id", storedPeerId);
    console.log("[Weetle] Generated new peer ID:", storedPeerId);
  } else {
    console.log("[Weetle] Reusing existing peer ID:", storedPeerId);
  }

  // Initialize peer manager with persistent peer ID
  peerManager = new PeerConnectionManager(
    currentUserId,
    currentLayerId,
    platform,
    {
      peerId: storedPeerId, // Use persistent peer ID
      serverHost: "localhost",
      serverPort: 9000,
      serverPath: "/peer",
      secure: false, // Use ws:// not wss:// for localhost dev
    }
  );

  // Connect to PeerJS server
  const peerId = await peerManager.initialize();
  console.log("[Weetle] Connected to PeerJS with ID:", peerId);

  // Register with peer discovery service and get list of other peers
  await registerAndDiscoverPeers(peerId, displayName);

  // Set up event handlers
  setupPeerEventHandlers();

  // Start tracking user interactions
  trackMouseMovements();
  trackClicks();
  trackKeyboardInput();

  // Render cursors overlay
  createCursorsOverlay();

  // Initialize sticky notes manager
  initializeStickyNotes();

  // Add keyboard shortcut for creating sticky notes
  setupStickyNoteShortcut();

  // Send heartbeat every 10 seconds to keep registration alive
  startHeartbeat(peerId);

  // Unregister when page unloads
  window.addEventListener("beforeunload", () => {
    unregisterPeer(peerId);
  });
}

/**
 * Set up peer event handlers
 */
function setupPeerEventHandlers() {
  if (!peerManager) return;

  // Handle remote mouse movements
  peerManager.on("mouse:move", (event, peerId) => {
    const { u, v, velocity } = event.payload;

    // Get or create cursor for this peer
    if (!remoteCursors.has(peerId)) {
      createRemoteCursor(peerId, event.userId);
    }

    // Update cursor position directly without interpolation
    updateRemoteCursorPosition(peerId, u, v);
  });

  // Handle remote clicks
  peerManager.on("mouse:click", (event, peerId) => {
    const { elementSelector } = event.payload;

    if (elementSelector) {
      const element = findElementBySelector(elementSelector);
      if (element) {
        console.log("[Weetle] Simulating remote click on:", elementSelector);
        simulateClick(element);

        // Animate the remote cursor
        animateRemoteCursorClick(peerId);
      } else {
        console.warn("[Weetle] Element not found for remote click:", elementSelector);
      }
    }
  });

  // Handle remote keyboard input
  peerManager.on("keyboard:input", (event, peerId) => {
    const { key, code, altKey, ctrlKey, metaKey, shiftKey, elementSelector } = event.payload;

    if (elementSelector) {
      const element = findElementBySelector(elementSelector);
      if (element) {
        console.log("[Weetle] Simulating remote keyboard input on:", elementSelector);
        simulateKeyboardInput(element, key, code, { altKey, ctrlKey, metaKey, shiftKey });
      } else {
        console.warn("[Weetle] Element not found for remote keyboard input:", elementSelector);
      }
    }
  });

  // Handle peer disconnect - remove their cursor
  peerManager.on("peer:disconnect", (event, peerId) => {
    console.log("[Weetle] Peer disconnected, removing cursor:", peerId);
    removeRemoteCursor(peerId);
  });

  // Handle new peer connections (create cursor on first event)
  peerManager.onAll((event, peerId) => {
    if (event.type === "mouse:move" && !remoteCursors.has(peerId)) {
      createRemoteCursor(peerId, event.userId);
    }
  });

  // Handle DOM updates from peers (page interactions)
  peerManager.on("dom:update", (event, peerId) => {
    const deltas = event.payload as DOMDelta[];
    if (domReplicator && deltas) {
      console.log("[Weetle] Applying DOM deltas from peer:", deltas.length);
      domReplicator.applyDeltas(deltas);
    }
  });

  // Handle RPC calls from peers (Weetle components)
  peerManager.on("rpc:call", (event, peerId) => {
    const rpcCall = event.payload as RPCCall;
    if (rpcBridge) {
      console.log("[Weetle] Executing RPC from peer:", rpcCall.functionName);
      rpcBridge.handleRemote(rpcCall);
    }
  });
}

/**
 * Track mouse movements and broadcast
 */
function trackMouseMovements() {
  if (!peerManager) return;

  let lastBroadcast = 0;
  const broadcastInterval = 33; // ~30fps

  document.addEventListener("mousemove", (e) => {
    const now = Date.now();

    // Throttle at document level too (in addition to PeerManager throttling)
    if (now - lastBroadcast < broadcastInterval) {
      return;
    }

    lastBroadcast = now;

    // Get viewport dimensions
    const viewport = getViewportDimensions();

    // Convert to UV coordinates
    const uv = pixelToUV({ x: e.clientX, y: e.clientY }, viewport);

    // Get scroll position for context
    const scroll = getScrollPosition();

    // Broadcast to peers
    peerManager!.broadcastMouseMove(uv.u, uv.v, scroll.scrollX, scroll.scrollY);
  });

  // Flush on mouse leave
  document.addEventListener("mouseleave", () => {
    const scroll = getScrollPosition();
    peerManager!.flushMouseMove(scroll.scrollX, scroll.scrollY);
  });
}

/**
 * Track clicks and broadcast with element selector
 */
function trackClicks() {
  if (!peerManager) return;

  document.addEventListener("click", (e) => {
    // IMPORTANT: Only broadcast real user clicks, not simulated ones
    // This prevents infinite ping-pong loops between peers
    if (!e.isTrusted) {
      return;
    }

    // Initialize audio on first user click (after user interaction, audio autoplay is allowed)
    initializeClickAudio();

    const target = e.target as Element;
    const selector = getElementSelector(target);

    if (!selector) {
      console.warn("[Weetle] Could not generate selector for clicked element");
      return;
    }

    // Get viewport and scroll info
    const viewport = getViewportDimensions();
    const uv = pixelToUV({ x: e.clientX, y: e.clientY }, viewport);
    const scroll = getScrollPosition();

    // Broadcast click with element selector
    peerManager!.broadcast("mouse:click", {
      u: uv.u,
      v: uv.v,
      button: e.button,
      elementSelector: selector,
      scrollX: scroll.scrollX,
      scrollY: scroll.scrollY,
    });

    console.log("[Weetle] Broadcasting click on:", selector);
  });
}

/**
 * Track keyboard input and broadcast with element selector
 */
function trackKeyboardInput() {
  if (!peerManager) return;

  document.addEventListener("keydown", (e) => {
    // IMPORTANT: Only broadcast real user input, not simulated keystrokes
    // This prevents infinite ping-pong loops between peers
    if (!e.isTrusted) {
      return;
    }

    const target = e.target as Element;

    // Only track input on interactive elements
    if (
      !(target instanceof HTMLInputElement) &&
      !(target instanceof HTMLTextAreaElement) &&
      !(target instanceof HTMLSelectElement) &&
      !target.isContentEditable
    ) {
      return;
    }

    const selector = getElementSelector(target);
    if (!selector) {
      console.warn("[Weetle] Could not generate selector for focused element");
      return;
    }

    // Get current value if it's an input
    let inputValue: string | undefined;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      inputValue = target.value;
    }

    // Broadcast keyboard input
    peerManager!.broadcast("keyboard:input", {
      key: e.key,
      code: e.code,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      elementSelector: selector,
      inputValue,
    });

    console.log("[Weetle] Broadcasting keyboard input on:", selector);
  });
}

/**
 * Create cursors overlay container
 */
function createCursorsOverlay() {
  // Create container for cursors
  const overlay = document.createElement("div");
  overlay.id = "weetle-cursors-overlay";
  overlay.setAttribute('data-weetle', 'cursors-overlay');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 2147483646;
  `;

  document.body.appendChild(overlay);
}

// Animation loop removed - cursor updates are now direct

/**
 * Update remote cursor position directly
 */
function updateRemoteCursorPosition(peerId: string, u: number, v: number) {
  const cursor = remoteCursors.get(peerId);
  if (!cursor) return;

  // Convert UV to pixel coordinates
  const viewport = getViewportDimensions();
  const x = u * viewport.width;
  const y = v * viewport.height;

  // Get current scale (default to 1)
  const scale = cursorScales.get(peerId) || 1;

  // Update position with scale
  // The transform-origin is set to the cursor tip (3px, 3px) in the element creation
  cursor.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
}

/**
 * Create cursor element for new peer
 */
function createRemoteCursor(peerId: string, userId: string) {
  const cursor = createCursorElement(peerId, userId);
  remoteCursors.set(peerId, cursor);
  cursorScales.set(peerId, 1); // Initialize scale to 1

  const overlay = document.getElementById("weetle-cursors-overlay");
  if (overlay) {
    overlay.appendChild(cursor);
  }
}

/**
 * Create cursor element
 */
function createCursorElement(peerId: string, userId: string): HTMLDivElement {
  const cursor = document.createElement("div");
  cursor.className = "weetle-remote-cursor weetle-cursor";
  cursor.setAttribute('data-weetle', 'cursor');
  cursor.dataset.peerId = peerId;

  // Generate consistent color from user ID
  const color = generateColorFromId(userId);

  cursor.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3L10.07 19.97L12.58 12.58L19.97 10.07L3 3Z" fill="${color}" stroke="white" stroke-width="2"/>
    </svg>
    <div style="
      position: absolute;
      top: 24px;
      left: 12px;
      background: ${color};
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: system-ui, sans-serif;
      white-space: nowrap;
      pointer-events: none;
    ">
      ${userId.startsWith("anon_") ? userId.substring(0, 12) + "..." : userId}
    </div>
  `;

  cursor.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    will-change: transform;
    transform-origin: 3px 3px;
  `;

  return cursor;
}

/**
 * Initialize click audio on first user interaction
 */
function initializeClickAudio() {
  if (clickAudio || audioEnabled) return;

  try {
    clickAudio = new Audio(chrome.runtime.getURL("m-click-01.mp3"));
    clickAudio.volume = 0.3;

    // Try to play silently to prime the audio
    clickAudio.play().then(() => {
      clickAudio!.pause();
      clickAudio!.currentTime = 0;
      audioEnabled = true;
      console.log("[Weetle] Audio enabled after user interaction");
    }).catch(() => {
      // Audio still blocked, will try again on next interaction
      clickAudio = null;
    });
  } catch (err) {
    console.warn("[Weetle] Could not initialize audio:", err);
  }
}

/**
 * Animate remote cursor click with shrink effect and sound
 */
function animateRemoteCursorClick(peerId: string) {
  const cursor = remoteCursors.get(peerId);
  if (!cursor) return;

  // Play click sound if audio is enabled
  if (audioEnabled && clickAudio) {
    try {
      clickAudio.currentTime = 0;
      clickAudio.play().catch(() => {
        // Ignore errors after audio is enabled
      });
    } catch (err) {
      // Extension context might be invalidated
    }
  }

  // Shrink animation - update scale state
  cursorScales.set(peerId, 0.8);

  // Return to normal after animation
  setTimeout(() => {
    cursorScales.set(peerId, 1);
  }, 100);
}

/**
 * Remove remote cursor
 */
function removeRemoteCursor(peerId: string) {
  const cursor = remoteCursors.get(peerId);
  if (cursor) {
    cursor.remove();
    remoteCursors.delete(peerId);
  }

  // Clean up scale state
  cursorScales.delete(peerId);
}

/**
 * Generate consistent color from ID
 */
function generateColorFromId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Register with backend and discover other peers
 */
async function registerAndDiscoverPeers(peerId: string, displayName?: string) {
  try {
    const response = await fetch("http://localhost:3000/api/peers/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pageUrl: window.location.href,
        peerId,
        userId: currentUserId,
        displayName: displayName || currentUserId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Registration failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log("[Weetle] Registered with backend:", data);

    // Update layer ID from server response
    currentLayerId = data.layerId;

    // Connect to discovered peers
    if (data.peers && data.peers.length > 0) {
      console.log(`[Weetle] Found ${data.peers.length} other peers, connecting...`);

      for (const peer of data.peers) {
        console.log(`[Weetle] Connecting to peer: ${peer.peerId} (${peer.displayName})`);

        // Connect to peer via PeerManager
        if (peerManager) {
          await peerManager.connect(peer.peerId, {
            userId: peer.peerId,
            displayName: peer.displayName,
          });
        }
      }
    } else {
      console.log("[Weetle] No other peers found on this page yet");
    }
  } catch (error) {
    console.error("[Weetle] Peer registration failed:", error);
  }
}

/**
 * Start heartbeat to keep peer registration alive
 */
function startHeartbeat(peerId: string) {
  setInterval(async () => {
    try {
      await fetch("http://localhost:3000/api/peers/heartbeat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ peerId }),
      });
    } catch (error) {
      console.error("[Weetle] Heartbeat failed:", error);
    }
  }, 10000); // Every 10 seconds
}

/**
 * Unregister peer when leaving page
 */
async function unregisterPeer(peerId: string) {
  try {
    await fetch(`http://localhost:3000/api/peers/${peerId}`, {
      method: "DELETE",
    });
    console.log("[Weetle] Unregistered peer");
  } catch (error) {
    console.error("[Weetle] Unregister failed:", error);
  }
}

/**
 * Initialize sticky notes with RPC system
 */
function initializeStickyNotes() {
  if (!peerManager || !currentUserId) {
    console.error("[Weetle] Cannot initialize sticky notes: missing dependencies");
    return;
  }

  // Initialize RPC bridge for Weetle components
  rpcBridge = new RPCBridge();
  rpcBridge.setSendCallback((rpcCall) => {
    console.log("[Weetle] Broadcasting RPC call:", rpcCall.functionName);
    peerManager!.broadcast("rpc:call", rpcCall);
  });

  // Initialize sticky notes manager with RPC
  const pageKey = getPageKey();
  const circleId = currentCircleId || 'anonymous';
  const circlePassword = circlePasswords.get(circleId);
  stickyNotesManager = new StickyNotesManager(rpcBridge, pageKey, circleId, circlePassword);

  // Load persisted state
  stickyNotesManager.loadFromLocalStorage();

  // Initialize DOMReplicator for page interactions (clicks, typing, etc.)
  domReplicator = new DOMReplicator({
    selector: 'input, textarea, [contenteditable]', // Watch page inputs
    batchInterval: 16, // ~60fps
    onDeltasReady: (deltas) => {
      console.log("[Weetle] Broadcasting DOM deltas:", deltas.length);
      peerManager!.broadcast("dom:update", deltas);
    },
  });

  domReplicator.start();

  console.log("[Weetle] Sticky notes with RPC + DOMReplicator initialized");
}

/**
 * Setup keyboard shortcut for creating sticky notes
 * Alt + N
 */
function setupStickyNoteShortcut() {
  document.addEventListener("keydown", (e) => {
    // Check for Alt+N (case insensitive, avoids conflict with Ctrl+Shift+N for incognito)
    const isAltN = e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey &&
                   (e.key === "n" || e.key === "N" || e.code === "KeyN");

    if (isAltN) {
      e.preventDefault();
      e.stopPropagation();

      if (stickyNotesManager && currentUserId) {
        console.log("[Weetle] Creating sticky note via keyboard shortcut (Alt+N)");

        // Create note at center of viewport
        const x = window.innerWidth / 2 - 90;
        const y = window.innerHeight / 2 - 75;

        // Create the note - DOMReplicator will detect it and broadcast!
        const noteId = stickyNotesManager.createNote(currentUserId, x, y);
        console.log("[Weetle] Created sticky note:", noteId);
      } else {
        console.warn("[Weetle] Cannot create sticky note: manager or userId missing");
      }
    }
  }, true); // Use capture phase to intercept before page handlers

  console.log("[Weetle] Sticky note keyboard shortcut registered (Alt+N)");
}

// Listen for circle updates from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CIRCLE_UPDATE':
      // Store password if provided
      if (message.password) {
        circlePasswords.set(message.circleId, message.password);
      }
      handleCircleUpdate(message.circleId, message.isTemporary);
      break;

    case 'CREATE_NOTE_AT':
      // Context menu action
      if (stickyNotesManager && currentUserId) {
        stickyNotesManager.createNote(currentUserId, message.x, message.y);
      }
      break;

    case 'COPY_TO_CLIPBOARD':
      navigator.clipboard.writeText(message.text).then(() => {
        showNotification('Circle link copied to clipboard!');
      });
      break;
  }
});

/**
 * Get page key for current URL
 */
function getPageKey(): string {
  return window.location.origin + window.location.pathname;
}

/**
 * Clean up all Weetle elements from the page
 */
function cleanupAllWeetleElements(): void {
  console.log('[Weetle] Cleaning up all Weetle elements');

  // Remove all sticky notes by class
  document.querySelectorAll('.weetle-sticky-note').forEach(el => {
    console.log('[Weetle] Removing sticky note:', el);
    el.remove();
  });

  // Remove all cursors
  document.querySelectorAll('.weetle-cursor').forEach(el => {
    el.remove();
  });

  // Remove any other Weetle UI elements
  document.querySelectorAll('[data-weetle]').forEach(el => {
    el.remove();
  });

  // Remove cursor overlay if it exists
  const cursorOverlay = document.getElementById('weetle-cursors-overlay');
  if (cursorOverlay) {
    cursorOverlay.remove();
  }

  // Remove any notification elements
  document.querySelectorAll('.weetle-notification').forEach(el => {
    el.remove();
  });
}

/**
 * Handle circle change
 */
function handleCircleUpdate(circleId: string, isTemporary: boolean) {
  console.log(`[Weetle] Circle updated to: ${circleId} (temporary: ${isTemporary})`);

  // Don't reload if same circle
  if (currentCircleId === circleId) {
    console.log('[Weetle] Same circle, no reload needed');
    return;
  }

  const previousCircle = currentCircleId;
  currentCircleId = circleId;
  isTemporaryCircle = isTemporary;

  // Clean up ALL Weetle elements from the page
  cleanupAllWeetleElements();

  // Clean up existing sticky notes manager
  if (stickyNotesManager) {
    console.log(`[Weetle] Switching from ${previousCircle} to ${circleId}`);

    // Destroy all current notes
    stickyNotesManager.destroy();

    // Create new manager for new circle
    const pageKey = getPageKey();
    const circlePassword = circlePasswords.get(circleId);
    stickyNotesManager = new StickyNotesManager(rpcBridge!, pageKey, circleId, circlePassword);

    // For MVP, load from localStorage - later this should come from server
    stickyNotesManager.loadFromLocalStorage();

    // TODO: Fetch circle state from server instead of localStorage
    console.log('[Weetle] Loading state for circle:', circleId);

    // Show notification
    showNotification(`Switched to ${isTemporary ? 'viewing' : ''} circle: ${circleId}`);
  }

  // Disconnect from previous circle's peers
  if (peerManager) {
    console.log('[Weetle] Disconnecting from previous circle peers');
    peerManager.destroy();

    // Clear remote cursors
    remoteCursors.forEach(cursor => cursor.remove());
    remoteCursors.clear();
    cursorScales.clear();

    // Reconnect to new circle's layer
    const layerId = `${circleId}:${getPageKey()}`;
    currentLayerId = layerId;

    peerManager.connect(layerId).then(() => {
      console.log(`[Weetle] Connected to new layer: ${layerId}`);

      // After connecting, load any saved state for this circle
      // For MVP, use localStorage - later this will come from server
      if (stickyNotesManager) {
        stickyNotesManager.loadFromLocalStorage();
      }
    }).catch(err => {
      console.error('[Weetle] Failed to connect to new layer:', err);
    });
  }
}

/**
 * Show temporary notification
 */
function showNotification(text: string) {
  const notification = document.createElement('div');
  notification.className = 'weetle-notification';
  notification.setAttribute('data-weetle', 'notification');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-family: system-ui, sans-serif;
    font-size: 14px;
    z-index: 2147483647;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = text;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Create confirmation modal for circle join
 */
function showCircleJoinModal(circleId: string, href: string | null, callback: (join: boolean) => void) {
  const modal = document.createElement('div');
  modal.id = 'weetle-join-modal';

  // Create shadow DOM for isolation
  const shadow = modal.attachShadow({ mode: 'open' });

  shadow.innerHTML = `
    <style>
      .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        animation: fadeIn 0.2s ease-out;
      }

      .modal-content {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: slideUp 0.3s ease-out;
      }

      .modal-title {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 12px;
        color: #333;
        font-family: system-ui, sans-serif;
      }

      .modal-text {
        font-size: 14px;
        line-height: 1.5;
        color: #666;
        margin-bottom: 20px;
        font-family: system-ui, sans-serif;
      }

      .circle-id {
        background: #f3f4f6;
        padding: 8px 12px;
        border-radius: 6px;
        font-family: monospace;
        margin: 12px 0;
        word-break: break-all;
      }

      .modal-buttons {
        display: flex;
        gap: 12px;
        justify-content: flex-end;
      }

      button {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        font-family: system-ui, sans-serif;
      }

      .btn-join {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
      }

      .btn-join:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      }

      .btn-view {
        background: #e5e7eb;
        color: #374151;
      }

      .btn-view:hover {
        background: #d1d5db;
      }

      .btn-cancel {
        background: transparent;
        color: #6b7280;
      }

      .btn-cancel:hover {
        background: #f9fafb;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes slideUp {
        from {
          transform: translateY(20px);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    </style>

    <div class="modal-backdrop">
      <div class="modal-content">
        <div class="modal-title">Join Weetle Circle?</div>
        <div class="modal-text">
          This link wants to add you to a Weetle circle:
          <div class="circle-id">${circleId}</div>
          ${href ? `<div style="margin-top: 12px; font-size: 13px;">You'll be redirected to: ${new URL(href).hostname}</div>` : ''}
        </div>
        <div class="modal-buttons">
          <button class="btn-cancel" id="cancel-btn">Cancel</button>
          <button class="btn-view" id="view-btn">Just View</button>
          <button class="btn-join" id="join-btn">Join Circle</button>
        </div>
      </div>
    </div>
  `;

  // Add event listeners
  shadow.getElementById('join-btn')?.addEventListener('click', () => {
    modal.remove();
    callback(true);
  });

  shadow.getElementById('view-btn')?.addEventListener('click', () => {
    modal.remove();
    callback(false);
  });

  shadow.getElementById('cancel-btn')?.addEventListener('click', () => {
    modal.remove();
  });

  // Close on backdrop click
  shadow.querySelector('.modal-backdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      modal.remove();
    }
  });

  document.body.appendChild(modal);
}

// Listen for data-weetle clicks
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const link = target.closest('a[data-weetle]') as HTMLAnchorElement;

  if (link) {
    e.preventDefault();
    e.stopPropagation();

    const weetleData = link.dataset.weetle;
    if (!weetleData) return;

    const [circleId, password] = weetleData.split(':');
    const href = link.href;

    // Show confirmation modal
    showCircleJoinModal(circleId, href, async (shouldJoin) => {
      if (shouldJoin) {
        // User wants to join the circle
        console.log(`[Weetle] User accepted circle join: ${circleId}`);

        // Notify background to join circle
        const response = await chrome.runtime.sendMessage({
          type: 'JOIN_CIRCLE',
          circleId,
          password
        });

        if (response?.success) {
          // Navigate to the link destination with the new circle active
          if (href && href !== '#') {
            window.location.href = href;
          }
        }
      } else {
        // User wants to preview without joining
        console.log(`[Weetle] User wants to preview circle: ${circleId}`);

        if (href && href !== '#') {
          // Add circle as URL param for preview
          const url = new URL(href);
          url.searchParams.set('weetlec', password ? `${circleId}:${password}` : circleId);
          window.location.href = url.toString();
        }
      }
    });
  }
}, true);

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeWeetle);
} else {
  initializeWeetle();
}
