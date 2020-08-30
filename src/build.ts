import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';
import * as validate from './validate';
import isUtf8 from 'is-utf8';

export const syntax = (file: string) =>
{
  var fileparse = path.parse(file);
  const filepath = fileparse.dir.split(path.sep);
  var result = {
    version: "5.4",
    phase: "",
    data: "",
    files: <any>[]
  };
  var filespath = "";
  if (filepath.length > 2 && filepath.slice(-2, -1)[0] == "hooks")
  {
    if (filepath.slice(-1)[0] == 'queue')
      result.phase = fileparse.name;
    else
      result.phase = filepath.slice(-1)[0];
    filespath = path.join(fileparse.root, ...filepath.slice(0, -2), 'files');
  }
  else if (filepath.length > 3 && filepath.slice(-3, -2)[0] == "hooks")
  {
    if (filepath.slice(-2)[0] == 'eod' && filepath.slice(-1)[0] == 'rcpt')
      result.phase = 'eodrcpt';
    else
      throw Error('Unknown hooks directory in path');
    filespath = path.join(fileparse.root, ...filepath.slice(0, -3), 'files');
  }
  else
  {
    var index = filepath.findIndex((element, index, array) => {
      if (element == "src" && array[index + 1] == "files")
        return true;
      return false;
    });
    if (index == -1)
      throw Error('Could not find a src/files directory in path');
    filespath = path.join(fileparse.root, ...filepath.slice(0, index + 2));
  }
  result.data = fs.readFileSync(file).toString();

  for (let i of readdirSyncRecursive(filespath))
  {
    if (file == i)
      continue;

    const buffer = fs.readFileSync(i);

    let item: any = { id: path.relative(filespath, i) };
    if (isUtf8(buffer)) {
      item.data = buffer.toString('utf8');
    } else {
      item.data = buffer.toString('base64');
      item.binary = true;
    }

    result.files.push(item);
  }

  return result;
}

export const syntaxAll = (base: string = '.') =>
{
  let syntaxes: any = [];
  let smtpdapp = path.join(base, "src", "config", "smtpd-app.yaml");
  if (!fs.existsSync(smtpdapp))
    throw new Error("Missing " + smtpdapp);
  const file = fs.readFileSync(smtpdapp, 'utf-8');
  if (!file)
    throw new Error("Cannot open " + smtpdapp);
  let config = yaml.parse(file);
  const hooks = extractHooks(config);

  var entries: any = Object.entries(hooks);
  for (let [type, value] of entries)
  {
    for (let id of value)
    {
      var hookfolder = [type];
      if (type == "eodrcpt")
        hookfolder = ["eod", "rcpt"];
      const filePath = path.join(base, "src", "hooks", ...hookfolder, id + ".hsl");
      syntaxes[filePath] = syntax(filePath);
    }
  }

  var filePath = path.join(base, "src", "hooks", "queue", "predelivery.hsl");
  if (fs.existsSync(filePath))
  {
    syntaxes[filePath] = syntax(filePath);
  }

  filePath = path.join(base, "src", "hooks", "queue", "postdelivery.hsl");
  if (fs.existsSync(filePath))
  {
    syntaxes[filePath] = syntax(filePath);
  }
  return syntaxes;
}

const readdirSyncRecursive = (dir: string) =>
{
  var results: string[] = [];
  var list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = dir + path.sep + file;
    var stat = fs.statSync(file);
    if (stat && stat.isDirectory())
      results = results.concat(readdirSyncRecursive(file));
    else
      results.push(file);
  });
  return results;
}

const addFile = (config: any, script: any) =>
{
  if (!config.scripting)
    config.scripting = {};
  if (!config.scripting.files)
    config.scripting.files = [];
  config.scripting.files.push(script);
}

