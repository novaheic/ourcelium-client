import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

const WEBSITE_URL = "https://ourcelium.dev";
const GATEWAY_URL = "https://api.ourcelium.dev";
const OURCELIUM_DIR = path.join(os.homedir(), ".ourcelium");
const CONFIG_YAML_PATH = path.join(OURCELIUM_DIR, "config.yaml");

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
        document.getElementById('msg').innerHTML='<h1>You\\'re connected!</h1><p>Return to VS Code to start coding.</p>';
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

      if (req.url === "/callback") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(callbackHtml(port));
        return;
      }

      if (req.url === "/token" && req.method === "POST") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          try {
            const { access_token } = JSON.parse(body) as {
              access_token: string;
            };
            res.writeHead(200);
            res.end("OK");
            server.close();
            resolve(access_token);
          } catch {
            res.writeHead(400);
            res.end();
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

    // 5-minute timeout
    setTimeout(
      () => {
        server.close();
        reject(new Error("Sign-in timed out after 5 minutes"));
      },
      5 * 60 * 1000,
    );
  });
}

async function fetchApiKey(accessToken: string): Promise<string> {
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
  if (!fs.existsSync(OURCELIUM_DIR)) {
    fs.mkdirSync(OURCELIUM_DIR, { recursive: true });
  }

  const yaml = `name: Main Config
version: "1.0.0"
schema: v1
models:
  - name: Qwen3 235B
    provider: openai
    model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
    apiBase: ${GATEWAY_URL}/v1
    apiKey: ${apiKey}
    roles:
      - chat
      - edit
      - apply
    defaultCompletionOptions:
      maxTokens: 8192
`;
  fs.writeFileSync(CONFIG_YAML_PATH, yaml, "utf8");
}

export function getStoredApiKey(): string | undefined {
  if (!fs.existsSync(CONFIG_YAML_PATH)) return undefined;
  try {
    const content = fs.readFileSync(CONFIG_YAML_PATH, "utf8");
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
  if (fs.existsSync(CONFIG_YAML_PATH)) {
    fs.unlinkSync(CONFIG_YAML_PATH);
  }
}

async function runSignInFlow(): Promise<void> {
  const port = await getFreePort();
  const url = `${WEBSITE_URL}/cli-auth?port=${port}`;

  await vscode.env.openExternal(vscode.Uri.parse(url));

  const accessToken = await waitForToken(port);
  const apiKey = await fetchApiKey(accessToken);
  writeConfig(apiKey);
}

export async function signIn(): Promise<{ success: boolean; error?: string }> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Waiting for sign-in...",
        cancellable: false,
      },
      () => runSignInFlow(),
    );
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(`Sign-in failed: ${message}`);
    return { success: false, error: message };
  }
}
