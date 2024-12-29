import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider("plaintext", {
      provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): vscode.TextEdit[] {
        const data = document.getText();
        const formattedData = formatKamailioConfig(data);
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(data.length)
        );
        return [
          vscode.TextEdit.replace(fullRange, formattedData.formattedContent),
        ];
      },
    })
  );
}

export interface KamailioConfig {
  content: string;
  formattedContent: string;
}

/**
 * Formats a Kamailio configuration file content
 * @param configContent The raw content of the Kamailio config file
 * @returns Formatted config content with proper indentation and spacing
 */
export function formatKamailioConfig(configContent: string): KamailioConfig {
  // Remove empty lines at start and end
  const trimmedContent = configContent.trim();

  // Split into lines
  const lines = trimmedContent.split("\n");

  let formattedLines: string[] = [];
  let indentLevel = 0;
  let inPreprocessorBlock = false;

  for (let line of lines) {
    // Trim each line
    let trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      formattedLines.push("");
      continue;
    }

    // Handle preprocessor directives
    if (trimmedLine.startsWith("#!")) {
      if (trimmedLine === "#!KAMAILIO") {
        formattedLines.push(trimmedLine);
        formattedLines.push("");
      } else if (trimmedLine.startsWith("#!define")) {
        formattedLines.push(trimmedLine);
      } else if (
        trimmedLine.startsWith("#!ifdef") ||
        trimmedLine.startsWith("#!ifndef")
      ) {
        inPreprocessorBlock = true;
        formattedLines.push("");
        formattedLines.push(trimmedLine);
        indentLevel++;
      } else if (trimmedLine === "#!else") {
        indentLevel--;
        formattedLines.push(trimmedLine);
        indentLevel++;
      } else if (trimmedLine === "#!endif") {
        indentLevel--;
        formattedLines.push(trimmedLine);
        formattedLines.push("");
        inPreprocessorBlock = false;
      } else {
        formattedLines.push(trimmedLine);
      }
      continue;
    }

    // Handle section headers
    if (trimmedLine.startsWith("#####")) {
      formattedLines.push("");
      formattedLines.push(trimmedLine);
      formattedLines.push("");
      continue;
    }

    // Handle regular comments
    if (trimmedLine.startsWith("#")) {
      // If it's a comment in a preprocessor block or inside a route, indent it
      if (inPreprocessorBlock || indentLevel > 0) {
        formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      } else {
        formattedLines.push(trimmedLine);
      }
      continue;
    }

    // Handle listen directives
    if (trimmedLine.startsWith("listen=")) {
      formattedLines.push(trimmedLine);
      continue;
    }

    // Handle block start
    if (trimmedLine.includes("{")) {
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      indentLevel++;
      continue;
    }

    // Handle block end
    if (trimmedLine.includes("}")) {
      indentLevel = Math.max(0, indentLevel - 1);
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      continue;
    }

    // Format module loading
    if (trimmedLine.startsWith("loadmodule")) {
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      continue;
    }

    // Format module parameters
    if (trimmedLine.startsWith("modparam")) {
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      continue;
    }

    // Format route definitions
    if (
      trimmedLine.startsWith("route[") ||
      trimmedLine.startsWith("failure_route[") ||
      trimmedLine.startsWith("onreply_route[") ||
      trimmedLine.startsWith("event_route[") ||
      trimmedLine.startsWith("request_route")
    ) {
      formattedLines.push("");
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      continue;
    }

    // Handle variable assignments
    if (trimmedLine.includes("=") && !trimmedLine.includes("==")) {
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      continue;
    }

    // Handle SIP-specific functions
    if (
      trimmedLine.startsWith("t_") ||
      trimmedLine.startsWith("sl_") ||
      trimmedLine.startsWith("xlog") ||
      trimmedLine.startsWith("rtpengine_") ||
      trimmedLine.startsWith("ds_") ||
      trimmedLine.startsWith("append_hf") ||
      trimmedLine.startsWith("remove_hf") ||
      trimmedLine.startsWith("is_method") ||
      trimmedLine.startsWith("record_route")
    ) {
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      continue;
    }

    // Handle if statements and conditions
    if (trimmedLine.startsWith("if") || trimmedLine.startsWith("else")) {
      formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
      if (!trimmedLine.endsWith("{")) {
        indentLevel++;
      }
      continue;
    }

    // Add standard indentation for other lines
    formattedLines.push("  ".repeat(indentLevel) + trimmedLine);
  }

  return {
    content: configContent,
    formattedContent: formattedLines.join("\n"),
  };
}

/**
 * Validates basic syntax of Kamailio config
 * @param content The config content to validate
 * @returns true if valid, throws error if invalid
 */
export function validateKamailioConfig(content: string): boolean {
  const lines = content.split("\n");
  let blockCount = 0;
  let preprocessorBlockCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check preprocessor blocks
    if (line.startsWith("#!ifdef") || line.startsWith("#!ifndef")) {
      preprocessorBlockCount++;
    } else if (line === "#!endif") {
      preprocessorBlockCount--;
      if (preprocessorBlockCount < 0) {
        throw new Error(`Unexpected #!endif at line ${i + 1}`);
      }
    }

    // Count block openings and closings
    const openCount = (line.match(/{/g) || []).length;
    const closeCount = (line.match(/}/g) || []).length;

    blockCount += openCount - closeCount;

    if (blockCount < 0) {
      throw new Error(`Unexpected closing bracket at line ${i + 1}`);
    }
  }

  if (blockCount !== 0) {
    throw new Error("Unmatched brackets in configuration");
  }

  if (preprocessorBlockCount !== 0) {
    throw new Error(
      "Unmatched preprocessor directives (#!ifdef/#!ifndef/#!endif)"
    );
  }

  return true;
}

export function deactivate() {}
