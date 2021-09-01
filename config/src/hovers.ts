import { HoverProvider, TextDocument, Position, CancellationToken, ProviderResult, Hover, MarkdownString, Range } from 'vscode';
import { matchVariable, parseVariable } from './variables';
import docs from './docs';

export default class Hovers implements HoverProvider
{
  public provideHover(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Hover> {
    const docsUrl = 'https://docs.halon.io/hsl/';
    const wordRange = document.getWordRangeAtPosition(position);
    const text = document.getText(wordRange);

    const { classes, functions, variables, keywords } = docs(document);

    if (wordRange) {
      let variable = parseVariable(document, new Position(position.line, wordRange.start.character), true, [text]);
      let isStaticMethod = document.getText(new Range(position.line, wordRange.start.character >= 2 ? wordRange.start.character -2 : 0, position.line, wordRange.start.character)) === '::';
      if (variable) {
        let key = matchVariable(variable, variables, false);
        if (key) {
          let contents = [
            new MarkdownString().appendCodeblock(key.detail, 'plaintext'),
            new MarkdownString(key.documentation),
          ];
          if (key.example) contents.push(new MarkdownString('Example: `' + key.example + '`'));
          return new Hover(contents);
        }
      } else if (isStaticMethod) {
        if (wordRange !== undefined) {
          let classNamePosition = new Position(position.line, wordRange.start.character >= 3 ? wordRange.start.character -3 : 0);
          let classNameRange = document.getWordRangeAtPosition(classNamePosition);
          if (classNameRange !== undefined) {
            let className = document.getText(classNameRange);
            if (className) {
              for (let item of classes) {
                if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false) && item.name === className) {
                  for (let method of item.methods) {
                    if (item.name === className && method.name === text) {
                      let contents = [
                        new MarkdownString().appendCodeblock(method.detail, 'plaintext'),
                        new MarkdownString(method.documentation),
                        new MarkdownString(method.link.replace('{{ docsurl }}', docsUrl))
                      ];
                      return new Hover(contents);
                    }
                  }
                }
              }
            }
          }
        }
      } else {
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
            if (item.name === 'globalview' || item.name === 'ScanRPD' || item.name === 'ScanSA' || item.name === 'ScanKAV' || item.name === 'ScanCLAM' || item.name === 'mail') continue;
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
              if (item.example) contents.push(new MarkdownString('Example: `' + item.example + '`'));
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
      }
    }
    return null;
  }
}
