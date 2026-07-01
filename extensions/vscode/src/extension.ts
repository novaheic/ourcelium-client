/**
 * This is the entry point for the extension.
 */

import { setupCa } from "core/util/ca";
import * as vscode from "vscode";

export { default as buildTimestamp } from "./.buildTimestamp";

async function dynamicImportAndActivate(context: vscode.ExtensionContext) {
  await setupCa();
  const { activateExtension } = await import("./activation/activate");
  return await activateExtension(context);
}

export function activate(context: vscode.ExtensionContext) {
  return dynamicImportAndActivate(context).catch((e) => {
    console.error("Error activating extension: ", e?.stack ?? e);
    vscode.window
      .showWarningMessage(
        `Error activating the Ourcelium extension: ${e?.message ?? e}`,
        "View Logs",
        "Retry",
      )
      .then((selection) => {
        if (selection === "View Logs") {
          vscode.commands.executeCommand("workbench.action.showErrorLog");
        } else if (selection === "Retry") {
          // Reload VS Code window
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  });
}

export function deactivate() {}
