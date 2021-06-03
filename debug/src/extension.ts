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
}

export function deactivate() {
}
