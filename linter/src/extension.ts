import * as vscode from 'vscode';
import { window, workspace, languages, TextEditor, TextDocument, TextEditorSelectionChangeEvent, Uri } from 'vscode';
import { debounce } from 'underscore';
import * as factory from './factory';
import lint from './lint';

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = languages.createDiagnosticCollection('hsl');
  context.subscriptions.push(diagnosticCollection);

  const hslFileSystemWatcher = workspace.createFileSystemWatcher('**/*.hsl', true);
  context.subscriptions.push(hslFileSystemWatcher.onDidDelete((uri: Uri) => {
    if (typeof diagnosticCollection.get(uri) !== 'undefined') {
      diagnosticCollection.delete(uri);
    }
  }));

  context.subscriptions.push(workspace.onDidSaveTextDocument((document: TextDocument) => {
    if (document.languageId === 'hsl') {
      const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = factory.ConnectorFactory();
        lint(connector, document, diagnosticCollection);
      }
    }
  }));

  context.subscriptions.push(window.onDidChangeTextEditorSelection(debounce((event: TextEditorSelectionChangeEvent) => {
    const editor = event.textEditor;
    const document = editor.document;
    if (document.languageId === 'hsl') {
      const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = factory.ConnectorFactory();
        lint(connector, document, diagnosticCollection);
      }
    }
  }, 500)));

  context.subscriptions.push(window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
    if (editor) {
      const document = editor.document;
      if (document.languageId === 'hsl') {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (typeof workspaceFolder !== 'undefined') {
          const connector = factory.ConnectorFactory();
          lint(connector, document, diagnosticCollection);
        }
      }
    }
  }));

  if (typeof window.activeTextEditor !== 'undefined') {
    if (window.activeTextEditor.document.languageId === 'hsl') {
      const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = factory.ConnectorFactory();
        lint(connector, window.activeTextEditor.document, diagnosticCollection);
      }
    }
  }
}

export function deactivate() {
}
