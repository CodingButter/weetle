#!/usr/bin/env bun
import { $ } from "bun";

console.log("🔨 Initializing database...\n");

try {
  // Generate Prisma client
  console.log("📦 Generating Prisma client...");
  await $`bunx prisma generate --schema=prisma/schema.prisma`;

  // Push schema to database
  console.log("📤 Pushing schema to database...");
  await $`bunx prisma db push --schema=prisma/schema.prisma`;

  console.log("\n✅ Database initialized successfully!");
} catch (error) {
  console.error("\n❌ Error initializing database:", error);
  process.exit(1);
}
