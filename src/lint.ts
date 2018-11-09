import * as fs from 'fs';
import * as path from 'path';
import { window, workspace, Uri, DiagnosticCollection, Range, Diagnostic, DiagnosticSeverity, TextDocument } from 'vscode';
import { build, remote, factory } from '@halon/cli';

export default (document: TextDocument, diagnosticCollection: DiagnosticCollection) =>
{
	const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

	if (typeof workspaceFolder !== 'undefined') {
		const settingsPath = path.join(workspaceFolder.uri.fsPath, 'settings.json');
		if (fs.existsSync(settingsPath)) {
			const userSettings = JSON.parse(fs.readFileSync(settingsPath).toString());
			if (userSettings.ssh2) {
				let syntaxObject = build.syntax(document.uri.fsPath);
	
				const dirtyScripts = workspace.textDocuments.filter((document) => document.languageId === 'hsl' && document.isDirty);
				for (let dirtyScript of dirtyScripts) {
					if (dirtyScript.fileName === document.uri.fsPath) {
						syntaxObject.data = dirtyScript.getText();
					}
					const matchedIndex = syntaxObject.files.map((file: any) => {
						return path.join(workspaceFolder.uri.fsPath, 'src', 'files', file.id);
					}).indexOf(dirtyScript.uri.fsPath);
					if (matchedIndex !== -1) {
						syntaxObject.files[matchedIndex].data = dirtyScript.getText();
					}
				}

				const connector = factory.ConnectorFactory(userSettings);

				remote.syntax(connector, syntaxObject).then((syntaxError: any) => {
					diagnosticCollection.delete(document.uri);
					if (syntaxError) {
						const filePath = syntaxError.file ? path.join(workspaceFolder.uri.toString(), 'src', 'files', syntaxError.file) : document.uri.toString();
						if (typeof syntaxError.file !== 'undefined') { diagnosticCollection.delete(Uri.parse(filePath)); }
						let range = new Range(syntaxError.line - 1, syntaxError.column -1, syntaxError.line - 1, 5000);
						diagnosticCollection.set(Uri.parse(filePath), [new Diagnostic(range, syntaxError.message, DiagnosticSeverity.Error)]);
					}
					connector.dispose();
				}).catch((error) => {
					connector.dispose();
					diagnosticCollection.clear();
					window.showWarningMessage(`Linter: ${error.message || error}`);
				});
			}
		}
	}
}
