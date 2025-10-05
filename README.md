# Weetle

A browser extension template with a full-stack development setup.

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4
- **Backend**: Elysia, Better Auth
- **Database**: Prisma with SQLite
- **Runtime**: Bun
- **UI Components**: Radix UI
- **State Management**: TanStack Query
- **Forms**: React Hook Form + Zod

## Project Structure

```
weetle/
├── apps/
│   ├── extension/     # Browser extension (React app)
│   └── server/        # API server (Elysia)
└── packages/
    ├── db/           # Prisma schema and client
    ├── config/       # Shared configuration
    └── ui/           # Shared UI components
```

## Quick Start

```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env and add your API keys

# Initialize database
bun run db:init

# Start development servers
bun dev
```

This starts:
- 🎨 Extension dev server: http://localhost:3001
- 🚀 API server: http://localhost:3000

## What's Included

✅ **Browser Extension**
- React 19 with hot module reloading
- Tailwind CSS v4 with dark mode
- Background scripts and content scripts
- Manifest v3 ready

✅ **Backend API**
- Elysia server with auto-reload
- Better Auth with email/password
- Protected route macros
- File upload support

✅ **Database**
- Prisma ORM with SQLite
- Better Auth schema included
- Prisma Studio for data management

✅ **Developer Experience**
- Bun workspace monorepo
- TypeScript throughout
- Shared packages for code reuse
- Hot reload on all services

## Next Steps

1. 📖 Read [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development guide
2. 🎨 Customize the extension UI in `apps/extension/src/`
3. 🔌 Add API routes in `apps/server/src/routes/`
4. 📊 Modify database schema in `packages/db/prisma/schema.prisma`
5. 🎭 Build your extension: `bun run build:extension`

## Documentation

- [Development Guide](./DEVELOPMENT.md) - Complete development workflow
- [Environment Setup](./ENV_SETUP.md) - API keys and configuration
- [Prisma Schema](./packages/db/prisma/schema.prisma) - Database models
- [API Context](./apps/server/src/lib/Context.ts) - Server middleware setup

## Environment Variables

All API keys and configuration are centralized in the root `.env` file. This includes:

**AI Services**: OpenAI, Anthropic (Claude), Grok, ElevenLabs, Google AI, Cohere, Hugging Face, Replicate, Stability AI, Perplexity

See [ENV_SETUP.md](./ENV_SETUP.md) for detailed configuration instructions.

## License

MIT
