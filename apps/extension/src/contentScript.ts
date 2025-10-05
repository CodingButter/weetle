/**
 * Weetle Content Script
 * Handles mouse tracking, peer connections, and remote cursor rendering
 */

import { PeerConnectionManager, PositionInterpolator } from "@weetle/peer";
import { platform } from "@weetle/platform";
import { pixelToUV, getViewportDimensions, getScrollPosition } from "@weetle/peer";
import {
  getElementSelector,
  findElementBySelector,
  simulateClick,
  simulateKeyboardInput,
} from "./elementSelector";
import { SimpleStickyNotesManager } from "./stickyNoteSimple";
import { DOMReplicator } from "@weetle/dom-replicator";
import type { DOMDelta } from "@weetle/dom-replicator";

console.log("[Weetle] Content script loaded on:", window.location.href);

// Global state
let peerManager: PeerConnectionManager | null = null;
let currentUserId: string | null = null;
let currentLayerId: string | null = null;
let isAnonymous = false;
let remoteCursors = new Map<string, HTMLDivElement>();
let cursorInterpolators = new Map<string, PositionInterpolator>();
let cursorScales = new Map<string, number>(); // Track scale for each cursor
let animationFrameId: number | null = null;
let stickyNotesManager: SimpleStickyNotesManager | null = null;
let domReplicator: DOMReplicator | null = null; // DOM replication layer
let audioEnabled = false; // Track if audio is enabled (after first user interaction)
let clickAudio: HTMLAudioElement | null = null;

// No more event deduplication needed!
// DOMReplicator handles ping-pong prevention with ignoreNextMutation

/**
 * Initialize Weetle on this page
 */
async function initializeWeetle() {
  console.log("[Weetle] Initializing...");

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

  // For MVP, use a test layer ID (will be dynamic later)
  currentLayerId = "test-layer-" + window.location.hostname;

  console.log("[Weetle] Anonymous mode initialized:", displayName);

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

    // Get or create interpolator for this peer
    let interpolator = cursorInterpolators.get(peerId);
    if (!interpolator) {
      interpolator = new PositionInterpolator();
      cursorInterpolators.set(peerId, interpolator);
    }

    // Set target position with velocity for smooth interpolation
    interpolator.setTarget(u, v, velocity || 0);

    // Ensure animation loop is running
    if (!animationFrameId) {
      startCursorAnimation();
    }
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

  // Handle DOM updates from peers via DOMReplicator
  peerManager.on("dom:update", (event, peerId) => {
    const deltas = event.payload as DOMDelta[];
    if (domReplicator && deltas) {
      console.log("[Weetle] Applying DOM deltas from peer:", deltas.length);
      domReplicator.applyDeltas(deltas);
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

/**
 * Start cursor animation loop
 */
function startCursorAnimation() {
  function animate() {
    // Update all cursors with interpolated positions
    cursorInterpolators.forEach((interpolator, peerId) => {
      const position = interpolator.getPosition();
      // Position returns {x, y} in UV coordinates (0-1)
      updateRemoteCursorPosition(peerId, position.x, position.y);
    });

    animationFrameId = requestAnimationFrame(animate);
  }

  animationFrameId = requestAnimationFrame(animate);
}

/**
 * Update remote cursor position (called from animation loop)
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
  cursor.className = "weetle-remote-cursor";
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

  const interpolator = cursorInterpolators.get(peerId);
  if (interpolator) {
    cursorInterpolators.delete(peerId);
  }

  // Clean up scale state
  cursorScales.delete(peerId);

  // Stop animation if no more cursors
  if (remoteCursors.size === 0 && animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
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
 * Initialize sticky notes with DOMReplicator
 */
function initializeStickyNotes() {
  if (!peerManager || !currentUserId) {
    console.error("[Weetle] Cannot initialize sticky notes: missing dependencies");
    return;
  }

  // Initialize simple sticky notes manager
  stickyNotesManager = new SimpleStickyNotesManager();

  // Initialize DOMReplicator to watch sticky notes
  domReplicator = new DOMReplicator({
    selector: '[data-weetle-entity="sticky-note"]', // Watch sticky note elements
    batchInterval: 16, // ~60fps
    onDeltasReady: (deltas) => {
      // Broadcast deltas to all peers
      console.log("[Weetle] Broadcasting DOM deltas:", deltas.length);
      peerManager!.broadcast("dom:update", deltas);
    },
  });

  // Start watching for DOM changes
  domReplicator.start();

  console.log("[Weetle] Sticky notes with DOMReplicator initialized");
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

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeWeetle);
} else {
  initializeWeetle();
}