const addHook = (config: any, type: any, script: any) =>
{
  if (!config.scripting)
    config.scripting = {};
  if (!config.scripting.hooks)
    config.scripting.hooks = {};
  if (!config.scripting.hooks[type])
    config.scripting.hooks[type] = [];
  config.scripting.hooks[type].push(script);
}

const extractHooks = (config: any) =>
{
  var hooks: any = {
    'connect': [],
    'disconnect': [],
    'proxy': [],
    'helo': [],
    'auth': [],
    'mailfrom': [],
    'rcptto': [],
    'eod': [],
    'eodrcpt': [],
  };
  if (config.servers) {
    for (let server of config.servers) {
      if (server.phases)
      {
        if (server.phases.connect && server.phases.connect.hook)
          hooks.connect.push(server.phases.connect.hook);
        if (server.phases.disconnect && server.phases.disconnect.hook)
          hooks.disconnect.push(server.phases.disconnect.hook);
        if (server.phases.proxy && server.phases.proxy.hook)
          hooks.proxy.push(server.phases.proxy.hook);
        if (server.phases.helo && server.phases.helo.hook)
          hooks.helo.push(server.phases.helo.hook);
        if (server.phases.auth && server.phases.auth.hook)
          hooks.auth.push(server.phases.auth.hook);
        if (server.phases.mailfrom && server.phases.mailfrom.hook)
          hooks.mailfrom.push(server.phases.mailfrom.hook);
        if (server.phases.rcptto && server.phases.rcptto.hook)
        {
          var hook = server.phases.rcptto.hook;
          if (typeof hook == "string")
            hooks.rcptto.push(hook);
          else
          {
            if (hook.id)
              hooks.rcptto.push(hook.id);
            if (hook.recipientdomains)
            {
              for (let i in hook.recipientdomains)
                hooks.rcptto.push(hook.recipientdomains[i]);
            }
          }
        }
        if (server.phases.eod && server.phases.eod.hook)
          hooks.eod.push(server.phases.eod.hook);
        if (server.phases.eod && server.phases.eod.rcpt && server.phases.eod.rcpt.hook)
        {
          var hook = server.phases.eod.rcpt.hook;
          if (typeof hook == "string")
            hooks.eodrcpt.push(hook);
          else
          {
            if (hook.id)
              hooks.eodrcpt.push(hook.id);
            if (hook.recipientdomains)
            {
              for (let i in hook.recipientdomains)
                hooks.eodrcpt.push(hook.recipientdomains[i]);
            }
          }
        }
      }
    }
  }
  Object.keys(hooks).forEach(x => {
    hooks[x] = [...new Set(hooks[x])];
  })
  return hooks;
}

export const run = (base: string = '.') =>
{
  if (!fs.existsSync(path.join(base, "dist")))
    fs.mkdirSync(path.join(base, "dist"));

  const config = generate(base);

  if (config.smtpd) fs.writeFileSync(path.join(base, "dist", "smtpd.yaml"), yaml.stringify(config.smtpd));
  if (config.smtpd_app) fs.writeFileSync(path.join(base, "dist", "smtpd-app.yaml"), yaml.stringify(config.smtpd_app));
  if (config.smtpd_policy) fs.writeFileSync(path.join(base, "dist", "smtpd-policy.yaml"), yaml.stringify(config.smtpd_policy));
  if (config.smtpd_suspend) fs.writeFileSync(path.join(base, "dist", "smtpd-suspend.yaml"), yaml.stringify(config.smtpd_suspend));
  if (config.smtpd_delivery) fs.writeFileSync(path.join(base, "dist", "smtpd-delivery.yaml"), yaml.stringify(config.smtpd_delivery));
  if (config.rated) fs.writeFileSync(path.join(base, "dist", "rated.yaml"), yaml.stringify(config.rated));
  if (config.rated_app) fs.writeFileSync(path.join(base, "dist", "rated-app.yaml"), yaml.stringify(config.rated_app));
  if (config.dlpd) fs.writeFileSync(path.join(base, "dist", "dlpd.yaml"), yaml.stringify(config.dlpd));
  if (config.dlpd_app) fs.writeFileSync(path.join(base, "dist", "dlpd-app.yaml"), yaml.stringify(config.dlpd_app));
}

