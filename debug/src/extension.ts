import * as vscode from 'vscode';
import { HSLDebugSession } from './debug';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('hsl', {
    createDebugAdapterDescriptor: (_session) => {
      return new vscode.DebugAdapterInlineImplementation(new HSLDebugSession());
    }
  }));
  
  context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('hsl', new HSLConfigurationProvider()));
}

export function deactivate() {
}

class HSLConfigurationProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'hsl') {
        config.name = 'Debug File';
        config.type = 'hsl';
        config.request = 'launch';
        config.program = '${file}';
        config.debug = true;
      }
    }
    if (!config.folder && folder) {
      config.folder = folder.uri.fsPath;
    }
    if (config.type === 'hsl' && !config.program) {
      vscode.window.showInformationMessage('Cannot find a program to debug');
      return undefined;
    }
    return config;
  }
}
