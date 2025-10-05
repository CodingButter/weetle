import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Weetle configuration type
 */
export interface WeetleConfig {
  version: string;
  description?: string;
  performance: {
    throttling: {
      mouseMove: ThrottleSettings;
      scroll: ThrottleSettings;
    };
    interpolation: {
      baseLerpFactor: number;
      maxVelocityBoost: number;
    };
    fileTransfer: {
      chunkSize: number;
      chunkDelay: number;
      maxFileSize: number;
    };
  };
  security: {
    validation: {
      enabled: boolean;
      strictMode: boolean;
    };
    rateLimiting: {
      enabled: boolean;
      maxEventsPerSecond: number;
      maxEventsPerMinute: number;
    };
    reporting: {
      enabled: boolean;
      autoBlockThreshold: number;
      reportExpiryDays: number;
    };
    sanitization: {
      maxStringLength: number;
      maxArrayLength: number;
      maxObjectDepth: number;
    };
  };
  networking: {
    peerServer: {
      host: string;
      port: number;
      path: string;
      secure: boolean;
    };
    reconnection: {
      enabled: boolean;
      maxAttempts: number;
      delayMs: number;
    };
    timeout: {
      connectionMs: number;
      dataChannelMs: number;
    };
  };
  features: {
    stickyNotes: FeatureSettings;
    drawing: FeatureSettings;
    fileSharing: FileSharingSettings;
    voiceChat: MediaSettings;
    videoChat: MediaSettings;
  };
  ui: {
    cursors: {
      showRemoteCursors: boolean;
      showUsernames: boolean;
      cursorTrailLength: number;
      fadeOutMs: number;
    };
    notifications: {
      enabled: boolean;
      sound: boolean;
      duration: number;
    };
    overlay: {
      position: "left" | "right";
      width: number;
      collapsible: boolean;
      defaultCollapsed: boolean;
    };
  };
  experimental: {
    meshRelay: ExperimentalFeature;
    eventCompression: ExperimentalFeature & {
      algorithm?: string;
    };
    predictiveRendering: ExperimentalFeature & {
      lookaheadMs?: number;
    };
  };
}

interface ThrottleSettings {
  minInterval: number;
  maxInterval: number;
  velocityThreshold: number;
  description?: string;
}

interface FeatureSettings {
  enabled: boolean;
  [key: string]: any;
}

interface FileSharingSettings extends FeatureSettings {
  allowedTypes: string[];
  maxFileSize: number;
}

interface MediaSettings extends FeatureSettings {
  codec?: string;
  bitrate?: number;
}

interface ExperimentalFeature {
  enabled: boolean;
  description?: string;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: WeetleConfig = {
  version: "1.0.0",
  performance: {
    throttling: {
      mouseMove: {
        minInterval: 33, // ~30fps
        maxInterval: 100,
        velocityThreshold: 500,
      },
      scroll: {
        minInterval: 50,
        maxInterval: 200,
        velocityThreshold: 1000,
      },
    },
    interpolation: {
      baseLerpFactor: 0.1,
      maxVelocityBoost: 0.3,
    },
    fileTransfer: {
      chunkSize: 16384, // 16KB
      chunkDelay: 10,
      maxFileSize: 104857600, // 100MB
    },
  },
  security: {
    validation: {
      enabled: true,
      strictMode: true,
    },
    rateLimiting: {
      enabled: true,
      maxEventsPerSecond: 60,
      maxEventsPerMinute: 1000,
    },
    reporting: {
      enabled: true,
      autoBlockThreshold: 5,
      reportExpiryDays: 30,
    },
    sanitization: {
      maxStringLength: 10000,
      maxArrayLength: 1000,
      maxObjectDepth: 10,
    },
  },
  networking: {
    peerServer: {
      host: "localhost",
      port: 9000,
      path: "/peer",
      secure: false,
    },
    reconnection: {
      enabled: true,
      maxAttempts: 5,
      delayMs: 5000,
    },
    timeout: {
      connectionMs: 30000,
      dataChannelMs: 10000,
    },
  },
  features: {
    stickyNotes: {
      enabled: true,
      maxPerPage: 100,
      maxTextLength: 5000,
    },
    drawing: {
      enabled: true,
      maxStrokePoints: 1000,
      maxStrokesPerPage: 500,
    },
    fileSharing: {
      enabled: true,
      allowedTypes: ["image/*", "application/pdf", "text/*"],
      maxFileSize: 104857600,
    },
    voiceChat: {
      enabled: false,
      codec: "opus",
      bitrate: 64000,
    },
    videoChat: {
      enabled: false,
      codec: "vp9",
      bitrate: 1000000,
    },
  },
  ui: {
    cursors: {
      showRemoteCursors: true,
      showUsernames: true,
      cursorTrailLength: 10,
      fadeOutMs: 3000,
    },
    notifications: {
      enabled: true,
      sound: false,
      duration: 3000,
    },
    overlay: {
      position: "right",
      width: 400,
      collapsible: true,
      defaultCollapsed: false,
    },
  },
  experimental: {
    meshRelay: {
      enabled: false,
    },
    eventCompression: {
      enabled: false,
      algorithm: "gzip",
    },
    predictiveRendering: {
      enabled: false,
      lookaheadMs: 100,
    },
  },
};

/**
 * Cached configuration
 */
let cachedConfig: WeetleConfig | null = null;

/**
 * Load configuration from weetle.config.json
 */
export function loadConfig(configPath?: string): WeetleConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const path = configPath || resolve(process.cwd(), "weetle.config.json");

  try {
    const fileContent = readFileSync(path, "utf-8");
    const userConfig = JSON.parse(fileContent);

    // Deep merge with defaults
    cachedConfig = deepMerge(DEFAULT_CONFIG, userConfig);

    console.log(`[Config] Loaded configuration from ${path}`);
    return cachedConfig;
  } catch (error) {
    console.warn(`[Config] Could not load config from ${path}, using defaults`);
    cachedConfig = DEFAULT_CONFIG;
    return DEFAULT_CONFIG;
  }
}

/**
 * Get current configuration
 */
export function getConfig(): WeetleConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

/**
 * Reload configuration from disk
 */
export function reloadConfig(configPath?: string): WeetleConfig {
  cachedConfig = null;
  return loadConfig(configPath);
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (sourceValue && typeof sourceValue === "object" && !Array.isArray(sourceValue)) {
      if (targetValue && typeof targetValue === "object" && !Array.isArray(targetValue)) {
        result[key] = deepMerge(targetValue, sourceValue) as any;
      } else {
        result[key] = sourceValue as any;
      }
    } else {
      result[key] = sourceValue as any;
    }
  }

  return result;
}

/**
 * Export default config for reference
 */
export { DEFAULT_CONFIG };