export const generate = (base: string = '.') =>
{
  let returnValue: { smtpd?: any, smtpd_app?: any, smtpd_policy?: any, smtpd_suspend?: any, smtpd_delivery?: any, rated?: any, rated_app?: any, dlpd?: any, dlpd_app?: any } = {};
  const usersettings = JSON.parse(fs.readFileSync(path.join(base, "settings.json")).toString());

  if (fs.existsSync(path.join(base, "src", "config", "smtpd.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "smtpd.yaml"), 'utf-8');
    if (file) returnValue.smtpd = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "smtpd-app.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "smtpd-app.yaml"), 'utf-8');
    if (file) {
      let config = yaml.parse(file);
      const hooks = extractHooks(config);

      var entries: any = Object.entries(hooks);
      for (let [type, value] of entries)
      {
        for (let id of value)
        {
          var hookfolder = [type];
          if (type == "eodrcpt")
            hookfolder = ["eod", "rcpt"];
          addHook(config, type, {
            id: id,
            data: fs.readFileSync(path.join(base, "src", "hooks", ...hookfolder, id + ".hsl")).toString()
          });
        }
      }

      var filePath = path.join(base, "src", "hooks", "queue", "predelivery.hsl");
      if (fs.existsSync(filePath))
      {
        if (!config.scripting) config.scripting = {};
        if (!config.scripting.hooks) config.scripting.hooks = {};
        config.scripting.hooks.predelivery = fs.readFileSync(filePath).toString();
      }

      filePath = path.join(base, "src", "hooks", "queue", "postdelivery.hsl");
      if (fs.existsSync(filePath))
      {
        if (!config.scripting) config.scripting = {};
        if (!config.scripting.hooks) config.scripting.hooks = {};
        config.scripting.hooks.postdelivery = fs.readFileSync(filePath).toString();
      }

      for (let i of readdirSyncRecursive(path.join(base, "src", "files")))
      {
        var exclude: string[] = usersettings &&
          usersettings.smtpd &&
          usersettings.smtpd.build &&
          usersettings.smtpd.build.exclude ? usersettings.smtpd.build.exclude : [];
        if (exclude.indexOf(path.relative(path.join(base, "src", "files"), i)) != -1)
          continue;
        
        const buffer = fs.readFileSync(i);

        let item: any = { id: path.relative(path.join(base, "src", "files"), i) };
        if (isUtf8(buffer)) {
          item.data = buffer.toString('utf8');
        } else {
          item.data = buffer.toString('base64');
          item.binary = true;
        }

        addFile(config, item);
      }
      returnValue.smtpd_app = config;
    }
  }

  if (fs.existsSync(path.join(base, "src", "config", "smtpd-policy.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "smtpd-policy.yaml"), 'utf-8');
    if (file) returnValue.smtpd_policy = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "smtpd-suspend.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "smtpd-suspend.yaml"), 'utf-8');
    if (file) returnValue.smtpd_suspend = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "smtpd-delivery.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "smtpd-delivery.yaml"), 'utf-8');
    if (file) returnValue.smtpd_delivery = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "rated.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "rated.yaml"), 'utf-8');
    if (file) returnValue.rated = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "rated-app.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "rated-app.yaml"), 'utf-8');
    if (file) returnValue.rated_app = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "dlpd.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "dlpd.yaml"), 'utf-8');
    if (file) returnValue.dlpd = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "dlpd-app.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "dlpd-app.yaml"), 'utf-8');
    if (file) returnValue.dlpd_app = yaml.parse(file);
  }

  try {
    validate.validate(returnValue);
  } catch (err) {
    throw new Error(`${err.source}: ${JSON.stringify(err.errors)}`);
  }
  return returnValue;
}