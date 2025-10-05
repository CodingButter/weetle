import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "dotenv";
import { resolve } from "path";

// Context
import { context } from "./lib/context";

// Routes
import { healthRoutes } from "./routes/health";
import { authRoutes } from "./routes/auth";
import { circleRoutes } from "./routes/circles";
import { layerRoutes } from "./routes/layers";
import { sessionRoutes } from "./routes/sessions";
import { peerRoutes } from "./routes/peers";

// PeerJS server
import { createPeerServer } from "./peer-server";

// Load environment variables from root .env file
config({ path: resolve(process.cwd(), "../../.env") });

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
const peerPort = process.env.PEER_PORT ? Number(process.env.PEER_PORT) : 9000;

const app = new Elysia()
  // Context (provides Prisma client)
  .use(context)

  // CORS middleware
  .use(
    cors({
      origin: true, // Allow all origins in dev
      credentials: true,
    })
  )

  // Health check routes
  .use(healthRoutes)

  // Auth routes
  .use(authRoutes)

  // Circle routes
  .use(circleRoutes)

  // Layer routes
  .use(layerRoutes)

  // Session routes
  .use(sessionRoutes)

  // Peer discovery routes (unauthenticated for anonymous mode)
  .use(peerRoutes)

  // Error handling
  .onError(({ code, error, set }) => {
    console.error("Error:", error);

    if (code === "VALIDATION") {
      set.status = 400;
      return {
        error: "Validation error",
        message: error.message,
      };
    }

    if (error.message === "Unauthorized") {
      set.status = 401;
      return {
        error: "Unauthorized",
        message: "You must be logged in to access this resource",
      };
    }

    set.status = 500;
    return {
      error: "Internal server error",
      message: error.message,
    };
  })

  .listen(port);

// Start PeerJS server
createPeerServer(peerPort);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
