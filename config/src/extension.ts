import { ExtensionContext, languages, window, workspace, commands } from 'vscode';
import Links from './links';
import Completions from './completions';
import Hovers from './hovers';
import * as init from './init';
import * as build from './build';

export function activate(context: ExtensionContext)
{
  context.subscriptions.push(languages.registerDocumentLinkProvider('hsl', new Links()));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions()));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions('>'), '>'));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions(':'), ':'));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions('['), '['));
  context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions('"'), '"'));
  context.subscriptions.push(languages.registerHoverProvider('hsl', new Hovers()));

  context.subscriptions.push(commands.registerCommand('halon.init', () => {
    if (typeof workspace.workspaceFolders !== 'undefined') {
      window.showQuickPick(workspace.workspaceFolders.map((workspaceFolder) => workspaceFolder.uri.fsPath), {
        title: 'Select workspace folder'
      }).then((workspaceFolderPath) => {
        if (workspaceFolderPath !== undefined) {
          window.showQuickPick([{
            label: 'minimal',
            description: 'Minimal configuration',
            detail: 'Includes only a minimal amount of configuration'
          }], {
            title: 'Choose configuration template'
          }).then((template) => {
            if (template !== undefined) {
              window.showQuickPick([{
                label: 'none',
                description: 'No remote development',
                detail: 'Does not include any configuration for remote development'
              }, {
                label: 'container',
                description: 'Remote development using a Docker container',
                detail: 'Includes configuration for remote development using a Docker container'
              }, {
                label: 'ssh',
                description: 'Remote development using a SSH connection',
                detail: 'Includes configuration for remote development using a SSH connection'
              }], {
                title: 'Setup remote development'
              }).then((development) => {
                if (development !== undefined) {
                  try {
                    init.run(workspaceFolderPath, template?.label, development?.label);
                    window.showInformationMessage('Init command was run successfully');
                  } catch (error) {
                    window.showErrorMessage(error.message || error);
                  }
                }
              });
            }
          });
        }
      });
    } else {
      window.showErrorMessage('You need to have a workspace folder open to run this command');
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
            window.showInformationMessage('Build command was run successfully');
          } catch (error) {
            window.showErrorMessage(error.message || error);
          }
        }
      });
    } else {
      window.showErrorMessage('You need to have a workspace folder open to run this command');
    }
  }));

  return {
    build: build
  };
}

export function deactivate() {}
