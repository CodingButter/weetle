/**
 * Background Service Worker
 * Central circle management and state coordination
 */

console.log("[Weetle Background] Service worker loaded");

// Types
interface Circle {
  id: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private' | 'anonymous';
  createdAt: number;
  memberCount?: number;
  isTemporary?: boolean; // For URL param circles
}

interface TabCircleState {
  tabId: number;
  url: string;
  circleId: string;
  isTemporary: boolean; // URL param override
  joinedAt: number;
}

// State Management
class CircleManager {
  private userCircles: Map<string, Circle> = new Map();
  private tabCircles: Map<number, TabCircleState> = new Map();
  private defaultCircleId: string = 'anonymous';
  private apiUrl = 'http://localhost:3000';

  constructor() {
    this.initialize();
  }

  async initialize() {
    // Load saved circles from storage
    const stored = await chrome.storage.local.get(['userCircles', 'defaultCircleId']);

    if (stored.userCircles) {
      this.userCircles = new Map(Object.entries(stored.userCircles));
    } else {
      // Initialize with anonymous circle
      this.userCircles.set('anonymous', {
        id: 'anonymous',
        name: 'Anonymous',
        description: 'Public anonymous collaboration',
        visibility: 'anonymous',
        createdAt: Date.now()
      });
    }

    if (stored.defaultCircleId) {
      this.defaultCircleId = stored.defaultCircleId;
    }

    console.log(`[Weetle Background] Initialized with ${this.userCircles.size} circles`);
  }

  /**
   * Get circle for a specific tab
   */
  getTabCircle(tabId: number): string {
    const tabState = this.tabCircles.get(tabId);
    return tabState?.circleId || this.defaultCircleId;
  }

  /**
   * Set temporary circle for a tab (from URL param)
   */
  setTemporaryCircle(tabId: number, url: string, circleId: string) {
    console.log(`[Weetle Background] Setting temporary circle ${circleId} for tab ${tabId}`);

    this.tabCircles.set(tabId, {
      tabId,
      url,
      circleId,
      isTemporary: true,
      joinedAt: Date.now()
    });

    // Notify content script
    this.notifyTab(tabId, circleId, true);
  }

  /**
   * Set circle for a specific tab (from popup)
   */
  setTabCircle(tabId: number, circleId: string) {
    console.log(`[Weetle Background] Setting circle ${circleId} for tab ${tabId}`);

    this.tabCircles.set(tabId, {
      tabId,
      url: '',
      circleId,
      isTemporary: false,
      joinedAt: Date.now()
    });

    // Notify content script
    this.notifyTab(tabId, circleId, false);
  }

  /**
   * Join a circle permanently
   */
  async joinCircle(circleId: string, password?: string): Promise<boolean> {
    try {
      // TODO: Verify with server and get circle details
      const circle: Circle = {
        id: circleId,
        name: circleId, // Will be updated from server
        visibility: 'private',
        createdAt: Date.now()
      };

      this.userCircles.set(circleId, circle);
      await this.saveCircles();

      console.log(`[Weetle Background] Joined circle: ${circleId}`);
      return true;
    } catch (err) {
      console.error(`[Weetle Background] Failed to join circle:`, err);
      return false;
    }
  }

  /**
   * Switch default circle
   */
  async switchDefaultCircle(circleId: string) {
    if (!this.userCircles.has(circleId)) {
      console.error(`[Weetle Background] Circle not found: ${circleId}`);
      return;
    }

    this.defaultCircleId = circleId;
    await chrome.storage.local.set({ defaultCircleId: circleId });

    // Update all tabs that don't have temporary overrides
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id && !this.tabCircles.get(tab.id)?.isTemporary) {
        this.notifyTab(tab.id, circleId, false);
      }
    }

    console.log(`[Weetle Background] Switched default circle to: ${circleId}`);
  }

  /**
   * Notify a tab about its circle
   */
  private async notifyTab(tabId: number, circleId: string, isTemporary: boolean) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'CIRCLE_UPDATE',
        circleId,
        isTemporary,
        circleName: this.userCircles.get(circleId)?.name || circleId
      });
    } catch (err) {
      // Tab might not have content script loaded yet
      console.debug(`[Weetle Background] Could not notify tab ${tabId}:`, err);
    }
  }

  /**
   * Save circles to storage
   */
  private async saveCircles() {
    const circlesObj = Object.fromEntries(this.userCircles);
    await chrome.storage.local.set({ userCircles: circlesObj });
  }

  /**
   * Get all user circles
   */
  getUserCircles(): Circle[] {
    return Array.from(this.userCircles.values());
  }

  /**
   * Clean up when tab closes
   */
  cleanupTab(tabId: number) {
    this.tabCircles.delete(tabId);
  }
}

// Initialize manager
const circleManager = new CircleManager();

