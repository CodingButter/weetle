# Development Guide

## Initial Setup

1. **Install Bun** (if not already installed):
```bash
curl -fsSL https://bun.sh/install | bash
```

2. **Clone and setup the project**:
```bash
git clone <your-repo>
cd weetle
bun install
```

3. **Configure environment variables**:
```bash
cp .env.example .env
```

Then edit `.env` and add your API keys:
- OpenAI API key (for GPT models)
- Anthropic API key (for Claude)
- ElevenLabs API key (for text-to-speech)
- Grok API key (for xAI)
- Any other AI service keys you need

The global `.env` file at the project root is automatically loaded by:
- Server (`apps/server`)
- Database package (`packages/db`)
- Extension (via build-time env vars)

4. **Initialize the database**:
```bash
bun run db:init
```

This will:
- Generate the Prisma client
- Create and migrate the SQLite database

## Development Workflow

### Start Development Servers

Run both the extension dev server and API server:

```bash
bun dev
```

This starts:
- **Extension**: http://localhost:3001 (with hot reload)
- **API Server**: http://localhost:3000 (with hot reload)

### Working with the Extension

#### Development Mode
1. Navigate to http://localhost:3001 in your browser to see the extension UI
2. Changes to React components will hot reload automatically

#### Testing as Browser Extension
1. Build the extension: `bun run build:extension`
2. Load `apps/extension/dist` as an unpacked extension in your browser:
   - **Chrome**: Navigate to `chrome://extensions`, enable "Developer mode", click "Load unpacked"
   - **Firefox**: Navigate to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on"
   - **Edge**: Navigate to `edge://extensions`, enable "Developer mode", click "Load unpacked"

### Database Management

#### View/Edit Data with Prisma Studio
```bash
bun run db:studio
```

Opens Prisma Studio at http://localhost:5555

#### Update the Schema
1. Edit `packages/db/prisma/schema.prisma`
2. Generate the client and push changes:
```bash
cd packages/db
bun run generate
bunx prisma db push --schema=prisma/schema.prisma
```

#### Reset the Database
```bash
cd packages/db
rm prisma/dev.db
bun run init
```

### Adding API Routes

Create new route files in `apps/server/src/routes/`:

```typescript
import { Elysia } from "elysia"

const MyRoute = new Elysia({ prefix: "/my-route" })
  .get("/", () => ({ message: "Hello" }))
  .post("/create", async ({ body, prisma }) => {
    // Use prisma to interact with database
    return { success: true }
  }, {
    db: true, // Adds prisma to context
  })

export default MyRoute
```

Then import and use it in `apps/server/src/index.ts`:

```typescript
import MyRoute from "./routes/my-route"
// ...
.use(MyRoute)
```

### Adding Protected Routes

Use the `auth` macro for authenticated routes:

```typescript
.get("/protected", ({ user }) => {
  return { user }
}, {
  auth: true, // Requires authentication
})
```

### Frontend Components

Components are in `apps/extension/src/components/`. The project uses:
- **Styling**: Tailwind CSS v4 with custom color system
- **UI Components**: Radix UI primitives
- **Forms**: React Hook Form + Zod
- **State**: TanStack Query
- **Routing**: React Router v7
- **Theming**: next-themes

### Authentication

Better Auth is configured with email/password authentication. To use it:

```typescript
import { authClient } from "@/lib/auth-client"

// Sign up
await authClient.signUp.email({
  email: "user@example.com",
  password: "password",
  name: "User Name"
})

// Sign in
await authClient.signIn.email({
  email: "user@example.com",
  password: "password"
})

// Get session
const { data: session } = authClient.useSession()
```

## Project Structure

```
weetle/
├── apps/
│   ├── extension/           # Browser extension (React)
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── pages/       # Page components
│   │   │   ├── lib/         # Utilities and helpers
│   │   │   ├── App.tsx      # Main app component
│   │   │   ├── main.tsx     # Entry point
│   │   │   ├── background.ts     # Extension background script
│   │   │   └── contentScript.ts  # Extension content script
│   │   ├── public/          # Static assets (manifest.json, icons)
│   │   ├── index.tsx        # Dev server entry
│   │   └── build.ts         # Production build script
│   │
│   └── server/              # API server (Elysia)
│       ├── src/
│       │   ├── lib/         # Auth, utils, context
│       │   ├── routes/      # API routes
│       │   └── index.ts     # Server entry point
│       └── uploads/         # File uploads directory
│
└── packages/
    ├── db/                  # Database (Prisma)
    │   ├── prisma/
    │   │   └── schema.prisma
    │   ├── generated/       # Generated Prisma client
    │   └── index.ts         # Exports Prisma client
    │
    ├── config/              # Shared configuration
    │   └── tsconfig.base.json
    │
    └── ui/                  # Shared UI components (empty, ready for use)
```

## Building for Production

### Build the Extension
```bash
bun run build:extension
```

Output: `apps/extension/dist/`

### Build the Server
The server runs directly with Bun, no build step needed:
```bash
cd apps/server
bun src/index.ts
```

## Troubleshooting

### Extension not loading
- Make sure you've run `bun run build:extension`
- Check that manifest.json is in the dist folder
- Verify all file paths in manifest.json are correct

### Database errors
- Run `bun run db:init` to regenerate the database
- Check that DATABASE_URL in `.env` files is correct
- Ensure the Prisma client is generated: `cd packages/db && bun run generate`

### Port conflicts
- Change ports in:
  - Extension dev server: `apps/extension/index.tsx` (default: 3001)
  - API server: `apps/server/.env` PORT variable (default: 3000)

### Module not found errors
- Run `bun install` from the root directory
- Ensure workspace dependencies are properly linked
- Try clearing node_modules and reinstalling: `rm -rf node_modules && bun install`
