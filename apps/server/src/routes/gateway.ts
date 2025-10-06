/**
 * Gateway Route - Handles share links and extension detection
 * Redirects users through an onboarding flow if they don't have the extension
 */

import { Elysia } from 'elysia';

export const gatewayRoutes = new Elysia({ prefix: '/gateway' });

/**
 * Gateway page for shared circle links
 * URL format: /gateway?url=<encoded-url>&circle=<circle-id>
 */
gatewayRoutes.get('/', ({ query }) => {
  const url = query.url;
  const circleId = query.circle;

  if (!url || !circleId) {
    return new Response('Invalid share link', { status: 400 });
  }

  // Decode the target URL and add circle parameter
  const targetUrl = decodeURIComponent(url);
  const finalUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}weetlec=${circleId}`;

  // Return HTML page that detects extension and handles redirect
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Weetle - Joining Circle ${circleId}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .container {
          text-align: center;
          max-width: 500px;
          padding: 40px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        h1 {
          font-size: 48px;
          margin-bottom: 10px;
        }

        .subtitle {
          font-size: 18px;
          opacity: 0.9;
          margin-bottom: 30px;
        }

        .circle-info {
          background: rgba(255, 255, 255, 0.2);
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 30px;
        }

        .circle-id {
          font-family: monospace;
          font-size: 16px;
          background: rgba(0, 0, 0, 0.3);
          padding: 8px 12px;
          border-radius: 6px;
          display: inline-block;
          margin-top: 10px;
        }

        .status {
          font-size: 16px;
          margin-bottom: 30px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 20px auto;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .install-prompt {
          display: none;
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .install-prompt.show {
          display: block;
        }

        .btn {
          display: inline-block;
          padding: 12px 30px;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.2s, box-shadow 0.2s;
          margin: 10px;
        }

        .btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
        }

        .btn-secondary {
          background: transparent;
          color: white;
          border: 2px solid white;
        }

        .url-preview {
          font-size: 14px;
          opacity: 0.8;
          margin-top: 20px;
          word-break: break-all;
        }

        .success-check {
          font-size: 60px;
          margin-bottom: 20px;
          display: none;
        }

        .success-check.show {
          display: block;
          animation: bounceIn 0.5s ease-out;
        }

        @keyframes bounceIn {
          0% { transform: scale(0); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎯 Weetle</h1>
        <p class="subtitle">Collaborative Web Browsing</p>

        <div class="circle-info">
          <p>You're being invited to join a circle:</p>
          <div class="circle-id">${circleId}</div>
        </div>

        <div id="checking" class="status">
          <div class="spinner"></div>
          <p>Checking for Weetle extension...</p>
        </div>

        <div id="success" class="status" style="display: none;">
          <div class="success-check">✅</div>
          <p>Extension detected! Redirecting...</p>
        </div>

        <div id="install-prompt" class="install-prompt">
          <p style="margin-bottom: 20px;">
            To join this collaborative circle, you need the Weetle extension.
          </p>
          <a href="https://weetle.io" target="_blank" class="btn">
            Get Weetle Extension
          </a>
          <br>
          <a href="${finalUrl}" class="btn btn-secondary">
            Continue without Extension
          </a>
        </div>

        <div class="url-preview">
          <small>Destination: ${new URL(targetUrl).hostname}</small>
        </div>
      </div>

      <script>
        const finalUrl = "${finalUrl}";
        let extensionDetected = false;
        let checkCount = 0;
        const maxChecks = 100; // Check for 10 seconds (100 * 100ms)

        // Method 1: Check for extension via injected element
        function checkForExtensionElement() {
          return document.querySelector('[data-weetle-extension]') !== null;
        }

        // Method 2: Try to communicate with extension
        function checkViaMessage() {
          window.postMessage({ type: 'WEETLE_EXTENSION_CHECK' }, '*');
        }

        // Listen for extension response
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'WEETLE_EXTENSION_PRESENT') {
            extensionDetected = true;
            onExtensionDetected();
          }
        });

        function onExtensionDetected() {
          document.getElementById('checking').style.display = 'none';
          document.getElementById('success').style.display = 'block';
          document.querySelector('.success-check').classList.add('show');

          // Redirect after short delay
          setTimeout(() => {
            window.location.href = finalUrl;
          }, 1500);
        }

        function showInstallPrompt() {
          document.getElementById('checking').style.display = 'none';
          document.getElementById('install-prompt').classList.add('show');

          // Continue checking in background
          continuousCheck();
        }

        function continuousCheck() {
          // Check every second in case they install the extension
          setInterval(() => {
            checkViaMessage();
            if (checkForExtensionElement() && !extensionDetected) {
              extensionDetected = true;
              onExtensionDetected();
            }
          }, 1000);
        }

        // Initial detection loop
        function detectExtension() {
          checkCount++;

          // Try both detection methods
          checkViaMessage();

          if (checkForExtensionElement()) {
            extensionDetected = true;
            onExtensionDetected();
            return;
          }

          if (checkCount < maxChecks && !extensionDetected) {
            setTimeout(detectExtension, 100);
          } else if (!extensionDetected) {
            showInstallPrompt();
          }
        }

        // Start detection
        detectExtension();
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
});