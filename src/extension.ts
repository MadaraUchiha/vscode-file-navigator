// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { promises as fs } from "fs";
import * as path from "path";

const DIRECTORY_PREFIX = "📁 ";
const FILE_PREFIX = "📄 ";

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

      return await navigateTo(currentlyOpenedFile);
    }
  );

  context.subscriptions.push(disposable);
}

async function navigateTo(currentlyOpenedFile: string): Promise<void> {
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
      const newDocument = await vscode.workspace.openTextDocument(newFilePath);
      await vscode.window.showTextDocument(newDocument);

      break;
    case ActionType.createFolder:
      const dirName = await vscode.window.showInputBox({
        prompt: "Enter a name for the new folder",
      });
      if (!dirName) {
        return;
      }
      const newDirPath = path.resolve(atPath, dirName);
      await fs.mkdir(newDirPath, { recursive: true });
      return await navigateTo(newDirPath);
  }
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
  const directoryListing = await fs.readdir(dirPath, { withFileTypes: true });

  const fileDisplayNames = directoryListing
    .sort((a, b) =>
      a.isDirectory()
        ? b.isDirectory()
          ? a.name.localeCompare(b.name)
          : -1
        : 1
    )
    .map(
      (item) =>
        `${item.isDirectory() ? DIRECTORY_PREFIX : FILE_PREFIX}${item.name}`
    );

  const result = await withCallback([
    "..",
    ...fileDisplayNames,
    "Create Folder",
    "Create File",
  ]);

  switch (result) {
    case "..":
      return await directoryListingAt(
        path.resolve(dirPath, ".."),
        withCallback
      );
    case "Create File":
      return { type: ActionType.createFile, atPath: dirPath };
    case "Create Folder":
      return { type: ActionType.createFolder, atPath: dirPath };
    case undefined:
      return { type: ActionType.abort, atPath: "" };
    default:
      if (result.startsWith(DIRECTORY_PREFIX)) {
        const selectedDirName = result.slice(DIRECTORY_PREFIX.length);
        const newPath = path.resolve(dirPath, selectedDirName);
        return await directoryListingAt(newPath);
      }
      const selectedFileName = result.slice(FILE_PREFIX.length);
      const newPath = path.resolve(dirPath, selectedFileName);
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
  createFolder,
  openFile,
  abort,
}

// this method is called when your extension is deactivated
export function deactivate() {}