// Listen for navigation events to detect URL params
chrome.webNavigation.onCommitted.addListener((details) => {
  // Only process main frame navigations
  if (details.frameId !== 0) return;

  try {
    const url = new URL(details.url);
    const circleParam = url.searchParams.get('weetlec');

    if (circleParam) {
      // Parse circle ID and optional password
      const [circleId, password] = circleParam.split(':');

      console.log(`[Weetle Background] Detected circle URL param: ${circleId}`);
      circleManager.setTemporaryCircle(details.tabId, details.url, circleId);

      // If password provided, might need to authenticate
      if (password) {
        // TODO: Verify password with server
      }
    } else {
      // No URL param, use default circle
      const defaultCircle = circleManager.getTabCircle(details.tabId);
      chrome.tabs.sendMessage(details.tabId, {
        type: 'CIRCLE_UPDATE',
        circleId: defaultCircle,
        isTemporary: false
      }).catch(() => {
        // Content script not ready yet, will request on load
      });
    }
  } catch (err) {
    console.error('[Weetle Background] Error processing URL:', err);
  }
});

// Listen for tab removal to clean up
chrome.tabs.onRemoved.addListener((tabId) => {
  circleManager.cleanupTab(tabId);
});

// Message handling from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Weetle Background] Received message:', message.type);

  switch (message.type) {
    case 'GET_TAB_CIRCLE':
      // Content script or popup requesting a tab's circle
      const tabId = message.tabId || sender.tab?.id;

      // If no tabId provided and sender is popup, get active tab
      if (!tabId && !sender.tab) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            const circleId = circleManager.getTabCircle(tabs[0].id);
            sendResponse({ circleId });
          } else {
            sendResponse({ circleId: circleManager.getDefaultCircle() });
          }
        });
        return true; // Keep channel open for async response
      } else if (tabId) {
        const circleId = circleManager.getTabCircle(tabId);
        sendResponse({ circleId });
      } else {
        sendResponse({ circleId: circleManager.getDefaultCircle() });
      }
      break;

    case 'JOIN_CIRCLE':
      // User wants to join a circle permanently
      circleManager.joinCircle(message.circleId, message.password)
        .then(success => sendResponse({ success }));
      return true; // Keep channel open for async response

    case 'SWITCH_DEFAULT_CIRCLE':
      // Popup switching default circle
      circleManager.switchDefaultCircle(message.circleId);
      sendResponse({ success: true });
      break;

    case 'SWITCH_TAB_CIRCLE':
      // Popup switching circle for specific tab
      const switchTabId = message.tabId || sender.tab?.id;
      if (switchTabId) {
        circleManager.setTabCircle(switchTabId, message.circleId);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'No tab ID' });
      }
      break;

    case 'GET_USER_CIRCLES':
      // Popup requesting circle list
      const circles = circleManager.getUserCircles();
      sendResponse({ circles });
      break;

    case 'GENERATE_SHARE_LINK':
      // Popup requesting a share link for current tab
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id && tab.url) {
          const shareCircleId = message.circleId || circleManager.getTabCircle(tab.id);
          const shareLink = generateGatewayUrl(tab.url, shareCircleId);
          sendResponse({ shareLink });
        } else {
          sendResponse({ error: 'No active tab found' });
        }
      });
      return true; // Keep channel open for async response

    case 'DATA_WEETLE_CLICK':
      // Content script detected data-weetle click
      const [circleId, password] = message.weetleData.split(':');

      // Show join prompt
      if (chrome.action) {
        chrome.action.setBadgeText({ text: '!' });
        chrome.action.setBadgeBackgroundColor({ color: '#667eea' });
      }

      // Store pending join for when popup opens
      chrome.storage.session.set({
        pendingJoin: { circleId, password, fromUrl: sender.url }
      });

      sendResponse({ acknowledged: true });
      break;
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Weetle Background] Extension installed");

  // Set up context menus
  chrome.contextMenus.create({
    id: 'weetle-create-note',
    title: 'Create Weetle Note Here',
    contexts: ['page', 'selection']
  });

  chrome.contextMenus.create({
    id: 'weetle-share-circle',
    title: 'Share Current Circle',
    contexts: ['page']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;

  switch (info.menuItemId) {
    case 'weetle-create-note':
      chrome.tabs.sendMessage(tab.id, {
        type: 'CREATE_NOTE_AT',
        x: info.x,
        y: info.y,
        selectedText: info.selectionText
      });
      break;

    case 'weetle-share-circle':
      const circleId = circleManager.getTabCircle(tab.id);

      // Generate gateway URL instead of direct link
      const gatewayUrl = generateGatewayUrl(tab.url!, circleId);

      // Copy to clipboard
      chrome.tabs.sendMessage(tab.id, {
        type: 'COPY_TO_CLIPBOARD',
        text: gatewayUrl
      });
      break;
  }
});

/**
 * Generate a gateway URL for sharing circles
 */
function generateGatewayUrl(targetUrl: string, circleId: string): string {
  const encodedUrl = encodeURIComponent(targetUrl);
  const serverUrl = 'http://localhost:3000'; // TODO: Use production URL in prod
  return `${serverUrl}/gateway?url=${encodedUrl}&circle=${circleId}`;
}

console.log("[Weetle Background] Circle manager initialized");