/**
 * Quick API test script
 * Run with: bun run test-api.ts
 */

const BASE_URL = "http://localhost:3000";

async function testAPI() {
  console.log("🧪 Testing Weetle API...\n");

  // Test 1: Health check
  console.log("1. Testing health check...");
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log("✅ Health check:", data);
  } catch (error) {
    console.error("❌ Health check failed:", error);
  }

  // Test 2: Database health
  console.log("\n2. Testing database health...");
  try {
    const response = await fetch(`${BASE_URL}/health/db`);
    const data = await response.json();
    console.log("✅ Database health:", data);
  } catch (error) {
    console.error("❌ Database health failed:", error);
  }

  console.log("\n✨ API tests complete!");
}

testAPI();
