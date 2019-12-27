import fs from 'fs';
import * as path from 'path';
import { WorkspaceFolder, Uri } from 'vscode';
import * as factory from './factory';

export default class Connectors
{
  connectors: {
    settingsPath: string,
    connector: factory.SSH2Connector | factory.UNIXConnector
  }[];

  constructor()
  {
    this.connectors = [];
  }

  getConnector(workspaceFolder: WorkspaceFolder) {
    if (typeof workspaceFolder !== 'undefined') {
      const settingsPath = path.join(workspaceFolder.uri.fsPath, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath).toString());
        if (settings.ssh2 && settings.ssh2.agent && settings.ssh2.agent[0] == '$')
          settings.ssh2.agent = process.env[settings.ssh2.agent.substr(1)];
        let connector = this.connectors.find(connector => {
          return connector.settingsPath === settingsPath;
        });
        if (connector) {
          return connector.connector;
        } else {
          connector = {
            settingsPath: settingsPath,
            connector: factory.ConnectorFactory(settings)
          };
          this.connectors.push(connector);
          return connector.connector;
        }
      }
    }
  }

  removeConnector(uri: Uri) {
    this.connectors = this.connectors.filter(connector => {
      if (connector.settingsPath === uri.fsPath) return false;
      return true;
    });
  }
}
