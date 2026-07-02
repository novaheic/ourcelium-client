import { ConfigYaml } from "@continuedev/config-yaml";

export const defaultConfig: ConfigYaml = {
  name: "Main Config",
  version: "1.0.0",
  schema: "v1",
  models: [
    {
      name: "Qwen3 235B",
      provider: "openai",
      model: "Qwen/Qwen3-235B-A22B-Instruct-2507-tput",
      apiBase: "https://api.ourcelium.dev/v1",
      roles: ["chat", "edit", "apply"],
      // The model string ("Qwen/...") isn't in PROVIDER_TOOL_SUPPORT's openai
      // matcher, so tool support is auto-detected as false and the agent can't
      // apply edits. Qwen3-235B-Instruct supports function calling on Together,
      // so declare it explicitly. ("tool_use" -> capabilities.tools = true.)
      capabilities: ["tool_use"],
      // Whole-file edit_existing_file calls are token-heavy; 8192 truncated the
      // model mid-tool-call, producing malformed JSON that poisoned sessions.
      defaultCompletionOptions: { maxTokens: 32768 },
    },
  ],
};
