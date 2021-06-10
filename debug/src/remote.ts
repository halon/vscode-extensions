import yaml from 'yaml';
import { IConnector, ExecProgram } from './factory';
import * as channel from './channel';
import * as pb from './protobuf';
import kill from 'tree-kill';

export const hsh = (
  connector: IConnector,
  configPath: string | undefined,
  appConfig: any,
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
      });
      stream.write(channel.packRequest('e'));
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
