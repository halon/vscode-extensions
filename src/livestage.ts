import * as fs from 'fs';
import * as path from 'path';
import { window } from 'vscode';
import { build, remote, factory } from '@halon/cli';

export default (workspacePath: string, command: string) =>
{
	const userSettings = JSON.parse(fs.readFileSync(path.join(workspacePath, "settings.json")).toString());

	if (userSettings.ssh2) {
		if (command === 'start') {
			build.run(workspacePath);
			const smtpdConfig = fs.readFileSync(path.join(workspacePath, "dist", "smtpd-app.yaml")).toString();
			const queuedConfig = fs.readFileSync(path.join(workspacePath, "dist", "queued-app.yaml")).toString();
			const conditions = userSettings.livestage && userSettings.livestage.conditions ? userSettings.livestage.conditions : {};
			const id = userSettings.livestage && userSettings.livestage.id ? userSettings.livestage.id : "abcd";

			const connector = factory.ConnectorFactory(userSettings);

			remote.startLiveStage(connector, id, conditions, smtpdConfig, queuedConfig).then(() => {
				window.showInformationMessage('Live Staging: Started');
				connector.dispose();
			}).catch((error) => {
				connector.dispose();
				window.showWarningMessage(`Live Staging: ${error.message || error}`);
			});
		}
		else if (command === 'status') {
			const connector = factory.ConnectorFactory(userSettings);

			remote.statusLiveStage(connector).then((status) => {
				connector.dispose();
				if (!status) {
					window.showInformationMessage('Live Staging: Not Running');
				} else {
					window.showInformationMessage('Live Staging: ' + JSON.stringify(status));
				}
			}).catch((error) => {
				connector.dispose();
				window.showWarningMessage(`Live Staging: ${error.message || error}`);
			});
		}
		else if (command === 'cancel') {
			const connector = factory.ConnectorFactory(userSettings);

			remote.cancelLiveStage(connector).then(() => {
				connector.dispose();
				window.showInformationMessage('Live Staging: Cancelled');
			}).catch((error) => {
				connector.dispose();
				window.showWarningMessage(`Live Staging: ${error.message || error}`);
			});
		}
	}
}
