import * as fs from "fs";
import * as os from "os";
import * as YAML from "yaml";

// Inlined rather than imported from ../util/paths to avoid an import cycle:
// paths.ts calls this migration during config load.
function restrictPermissions(filePath: string): void {
  try {
    if (os.platform() !== "win32") {
      fs.chmodSync(filePath, 0o600);
    }
  } catch {
    // Non-fatal.
  }
}

/** Together.ai deprecated this in favour of MiniMaxAI/MiniMax-M3. */
const DEPRECATED_MODEL = "Qwen/Qwen3-235B-A22B-Instruct-2507-tput";
const DEPRECATED_MODEL_NAME = "Qwen3 235B";

const CURRENT_MODEL = "MiniMaxAI/MiniMax-M3";
const CURRENT_MODEL_NAME = "MiniMax M3";

/** M3's window on Together. See migrateOurceliumConfig() for why it's needed. */
const CURRENT_CONTEXT_LENGTH = 524288;

const GATEWAY_HOST = "api.ourcelium.dev";

let hasRun = false;

/**
 * Reconcile an existing ~/.ourcelium/config.yaml with the current defaults.
 *
 * config.yaml is only ever written at login, and defaultConfig is only applied
 * when the file is absent or empty — so nothing else ever updates a config that
 * already exists. Two things therefore have to be repaired in place:
 *
 *  1. `model` may still name the deprecated Qwen id. Harmless for inference
 *     (the gateway forces the upstream model regardless) but it mislabels the
 *     model picker.
 *  2. `contextLength` may be absent. The model isn't in llm-info under the
 *     "openai" provider, so it falls back to DEFAULT_CONTEXT_LENGTH (32768) —
 *     identical to maxTokens, which leaves isItemTooBig() a zero-token budget
 *     and silently rejects every @-mentioned file.
 *
 * Only entries pointing at our own gateway are touched; a user's own models are
 * left alone. Parsed as a Document so comments and formatting survive.
 */
export function migrateOurceliumConfig(configPath: string): void {
  if (hasRun) return;
  hasRun = true;

  try {
    if (!fs.existsSync(configPath)) return;

    const raw = fs.readFileSync(configPath, "utf8");
    if (raw.trim() === "") return;

    const doc = YAML.parseDocument(raw);
    if (doc.errors.length > 0) return;

    const models = doc.get("models");
    if (!YAML.isSeq(models)) return;

    let changed = false;

    for (const item of models.items) {
      if (!YAML.isMap(item)) continue;

      const apiBase = item.get("apiBase");
      if (typeof apiBase !== "string" || !apiBase.includes(GATEWAY_HOST)) {
        continue;
      }

      if (item.get("model") === DEPRECATED_MODEL) {
        item.set("model", CURRENT_MODEL);
        changed = true;

        // Only rename when it still carries the generated name — a user who
        // renamed the entry keeps their label.
        if (item.get("name") === DEPRECATED_MODEL_NAME) {
          item.set("name", CURRENT_MODEL_NAME);
        }
      }

      if (
        item.get("model") === CURRENT_MODEL &&
        item.get("contextLength") === undefined
      ) {
        item.set("contextLength", CURRENT_CONTEXT_LENGTH);
        changed = true;
      }
    }

    if (!changed) return;

    fs.writeFileSync(configPath, doc.toString(), "utf8");
    restrictPermissions(configPath);
  } catch {
    // A malformed or unreadable config must never block startup — the user can
    // always log out and back in to regenerate it.
  }
}

/** Test seam: the migration is otherwise once-per-process. */
export function resetOurceliumConfigMigrationForTests(): void {
  hasRun = false;
}
