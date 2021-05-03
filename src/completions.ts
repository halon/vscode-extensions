import * as path from 'path';
import { workspace, CompletionItemProvider, CancellationToken, TextDocument, Position, CompletionContext, CompletionItem, CompletionItemKind, SnippetString, MarkdownString, Range } from 'vscode';
import { matchVariable, parseVariable } from './variables';
import docs from './docs';
import { readdirSyncRecursive } from './build';

export default class Completions implements CompletionItemProvider
{
  triggerCharacters: string[];

  constructor(...triggerCharacters: string[])
  {
    this.triggerCharacters = triggerCharacters;
  }

  public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): CompletionItem[] {
    let completionItems: CompletionItem[] = [];
  
    const { classes, functions, variables, keywords } = docs(document);

    if (!this.triggerCharacters.length) {
      let isMethod = false;
      let isStaticMethod = false;
      const wordRange = document.getWordRangeAtPosition(position);
      if (wordRange !== undefined) {
        const text = document.getText(wordRange);
        if (text) {
          let range = new Range(position.line, wordRange.start.character >= 2 ? wordRange.start.character -2 : 0, position.line, wordRange.start.character);
          isMethod = document.getText(range) === '->';
          isStaticMethod = document.getText(range) === '::';
        }
      }
      if (isMethod) {
        for (let item of classes) {
          if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
            for (let method of item.methods) {
              if (typeof method.static === 'undefined' || method.static === false) {
                let completionItem = new CompletionItem(`(${item.name}) ${method.name}`, CompletionItemKind.Method);
                completionItem.detail = method.detail;
                completionItem.documentation = new MarkdownString(method.documentation);
                completionItem.insertText = new SnippetString(method.value);
                completionItems.push(completionItem);
              }
            }
          }
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
                    if (typeof method.static !== 'undefined' && method.static === true) {
                      let completionItem = new CompletionItem(method.name, CompletionItemKind.Method);
                      completionItem.detail = method.detail;
                      completionItem.documentation = new MarkdownString(method.documentation);
                      completionItem.insertText = new SnippetString(method.value);
                      completionItems.push(completionItem);
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
            if (item.name === 'MailMessage' || item.name === 'EODMailMessage' || item.name === 'MIMEPart' || item.name === 'LDAPResult') continue;
            let completionItem = new CompletionItem(item.name, CompletionItemKind.Class);
            completionItem.detail = item.detail;
            completionItem.documentation = new MarkdownString(item.documentation);
            completionItem.insertText = new SnippetString(item.value);
            completionItems.push(completionItem);
          }
        }
    
        for (let item of functions) {
          if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
            let completionItem = new CompletionItem(item.name, CompletionItemKind.Function);
            completionItem.detail = item.detail;
            completionItem.documentation = new MarkdownString(item.documentation);
            completionItem.insertText = new SnippetString(item.value);
            completionItems.push(completionItem);
          }
        }
    
        for (let item of variables) {
          if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
            let completionItem = new CompletionItem(item.name, CompletionItemKind.Variable);
            completionItem.detail = item.detail;
            completionItem.documentation = new MarkdownString(item.example ? `${item.documentation} \n\n Example: \`${item.example}\`` : item.documentation);
            completionItems.push(completionItem);
          }
        }
    
        for (let item of keywords) {
          let completionItem = new CompletionItem(item.name, CompletionItemKind.Keyword);
          completionItem.detail = item.detail;
          completionItem.documentation = new MarkdownString(item.documentation);
          completionItem.insertText = new SnippetString(item.value || item.name);
          completionItems.push(completionItem);
          if (typeof item.snippets !== 'undefined') {
            for (let snippet of item.snippets) {
              let completionItem = new CompletionItem(item.name, CompletionItemKind.Snippet);
              completionItem.detail = snippet.detail;
              completionItem.documentation = new MarkdownString(snippet.documentation || item.documentation);
              completionItem.insertText = new SnippetString(snippet.insertText.join('\n'));
              completionItems.push(completionItem);
            }
          }
        }
      }
    }

    for (let triggerCharacter of this.triggerCharacters) {
      if (triggerCharacter === '>') {
        let isMethod = document.getText(new Range(position.line, position.character >= 2 ? position.character -2 : 0, position.line, position.character)) === '->';
        if (isMethod) {
          for (let item of classes) {
            if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
              for (let method of item.methods) {
                if (typeof method.static === 'undefined' || method.static === false) {
                  let completionItem = new CompletionItem(`(${item.name}) ${method.name}`, CompletionItemKind.Method);
                  completionItem.detail = method.detail;
                  completionItem.documentation = new MarkdownString(method.documentation);
                  completionItem.insertText = new SnippetString(method.value);
                  completionItems.push(completionItem);
                }
              }
            }
          }
        }
      } else if (triggerCharacter === ':') {
        let isMethod = document.getText(new Range(position.line, position.character >= 2 ? position.character -2 : 0, position.line, position.character)) === '::';
        if (isMethod) {
          const wordRange = document.getWordRangeAtPosition(new Position(position.line, position.character >= 3 ? position.character -3 : 0));
          if (wordRange !== undefined) {
            const className = document.getText(wordRange);
            if (className) {
              for (let item of classes) {
                if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false) && item.name === className) {
                  for (let method of item.methods) {
                    if (typeof method.static !== 'undefined' && method.static === true) {
                      let completionItem = new CompletionItem(method.name, CompletionItemKind.Method);
                      completionItem.detail = method.detail;
                      completionItem.documentation = new MarkdownString(method.documentation);
                      completionItem.insertText = new SnippetString(method.value);
                      completionItems.push(completionItem);
                    }
                  }
                }
              }
            }
          }
        }
      } else if (triggerCharacter === '[' || triggerCharacter === '"') {
        let variable = parseVariable(document, position, triggerCharacter === '[' ? false : true, []);
        if (variable) {
          let keys = matchVariable(variable, variables, true);
          if (keys) {
            for (let v of keys) {
              let value = v.documentation;
              if (v.example !== undefined)
                value = value + '\n\n' + 'Example: `' + v.example + '`';
              let completionItem = new CompletionItem(v.name, CompletionItemKind.Text);
              completionItem.detail = v.detail;
              completionItem.documentation = new MarkdownString(value);
              completionItem.insertText = new SnippetString((triggerCharacter === '[' ? '"' : '') + v.name + '"]');
              completionItem.range = new Range(position.line, position.character, position.line, position.character + (triggerCharacter === '[' ? 1 : 2));
              completionItems.push(completionItem);
            }
          }
        }
        if (triggerCharacter === '"') {
          const isImport = document.getText(new Range(position.line, position.character >= 7 ? position.character -7 : 0, position.line, position.character)) === ' from "';
          const isInclude = document.getText(new Range(position.line, position.character >= 9 ? position.character -9 : 0, position.line, position.character)) === 'include "';
          const isIncludeOnce = document.getText(new Range(position.line, position.character >= 14 ? position.character -14 : 0, position.line, position.character)) === 'include_once "';
          if (isImport || isInclude || isIncludeOnce) {
            const workspaceFolder = workspace.getWorkspaceFolder(document.uri);
            if (workspaceFolder !== undefined) {
              for (let i of readdirSyncRecursive(path.join(workspaceFolder.uri.fsPath, "src", "files"))) {
                const id = path.relative(path.join(workspaceFolder.uri.fsPath, "src", "files"), i).split(path.sep).join(path.posix.sep);
                const hidden = id.split(path.posix.sep).filter(i => i.charAt(0) === '.');
                if (hidden.length > 0)
                  continue;
                let completionItem = new CompletionItem(id, CompletionItemKind.File);
                completionItem.insertText = new SnippetString(id + '";');
                completionItem.range = new Range(position.line, position.character, position.line, position.character + 2);
                completionItems.push(completionItem);
              }
            }
          }
        }
      }
    }

    return completionItems;
  }
}
