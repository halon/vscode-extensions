import * as fs from 'fs';
import * as path from 'path';
import { Uri, commands } from 'vscode';
import yaml from 'yaml';

export const run = (base: string | null = '.', template = 'minimal', development = 'none') =>
{
  if (base === null)
    base = '.';

  if (fs.existsSync(path.join(base, "src")))
    throw new Error('"src" folder already exists in current working directory');

  if (!fs.existsSync(path.join(base, "dist")))
    fs.mkdirSync(path.join(base, "dist"));

  if (development === 'container') {
    if (!fs.existsSync(path.join(base, ".devcontainer")))
      fs.mkdirSync(path.join(base, ".devcontainer"));

    fs.writeFileSync(path.join(base, ".devcontainer", "devcontainer.json"), JSON.stringify({
      name: 'Halon',
      context: '..',
      dockerFile: './Dockerfile',
      forwardPorts: [25],
      // appPort: [25],
      overrideCommand: false,
      extensions: ['Halon.vscode-halon', 'Halon.hsl-linter', 'Halon.hsl-debug'],
      mounts: [
        'source=${localWorkspaceFolder}/dist,target=/etc/halon,type=bind,consistency=cached'
      ]
    }, undefined, 2));

    fs.writeFileSync(path.join(base, ".devcontainer", "Dockerfile"),
`FROM ubuntu:20.04
MAINTAINER Halon <support@halon.io>

COPY .devcontainer/halon-5.7.1-ubuntu-20.04-x86_64.deb /halon-5.7.1-ubuntu-20.04-x86_64.deb
RUN apt-get update && apt install -y /halon-5.7.1-ubuntu-20.04-x86_64.deb && rm /halon-5.7.1-ubuntu-20.04-x86_64.deb

RUN /usr/bin/install -d /var/run/halon
ENV LD_LIBRARY_PATH=/opt/halon/lib/:$LD_LIBRARY_PATH

RUN apt-get install -y git

RUN apt-get install -y supervisor
COPY .devcontainer/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
CMD ["/usr/bin/supervisord"]`
    );

    fs.writeFileSync(path.join(base, ".devcontainer", "supervisord.conf"),
`[supervisord]
nodaemon=true
loglevel=info

[program:rated]
command=/opt/halon/sbin/rated

[program:dlpd]
command=/opt/halon/sbin/dlpd

[program:smtpd]
command=/opt/halon/sbin/smtpd -f`
    );

    if (!fs.existsSync(path.join(base, ".vscode")))
      fs.mkdirSync(path.join(base, ".vscode"));

    fs.writeFileSync(path.join(base, ".vscode", "launch.json"), JSON.stringify({
      version: "0.2.0",
      configurations: [
        {
          name: "Debug File",
          type: "hsl",
          request: "launch",
          program: "${file}"
        },
        {
          name: "Debug Live Stage",
          type: "halon",
          request: "launch"
        }
      ]
    }, undefined, 2));
  }

  let settings: any = {
    "halon.build.exclude": [],
  };
  if (!fs.existsSync(path.join(base, ".vscode")))
    fs.mkdirSync(path.join(base, ".vscode"));
  fs.writeFileSync(path.join(base, ".vscode", "settings.json"), JSON.stringify(settings, undefined, 2));

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

  const smtpd_app = {
    version: '5.7',
    servers: [
      {
        id: 'default',
        transport: 'mx'
      }
    ],
    transportgroups: [
      {
        id: 'default',
        retry: {
          count: 30,
          intervals: [
            { interval: 60 },
            { interval: 900 },
            { interval: 3600, notify: true },
            { interval: 7200 },
            { interval: 10800 }
          ]
        },
        dsn: {
          transport: 'mx'
        },
        transports: [
          {
            id: 'mx',
            session: {
              tls: {
                mode: 'dane'
              }
            }
          }
        ]
      }
    ],
    resolver: {
      cache: {
        size: 10000
      }
    }
  };
  fs.writeFileSync(path.join(base, "src", "config", "smtpd-app.yaml"), yaml.stringify(smtpd_app));
  if (development === 'container')
    fs.writeFileSync(path.join(base, "dist", "smtpd-app.yaml"), yaml.stringify(smtpd_app));

  if (development === 'container') {
    const smtpd = {
      version: '5.7',
      servers: [
        {
          id: 'default',
          listeners: [{
            port: 25,
            address: '127.0.0.1'
          }]
        }
      ],
      environment: {
        uuid: {
          version: 4
        },
        controlsocket: {
          group: 'staff',
          chmod: '0660'
        },
        privdrop: {
          user: 'halon',
          group: 'halon'
        },
        umask: "0027",
        rlimit: {
          nofile: 70000
        }
      }
    };
    fs.writeFileSync(path.join(base, "src", "config", "smtpd.yaml"), yaml.stringify(smtpd));
    fs.writeFileSync(path.join(base, "dist", "smtpd.yaml"), yaml.stringify(smtpd));
  }

  fs.writeFileSync(path.join(base, "src", "hooks", "queue", "predelivery.hsl"), "");
  fs.writeFileSync(path.join(base, "src", "hooks", "queue", "postdelivery.hsl"), "");

  if (development === 'container') {
    fs.writeFileSync(path.join(base, "README.md"),
`# Halon configuration template (container)

## Getting started

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Install [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
3. Copy \`halon-5.7.1-ubuntu-20.04-x86_64.deb\` to the \`.devcontainer\` folder
4. [Reopen this folder in the container](https://code.visualstudio.com/docs/remote/containers#_quick-start-open-an-existing-folder-in-a-container)

## Useful information

* This docker container is not configured to be production-ready and should only be used during development
* By default port 25 will be forwarded from the container to the local machine, click on the *PORTS* tab to see which randomized destination port you should use to connect to it
* If you need to restart \`smtpd\` after building a new startup configuration (\`smtpd.yaml\`) you can run \`supervisorctl restart smtpd\`
* If you need to reload \`smtpd\` after building a new running configuration (\`smtpd-app.yaml\`) you can run \`halonctl config reload -P smtpd\`
* If you need to see the text logs you can run \`supervisorctl tail -f smtpd stderr\`
`
    );
    commands.executeCommand('markdown.showPreview', Uri.file(path.join(base, "README.md")))
  }

  if (development === 'ssh') {
    fs.writeFileSync(path.join(base, "README.md"),
`# Halon configuration template (ssh)

## Getting started

1. Install \`halon-5.7.1-ubuntu-20.04-x86_64.deb\` on the remote machine
2. Move this folder to the remote machine (You don't need to have it on your local machine)
3. Install [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) extension
4. [Connect to the remote machine](https://code.visualstudio.com/docs/remote/ssh#_connect-to-a-remote-host) using the [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) extension
5. [Install](https://code.visualstudio.com/docs/remote/ssh#_managing-extensions) [Halon Configuration Packer](https://marketplace.visualstudio.com/items?itemName=Halon.vscode-halon) extension, [Halon Scripting Language Linter](https://marketplace.visualstudio.com/items?itemName=Halon.hsl-linter) extension and [Halon Scripting Language Debugger](https://marketplace.visualstudio.com/items?itemName=Halon.hsl-debug) extension on the remote machine (if they are not already installed)
6. [Open this folder on the remote machine](https://code.visualstudio.com/docs/remote/ssh#_connect-to-a-remote-host)
`
    );
    commands.executeCommand('markdown.showPreview', Uri.file(path.join(base, "README.md")))
  }
}
