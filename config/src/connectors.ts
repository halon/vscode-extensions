import fs from 'fs';
import * as path from 'path';
import { Uri } from 'vscode';
import * as factory from './factory';
import yaml from 'yaml';

export default class Connectors
{
  connectors: {
    type: string,
    settingsPath: string,
    connector: factory.SSH2Connector | factory.UNIXConnector
  }[];

  constructor()
  {
    this.connectors = [];
  }

  getConnector(workspaceFolderPath: string) {
    if (typeof workspaceFolderPath !== 'undefined') {
      const yamlSettingsPath = path.join(workspaceFolderPath, 'settings.yaml');
      const jsonSettingsPath = path.join(workspaceFolderPath, 'settings.json');

      let settings: any = null;
      let settingsPath: string | null = null;

      if (fs.existsSync(yamlSettingsPath)) {
        settings = yaml.parse(fs.readFileSync(yamlSettingsPath).toString());
        settingsPath = yamlSettingsPath;
      } else if (fs.existsSync(jsonSettingsPath)) {
        settings = JSON.parse(fs.readFileSync(jsonSettingsPath).toString());
        settingsPath = jsonSettingsPath;
      }

      if (settings && settingsPath) {
        if (settings.ssh2) {
          settings.ssh = settings.ssh2;
          delete settings.ssh2;
        }
        if (settings.ssh && settings.ssh.agent && settings.ssh.agent[0] == '$')
          settings.ssh.agent = process.env[settings.ssh.agent.substr(1)];
        let connector = this.connectors.find(connector => {
          return connector.settingsPath === settingsPath;
        });
        if (connector) {
          return connector;
        } else {
          connector = {
            type: settings.ssh ? 'ssh' : 'unix',
            settingsPath: settingsPath,
            connector: factory.ConnectorFactory(settings)
          };
          this.connectors.push(connector);
          return connector;
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
