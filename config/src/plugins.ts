import * as fs from "fs";
import * as glob from "glob";
import mem from "mem";

const plugins = () => {
  const pluginsPath = "/opt/halon/share/plugins";
  let items: HSL.Collection = {
    functions: [],
    classes: [],
    variables: [],
    keywords: [],
  };
  try {
    for (const plugin of glob.sync(`${pluginsPath}/*.functions.json`)) {
      const functions = JSON.parse(fs.readFileSync(plugin).toString());
      if (Array.isArray(functions)) {
        items.functions = items.functions.concat(functions);
      }
    }
    for (const plugin of glob.sync(`${pluginsPath}/*.classes.json`)) {
      const classes = JSON.parse(fs.readFileSync(plugin).toString());
      if (Array.isArray(classes)) {
        items.classes = items.classes.concat(classes);
      }
    }
  } catch (error) {}
  return items;
};

const memoized = mem(plugins, { maxAge: 5000 });

export default memoized;
