// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as path from "path";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log("File Navgiator: Extension active");

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "file-navigator.start",
    async () => {
      const currentlyOpenedFile =
        vscode.window.activeTextEditor?.document.uri.fsPath;

      if (!currentlyOpenedFile) {
        await vscode.window.showInformationMessage(
          "File Navgiator: No file is currently open."
        );
        return;
      }

      const { type, atPath } = await directoryListingAt(currentlyOpenedFile);

      switch (type) {
        case ActionType.openFile:
          const document = await vscode.workspace.openTextDocument(atPath);
          await vscode.window.showTextDocument(document);
          break;
        case ActionType.createFile:
          const fileName = await vscode.window.showInputBox({
            prompt: "Enter a name for the new file",
          });
          if (!fileName) {
            return;
          }
          const newFilePath = path.resolve(atPath, fileName);

          const workspaceEdit = new vscode.WorkspaceEdit();
          workspaceEdit.createFile(vscode.Uri.file(newFilePath), {
            ignoreIfExists: true,
          });
          await vscode.workspace.applyEdit(workspaceEdit);
          const newDocument = await vscode.workspace.openTextDocument(
            newFilePath
          );
          await vscode.window.showTextDocument(newDocument);

          break;
      }
    }
  );

  context.subscriptions.push(disposable);
}

async function getDirname(pathToFileOrDir: string) {
  const stat = await fs.lstat(pathToFileOrDir);
  if (stat.isDirectory()) {
    return pathToFileOrDir;
  }
  return path.dirname(pathToFileOrDir);
}

async function directoryListingAt(
  pathToFile: string,
  withCallback = vscode.window.showQuickPick
): Promise<Action> {
  const dirPath = await getDirname(pathToFile);
  const filesInDirectory = await fs.readdir(dirPath);
  const result = await withCallback(["..", ...filesInDirectory, "Create File"]);

  switch (result) {
    case "..":
      return await directoryListingAt(
        path.resolve(dirPath, ".."),
        withCallback
      );
    case "Create File":
      return { type: ActionType.createFile, atPath: dirPath };
    case undefined:
      return { type: ActionType.abort, atPath: "" };
    default:
      const newPath = path.resolve(dirPath, result);
      const stat = await fs.lstat(newPath);
      if (stat.isDirectory()) {
        return await directoryListingAt(newPath);
      }
      return {
        type: ActionType.openFile,
        atPath: newPath,
      };
  }
}

interface Action {
  type: ActionType;
  atPath: string;
}

const enum ActionType {
  createFile,
  openFile,
  abort,
}

// this method is called when your extension is deactivated
export function deactivate() {}
