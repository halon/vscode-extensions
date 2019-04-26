import { CompletionItemProvider, CancellationToken, TextDocument, Position, CompletionContext, CompletionItem, CompletionItemKind, SnippetString, MarkdownString, Range } from 'vscode';
import { matchVariable, parseVariable } from './variables';
import docs from './docs';

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
      const wordRange = document.getWordRangeAtPosition(position);
      if (wordRange !== undefined) {
        const text = document.getText(wordRange);
        if (text) {
          isMethod = document.getText(new Range(position.line, wordRange.start.character >= 2 ? wordRange.start.character -2 : 0, position.line, wordRange.start.character)) === '->';
        }
      }
      if (isMethod) {
        for (let item of classes) {
          if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
            for (let method of item.methods) {
              let completionItem = new CompletionItem(`(${item.name}) ${method.name}`, CompletionItemKind.Method);
              completionItem.detail = method.detail;
              completionItem.documentation = new MarkdownString(method.documentation);
              completionItem.insertText = new SnippetString(method.value);
              completionItems.push(completionItem);
            }
          }
        }
      } else {
        for (let item of classes) {
          if (typeof item.compat === 'undefined' && (typeof item.deprecated === 'undefined' || item.deprecated === false)) {
            if (item.name === 'MailMessage' || item.name === 'MIMEPart' || item.name === 'LDAPResult') continue;
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
                let completionItem = new CompletionItem(`(${item.name}) ${method.name}`, CompletionItemKind.Method);
                completionItem.detail = method.detail;
                completionItem.documentation = new MarkdownString(method.documentation);
                completionItem.insertText = new SnippetString(method.value);
                completionItems.push(completionItem);
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
      }
    }

    return completionItems;
  }
}
