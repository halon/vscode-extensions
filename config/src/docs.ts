import { TextDocument } from "vscode";
import * as path from "path";
import functions from "./docs/functions.json";
import classes from "./docs/classes.json";
import variables from "./docs/variables.json";
import keywords from "./docs/keywords.json";

export default (document: TextDocument) => {
  let items: HSL.Collection = {
    functions: functions.core,
    classes: classes.core,
    variables: variables.core,
    keywords: keywords,
  };

  const scheme = document.uri.scheme;

  if (scheme === "file") {
    const fileName = document.fileName;
    const basename = path.basename(fileName);
    const folder = path.dirname(fileName).split(path.sep).pop();

    if (typeof folder !== "undefined") {
      if (folder === "connect") {
        items.classes = items.classes.concat(classes.connect);
        items.functions = items.functions.concat(functions.connect);
        items.variables = items.variables.concat(variables.connect);
      }
      if (folder === "disconnect") {
        items.classes = items.classes.concat(classes.disconnect);
        items.functions = items.functions.concat(functions.disconnect);
        items.variables = items.variables.concat(variables.disconnect);
      }
      if (folder === "proxy") {
        items.classes = items.classes.concat(classes.proxy);
        items.functions = items.functions.concat(functions.proxy);
        items.variables = items.variables.concat(variables.proxy);
      }
      if (folder === "helo") {
        items.classes = items.classes.concat(classes.helo);
        items.functions = items.functions.concat(functions.helo);
        items.variables = items.variables.concat(variables.helo);
      }
      if (folder === "auth") {
        items.classes = items.classes.concat(classes.auth);
        items.functions = items.functions.concat(functions.auth);
        items.variables = items.variables.concat(variables.auth);
      }
      if (folder === "mailfrom") {
        items.classes = items.classes.concat(classes.mailfrom);
        items.functions = items.functions.concat(functions.mailfrom);
        items.variables = items.variables.concat(variables.mailfrom);
      }
      if (folder === "rcptto") {
        items.classes = items.classes.concat(classes.rcptto);
        items.functions = items.functions.concat(functions.rcptto);
        items.variables = items.variables.concat(variables.rcptto);
      }
      if (folder === "eod") {
        items.classes = items.classes.concat(classes.eod);
        items.functions = items.functions.concat(functions.eod);
        items.variables = items.variables.concat(variables.eod);
      }
      if (basename === "predelivery.hsl") {
        items.classes = items.classes.concat(classes.predelivery);
        items.functions = items.functions.concat(functions.predelivery);
        items.variables = items.variables.concat(variables.predelivery);
      }
      if (basename === "postdelivery.hsl") {
        items.classes = items.classes.concat(classes.postdelivery);
        items.functions = items.functions.concat(functions.postdelivery);
        items.variables = items.variables.concat(variables.postdelivery);
      }
    }
  }

  return items;
};
