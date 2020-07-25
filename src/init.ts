import * as fs from 'fs';
import * as path from 'path';
import yaml from 'yaml';

export const run = (base: string | null = '.', force: boolean = false) =>
{
  if (base === null) {
    base = '.';
  }

  if (!force && fs.existsSync(path.join(base, "src")))
  {
    throw '"src" folder already exists in current working directory';
  }

  if (!fs.existsSync(path.join(base, "dist")))
    fs.mkdirSync(path.join(base, "dist"));
  if (force || !fs.existsSync(path.join(base, "settings.json")))
    fs.writeFileSync(path.join(base, "settings.json"), JSON.stringify(
      {
        smtpd: {
          build: { excludes: [] }
        },
        ssh2: {
          host: "192.168.0.1",
          port: 22,
          username: "admin",
          password: "admin"
        },
        livestage: {
          id: "abcd",
          conditions: {
          }
        }
      }, null, 4));

  if (!fs.existsSync(path.join(base, "src")))
    fs.mkdirSync(path.join(base, "src"));
  if (!fs.existsSync(path.join(base, "src", "hooks")))
    fs.mkdirSync(path.join(base, "src", "hooks"));
  if (!fs.existsSync(path.join(base, "src", "files")))
    fs.mkdirSync(path.join(base, "src", "files"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "connect")))
    fs.mkdirSync(path.join(base, "src", "hooks", "connect"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "disconnect")))
    fs.mkdirSync(path.join(base, "src", "hooks", "disconnect"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "proxy")))
    fs.mkdirSync(path.join(base, "src", "hooks", "proxy"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "helo")))
    fs.mkdirSync(path.join(base, "src", "hooks", "helo"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "auth")))
    fs.mkdirSync(path.join(base, "src", "hooks", "auth"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "mailfrom")))
    fs.mkdirSync(path.join(base, "src", "hooks", "mailfrom"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "rcptto")))
    fs.mkdirSync(path.join(base, "src", "hooks", "rcptto"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "eod")))
    fs.mkdirSync(path.join(base, "src", "hooks", "eod"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "eod", "rcpt")))
    fs.mkdirSync(path.join(base, "src", "hooks", "eod", "rcpt"));
  if (!fs.existsSync(path.join(base, "src", "config")))
    fs.mkdirSync(path.join(base, "src", "config"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "queue")))
    fs.mkdirSync(path.join(base, "src", "hooks", "queue"));

  var smtpd_app = {
    version: '5.4',
    servers: [
      {
        id: 'inbound',
        transport: 'inbound',
        phases: {
          connect: {
            hook: 'inbound'
          }
        }
      }
    ],
    transportgroups: [
      {
        id: 'default',
        transports: [
          {
            id: 'inbound',
            connection: {
              server: '192.168.0.25'
            },
            retry: {
              intervals: [
                { interval: 0 }
              ],
              count: 0
            }
          }
        ]
      }
    ]
  };
  fs.writeFileSync(path.join(base, "src", "config", "smtpd-app.yaml"), yaml.stringify(smtpd_app));
  fs.writeFileSync(path.join(base, "src", "hooks", "connect", "inbound.hsl"), 'echo "Hello World";');
  fs.writeFileSync(path.join(base, "src", "hooks", "queue", "predelivery.hsl"), 'echo "Do";');
  fs.writeFileSync(path.join(base, "src", "hooks", "queue", "postdelivery.hsl"), 'echo "Done";');
}
