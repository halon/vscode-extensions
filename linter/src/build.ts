import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';
import isUtf8 from 'is-utf8';

export const readdirSyncRecursive = (dir: string) =>
{
  var results: string[] = [];
  var list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = dir + path.sep + file;
    var stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(readdirSyncRecursive(file));
    } else {
      results.push(file);
    }
  });
  return results;
};

export const syntax = (file: string, workspaceFolder: string) =>
{
  var result: {
    version?: string,
    phase: string,
    data: string,
    files: Array<any>
    scripting?: any
    plugins?: any
  } = {
    phase: "",
    data: "",
    files: []
  };

  const smtpd_path = path.join(workspaceFolder, 'src', 'config', 'smtpd.yaml');
  if (fs.existsSync(smtpd_path)) {
    try {
      const smtpd = yaml.parse(fs.readFileSync(smtpd_path).toString());
      if (smtpd.version !== undefined) {
        result.version = smtpd.version;
      }
      if (smtpd.scripting !== undefined) {
        result.scripting = smtpd.scripting;
      }
      if (smtpd.plugins !== undefined) {
        result.plugins = smtpd.plugins;
      }
    } catch (err) {}
  }

  const smtpd_app_path = path.join(workspaceFolder, 'src', 'config', 'smtpd-app.yaml');
  if (fs.existsSync(smtpd_app_path)) {
    try {
      const smtpd_app = yaml.parse(fs.readFileSync(smtpd_app_path).toString());
      if (result.version === undefined && smtpd_app.version !== undefined) {
        result.version = smtpd_app.version;
      }
      if (smtpd_app.scripting !== undefined && smtpd_app.scripting.files !== undefined) {
        result.files = smtpd_app.scripting.files;
      }
    } catch (err) {}
  }

  var fileparse = path.parse(file);
  const filepath = fileparse.dir.split(path.sep);

  if (filepath.length > 2 && filepath.slice(-2, -1)[0] === "hooks") {
    if (filepath.slice(-1)[0] === 'queue') {
      result.phase = fileparse.name;
    } else {
      result.phase = filepath.slice(-1)[0];
    }
  } else if (filepath.length > 3 && filepath.slice(-3, -2)[0] === "hooks") {
      throw Error('Unknown hooks directory in path');
  }
  result.data = fs.readFileSync(file).toString();

  const files_path = path.join(workspaceFolder, 'src', 'files');
  if (fs.existsSync(files_path)) {
    for (let i of readdirSyncRecursive(files_path)) {
      if (file === i) {
        continue;
      }
  
      const id = path.relative(files_path, i).split(path.sep).join(path.posix.sep);
      const hidden = id.split(path.posix.sep).filter(i => i.charAt(0) === '.');
      if (hidden.length > 0) {
        continue;
      }
  
      const buffer = fs.readFileSync(i);
  
      let item: any = { id: id };
      if (isUtf8(buffer)) {
        item.data = buffer.toString('utf8');
      } else {
        item.data = buffer.toString('base64');
        item.binary = true;
      }

      if (result.files.find(file => file.id === item.id)) {
        result.files = result.files.map(file => file.id === item.id ? item : file);
      } else {
        result.files.push(item);
      }
    }
  }

  return result;
};
