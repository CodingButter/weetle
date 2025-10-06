/**
 * Test setup file
 * Loads environment variables for test context
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env file
config({ path: resolve(process.cwd(), '../../.env') });

// Override DATABASE_URL to use absolute path
const dbPath = resolve(process.cwd(), '../../packages/db/prisma/dev.db');
process.env.DATABASE_URL = `file:${dbPath}`;

console.log('[Test Setup] Loaded environment variables');
console.log('[Test Setup] DATABASE_URL:', process.env.DATABASE_URL);
