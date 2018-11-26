import * as fs from 'fs';
import * as path from 'path';
import { window, workspace, Uri, DiagnosticCollection, Range, Diagnostic, DiagnosticSeverity, TextDocument, RelativePattern, Location } from 'vscode';
import { build, remote, factory } from '@halon/cli';
import pathIsInside from 'path-is-inside';

export default async (document: TextDocument, diagnosticCollection: DiagnosticCollection) =>
{
	const workspaceFolder = workspace.getWorkspaceFolder(document.uri);

	if (typeof workspaceFolder !== 'undefined') {
		const settingsPath = path.join(workspaceFolder.uri.fsPath, 'settings.json');
		if (fs.existsSync(settingsPath)) {
			const userSettings = JSON.parse(fs.readFileSync(settingsPath).toString());
			if (userSettings.ssh2) {
				let uris: Uri[] = [];

				let hooksPath = path.join(workspaceFolder.uri.fsPath, 'src', 'hooks');
				let filesPath = path.join(workspaceFolder.uri.fsPath, 'src', 'files');

				if (pathIsInside(document.uri.fsPath, hooksPath)) {
					uris.push(document.uri);
				}

				if (pathIsInside(document.uri.fsPath, filesPath)) {
					let pattern = new RelativePattern(hooksPath, '**/*.{hsl}');
					let matches = await workspace.findFiles(pattern);
					uris = uris.concat(matches);
				}

				let promises: Promise<{}>[] = [];
				const connector = factory.ConnectorFactory(userSettings);
				for (let uri of uris) {
					let syntaxObject = build.syntax(uri.fsPath);
	
					const dirtyScripts = workspace.textDocuments.filter((document) => document.languageId === 'hsl' && document.isDirty);
					for (let dirtyScript of dirtyScripts) {
						if (dirtyScript.fileName === uri.fsPath) {
							syntaxObject.data = dirtyScript.getText();
						}
						const matchedIndex = syntaxObject.files.map((file: any) => {
							return path.join(workspaceFolder.uri.fsPath, 'src', 'files', file.id);
						}).indexOf(dirtyScript.uri.fsPath);
						if (matchedIndex !== -1) {
							syntaxObject.files[matchedIndex].data = dirtyScript.getText();
						}
					}

					promises.push(remote.syntax(connector, syntaxObject));
				}

				Promise.all(promises).then((syntaxErrors: any[]) => {
					connector.dispose();
					diagnosticCollection.delete(document.uri);

					for (let [index, syntaxError] of syntaxErrors.entries()) {
						diagnosticCollection.delete(uris[index]);
						if (syntaxError) {
							const filePath = syntaxError.file ? path.join(workspaceFolder.uri.toString(), 'src', 'files', syntaxError.file) : document.uri.toString();
							let range = new Range(syntaxError.line - 1, syntaxError.column - 1, syntaxError.line - 1, 5000);
							let diagnostic = new Diagnostic(range, syntaxError.message, DiagnosticSeverity.Error);
							if (typeof syntaxError.file !== 'undefined') {
								diagnostic.relatedInformation = [{
									location: new Location(uris[index], new Range(0, 0, 0, 0)),
									message: 'The hook where the file was included'
								}];
								diagnosticCollection.delete(Uri.parse(filePath));
							}
							diagnosticCollection.set(Uri.parse(filePath), [diagnostic]);
						}
					}
				}).catch(error => {
					connector.dispose();
					diagnosticCollection.clear();
					window.showWarningMessage(`Linter: ${error.message || error}`);
				});
			}
		}
	}
}
