import { serve } from "bun";
import index from "@/index.html";

const server = serve({
  port: 3001,
  routes: {
    "/": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Extension dev server running at ${server.url}`);
