'use strict';

import { ExtensionContext, languages, window, workspace, TextDocument, TextEditor, Uri, TextEditorSelectionChangeEvent, commands } from 'vscode';
import { debounce } from 'underscore';
import Links from './links';
import Completions from './completions';
import Hovers from './hovers';
import lint from './lint';
import * as init from './init';
import * as build from './build';
import run from './run';
import livestage from './livestage';
import Connectors from './connectors';

export function activate(context: ExtensionContext)
{
  const connectors = new Connectors();

  const settingsFileSystemWatcher = workspace.createFileSystemWatcher('**/settings.{yaml,json}', true);
  context.subscriptions.push(settingsFileSystemWatcher.onDidChange((uri: Uri) => {
    connectors.removeConnector(uri);
  }));

  context.subscriptions.push(languages.registerDocumentLinkProvider('hsl', new Links()));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions()));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions('>'), '>'));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions(':'), ':'));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions('['), '['));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions('"'), '"'));
  context.subscriptions.push(languages.registerHoverProvider('hsl', new Hovers()));

  context.subscriptions.push(languages.setLanguageConfiguration('hsl', {
    wordPattern: /(-?\d*\.\d\w*)|([^\-\`\~\!\@\#\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
  }));

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
        const connector = connectors.getConnector(workspaceFolder);
        if (typeof connector !== 'undefined') lint(connector, document, diagnosticCollection);
      }
    }
  }));

  context.subscriptions.push(window.onDidChangeTextEditorSelection(debounce((event: TextEditorSelectionChangeEvent) => {
    const editor = event.textEditor;
    const document = editor.document;
    if (document.languageId === 'hsl') {
      const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = connectors.getConnector(workspaceFolder);
        if (typeof connector !== 'undefined') lint(connector, document, diagnosticCollection);
      }
    }
  }, 500)));

  context.subscriptions.push(window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
    if (editor) {
      const document = editor.document;
      if (document.languageId === 'hsl') {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (typeof workspaceFolder !== 'undefined') {
          const connector = connectors.getConnector(workspaceFolder);
          if (typeof connector !== 'undefined') lint(connector, document, diagnosticCollection);
        }
      }
    }
  }));

  if (typeof window.activeTextEditor !== 'undefined') {
    if (window.activeTextEditor.document.languageId === 'hsl') {
      const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = connectors.getConnector(workspaceFolder);
        if (typeof connector !== 'undefined') lint(connector, window.activeTextEditor.document, diagnosticCollection);
      }
    }
  }

  context.subscriptions.push(commands.registerCommand('halon.init', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      const workspaceFolder = workspace.workspaceFolders[0];
      try {
        init.run(workspaceFolder.uri.fsPath);
        window.showInformationMessage('Init: Completed!');
      } catch (error) {
        window.showErrorMessage(`Init: ${error.message || error}`);
      }
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.initForce', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      const workspaceFolder = workspace.workspaceFolders[0];
      try {
        init.run(workspaceFolder.uri.fsPath, true);
        window.showInformationMessage('Init: Completed');
      } catch (error) {
        window.showErrorMessage(`Init: ${error.message || error}`);
      }
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.build', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      const workspaceFolder = workspace.workspaceFolders[0];
      try {
        build.run(workspaceFolder.uri.fsPath);
        window.showInformationMessage('Build: Completed');
      } catch (error) {
        window.showErrorMessage(`Build: ${error.message || error}`);
      }
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.livestageStart', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      const workspaceFolder = workspace.workspaceFolders[0];
      const connector = connectors.getConnector(workspaceFolder);
      if (typeof connector !== 'undefined') livestage(connector, workspaceFolder.uri.fsPath, 'start');
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.livestageStatus', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      const workspaceFolder = workspace.workspaceFolders[0];
      const connector = connectors.getConnector(workspaceFolder);
      if (typeof connector !== 'undefined') livestage(connector, workspaceFolder.uri.fsPath, 'status');
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.livestageCancel', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      const workspaceFolder = workspace.workspaceFolders[0];
      const connector = connectors.getConnector(workspaceFolder);
      if (typeof connector !== 'undefined') livestage(connector, workspaceFolder.uri.fsPath, 'cancel');
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.runScript', () => {
    if (typeof window.activeTextEditor !== 'undefined') {
      const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = connectors.getConnector(workspaceFolder);
        if (typeof connector !== 'undefined') run(connector, window.activeTextEditor.document, workspaceFolder.uri.fsPath);
      }
    }
  }));
}

export function deactivate() {}
