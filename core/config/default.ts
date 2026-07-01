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
      defaultCompletionOptions: { maxTokens: 8192 },
    },
  ],
};
