import yaml from 'yaml';
import { IConnector, ExecProgram } from './factory';
import * as channel from './channel';
import * as pb from './protobuf';

const hshPath = '/opt/halon/bin/hsh';

export const run = (
  connector: IConnector,
  configPath: string | undefined,
  appConfig: any,
  plugins: string[],
  onData: (data: string, error: boolean) => void,
  onDone: (code: number, signal: string) => void,
  onError: (error: any) => void,
  getPid: (pid: number) => void,
  getBreakPoint: (bp: any) => void
) => {
  return new Promise<() => void>(async (resolve, reject) => {
    const debugsocket = '/tmp/hsh-debug.' + (new Date()).getTime();
    connector.openServerChannel(debugsocket, (debugChannel) => {
      var cmd = 'e';
      channel.setupIPC(debugChannel, async (response: any) => {
        try {
          if (cmd === 'e') {
            if (!response) {
              return;
            }
            const bp = await pb.protobufLoader('hsh', 'hsh.HSLBreakPointResponse', response);
            getBreakPoint(bp);
          } else if (cmd === 'f') {
            cmd = 'e';
            debugChannel.write(channel.packRequest('e'));
          }
        } catch (error) {
          onError(error);
        }
      }, (error: any) => {
        onError(error);
      });
      debugChannel.write(channel.packRequest('e'));
      resolve(() => {
        cmd = 'f';
        debugChannel.write(channel.packRequest('f'));
      });
    }).then((s: any) => {
      let args = ['-C', debugsocket, '-A', '-', '-'];
      if (configPath) {
        args.push('-c', configPath);
      }
      for (const plugin of plugins) {
        args.push('-p', plugin);
      }

      connector.exec(hshPath, args).then((program: ExecProgram) => {
        getPid(program.pid);

        program.on('close', (code: number, signal: string) => {
          connector.closeServerChannel(s);
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
