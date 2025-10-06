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
  User,
  Circle,
  Sun,
  Layers,
  Command,
  Info,
  ChevronRight,
  Star,
  Settings,
  Save,
  Check
} from '@weetle/ui';
import '@weetle/ui/styles';

interface UserSettings {
  profile: {
    displayName: string;
    isSignedIn: boolean;
    email?: string;
  };
  circles: {
    favorites: string[];
    defaultCircle: string;
  };
  appearance: {
    stickyNoteColor: string;
    showCursorNames: boolean;
    animateCursors: boolean;
  };
  tools: {
    defaultPenColor: string;
    defaultPenSize: number;
    highlighterOpacity: number;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  profile: {
    displayName: 'Anonymous',
    isSignedIn: false,
  },
  circles: {
    favorites: [],
    defaultCircle: 'anonymous',
  },
  appearance: {
    stickyNoteColor: '#fef3c7',
    showCursorNames: true,
    animateCursors: true,
  },
  tools: {
    defaultPenColor: '#000000',
    defaultPenSize: 4,
    highlighterOpacity: 0.3,
  },
};

const STICKY_NOTE_COLORS = [
  '#fef3c7', '#fde68a', '#fbbf24',
  '#dbeafe', '#bfdbfe', '#60a5fa',
  '#dcfce7', '#bbf7d0', '#86efac',
  '#fce7f3', '#fbcfe8', '#f9a8d4',
];

const PEN_COLORS = [
  '#000000', '#ef4444', '#f97316', '#eab308',
  '#84cc16', '#22c55e', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#ffffff', '#6b7280',
];

function OptionsApp() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [activeSection, setActiveSection] = useState('profile');
  const [saved, setSaved] = useState(false);
  const [circles, setCircles] = useState<any[]>([]);

  useEffect(() => {
    // Load settings from chrome storage
    chrome.storage.local.get(['userSettings', 'availableCircles'], (result) => {
      if (result.userSettings) {
        setSettings(result.userSettings);
      }
      if (result.availableCircles) {
        setCircles(result.availableCircles);
      }
    });
  }, []);

