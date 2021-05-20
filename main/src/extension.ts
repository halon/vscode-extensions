'use strict';

import { ExtensionContext, languages, window, workspace, TextDocument, TextEditor, Uri, TextEditorSelectionChangeEvent, commands } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
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
        const connector = connectors.getConnector(workspaceFolder.uri.fsPath);
        if (typeof connector !== 'undefined' && connector.type === 'ssh') lint(connector.connector, document, diagnosticCollection);
      }
    }
  }));

  context.subscriptions.push(window.onDidChangeTextEditorSelection(debounce((event: TextEditorSelectionChangeEvent) => {
    const editor = event.textEditor;
    const document = editor.document;
    if (document.languageId === 'hsl') {
      const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = connectors.getConnector(workspaceFolder.uri.fsPath);
        if (typeof connector !== 'undefined' && connector.type === 'ssh') lint(connector.connector, document, diagnosticCollection);
      }
    }
  }, 500)));

  context.subscriptions.push(window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
    if (editor) {
      const document = editor.document;
      if (document.languageId === 'hsl') {
        const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
        if (typeof workspaceFolder !== 'undefined') {
          const connector = connectors.getConnector(workspaceFolder.uri.fsPath);
          if (typeof connector !== 'undefined' && connector.type === 'ssh') lint(connector.connector, document, diagnosticCollection);
        }
      }
    }
  }));

  if (typeof window.activeTextEditor !== 'undefined') {
    if (window.activeTextEditor.document.languageId === 'hsl') {
      const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = connectors.getConnector(workspaceFolder.uri.fsPath);
        if (typeof connector !== 'undefined' && connector.type === 'ssh') lint(connector.connector, window.activeTextEditor.document, diagnosticCollection);
      }
    }
  }

  context.subscriptions.push(commands.registerCommand('halon.init', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      window.showQuickPick(workspace.workspaceFolders.map((workspaceFolder) => workspaceFolder.uri.fsPath), {
        title: 'Select workspace folder'
      }).then((workspaceFolderPath) => {
        if (typeof workspaceFolderPath !== 'undefined') {
          window.showQuickPick([{
            label: 'none',
            description: 'No remote development',
            detail: 'This template does not include configuration for remote development'
          }, {
            label: 'container',
            description: 'Remote development using a Docker container',
            detail: 'This template includes configuration for remote development using a Docker container'
          }, {
            label: 'ssh',
            description: 'Remote development using a SSH connection',
            detail: 'This template includes configuration for remote development using a SSH connection'
          }], {
            title: 'Choose configuration template'
          }).then((type) => {
            try {
              init.run(workspaceFolderPath, type?.label);
              window.showInformationMessage('Init: Completed');
            } catch (error) {
              window.showErrorMessage(`Init: ${error.message || error}`);
            }
          });
        }
      });
    } else {
      window.showErrorMessage(`Init: You need to have a workspace folder open to run this command`);
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.build', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      window.showQuickPick(workspace.workspaceFolders.map((workspaceFolder) => workspaceFolder.uri.fsPath), {
        title: 'Select workspace folder'
      }).then((workspaceFolderPath) => {
        if (typeof workspaceFolderPath !== 'undefined') {
          try {
            build.run(workspaceFolderPath);
            window.showInformationMessage('Build: Completed');
          } catch (error) {
            window.showErrorMessage(`Build: ${error.message || error}`);
          }
        }
      });
    } else {
      window.showErrorMessage(`Build: You need to have a workspace folder open to run this command`);
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.livestageStart', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      window.showQuickPick(workspace.workspaceFolders.map((workspaceFolder) => workspaceFolder.uri.fsPath), {
        title: 'Select workspace folder'
      }).then((workspaceFolderPath) => {
        if (typeof workspaceFolderPath !== 'undefined') {
          try {
            const connector = connectors.getConnector(workspaceFolderPath);
            if (typeof connector !== 'undefined') livestage(connector.connector, workspaceFolderPath, 'start');
          } catch (error) {
            window.showErrorMessage(`Live Staging: ${error.message || error}`);
          }
        }
      });
    } else {
      window.showErrorMessage(`Live Staging: You need to have a workspace folder open to run this command`);
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.livestageStatus', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      window.showQuickPick(workspace.workspaceFolders.map((workspaceFolder) => workspaceFolder.uri.fsPath), {
        title: 'Select workspace folder'
      }).then((workspaceFolderPath) => {
        if (typeof workspaceFolderPath !== 'undefined') {
          try {
            const connector = connectors.getConnector(workspaceFolderPath);
            if (typeof connector !== 'undefined') livestage(connector.connector, workspaceFolderPath, 'status');
          } catch (error) {
            window.showErrorMessage(`Live Staging: ${error.message || error}`);
          }
        }
      });
    } else {
      window.showErrorMessage(`Live Staging: You need to have a workspace folder open to run this command`);
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.livestageCancel', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      window.showQuickPick(workspace.workspaceFolders.map((workspaceFolder) => workspaceFolder.uri.fsPath), {
        title: 'Select workspace folder'
      }).then((workspaceFolderPath) => {
        if (typeof workspaceFolderPath !== 'undefined') {
          try {
            const connector = connectors.getConnector(workspaceFolderPath);
            if (typeof connector !== 'undefined') livestage(connector.connector, workspaceFolderPath, 'cancel');
          } catch (error) {
            window.showErrorMessage(`Live Staging: ${error.message || error}`);
          }
        }
      });
    } else {
      window.showErrorMessage(`Live Staging: You need to have a workspace folder open to run this command`);
    }
  }));

  context.subscriptions.push(commands.registerCommand('halon.runScript', () => {
    if (typeof window.activeTextEditor !== 'undefined') {
      const workspaceFolder = workspace.getWorkspaceFolder(window.activeTextEditor.document.uri);
      if (typeof workspaceFolder !== 'undefined') {
        const connector = connectors.getConnector(workspaceFolder.uri.fsPath);
        if (typeof connector !== 'undefined') run(connector.connector, window.activeTextEditor.document, workspaceFolder.uri.fsPath);
      } else {
        window.showErrorMessage(`Run Script: You need to have a workspace folder open to run this command`);
      }
    }
  }));
}

export function deactivate() {}
