import { ConfigYaml } from "@continuedev/config-yaml";

export const defaultConfig: ConfigYaml = {
  name: "Main Config",
  version: "1.0.0",
  schema: "v1",
  models: [
    {
      name: "MiniMax M3",
      provider: "openai",
      model: "MiniMaxAI/MiniMax-M3",
      apiBase: "https://api.ourcelium.dev/v1",
      roles: ["chat", "edit", "apply"],
      // The model string ("MiniMaxAI/...") isn't in PROVIDER_TOOL_SUPPORT's openai
      // matcher, so tool support is auto-detected as false and the agent can't
      // apply edits. MiniMax M3 supports function calling on Together, so
      // declare it explicitly. ("tool_use" -> capabilities.tools = true.)
      capabilities: ["tool_use"],
      // Not in llm-info under the "openai" provider, so contextLength falls back
      // to DEFAULT_CONTEXT_LENGTH (32768) — identical to maxTokens, leaving a
      // zero-token budget in isItemTooBig() so every @-mentioned file is
      // rejected as "too big". M3's real window on Together is 524288.
      contextLength: 524288,
      // Whole-file edit_existing_file calls are token-heavy; 8192 truncated the
      // model mid-tool-call, producing malformed JSON that poisoned sessions.
      defaultCompletionOptions: { maxTokens: 32768 },
      // edit_existing_file relies on a model-based "apply" step to merge lazy
      // edits; disable until validated on M3 — agent uses single_find_and_replace
      // / multi_edit, which apply deterministically via instantApplyDiff.
      chatOptions: {
        toolOverrides: {
          edit_existing_file: { disabled: true },
        },
      },
    },
  ],
};
