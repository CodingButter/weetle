import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  cn,
  Plus,
  Share,
  Circle,
  Globe,
  Lock,
  Users,
  Settings,
  Check,
  ChevronRight
} from '@weetle/ui';
import '@weetle/ui/styles';

interface CircleData {
  id: string;
  name: string;
  description?: string;
  visibility: 'public' | 'private' | 'anonymous';
  createdAt: number;
  memberCount?: number;
}

function PopupApp() {
  const [currentCircle, setCurrentCircle] = useState<CircleData | null>(null);
  const [availableCircles, setAvailableCircles] = useState<CircleData[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newCircleName, setNewCircleName] = useState('');
  const [newCircleDesc, setNewCircleDesc] = useState('');
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  useEffect(() => {
    // Initialize popup
    initializePopup();
  }, []);

  async function initializePopup() {
    console.log('[Weetle Popup] Initializing...');

    // Get current tab's circle from background
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (tab.id) {
      // Ask background for this tab's circle
      chrome.runtime.sendMessage({ type: 'GET_TAB_CIRCLE' }, (response) => {
        if (response?.circleId) {
          // Load circles and find the current one
          chrome.storage.local.get(['availableCircles']).then((stored) => {
            const circles = stored.availableCircles || getDefaultCircles();
            setAvailableCircles(circles);
            const current = circles.find((c: CircleData) => c.id === response.circleId) || circles[0];
            setCurrentCircle(current);
          });
        }
      });
    } else {
      // Fallback to stored circle
      const stored = await chrome.storage.local.get(['currentCircle', 'availableCircles']);

      const defaultCircle = {
        id: 'anonymous',
        name: 'Anonymous',
        description: 'Public anonymous collaboration',
        visibility: 'anonymous' as const,
        createdAt: Date.now()
      };

      setCurrentCircle(stored.currentCircle || defaultCircle);
      setAvailableCircles(stored.availableCircles || getDefaultCircles());
    }
  }

  function getDefaultCircles(): CircleData[] {
    return [
      {
        id: 'anonymous',
        name: 'Anonymous',
        description: 'Public anonymous collaboration',
        visibility: 'anonymous',
        createdAt: Date.now()
      },
      {
        id: 'my-team',
        name: 'My Team',
        description: 'Private team workspace',
        visibility: 'private',
        createdAt: Date.now(),
        memberCount: 5
      },
      {
        id: 'study-group',
        name: 'Study Group',
        description: 'CS101 Study Materials',
        visibility: 'private',
        createdAt: Date.now(),
        memberCount: 12
      }
    ];
  }

  async function switchCircle(circleId: string) {
    const circle = availableCircles.find(c => c.id === circleId);
    if (!circle) return;

    setCurrentCircle(circle);

    // Save to storage
    await chrome.storage.local.set({ currentCircle: circle });

    // Get current tab and switch its circle
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab.id) {
      chrome.runtime.sendMessage({
        type: 'SWITCH_TAB_CIRCLE',
        tabId: tab.id,
        circleId: circle.id
      });
    }

    console.log(`[Weetle Popup] Switched to circle: ${circle.name}`);
  }

  async function createCircle() {
    if (!newCircleName.trim()) return;

    const newCircle: CircleData = {
      id: `circle-${Date.now()}`,
      name: newCircleName.trim(),
      description: newCircleDesc.trim(),
      visibility: 'private',
      createdAt: Date.now(),
      memberCount: 1
    };

    const updatedCircles = [...availableCircles, newCircle];
    setAvailableCircles(updatedCircles);

    // Save to storage
    await chrome.storage.local.set({ availableCircles: updatedCircles });

    // Switch to new circle
    await switchCircle(newCircle.id);

    // Reset form
    setNewCircleName('');
    setNewCircleDesc('');
    setIsCreating(false);

    console.log(`[Weetle Popup] Created circle: ${newCircle.name}`);
  }

  async function shareCircle() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !currentCircle) {
      return;
    }

    // Request share link from background
    chrome.runtime.sendMessage({
      type: 'GENERATE_SHARE_LINK',
      circleId: currentCircle.id
    }, (response) => {
      if (response.shareLink) {
        // Copy to clipboard
        navigator.clipboard.writeText(response.shareLink).then(() => {
          setShowCopiedMessage(true);
          setTimeout(() => setShowCopiedMessage(false), 2000);
        });
      }
    });
  }

  function getCircleIcon(visibility: string) {
    switch (visibility) {
      case 'anonymous':
        return <Users className="h-4 w-4" />;
      case 'private':
        return <Lock className="h-4 w-4" />;
      case 'public':
        return <Globe className="h-4 w-4" />;
      default:
        return <Circle className="h-4 w-4" />;
    }
  }

  return (
    <div className="min-w-[360px] bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Circle className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Weetle</h1>
            <p className="text-xs text-muted-foreground">Collaborative Browsing</p>
          </div>
        </div>
      </div>

      {/* Current Circle */}
      <div className="border-b border-border p-4">
        <div className="mb-2 text-xs font-medium text-muted-foreground">Current Circle</div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentCircle && getCircleIcon(currentCircle.visibility)}
            <span className="font-medium">{currentCircle?.name || 'None'}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={shareCircle}
            className="gap-1.5"
          >
            {showCopiedMessage ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Share className="h-3 w-3" />
                Share
              </>
            )}
          </Button>
        </div>
        {currentCircle?.memberCount && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {currentCircle.memberCount} members online
          </div>
        )}
      </div>

      {/* Circle List */}
      <div className="p-4">
        <div className="mb-3 text-xs font-medium text-muted-foreground">Switch Circle</div>
        <div className="space-y-2">
          {availableCircles.map((circle) => (
            <button
              key={circle.id}
              onClick={() => switchCircle(circle.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                circle.id === currentCircle?.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-secondary/50"
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
                {getCircleIcon(circle.visibility)}
              </div>
              <div className="flex-1">
                <div className="font-medium">{circle.name}</div>
                {circle.description && (
                  <div className="text-xs text-muted-foreground">{circle.description}</div>
                )}
              </div>
              {circle.id === currentCircle?.id && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>

        {/* Create Circle Form */}
        {isCreating ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
            <input
              type="text"
              placeholder="Circle name..."
              value={newCircleName}
              onChange={(e) => setNewCircleName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)..."
              value={newCircleDesc}
              onChange={(e) => setNewCircleDesc(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
              rows={2}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={createCircle}
                disabled={!newCircleName.trim()}
              >
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  setNewCircleName('');
                  setNewCircleDesc('');
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="mt-4 w-full gap-2"
            onClick={() => setIsCreating(true)}
          >
            <Plus className="h-4 w-4" />
            Create New Circle
          </Button>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Connected
        </div>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-3 w-3" />
          Settings
        </button>
      </div>
    </div>
  );
}

// Initialize React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<PopupApp />);
}