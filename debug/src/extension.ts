import * as vscode from 'vscode';
import { HSLLoggingDebugSession } from './debug';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('halon.runEditorContents', (resource: vscode.Uri) => {
    let targetResource = resource;
    if (!targetResource && vscode.window.activeTextEditor) {
      targetResource = vscode.window.activeTextEditor.document.uri;
    }
    if (targetResource) {
      vscode.debug.startDebugging(undefined, {
        name: 'Run File',
        type: 'hsl',
        request: 'launch',
        program: targetResource.fsPath,
        debug: false
      });
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('halon.debugEditorContents', (resource: vscode.Uri) => {
    let targetResource = resource;
    if (!targetResource && vscode.window.activeTextEditor) {
      targetResource = vscode.window.activeTextEditor.document.uri;
    }
    if (targetResource) {
      vscode.debug.startDebugging(undefined, {
        name: 'Debug File',
        type: 'hsl',
        request: 'launch',
        program: targetResource.fsPath,
        debug: true
      });
    }
  }));
  
  context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('hsl', {
    createDebugAdapterDescriptor: (_session) => {
      return new vscode.DebugAdapterInlineImplementation(new HSLLoggingDebugSession());
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
		if (!config.program) {
			vscode.window.showInformationMessage('Cannot find a program to debug');
      return undefined;
		}
		return config;
	}
}
