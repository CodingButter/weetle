import { config } from "dotenv"
import { resolve } from "path"

// Load global .env from project root
const rootPath = resolve(__dirname, "../../.env")
config({ path: rootPath })

// Export typed environment variables
export const env = {
  // ==============================================
  // AI API Keys
  // ==============================================
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",

  GROK_API_KEY: process.env.GROK_API_KEY || "",
  GROK_MODEL: process.env.GROK_MODEL || "grok-beta",

  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || "",
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID || "",
  ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2",
  ELEVENLABS_OUTPUT_FORMAT: process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_64",

  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || "",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-1.5-flash-002",

  COHERE_API_KEY: process.env.COHERE_API_KEY || "",
  HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY || "",
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN || "",
  STABILITY_API_KEY: process.env.STABILITY_API_KEY || "",
  PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || "",

  // ==============================================
  // Social Media & Streaming
  // ==============================================
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || "",
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || "",
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || "",
  DISCORD_USERNAME: process.env.DISCORD_USERNAME || "",
  DISCORD_PASSWORD: process.env.DISCORD_PASSWORD || "",
  DISCORD_USER_COOKIE: process.env.DISCORD_USER_COOKIE || "",

  TWITCH_USERNAME: process.env.TWITCH_USERNAME || "",
  TWITCH_OAUTH_TOKEN: process.env.TWITCH_OAUTH_TOKEN || "",
  TWITCH_CHANNEL: process.env.TWITCH_CHANNEL || "",

  X_BEARER_TOKEN: process.env.X_BEARER_TOKEN || "",
  X_ACCESS_TOKEN: process.env.X_ACCESS_TOKEN || "",
  X_ACCESS_TOKEN_SECRET: process.env.X_ACCESS_TOKEN_SECRET || "",
  X_API_KEY: process.env.X_API_KEY || "",
  X_API_SECRET_KEY: process.env.X_API_SECRET_KEY || "",
  X_USERNAME: process.env.X_USERNAME || "",
  X_EMAIL: process.env.X_EMAIL || "",

  // ==============================================
  // Payment & Authentication
  // ==============================================
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",

  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  CLERK_JWT_TEMPLATE: process.env.CLERK_JWT_TEMPLATE || "",

  // ==============================================
  // Cloud Storage
  // ==============================================
  S3_BUCKET: process.env.S3_BUCKET || "",
  S3_REGION: process.env.S3_REGION || "us-east-1",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID || "",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY || "",
  S3_SIGNED_URL_TTL: Number(process.env.S3_SIGNED_URL_TTL) || 3600,

  // ==============================================
  // Database
  // ==============================================
  DATABASE_URL: process.env.DATABASE_URL || "file:./packages/db/prisma/dev.db",
  POSTGRES_URL: process.env.POSTGRES_URL || "",
  REDIS_URL: process.env.REDIS_URL || "",
  NEO4J_USERNAME: process.env.NEO4J_USERNAME || "",
  NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || "",
  NEO4J_URI: process.env.NEO4J_URI || "",
  MONGODB_URL: process.env.MONGODB_URL || "",

  // ==============================================
  // CMS & Content
  // ==============================================
  CONTENTFUL_SPACE_ID: process.env.CONTENTFUL_SPACE_ID || "",
  CONTENTFUL_ACCESS_TOKEN: process.env.CONTENTFUL_ACCESS_TOKEN || "",
  CONTENTFUL_PREVIEW_TOKEN: process.env.CONTENTFUL_PREVIEW_TOKEN || "",
  CONTENTFUL_MANAGEMENT_TOKEN: process.env.CONTENTFUL_MANAGEMENT_TOKEN || "",
  DIRECTUS_ADMIN_TOKEN: process.env.DIRECTUS_ADMIN_TOKEN || "",

  // ==============================================
  // Tools & Utilities
  // ==============================================
  CAPSOLVER_API_KEY: process.env.CAPSOLVER_API_KEY || "",
  USER_AGENT: process.env.USER_AGENT || "Mozilla/5.0",
  SENTRY_DSN: process.env.SENTRY_DSN || "",

  // ==============================================
  // Streaming & OBS
  // ==============================================
  OBS_WEBSOCKET_URL: process.env.OBS_WEBSOCKET_URL || "",
  AVATAR_SERVER_HOST: process.env.AVATAR_SERVER_HOST || "localhost",
  AVATAR_SERVER_PORT: Number(process.env.AVATAR_SERVER_PORT) || 8080,

  // ==============================================
  // Authentication
  // ==============================================
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

  // ==============================================
  // Server Configuration
  // ==============================================
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",

  // ==============================================
  // Client Configuration
  // ==============================================
  VITE_API_URL: process.env.VITE_API_URL || "http://localhost:3000",
} as const

export type Env = typeof env
