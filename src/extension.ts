'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, languages, window, workspace, TextDocument, TextEditor, Uri, TextEditorSelectionChangeEvent, commands } from 'vscode';
import { debounce } from 'underscore';
import Links from './links';
import Completions from './completions';
import Hovers from './hovers';
import lint from './lint';
import { init, build } from '@halon/cli';
import livestage from './livestage';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext)
{
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	context.subscriptions.push(languages.registerDocumentLinkProvider('hsl', new Links()));
	context.subscriptions.push(languages.registerCompletionItemProvider('hsl', new Completions()));
	context.subscriptions.push(languages.registerHoverProvider('hsl', new Hovers()));

	context.subscriptions.push(languages.setLanguageConfiguration('hsl', {
		wordPattern: /(-?\d*\.\d\w*)|([^\-\`\~\!\@\#\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
	}));

	const diagnosticCollection = languages.createDiagnosticCollection('hsl');
	context.subscriptions.push(diagnosticCollection);
	const fileSystemWatcher = workspace.createFileSystemWatcher('**/*.hsl', true);
	context.subscriptions.push(fileSystemWatcher.onDidDelete((uri: Uri) => {
		if (typeof diagnosticCollection.get(uri) !== 'undefined') {
			diagnosticCollection.delete(uri);
		}
	}));

	context.subscriptions.push(workspace.onDidSaveTextDocument((document: TextDocument) => {
		if (document.languageId === 'hsl') {
			lint(document, diagnosticCollection);
		}
	}));

	context.subscriptions.push(window.onDidChangeTextEditorSelection(debounce((event: TextEditorSelectionChangeEvent) => {
		const editor = event.textEditor;
		const document = editor.document;
		if (document.languageId === 'hsl') {
			lint(document, diagnosticCollection);
		}
	}, 500)));

	context.subscriptions.push(window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
		if (editor) {
			const document = editor.document;
			if (document.languageId === 'hsl') {
				lint(document, diagnosticCollection);
			}
		}
	}));

	if (typeof window.activeTextEditor !== 'undefined') {
		if (window.activeTextEditor.document.languageId === 'hsl') {
			lint(window.activeTextEditor.document, diagnosticCollection);
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
			livestage(workspaceFolder.uri.fsPath, 'start');
		}
	}));

	context.subscriptions.push(commands.registerCommand('halon.livestageStatus', () => {
		if (typeof workspace.workspaceFolders !== 'undefined') {
			const workspaceFolder = workspace.workspaceFolders[0];
			livestage(workspaceFolder.uri.fsPath, 'status');
		}
	}));

	context.subscriptions.push(commands.registerCommand('halon.livestageCancel', () => {
		if (typeof workspace.workspaceFolders !== 'undefined') {
			const workspaceFolder = workspace.workspaceFolders[0];
			livestage(workspaceFolder.uri.fsPath, 'cancel');
		}
	}));
}

// this method is called when your extension is deactivated
export function deactivate() {}
