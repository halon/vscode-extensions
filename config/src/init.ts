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
      ],
      build: {
        args: {
          HALON_REPO_USER: "${localEnv:HALON_REPO_USER}",
          HALON_REPO_PASS: "${localEnv:HALON_REPO_PASS}"
        }
      }
    }, undefined, 2));

    fs.writeFileSync(path.join(base, ".devcontainer", "Dockerfile"),
`FROM --platform=linux/amd64 ubuntu:20.04
LABEL org.opencontainers.image.authors="support@halon.io"

ARG HALON_REPO_USER
ARG HALON_REPO_PASS

RUN apt-get update

RUN apt-get install -y wget gnupg
RUN apt-get install -y apt-transport-https

RUN wget -qO - https://raw.githubusercontent.com/halon/changelog/master/pgp-keys/7F0A73B5.asc | apt-key add -
RUN echo "deb https://repo.halon.io/ focal stable" >> /etc/apt/sources.list.d/halon.list
RUN echo "machine repo.halon.io login \${HALON_REPO_USER} password \${HALON_REPO_PASS}" >> /etc/apt/auth.conf
RUN apt-get update && apt-get install -y halon=5.8.3 halon-rated=5.8.3 halon-dlpd=5.8.3 halon-extras-rate=1.0.0 halon-extras-dlp=1.0.1

RUN /usr/bin/install -d /var/run/halon
ENV LD_LIBRARY_PATH=$LD_LIBRARY_PATH

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
environment=LD_LIBRARY_PATH="/opt/halon/lib/rated/:%(ENV_LD_LIBRARY_PATH)s"

[program:dlpd]
command=/opt/halon/sbin/dlpd
environment=LD_LIBRARY_PATH="/opt/halon/lib/dlpd/:%(ENV_LD_LIBRARY_PATH)s"

[program:smtpd]
command=/opt/halon/sbin/smtpd -f
environment=LD_LIBRARY_PATH="/opt/halon/lib/:%(ENV_LD_LIBRARY_PATH)s"
`
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
  if (!fs.existsSync(path.join(base, "src", "config")))
    fs.mkdirSync(path.join(base, "src", "config"));
  if (!fs.existsSync(path.join(base, "src", "hooks", "queue")))
    fs.mkdirSync(path.join(base, "src", "hooks", "queue"));

  const eod_default = `$transactionid = $transaction["id"];
$sender = $transaction["senderaddress"];
$recipients = $transaction["recipients"];
$mail = $arguments["mail"];

// Queue message for all recipients
foreach ($recipients as $recipient)
    $mail->queue($sender, $recipient["address"], $recipient["transportid"]);

Accept();
`;
  fs.writeFileSync(path.join(base, "src", "hooks", "eod", "default.hsl"), eod_default);

  const smtpd_app: any = {
    version: '5.8',
    servers: [
      {
        id: 'default',
        transport: 'mx',
        phases: {
          eod: {
            hook: 'default'
          }
        }
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
  if (development === 'container') {
    if (smtpd_app.scripting === undefined) smtpd_app.scripting = {};
    if (smtpd_app.scripting.hooks === undefined) smtpd_app.scripting.hooks = {};
    if (smtpd_app.scripting.hooks.eod === undefined) smtpd_app.scripting.hooks.eod = [];
    smtpd_app.scripting.hooks.eod.push({ id: "default", data: eod_default });
    fs.writeFileSync(path.join(base, "dist", "smtpd-app.yaml"), yaml.stringify(smtpd_app));
  }

  if (development === 'container') {
    const smtpd = {
      version: '5.8',
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
    const rated = {
      version: '5.8',
      environment: {
        controlsocket: {
          group: 'staff',
          chmod: '0660'
        },
        socket: {
          owner: 'halon',
          group: 'halon',
          chmod: '0660'
        },
        privdrop: {
          user: 'nobody',
          group: 'nogroup'
        }
      }
    };
    fs.writeFileSync(path.join(base, "src", "config", "rated.yaml"), yaml.stringify(rated));
    fs.writeFileSync(path.join(base, "dist", "rated.yaml"), yaml.stringify(rated));
    const dlpd = {
      version: '5.8',
      environment: {
        controlsocket: {
          group: 'staff',
          chmod: '0660'
        },
        socket: {
          owner: 'halon',
          group: 'halon',
          chmod: '0660'
        },
        privdrop: {
          user: 'halon',
          group: 'halon'
        }
      }
    };
    fs.writeFileSync(path.join(base, "src", "config", "dlpd.yaml"), yaml.stringify(dlpd));
    fs.writeFileSync(path.join(base, "dist", "dlpd.yaml"), yaml.stringify(dlpd));
    const dlpd_app = {
      version: '5.8',
      rules:  []
    };
    fs.writeFileSync(path.join(base, "src", "config", "dlpd-app.yaml"), yaml.stringify(dlpd_app));
    fs.writeFileSync(path.join(base, "dist", "dlpd-app.yaml"), yaml.stringify(dlpd_app));
  }

  fs.writeFileSync(path.join(base, "src", "hooks", "queue", "predelivery.hsl"), "");
  fs.writeFileSync(path.join(base, "src", "hooks", "queue", "postdelivery.hsl"), "");

  if (development === 'container') {
    fs.writeFileSync(path.join(base, "README.md"),
`# Halon configuration template (container)

## Getting started

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Install [Remote - Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension
3. Set the \`HALON_REPO_USER\` and \`HALON_REPO_PASS\` environment variables or adjust the build arguments in \`.devcontainer/devcontainer.json\`
4. [Reopen this folder in the container](https://code.visualstudio.com/docs/remote/containers#_quick-start-open-an-existing-folder-in-a-container)

## Useful information

* This docker container is not configured to be production-ready and should only be used during development
* By default port 25 will be forwarded from the container to the local machine, click on the *PORTS* tab to see which randomized destination port you should use to connect to it
* If you need to restart \`smtpd\` after building a new startup configuration (\`smtpd.yaml\`) you can run \`supervisorctl restart smtpd\`
* If you need to reload \`smtpd\` after building a new running configuration (\`smtpd-app.yaml\`) you can run \`halonctl config reload -P smtpd\`
* If you need to see the text logs you can run \`supervisorctl tail -f smtpd stderr\`
`
    );
    commands.executeCommand('markdown.showPreview', Uri.file(path.join(base, "README.md")));
  }

  if (development === 'ssh') {
    fs.writeFileSync(path.join(base, "README.md"),
`# Halon configuration template (ssh)

## Getting started

1. Install \`halon-5.8.0-ubuntu-20.04-x86_64.deb\` on the remote machine
2. Move this folder to the remote machine (You don't need to have it on your local machine)
3. Install [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) extension
4. [Connect to the remote machine](https://code.visualstudio.com/docs/remote/ssh#_connect-to-a-remote-host) using the [Remote - SSH](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh) extension
5. [Install](https://code.visualstudio.com/docs/remote/ssh#_managing-extensions) [Halon Configuration Packer](https://marketplace.visualstudio.com/items?itemName=Halon.vscode-halon) extension, [Halon Scripting Language Linter](https://marketplace.visualstudio.com/items?itemName=Halon.hsl-linter) extension and [Halon Scripting Language Debugger](https://marketplace.visualstudio.com/items?itemName=Halon.hsl-debug) extension on the remote machine (if they are not already installed)
6. [Open this folder on the remote machine](https://code.visualstudio.com/docs/remote/ssh#_connect-to-a-remote-host)
`
    );
    commands.executeCommand('markdown.showPreview', Uri.file(path.join(base, "README.md")));
  }
};
