import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { beforeEach, describe, expect, test } from "vitest";
import * as YAML from "yaml";

import {
  migrateOurceliumConfig,
  resetOurceliumConfigMigrationForTests,
} from "./migrateOurceliumConfig";

function writeTempConfig(contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ourcelium-migrate-"));
  const p = path.join(dir, "config.yaml");
  fs.writeFileSync(p, contents, "utf8");
  return p;
}

function firstModel(configPath: string): any {
  return YAML.parse(fs.readFileSync(configPath, "utf8")).models[0];
}

const LEGACY = `name: Main Config
version: "1.0.0"
schema: v1
models:
  - name: Qwen3 235B
    provider: openai
    model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
    apiBase: https://api.ourcelium.dev/v1
    apiKey: orc_secret
    roles:
      - chat
    defaultCompletionOptions:
      maxTokens: 32768
`;

describe("migrateOurceliumConfig", () => {
  beforeEach(() => resetOurceliumConfigMigrationForTests());

  test("upgrades the deprecated Qwen model and adds contextLength", () => {
    const p = writeTempConfig(LEGACY);
    migrateOurceliumConfig(p);

    const m = firstModel(p);
    expect(m.model).toBe("MiniMaxAI/MiniMax-M3");
    expect(m.name).toBe("MiniMax M3");
    expect(m.contextLength).toBe(524288);
  });

  test("preserves the API key and unrelated fields", () => {
    const p = writeTempConfig(LEGACY);
    migrateOurceliumConfig(p);

    const m = firstModel(p);
    expect(m.apiKey).toBe("orc_secret");
    expect(m.roles).toEqual(["chat"]);
    expect(m.defaultCompletionOptions.maxTokens).toBe(32768);
  });

  test("adds contextLength to an already-M3 config", () => {
    const p = writeTempConfig(
      LEGACY.replace(
        "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
        "MiniMaxAI/MiniMax-M3",
      ),
    );
    migrateOurceliumConfig(p);
    expect(firstModel(p).contextLength).toBe(524288);
  });

  test("keeps a user-chosen model name", () => {
    const p = writeTempConfig(LEGACY.replace("Qwen3 235B", "My Model"));
    migrateOurceliumConfig(p);

    const m = firstModel(p);
    expect(m.name).toBe("My Model");
    expect(m.model).toBe("MiniMaxAI/MiniMax-M3");
  });

  test("does not touch models pointing at another provider", () => {
    const p = writeTempConfig(`name: Main Config
version: "1.0.0"
schema: v1
models:
  - name: Local
    provider: openai
    model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
    apiBase: http://localhost:1234/v1
`);
    migrateOurceliumConfig(p);

    const m = firstModel(p);
    expect(m.model).toBe("Qwen/Qwen3-235B-A22B-Instruct-2507-tput");
    expect(m.contextLength).toBeUndefined();
  });

  test("is idempotent and leaves a current config byte-identical", () => {
    const p = writeTempConfig(LEGACY);
    migrateOurceliumConfig(p);
    const afterFirst = fs.readFileSync(p, "utf8");

    resetOurceliumConfigMigrationForTests();
    migrateOurceliumConfig(p);
    expect(fs.readFileSync(p, "utf8")).toBe(afterFirst);
  });

  test("leaves malformed yaml untouched rather than destroying it", () => {
    const broken = "models:\n  - name: [unclosed\n";
    const p = writeTempConfig(broken);
    migrateOurceliumConfig(p);
    expect(fs.readFileSync(p, "utf8")).toBe(broken);
  });

  test("preserves comments", () => {
    const p = writeTempConfig(`# my notes
models:
  - name: Qwen3 235B
    provider: openai
    model: Qwen/Qwen3-235B-A22B-Instruct-2507-tput
    apiBase: https://api.ourcelium.dev/v1
`);
    migrateOurceliumConfig(p);
    expect(fs.readFileSync(p, "utf8")).toContain("# my notes");
  });

  test("does nothing when the file is absent", () => {
    expect(() =>
      migrateOurceliumConfig(path.join(os.tmpdir(), "nope-missing.yaml")),
    ).not.toThrow();
  });
});
