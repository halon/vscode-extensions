import { DocumentLinkProvider, CancellationToken, DocumentLink, TextDocument, Range, Uri, workspace } from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';

export default class Links implements DocumentLinkProvider
{
  public provideDocumentLinks(document: TextDocument, token: CancellationToken): DocumentLink[] {
    let links: DocumentLink[] = [];

    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    if (typeof workspaceFolder !== 'undefined') {
      const workspacePath = workspaceFolder.uri.fsPath;

      let rootPath: string | null = null;
      let smtpdPath = path.join(workspacePath, 'src', 'config', 'smtpd.yaml');
      if (!fs.existsSync(smtpdPath)) {
        smtpdPath = path.join('etc', 'halon', 'smtpd.yaml');
      }
      if (fs.existsSync(smtpdPath)) {
        try {
          const smtpd = yaml.parse(fs.readFileSync(smtpdPath).toString());
          if (smtpd.scripting !== undefined && smtpd.scripting.rootpath !== undefined) {
            rootPath = smtpd.scripting.rootpath;
          }
        } catch (err) {}
      }

      let patterns: RegExp[] = [];
      patterns.push(/(.*?(?:from)\s+\"(?:.*!)?)(file:\/\/)?((([^."]+)([\.\/][^."]+)*))\"/mg);
      patterns.push(/(.*?(?:include|include_once)\s+\")(file:\/\/)?((?:[^."]+)(?:[\.\/][^."]+)*)\"/mg);

      const text  = document.getText();

      for (let pattern of patterns) {
        let match: RegExpExecArray | null = null;
        while ((match = pattern.exec(text)) !== null && !match[3].includes('*')) {
          const pre = match[1];
          const type = match[2] ?? '';
          const link = match[3].split(path.posix.sep).join(path.sep);
          const offset = (match.index || 0) + pre.length;
          const start = document.positionAt(offset);
          const end = document.positionAt(offset + type.length + link.length);
          const range = new Range(start, end);
          let uri: string | null = null;
          if (type === 'file://') {
            if (rootPath !== null) {
              uri = path.join(rootPath, link);
            }
          } else {
            uri = path.join(workspacePath, 'src', 'files', link);
          }
          if (uri) {
            const target = Uri.file(uri);
            const documentLink = new DocumentLink(range, target);
            links.push(documentLink);
          }
        }
      }
    }

    return links;
  }
}
