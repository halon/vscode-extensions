import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';
import * as validate from './validate';
import isUtf8 from 'is-utf8';
import { workspace, Uri } from 'vscode';
import minimatch from 'minimatch';

export const readdirSyncRecursive = (dir: string) =>
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
};

const addFile = (config: any, script: any) =>
{
  if (!config.scripting)
    config.scripting = {};
  if (!config.scripting.files)
    config.scripting.files = [];
  if (config.scripting.files.find(file => file.id === script.id)) {
    config.scripting.files = config.scripting.files.map(file => file.id === script.id ? script : file);
  } else {
    config.scripting.files.push(script);
  }
};

const addHook = (config: any, type: any, script: any) =>
{
  if (!config.scripting)
    config.scripting = {};
  if (!config.scripting.hooks)
    config.scripting.hooks = {};
  if (!config.scripting.hooks[type])
    config.scripting.hooks[type] = [];
  config.scripting.hooks[type].push(script);
};

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
          if (typeof hook === "string")
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
  });
  return hooks;
};

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
  if (config.halonctl) fs.writeFileSync(path.join(base, "dist", "halonctl.yaml"), yaml.stringify(config.halonctl));
  if (config.rated) fs.writeFileSync(path.join(base, "dist", "rated.yaml"), yaml.stringify(config.rated));
  if (config.rated_app) fs.writeFileSync(path.join(base, "dist", "rated-app.yaml"), yaml.stringify(config.rated_app));
  if (config.ratectl) fs.writeFileSync(path.join(base, "dist", "ratectl.yaml"), yaml.stringify(config.ratectl));
  if (config.dlpd) fs.writeFileSync(path.join(base, "dist", "dlpd.yaml"), yaml.stringify(config.dlpd));
  if (config.dlpd_app) fs.writeFileSync(path.join(base, "dist", "dlpd-app.yaml"), yaml.stringify(config.dlpd_app));
  if (config.dlpctl) fs.writeFileSync(path.join(base, "dist", "dlpctl.yaml"), yaml.stringify(config.dlpctl));
  if (config.api) fs.writeFileSync(path.join(base, "dist", "api.yaml"), yaml.stringify(config.api));
  if (config.web) fs.writeFileSync(path.join(base, "dist", "web.yaml"), yaml.stringify(config.web));
};

export const generate = (base: string = '.') =>
{
  let returnValue: { smtpd?: any, smtpd_app?: any, smtpd_policy?: any, smtpd_suspend?: any, smtpd_delivery?: any, halonctl?: any, rated?: any, rated_app?: any, ratectl?: any, dlpd?: any, dlpd_app?: any, dlpctl?: any, api?: any, web?: any } = {};

  let exclude: [string, string][] = [];
  const config = workspace.getConfiguration('halon.build', Uri.file(base));
  const value = config.get('exclude');
  if (Array.isArray(value) && value.length > 0) {
    for (const pattern of value) {
      exclude.push([path.posix.sep, pattern]);
    }
  } else {
    // Backwards compatibility
    const yamlSettingsPath = path.join(base, "settings.yaml");
    const jsonSettingsPath = path.join(base, "settings.json");
    let settings: any = null;
    if (fs.existsSync(yamlSettingsPath)) {
      settings = yaml.parse(fs.readFileSync(yamlSettingsPath).toString());
    } else if (fs.existsSync(jsonSettingsPath)) {
      settings = JSON.parse(fs.readFileSync(jsonSettingsPath).toString());
    }
    exclude = settings &&
    settings.smtpd &&
    settings.smtpd.build &&
    settings.smtpd.build.exclude &&
    Array.isArray(settings.smtpd.build.exclude) ? settings.smtpd.build.exclude.map(pattern => [path.posix.sep, pattern]) : [];
  }

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
          if (type === "eodrcpt")
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

      const filespath = path.join(base, "src", "files");
      if (fs.existsSync(filespath)) {
        const files = readdirSyncRecursive(filespath);
        const halonignores = files.filter(file => path.basename(file) === '.halonignore');
        for (const halonignore of halonignores) {
          const buffer = fs.readFileSync(halonignore);
          const patterns = buffer.toString('utf8').split(/\r?\n/).filter(line => line !== '');
          const folder = path.relative(filespath, path.dirname(halonignore)).split(path.sep).join(path.posix.sep);
          for (const pattern of patterns) {
            exclude.push([`${path.posix.sep}${folder}`, pattern]);
          }
        }
        for (let i of files)
        {
          const id = path.relative(filespath, i).split(path.sep).join(path.posix.sep);
          const hidden = id.split(path.posix.sep).filter(i => i.charAt(0) === '.');
          if (hidden.length > 0)
            continue;

          const excluded = exclude.find((x) => {
            const relative = path.relative(x[0], `${path.posix.sep}${id}`);
            if (relative.startsWith('..')) {
              return false;
            } else {
              return minimatch(`${path.posix.sep}${relative}`, x[1], { matchBase: true });
            }
          });

          if (excluded)
            continue;
          
          const buffer = fs.readFileSync(i);
  
          let item: any = { id: id };
          if (isUtf8(buffer)) {
            item.data = buffer.toString('utf8');
          } else {
            item.data = buffer.toString('base64');
            item.binary = true;
          }
  
          addFile(config, item);
        }
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

  if (fs.existsSync(path.join(base, "src", "config", "halonctl.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "halonctl.yaml"), 'utf-8');
    if (file) returnValue.halonctl = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "rated.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "rated.yaml"), 'utf-8');
    if (file) returnValue.rated = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "rated-app.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "rated-app.yaml"), 'utf-8');
    if (file) returnValue.rated_app = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "ratectl.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "ratectl.yaml"), 'utf-8');
    if (file) returnValue.ratectl = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "dlpd.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "dlpd.yaml"), 'utf-8');
    if (file) returnValue.dlpd = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "dlpd-app.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "dlpd-app.yaml"), 'utf-8');
    if (file) returnValue.dlpd_app = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "dlpctl.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "dlpctl.yaml"), 'utf-8');
    if (file) returnValue.dlpctl = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "api.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "api.yaml"), 'utf-8');
    if (file) returnValue.api = yaml.parse(file);
  }

  if (fs.existsSync(path.join(base, "src", "config", "web.yaml"))) {
    const file = fs.readFileSync(path.join(base, "src", "config", "web.yaml"), 'utf-8');
    if (file) returnValue.web = yaml.parse(file);
  }

  try {
    validate.validate(returnValue);
  } catch (err: any) {
    throw new Error(`${err.source}: ${JSON.stringify(err.errors)}`);
  }
  return returnValue;
};