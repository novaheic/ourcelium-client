import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as path from "path";

import { setConfigFilePermissions } from "core/util/paths.js";

import { env } from "../env.js";

// Keep in sync with extensions/vscode/src/ourceliumAuth.ts — same browser-relay
// flow, same config.yaml format. Only the browser-opening and progress UI differ.

export const WEBSITE_URL = "https://ourcelium.dev";
export const GATEWAY_URL = "https://api.ourcelium.dev";

const configYamlPath = () => path.join(env.continueHome, "config.yaml");

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on("error", reject);
  });
}

const callbackHtml = (port: number) => `<!DOCTYPE html>
<html>
<head>
  <title>Ourcelium</title>
  <style>
    body{font-family:system-ui;display:flex;justify-content:center;align-items:center;
    min-height:100vh;margin:0;background:#1a001a;color:#fff;}
    h1{color:#ff0099;}p{color:#ccc;}
  </style>
</head>
<body>
  <div id="msg"><p>Connecting to Ourcelium...</p></div>
  <script>
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('access_token');
    if (token) {
      fetch('http://localhost:${port}/token', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({access_token:token})
      }).then(()=>{
        document.getElementById('msg').innerHTML='<h1>You\\'re connected!</h1><p>Return to your terminal to start coding.</p>';
      }).catch(()=>{
        document.getElementById('msg').innerHTML='<h1>Something went wrong</h1><p>Please try again.</p>';
      });
    } else {
      document.getElementById('msg').innerHTML='<h1>Sign-in failed</h1><p>No token received. Please try again.</p>';
    }
  </script>
</body>
</html>`;

function waitForToken(port: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // CORS headers so the callback page can POST back
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }

      // req.url includes the query string (e.g. "/callback?code=..."), so
      // compare against the parsed pathname rather than the raw string.
      const { pathname } = new URL(req.url ?? "", "http://localhost");

      if (pathname === "/callback") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(callbackHtml(port));
        return;
      }

      if (pathname === "/token" && req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const { access_token } = JSON.parse(body) as {
              access_token: string;
            };
            res.writeHead(200);
            res.end("OK");
            clearTimeout(timer);
            server.close();
            resolve(access_token);
          } catch {
            res.writeHead(400);
            res.end();
            clearTimeout(timer);
            server.close();
            reject(new Error("Invalid token response"));
          }
        });
        return;
      }

      res.writeHead(404);
      res.end();
    });

    server.listen(port, "127.0.0.1");
    server.on("error", reject);

    // 5-minute timeout; unref'd so a finished CLI process isn't held open
    const timer = setTimeout(
      () => {
        server.close();
        reject(new Error("Sign-in timed out after 5 minutes"));
      },
      5 * 60 * 1000,
    );
    timer.unref();
  });
}

async function fetchApiKey(accessToken: string): Promise<string> {
  // No Content-Type header — the gateway (Fastify) rejects an empty body
  // when content-type is application/json
  const res = await fetch(`${GATEWAY_URL}/v1/keys`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Gateway error ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as { key: string };
  return body.key;
}

function writeConfig(apiKey: string): void {
  if (!fs.existsSync(env.continueHome)) {
    fs.mkdirSync(env.continueHome, { recursive: true });
  }

  const yaml = `name: Main Config
version: "1.0.0"
schema: v1
models:
  - name: MiniMax M3
    provider: openai
    model: MiniMaxAI/MiniMax-M3
    apiBase: ${GATEWAY_URL}/v1
    apiKey: ${apiKey}
    roles:
      - chat
      - edit
      - apply
    capabilities:
      - tool_use
    contextLength: 524288
    defaultCompletionOptions:
      maxTokens: 32768
`;
  fs.writeFileSync(configYamlPath(), yaml, "utf8");
  setConfigFilePermissions(configYamlPath());
}

export function getStoredApiKey(): string | undefined {
  if (!fs.existsSync(configYamlPath())) return undefined;
  try {
    const content = fs.readFileSync(configYamlPath(), "utf8");
    const match = content.match(/apiKey:\s*(\S+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function isSignedIn(): boolean {
  const key = getStoredApiKey();
  return !!key && key !== "PLACEHOLDER";
}

export function logOut(): void {
  if (fs.existsSync(configYamlPath())) {
    fs.unlinkSync(configYamlPath());
  }
}

export async function runLoginFlow(): Promise<void> {
  const port = await getFreePort();
  const url = `${WEBSITE_URL}/cli-auth?port=${port}`;

  const open = (await import("open")).default;
  await open(url);

  const accessToken = await waitForToken(port);
  const apiKey = await fetchApiKey(accessToken);
  writeConfig(apiKey);
}