  const saveSettings = async () => {
    await chrome.storage.local.set({ userSettings: settings });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSetting = (category: keyof UserSettings, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value
      }
    }));
  };

  const toggleFavorite = (circleId: string) => {
    setSettings(prev => ({
      ...prev,
      circles: {
        ...prev.circles,
        favorites: prev.circles.favorites.includes(circleId)
          ? prev.circles.favorites.filter(id => id !== circleId)
          : [...prev.circles.favorites, circleId]
      }
    }));
  };

  const navItems = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'circles', label: 'Circles', icon: Circle },
    { id: 'appearance', label: 'Appearance', icon: Sun },
    { id: 'tools', label: 'Tools', icon: Layers },
    { id: 'shortcuts', label: 'Shortcuts', icon: Command },
    { id: 'about', label: 'About', icon: Info },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <header className="flex items-center justify-between pb-8 border-b border-border mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
              <Circle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Weetle Settings</h1>
              <p className="text-muted-foreground">Customize your collaborative browsing experience</p>
            </div>
          </div>
          <Button onClick={saveSettings} className="gap-2">
            {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {saved ? 'Saved' : 'Save Changes'}
          </Button>
        </header>

        <div className="grid grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                    activeSection === item.id
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Main Content */}
          <main>
            {/* Profile Section */}
            {activeSection === 'profile' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Profile</h2>
                  <p className="text-muted-foreground">Manage your account and personal settings</p>
                </div>

                <Card>
                  <CardContent className="flex items-center gap-6 p-6">
                    <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center text-2xl font-semibold">
                      {settings.profile.displayName[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{settings.profile.displayName}</h3>
                      <p className="text-muted-foreground">
                        {settings.profile.isSignedIn ? settings.profile.email : 'Using local storage'}
                      </p>
                    </div>
                    {!settings.profile.isSignedIn && (
                      <Button>Sign In</Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Display Name</CardTitle>
                    <CardDescription>This name will be shown to other users in your circles</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-background border border-border rounded-md"
                      value={settings.profile.displayName}
                      onChange={(e) => updateSetting('profile', 'displayName', e.target.value)}
                    />
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Circles Section */}
            {activeSection === 'circles' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Circles</h2>
                  <p className="text-muted-foreground">Manage your circles and set favorites for quick access</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Favorite Circles</CardTitle>
                    <CardDescription>Star circles to show them in the extension popup for quick access</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {circles.map(circle => (
                      <div key={circle.id} className="flex items-center p-3 bg-background rounded-lg border border-border">
                        <div className="flex-1 flex items-center gap-3">
                          <div className="w-8 h-8 bg-secondary rounded-md flex items-center justify-center text-sm">
                            {circle.visibility === 'anonymous' ? '🌐' : circle.visibility === 'private' ? '🔒' : '👥'}
                          </div>
                          <span className="font-medium">{circle.name}</span>
                        </div>
                        <button
                          onClick={() => toggleFavorite(circle.id)}
                          className={cn(
                            "p-2 rounded-md transition-colors",
                            settings.circles.favorites.includes(circle.id)
                              ? "text-yellow-500"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Star className={cn(
                            "h-4 w-4",
                            settings.circles.favorites.includes(circle.id) && "fill-current"
                          )} />
                        </button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Default Circle</CardTitle>
                    <CardDescription>Select the circle to use by default when opening new tabs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <select
                      className="w-full px-3 py-2 bg-background border border-border rounded-md"
                      value={settings.circles.defaultCircle}
                      onChange={(e) => updateSetting('circles', 'defaultCircle', e.target.value)}
                    >
                      {circles.map(circle => (
                        <option key={circle.id} value={circle.id}>{circle.name}</option>
                      ))}
                    </select>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Appearance Section */}
            {activeSection === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Appearance</h2>
                  <p className="text-muted-foreground">Customize colors and visual preferences</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Default Sticky Note Color</CardTitle>
                    <CardDescription>Choose the default color for new sticky notes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-6 gap-2">
                      {STICKY_NOTE_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => updateSetting('appearance', 'stickyNoteColor', color)}
                          className={cn(
                            "aspect-square rounded-lg border-2 transition-all",
                            settings.appearance.stickyNoteColor === color
                              ? "border-primary scale-110"
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ backgroundColor: color }}
                        >
                          {settings.appearance.stickyNoteColor === color && (
                            <Check className="h-4 w-4 text-gray-800 m-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cursor Settings</CardTitle>
                    <CardDescription>Customize how cursors appear</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.appearance.showCursorNames}
                        onChange={(e) => updateSetting('appearance', 'showCursorNames', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span>Show user names next to cursors</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.appearance.animateCursors}
                        onChange={(e) => updateSetting('appearance', 'animateCursors', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span>Animate cursor movements</span>
                    </label>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tools Section */}
            {activeSection === 'tools' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Drawing Tools</h2>
                  <p className="text-muted-foreground">Configure default settings for drawing and annotation tools</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Default Pen Color</CardTitle>
                    <CardDescription>Choose the default color for the drawing pen</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-6 gap-2">
                      {PEN_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => updateSetting('tools', 'defaultPenColor', color)}
                          className={cn(
                            "aspect-square rounded-lg border-2 transition-all",
                            settings.tools.defaultPenColor === color
                              ? "border-primary scale-110"
                              : "border-border hover:scale-105",
                            color === '#ffffff' && "border-border"
                          )}
                          style={{ backgroundColor: color }}
                        >
                          {settings.tools.defaultPenColor === color && (
                            <Check className={cn(
                              "h-4 w-4 m-auto",
                              color === '#ffffff' ? "text-gray-800" : "text-white"
                            )} />
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Tool Defaults</CardTitle>
                    <CardDescription>Set default values for drawing tools</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Default Pen Size</label>
                      <select
                        className="w-full px-3 py-2 bg-background border border-border rounded-md"
                        value={settings.tools.defaultPenSize}
                        onChange={(e) => updateSetting('tools', 'defaultPenSize', Number(e.target.value))}
                      >
                        <option value="2">Thin (2px)</option>
                        <option value="4">Medium (4px)</option>
                        <option value="8">Thick (8px)</option>
                        <option value="16">Extra Thick (16px)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Default Highlighter Opacity</label>
                      <select
                        className="w-full px-3 py-2 bg-background border border-border rounded-md"
                        value={settings.tools.highlighterOpacity}
                        onChange={(e) => updateSetting('tools', 'highlighterOpacity', Number(e.target.value))}
                      >
                        <option value="0.2">20%</option>
                        <option value="0.3">30%</option>
                        <option value="0.5">50%</option>
                        <option value="0.7">70%</option>
                      </select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Shortcuts Section */}
            {activeSection === 'shortcuts' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">Keyboard Shortcuts</h2>
                  <p className="text-muted-foreground">Configure keyboard shortcuts for quick actions</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Extension Shortcuts</CardTitle>
                    <CardDescription>Customize keyboard shortcuts for common actions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Toggle Extension</label>
                      <input
                        type="text"
                        value="Alt+W"
                        readOnly
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-muted-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Create Sticky Note</label>
                      <input
                        type="text"
                        value="Alt+N"
                        readOnly
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-muted-foreground"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Switch Circle</label>
                      <input
                        type="text"
                        value="Alt+C"
                        readOnly
                        className="w-full px-3 py-2 bg-secondary border border-border rounded-md text-muted-foreground"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      To change shortcuts, go to chrome://extensions/shortcuts
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* About Section */}
            {activeSection === 'about' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">About Weetle</h2>
                  <p className="text-muted-foreground">Information about your extension</p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Version</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold mb-2">1.0.0</p>
                    <p className="text-muted-foreground">You're running the latest version</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Resources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <a href="https://weetle.io" target="_blank" className="flex items-center gap-2 text-primary hover:underline">
                      Visit Website <ChevronRight className="h-4 w-4" />
                    </a>
                    <a href="https://github.com/weetle/extension" target="_blank" className="flex items-center gap-2 text-primary hover:underline">
                      View on GitHub <ChevronRight className="h-4 w-4" />
                    </a>
                    <a href="https://weetle.io/docs" target="_blank" className="flex items-center gap-2 text-primary hover:underline">
                      Documentation <ChevronRight className="h-4 w-4" />
                    </a>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Privacy</CardTitle>
                    <CardDescription>Your data, your control</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Anonymous mode stores all data locally on your device. No data is sent to servers unless you explicitly sign in and enable sync.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Success notification */}
      {saved && (
        <div className="fixed bottom-8 right-8 bg-success text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up">
          <Check className="h-5 w-5" />
          Settings saved successfully!
        </div>
      )}
    </div>
  );
}

// Initialize the app
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<OptionsApp />);
}