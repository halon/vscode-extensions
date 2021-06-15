import yaml from 'yaml';
import { IConnector, ExecProgram } from './factory';
import * as channel from './channel';
import * as pb from './protobuf';
import kill from 'tree-kill';
import { ConfigGreenConditions } from './debug';

export const smtpd = (
  connector: IConnector,
  appConfig: any,
  debugId: string,
  conditions: ConfigGreenConditions | undefined = undefined,
  onData: (data: string, error: boolean) => void,
  onError: (error: any) => void,
  getBreakPoint: (bp: any) => void
) => {
  return new Promise<{ terminate: () => void, continue: () => void }>(async (resolve, reject) => {
    const smtpdPath = '/var/run/halon/smtpd.ctl';
    try {
      var stream = await connector.openChannel(smtpdPath);
    } catch (error) {
      onError(error);
      return;
    }
    var cmd = 'a';
    channel.setupIPC(stream, async (response: any) => {
      try {
        if (cmd === 'c') {
          if (!stream.destroyed) {
            stream.destroy();
          }
        } else if (cmd === 'e') {
          if (!response) {
            return;
          }
          const bp = await pb.protobufLoader('smtpd', 'smtpd.HSLBreakPointResponse', response);
          getBreakPoint(bp);
        } else if (cmd === 'a' || cmd === 'f') {
          cmd = 'e';
          stream.write(channel.packRequest('e'));
        }
      } catch (error) {
        onError(error);
      }
    }, (error: any) => {
      onError(error);
    }, async (response: any) => {
      try {
        const log = await pb.protobufLoader('smtpd', 'smtpd.HSLLogResponse', response);
        onData(`[${log.id}] ${log.text}\n`, false);
      } catch (error) {
        onError(error);
      }
    });
    try {
      var buffer = await pb.protobufPacker('smtpd', 'smtpd.ConfigGreenDeployRequest', {
        id: debugId,
        conditions: conditions,
        config: yaml.stringify(appConfig),
        connectionbound: true
      });
    } catch (error) {
      onError(error);
      return;
    }
    stream.write(channel.packRequest('a', true, buffer));  
    resolve({
      continue: () => {
        cmd = 'f';
        stream.write(channel.packRequest('f'));
      },
      terminate: () => {
        cmd = 'c';
        stream.write(channel.packRequest('c'));
      }
    });
  });
};

export const hsh = (
  connector: IConnector,
  appConfig: any,
  configPath: string | undefined,
  plugins: string[] = [],
  onData: (data: string, error: boolean) => void,
  onDone: (code: number, signal: string) => void,
  onError: (error: any) => void,
  getBreakPoint: (bp: any) => void
) => {
  return new Promise<{ terminate: () => void, continue: () => void }>(async (resolve, reject) => {
    const hshPath = '/opt/halon/bin/hsh';
    let pid: number | null | undefined = null;
    const debugPath = '/tmp/hsh-debug.' + (new Date()).getTime();
    connector.openServerChannel(debugPath, (stream) => {
      var cmd = 'e';
      channel.setupIPC(stream, async (response: any) => {
        try {
          if (cmd === 'e') {
            if (!response) {
              return;
            }
            const bp = await pb.protobufLoader('hsh', 'hsh.HSLBreakPointResponse', response);
            getBreakPoint(bp);
          } else if (cmd === 'f') {
            cmd = 'e';
            stream.write(channel.packRequest('e'));
          }
        } catch (error) {
          onError(error);
        }
      }, (error: any) => {
        onError(error);
      }, async (response: any) => {
        try {
          const log = await pb.protobufLoader('hsh', 'hsh.HSLLogResponse', response);
          onData(`${log.text}\n`, false);
        } catch (error) {
          onError(error);
        }
      });
      stream.write(channel.packRequest('e', true));
      resolve({
        continue: () => {
          cmd = 'f';
          stream.write(channel.packRequest('f'));
        },
        terminate: () => {
          if (pid) {
            kill(pid, 'SIGINT');
          }
        }
      });
    }).then((server: any) => {
      let args = ['-C', debugPath, '-A', '-', '-'];
      if (configPath) {
        args.push('-c', configPath);
      }
      for (const plugin of plugins) {
        args.push('-p', plugin);
      }

      connector.exec(hshPath, args).then((program: ExecProgram) => {
        pid = program.pid;

        program.on('close', (code: number, signal: string) => {
          connector.closeServerChannel(server);
          onDone(code, signal);
        });

        program.stdout.on('data', (data: Buffer) => {
          onData(data.toString(), false);
        });

        program.stderr.on('data', (data: Buffer) => {
          onData(data.toString(), true);
        });

        try {
          program.stdin.end(yaml.stringify(appConfig));
        } catch (error) {
          onError(error);
        }
      }).catch((error) => onError(error));
    }).catch((error) => onError(error));
  });
};
