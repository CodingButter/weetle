import { createAuthClient } from "better-auth/client";

// Get API URL from environment or default to localhost
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: API_URL,
});

export const { signIn, signUp, signOut, useSession } = authClient;
