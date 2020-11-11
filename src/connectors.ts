import fs from 'fs';
import * as path from 'path';
import { WorkspaceFolder, Uri } from 'vscode';
import * as factory from './factory';
import yaml from 'yaml';

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
      const yamlSettingsPath = path.join(workspaceFolder.uri.fsPath, 'settings.yaml');
      const jsonSettingsPath = path.join(workspaceFolder.uri.fsPath, 'settings.json');

      let settings = null;
      let settingsPath: string | null = null;

      if (fs.existsSync(yamlSettingsPath)) {
        settings = yaml.parse(fs.readFileSync(yamlSettingsPath).toString());
        settingsPath = yamlSettingsPath;
      } else if (fs.existsSync(jsonSettingsPath)) {
        settings = JSON.parse(fs.readFileSync(jsonSettingsPath).toString());
        settingsPath = jsonSettingsPath;
      }

      if (settings && settingsPath) {
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
