import { DocumentLinkProvider, CancellationToken, DocumentLink, TextDocument, Range, Uri, workspace } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';

export default class Links implements DocumentLinkProvider
{
  public provideDocumentLinks(document: TextDocument, token: CancellationToken): DocumentLink[] {
    let links: DocumentLink[] = [];

    let workspacePath: string | null = null;
    let relativePath: string | null = null;
    let rootPath: string | null = null;
    let extrasPath: string | null = null;

    // Get workspace path
    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    if (typeof workspaceFolder !== 'undefined') {
      workspacePath = workspaceFolder.uri.fsPath;
    }

    // Get relative path
    if (path.dirname(document.uri.fsPath)) {
      relativePath = path.dirname(document.uri.fsPath);
    }

    // Get root path
    if (workspacePath) {
      let smtpdPath = path.join(workspacePath, 'src', 'config', 'smtpd.yaml');
      if (!fs.existsSync(smtpdPath)) {
        smtpdPath = path.join('/etc', 'halon', 'smtpd.yaml');
      }
      if (fs.existsSync(smtpdPath)) {
        try {
          const smtpd = yaml.parse(fs.readFileSync(smtpdPath).toString());
          if (smtpd.scripting !== undefined && smtpd.scripting.rootpath !== undefined) {
            rootPath = smtpd.scripting.rootpath;
          }
        } catch (err) {}
      }
    }

    // Get extras path
    if (fs.existsSync(path.join('/opt', 'halon', 'plugins', 'hsl'))) {
      extrasPath = path.join('/opt', 'halon', 'plugins', 'hsl');
    }

    const text  = document.getText();
    let pattern = /(.*?(?:from|include|include_once)\s+\"(?:.*!)?)((?:file|extras):\/\/)?((?:.\/)?(([^."]+)([\.\/][^."]+)*))\"/mg;
    let match: RegExpExecArray | null = null;
    while ((match = pattern.exec(text)) !== null && !match[3].includes('*')) {
      const pre = match[1];
      const type = match[2] ?? '';
      const link = match[3].split(path.posix.sep).join(path.sep);
      const extension = match[6];
      const offset = (match.index || 0) + pre.length;
      const start = document.positionAt(offset);
      const end = document.positionAt(offset + type.length + link.length);
      const range = new Range(start, end);
      const relative = link.substring(0, 2) === `.${path.sep}`;

      let uri: string | null = null;
      if (relative) {
        // Relative files
        if (relativePath) {
          uri = path.join(relativePath, link);
        }
      } else {
        if (type === 'file://') {
          // External files
          if (rootPath) {
            uri = path.join(rootPath, link);
          }
        } else if (type === 'extras://') {
          // Extras files
          if (extrasPath) {
            uri = path.join(extrasPath, link);
          }
        } else {
          // Workspace files
          if (workspacePath) {
            uri = path.join(workspacePath, 'src', 'files', link);
          }
        }
      }

      // Main files
      if (uri && !extension && fs.existsSync(path.join(uri, 'main.hsl'))) {
        uri = path.join(uri, 'main.hsl');
      }

      // Append link
      if (uri) {
        const target = Uri.file(uri);
        const documentLink = new DocumentLink(range, target);
        links.push(documentLink);
      }
    }

    return links;
  }
}
