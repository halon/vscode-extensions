import * as path from 'path';
import { TextDocument, window, EventEmitter, Pseudoterminal } from 'vscode';
import pathIsInside from 'path-is-inside';
import * as factory from './factory';
import * as build from './build';
import * as remote from './remote';

export default (connector: factory.SSH2Connector | factory.UNIXConnector, document: TextDocument, workspacePath: string) =>
{
  const filesPath = path.join(workspacePath, 'src', 'files');

  if (!pathIsInside(document.uri.fsPath, filesPath)) {
    window.showErrorMessage(`Run Script: Only files inside the "files" directory can be run`);
    return;
  }

  const id = path.relative(path.join(workspacePath, "src", "files"), document.uri.fsPath);
  let config: any = {};
  try {
    config = build.generate(workspacePath);
    if (typeof config.smtpd_app === 'undefined')
      throw new Error('You need an smtpd-app.yaml file to run a script');
    if (document.isDirty) {
      config.smtpd_app.scripting.files = config.smtpd_app.scripting.files.map((file: any) => {
        return file.id === id ? {
          ...file,
          data: document.getText()
        } : file;
      });
    }
    config.smtpd_app.__entrypoint = 'include "' + id + '";';
  } catch (error) {
    window.showErrorMessage(`Run Script: ${error.message || error}`);
    return;
  }

  const writeEmitter = new EventEmitter<string>();
  const closeEmitter = new EventEmitter<number | void>();
  const pty: Pseudoterminal = {
    onDidWrite: writeEmitter.event,
    onDidClose: closeEmitter.event,
    open: () => {
      writeEmitter.fire(`\x1b[36mRunning script file ${id}...\x1b[0m\r\n`);
      remote.run(connector, config.smtpd_app, (data: string) => {
        writeEmitter.fire(data.replace(/\n/g, '\r\n'));
      }).then((code) => {
        if (code === 0) {
          writeEmitter.fire('\x1b[32mFinished successfully, press any key to close terminal\x1b[0m');
        } else {
          writeEmitter.fire('\x1b[31mFinished unsuccessfully, press any key to close terminal\x1b[0m');
        }
      }).catch((error) => {
        window.showErrorMessage(`Run Script: ${error.message || error}`);
        closeEmitter.fire();
      });
    },
    close: () => {},
    handleInput: (data) => {
      closeEmitter.fire();
    }
  };
  
  const terminal = window.createTerminal({ name: 'Run Script', pty });
  terminal.show();
}
