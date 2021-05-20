import * as fs from 'fs';
import * as path from 'path';
import { Uri, workspace, window } from 'vscode';
import yaml from 'yaml';

export const run = (base: string | null = '.', type = 'none') =>
{
  if (base === null)
    base = '.';

  if (fs.existsSync(path.join(base, "src")))
    throw new Error('"src" folder already exists in current working directory');

  if (!fs.existsSync(path.join(base, "dist")))
    fs.mkdirSync(path.join(base, "dist"));

  if (type === 'container') {
    if (!fs.existsSync(path.join(base, ".devcontainer")))
      fs.mkdirSync(path.join(base, ".devcontainer"));

    fs.writeFileSync(path.join(base, ".devcontainer", "devcontainer.json"), JSON.stringify({
      name: 'Halon',
      context: '..',
      dockerFile: './Dockerfile',
      forwardPorts: [25],
      // appPort: [25],
      overrideCommand: false,
      extensions: ['Halon.vscode-halon', 'Halon.hsl-linter']
    }, undefined, 2));

    fs.writeFileSync(path.join(base, ".devcontainer", "Dockerfile"),
`FROM ubuntu:20.04
MAINTAINER Halon <support@halon.io>

COPY .devcontainer/halon-5.6.1-ubuntu-20.04-x86_64.deb /halon-5.6.1-ubuntu-20.04-x86_64.deb
RUN apt-get update && apt install -y /halon-5.6.1-ubuntu-20.04-x86_64.deb && rm /halon-5.6.1-ubuntu-20.04-x86_64.deb

RUN /usr/bin/install -d /var/run/halon
ENV LD_LIBRARY_PATH=/opt/halon/lib/:$LD_LIBRARY_PATH
COPY dist/*.yaml /etc/halon/

RUN apt-get install -y git

RUN apt-get install -y supervisor
COPY .devcontainer/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
CMD ["/usr/bin/supervisord"]`
    );

    fs.writeFileSync(path.join(base, ".devcontainer", "supervisord.conf"),
`[supervisord]
nodaemon=true

[program:rated]
command=/opt/halon/sbin/rated

[program:dlpd]
command=/opt/halon/sbin/dlpd

[program:smtpd]
command=/opt/halon/sbin/smtpd`
    );
  }

  let settings: any = {
    smtpd: {
      build: { exclude: [] }
    },
  };
  if (type === 'container') {
    settings.livestage = {
      id: 'abcd',
      conditions: {
      }
    }
  }
  fs.writeFileSync(path.join(base, "settings.yaml"), yaml.stringify(settings));

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
    version: '5.6',
    servers: [
      {
        id: 'inbound',
        transport: 'inbound'
      }
    ],
    transportgroups: [
      {
        id: 'default',
        transports: [
          {
            id: 'inbound',
            connection: {
              server: '192.168.0.2'
            }
          }
        ]
      }
    ]
  };
  fs.writeFileSync(path.join(base, "src", "config", "smtpd-app.yaml"), yaml.stringify(smtpd_app));
  if (type === 'container')
    fs.writeFileSync(path.join(base, "dist", "smtpd-app.yaml"), yaml.stringify(smtpd_app));

  if (type === 'container') {
    const smtpd = {
      version: '5.6',
      servers: [
        {
          id: 'inbound',
          listeners: [{
            port: 25
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
        umask: "0027"
      }
    };
    fs.writeFileSync(path.join(base, "src", "config", "smtpd.yaml"), yaml.stringify(smtpd));
    fs.writeFileSync(path.join(base, "dist", "smtpd.yaml"), yaml.stringify(smtpd));
  }

  fs.writeFileSync(path.join(base, "src", "hooks", "queue", "predelivery.hsl"), 'echo "Do";');
  fs.writeFileSync(path.join(base, "src", "hooks", "queue", "postdelivery.hsl"), 'echo "Done";');

  if (type === 'container') {
    fs.writeFileSync(path.join(base, "README.md"),
`# Halon configuration template (container)

## Getting started

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Install [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
3. Copy \`halon-5.6.1-ubuntu-20.04-x86_64.deb\` to the \`.devcontainer\` folder
4. [Reopen this folder in the container](https://code.visualstudio.com/docs/remote/containers#_quick-start-open-an-existing-folder-in-a-container)
5. If you need to restart \`smtpd\` you can run \`supervisorctl restart smtpd\`

## Important information
Note that this docker container is not configured to be production-ready and should only be used during development.
`
    );
    workspace.openTextDocument(Uri.file(path.join(base, "README.md"))).then((document) => {
      window.showTextDocument(document);
    });
  }
}
