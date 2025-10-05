# Environment Variables Setup

## Global Configuration

All environment variables are centralized in the root `.env` file. This makes it easy to manage API keys and configuration across the entire monorepo.

## Setup Instructions

1. **Copy the example file**:
```bash
cp .env.example .env
```

2. **Add your API keys** to the `.env` file

## Available API Keys

### AI / ML Services

| Service | Variable | Description |
|---------|----------|-------------|
| OpenAI | `OPENAI_API_KEY` | GPT-4, GPT-3.5, DALL-E, Whisper |
| Anthropic | `ANTHROPIC_API_KEY` | Claude models |
| Grok | `GROK_API_KEY` | xAI's Grok |
| ElevenLabs | `ELEVENLABS_API_KEY` | Text-to-Speech |
| Google AI | `GOOGLE_AI_API_KEY` | Gemini, Palm |
| Cohere | `COHERE_API_KEY` | Cohere models |
| Hugging Face | `HUGGINGFACE_API_KEY` | Hugging Face Hub |
| Replicate | `REPLICATE_API_TOKEN` | Replicate models |
| Stability AI | `STABILITY_API_KEY` | Stable Diffusion |
| Perplexity | `PERPLEXITY_API_KEY` | Perplexity AI |

### Application Config

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./packages/db/prisma/dev.db` | SQLite database path |
| `BETTER_AUTH_SECRET` | (generated) | Secret for auth encryption |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Auth service URL |
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |
| `VITE_API_URL` | `http://localhost:3000` | API URL for extension |

## How It Works

### Server (`apps/server`)
The server loads the root `.env` file automatically:
```typescript
import { env } from "@weetle/config/env"

// Use typed environment variables
const apiKey = env.OPENAI_API_KEY
```

### Extension (`apps/extension`)
The extension uses build-time environment variables prefixed with `VITE_`:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

### Packages (`packages/*`)
Shared packages can import from `@weetle/config/env`:
```typescript
import { env } from "@weetle/config/env"
```

## Adding New Environment Variables

1. **Add to `.env` file**:
```bash
MY_NEW_API_KEY=your_key_here
```

2. **Add to `packages/config/env.ts`**:
```typescript
export const env = {
  // ... existing vars
  MY_NEW_API_KEY: process.env.MY_NEW_API_KEY || "",
}
```

3. **Add to `.env.example`**:
```bash
MY_NEW_API_KEY=your_key_here
```

4. **Use in your code**:
```typescript
import { env } from "@weetle/config/env"
const apiKey = env.MY_NEW_API_KEY
```

## Security Notes

- **Never commit `.env`** - it's in `.gitignore`
- **Always commit `.env.example`** - with placeholder values
- **Rotate secrets regularly** - especially in production
- **Use different secrets** for dev/staging/prod

## Troubleshooting

### Variables not loading
- Check that `.env` exists in the project root
- Restart the dev server after changing `.env`
- Verify the variable name matches exactly (case-sensitive)

### Extension not getting variables
- Extension variables must be prefixed with `VITE_`
- Rebuild the extension after changing env vars
- Check `apps/extension/.env.local` for extension-specific overrides
