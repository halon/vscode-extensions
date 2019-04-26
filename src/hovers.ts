import { HoverProvider, TextDocument, Position, CancellationToken, ProviderResult, Hover, MarkdownString } from 'vscode';
import docs from './docs';

export default class Hovers implements HoverProvider
{
  public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
    const docsUrl = 'https://docs.halon.io/hsl/';
    const wordRange = document.getWordRangeAtPosition(position);
    const text = document.getText(wordRange);

    const { classes, functions, variables, keywords } = docs(document);

    for (let item of classes) {
      if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
        if (item.name === text) {
          let contents = [
            new MarkdownString().appendCodeblock(item.detail, 'plaintext'),
            new MarkdownString(item.documentation),
            new MarkdownString(item.link.replace('{{ docsurl }}', docsUrl))
          ];
          return new Hover(contents);
        }
      }
    }

    for (let item of functions) {
      if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
        if (item.name === text) {
          let contents = [
            new MarkdownString().appendCodeblock(item.detail, 'plaintext'),
            new MarkdownString(item.documentation),
            new MarkdownString(item.link.replace('{{ docsurl }}', docsUrl))
          ];
          return new Hover(contents);
        }
      }
    }

    for (let item of variables) {
      if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
        if (item.name === text) {
          let contents = [
            new MarkdownString().appendCodeblock(item.detail, 'plaintext'),
            new MarkdownString(item.documentation),
          ];
          if (item.example) contents.push(new MarkdownString('Example: `' + item.example + '`'))
          return new Hover(contents);
        }
      }
    }

    for (let item of keywords) {
      if (item.name === text) {
        let contents = [
          new MarkdownString().appendCodeblock(item.detail, 'plaintext'),
          new MarkdownString(item.documentation),
          new MarkdownString(item.link.replace('{{ docsurl }}', docsUrl))
        ];
        return new Hover(contents);
      }
    }

    return null;
  }
}
