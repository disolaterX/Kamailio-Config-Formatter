import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("plaintext", {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): vscode.TextEdit[] {
        const data = document.getText();
        const formattedData = kamailioCfgFix(data);
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(data.length)
        );
        return [vscode.TextEdit.replace(fullRange, formattedData)];
      },
    })
  );
}

function kamailioCfgFix(data: string): string {
  const lines = data
    .replace(/\\n/g, "slashN")
    .replace(/\r/g, "slashR")
    .replace(/]\n\s*{/g, `] {`)
    .split("\n");
  const result = [];
  let currentDepth = 0;
  let caseTriggeredDepthInc = false;
  let index = 1;
  let switchDepth = -1;
  for (let line of lines) {
    let pushed = false;
    line = line
      .trim()
      .replace(/slashR/g, "\\r")
      .replace(/\)\{/g, ") {")
      .replace(/]\n\{/g, "] {")
      .replace(/\}\n\}/g, " ")
      .replace(/\}else/g, "} else");
    let space = "";
    if (currentDepth > -1) {
      space = "  ".repeat(currentDepth);
    }

    if (
      (line.endsWith("}") ||
        line.endsWith("};") ||
        (line.startsWith("}") && line.endsWith("{"))) &&
      !line.startsWith("#")
    ) {
      currentDepth -= 1;
      if (currentDepth > -1) {
        space = "  ".repeat(currentDepth);
      }
      if (line.startsWith("}") && line.endsWith("{")) {
        result.push(`${space}${line}`);
        currentDepth += 1;
        pushed = true;
      }
    } else if (line.endsWith("{") && !line.startsWith("#")) {
      currentDepth += 1;
    }

    if (!pushed) result.push(`${space}${line}`);
    index += 1;
  }
  return result.join("\n");
}

export function deactivate() {}
