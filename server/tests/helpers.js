const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

// Create a temp data dir, set the env var, and return it along with a cleanup fn.
// Call this at the TOP of a test file, before requiring anything else that
// reads data-dir.js (order matters because data-dir is resolved at require time).
function useTempDataDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontline-test-'));
  process.env.FRONTLINE_DATA_DIR = dir;
  return {
    dir,
    cleanup: () => {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      delete process.env.FRONTLINE_DATA_DIR;
    },
  };
}

// Lightweight HTTP helper — issues a request against a bound Node server.
// Returns { status, headers, body } with JSON-parsed body when possible.
function request(server, method, urlPath, { body, headers, token } = {}) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const reqBody = body != null ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(reqBody && { 'Content-Length': Buffer.byteLength(reqBody) }),
          ...(token && { Authorization: `Bearer ${token}` }),
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed = raw;
          try { parsed = JSON.parse(raw); } catch { /* not JSON */ }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );
    req.on('error', reject);
    if (reqBody) req.write(reqBody);
    req.end();
  });
}

module.exports = { useTempDataDir, request };
