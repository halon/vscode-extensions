import * as path from "path";
import {
  window,
  workspace,
  Uri,
  DiagnosticCollection,
  Range,
  Diagnostic,
  DiagnosticSeverity,
  TextDocument,
  RelativePattern,
  Location,
  Position,
  DiagnosticRelatedInformation,
} from "vscode";
import * as build from "./build";
import * as remote from "./remote";
import * as factory from "./factory";
import pathIsInside from "path-is-inside";

export default async (
  connector: factory.SocketConnector,
  document: TextDocument,
  diagnosticCollection: DiagnosticCollection,
) => {
  const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

  if (typeof workspaceFolder !== "undefined") {
    let uris: Uri[] = [];

    let filesPath = path.join(workspaceFolder.uri.fsPath, "src", "files");
    let hooksPath = path.join(workspaceFolder.uri.fsPath, "src", "hooks");

    if (pathIsInside(document.uri.fsPath, hooksPath)) {
      uris.push(document.uri);
    }

    if (pathIsInside(document.uri.fsPath, filesPath)) {
      let pattern = new RelativePattern(hooksPath, "**/*.{hsl}");
      let matches = await workspace.findFiles(pattern);
      uris = uris.concat(matches);
    }

    let syntaxErrors: Array<any> = [];
    for (let uri of uris) {
      let syntaxObject = build.syntax(uri.fsPath, workspaceFolder.uri.fsPath);

      const dirtyScripts = workspace.textDocuments.filter(
        (document) => document.languageId === "hsl" && document.isDirty,
      );
      for (let dirtyScript of dirtyScripts) {
        if (dirtyScript.fileName === uri.fsPath) {
          syntaxObject.data = dirtyScript.getText();
        }
        const matchedIndex = syntaxObject.files
          .map((file: any) => {
            return path.join(filesPath, file.id);
          })
          .indexOf(dirtyScript.uri.fsPath);
        if (matchedIndex !== -1) {
          syntaxObject.files[matchedIndex].data = dirtyScript.getText();
        }
      }

      try {
        const syntaxError = await remote.syntax(connector, syntaxObject);
        syntaxErrors.push(syntaxError);
      } catch (error) {
        diagnosticCollection.clear();
        window.showWarningMessage(`Linter: ${error.message || error}`);
      }
    }

    diagnosticCollection.delete(document.uri);

    for (const [uriIndex, syntaxError] of syntaxErrors.entries()) {
      diagnosticCollection.delete(uris[uriIndex]);
      if (syntaxError) {
        const filePath = syntaxError.file
          ? path.join(
              workspaceFolder.uri.toString(),
              "src",
              "files",
              syntaxError.file,
            )
          : uris[uriIndex].toString();
        const range = new Range(
          syntaxError.line - 1,
          syntaxError.column - 1,
          syntaxError.line - 1,
          5000,
        );
        const diagnostic = new Diagnostic(
          range,
          syntaxError.message,
          DiagnosticSeverity.Error,
        );
        if (syntaxError.path) {
          let related: DiagnosticRelatedInformation[] = [];
          for (const [itemIndex, item] of syntaxError.path.entries()) {
            const uri = item.file
              ? Uri.file(path.join(filesPath, item.file))
              : uris[uriIndex];
            related.push({
              location: new Location(
                uri,
                new Position(item.line - 1, item.column - 1),
              ),
              message: item.file
                ? `Include chain (#${syntaxError.path.length - itemIndex - 1})`
                : "The hook entry point",
            });
          }
          diagnostic.relatedInformation = related;
          diagnosticCollection.delete(Uri.parse(filePath));
        }
        diagnosticCollection.set(Uri.parse(filePath), [diagnostic]);
      }
    }
  }
};
