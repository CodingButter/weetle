import { Elysia } from "elysia";

export const healthRoutes = new Elysia({ prefix: "/api/health" })
  .get("/", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "weetle-api",
  }))
  .get("/db", async ({ prisma }) => {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  });
