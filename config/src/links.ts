import { DocumentLinkProvider, CancellationToken, DocumentLink, TextDocument, Range, Uri, workspace } from 'vscode';
import * as path from 'path';

export default class Links implements DocumentLinkProvider
{
  public provideDocumentLinks(document: TextDocument, token: CancellationToken): DocumentLink[] {
    let links: DocumentLink[] = [];

    const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    if (typeof workspaceFolder !== 'undefined') {
      const workspacePath = workspaceFolder.uri.fsPath;

      let patterns: RegExp[] = [];
      patterns.push(/(.*?(?:from)\s+\"(?:.*!)?)((([^."]+)([\.\/][^."]+)*))\"/mg);
      patterns.push(/(.*?(?:include|include_once)\s+\")((?:[^."]+)(?:[\.\/][^."]+)*)\"/mg);

      const text  = document.getText();

      for (let pattern of patterns) {
        let match: RegExpExecArray | null = null;
        while ((match = pattern.exec(text)) !== null) {
          const pre = match[1];
          const link = match[2];
          const offset = (match.index || 0) + pre.length;
          const start = document.positionAt(offset);
          const end = document.positionAt(offset + link.length);
          const range = new Range(start, end);
          const uri = path.join(workspacePath, 'src', 'files', link);
          const target = Uri.file(uri);
          const documentLink = new DocumentLink(range, target);
          links.push(documentLink);
        }
      }
    }

    return links;
  }
}
