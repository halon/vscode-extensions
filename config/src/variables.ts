import { TextDocument, Position, Range } from "vscode";

export let matchVariable = (
  variable: any,
  variables: any,
  returnKeys: any,
): any => {
  var result = null;
  for (let v of variables) {
    if (variable.name === v.name) {
      if (variable.keys.length === 0) {
        result = returnKeys ? v.keys : v;
      } else {
        var key = variable.keys.shift();
        result = matchVariable(
          {
            name: key,
            keys: variable.keys,
          },
          v.keys,
          returnKeys,
        );
      }
    }
  }
  return result;
};

export let parseVariable = (
  document: TextDocument,
  position: Position,
  quote = false,
  keys: any,
): any => {
  const steps = quote === true ? 2 : 1;
  const startBracket =
    document.getText(
      new Range(
        position.line,
        position.character >= steps ? position.character - steps : 0,
        position.line,
        position.character,
      ),
    ) === (quote === true ? '["' : "[");
  let endBracket: boolean | null = null;

  if (keys.length > 0) {
    const wordRange = document.getWordRangeAtPosition(position);
    if (wordRange !== undefined) {
      const text = document.getText(wordRange);
      if (text) {
        endBracket =
          document.getText(
            new Range(
              position.line,
              wordRange.end.character,
              position.line,
              wordRange.end.character + steps,
            ),
          ) === (quote === true ? '"]' : "]");
      }
    }
  } else {
    endBracket =
      document.getText(
        new Range(
          position.line,
          position.character,
          position.line,
          position.character + steps,
        ),
      ) === (quote === true ? '"]' : "]");
  }

  if (startBracket && endBracket) {
    let isBracket =
      document.getText(
        new Range(
          position.line,
          position.character >= steps + 2 ? position.character - steps - 2 : 0,
          position.line,
          position.character >= steps ? position.character - steps : 0,
        ),
      ) === '"]';
    let wordRange: Range | undefined;
    if (isBracket) {
      wordRange = document.getWordRangeAtPosition(
        new Position(
          position.line,
          position.character >= steps + 2 ? position.character - steps - 2 : 0,
        ),
      );
    } else {
      wordRange = document.getWordRangeAtPosition(
        new Position(
          position.line,
          position.character >= steps ? position.character - steps : 0,
        ),
      );
    }

    if (wordRange !== undefined) {
      let word = document.getText(wordRange);
      if (word.charAt(0) === "$") {
        return {
          name: word,
          keys: keys,
        };
      } else {
        if (word.length > 0) {
          keys.unshift(word);
          return parseVariable(
            document,
            new Position(position.line, wordRange.start.character),
            true,
            keys,
          );
        }
      }
    }
  }
};
