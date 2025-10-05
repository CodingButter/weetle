import { Elysia } from "elysia";
import { PrismaClient } from "@weetle/db";

const prisma = new PrismaClient();

/**
 * Context plugin
 * Provides shared context across all routes
 */
export const context = new Elysia({ name: "context" }).decorate("prisma", prisma);
