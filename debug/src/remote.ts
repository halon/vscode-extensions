import yaml from 'yaml';
import { IConnector, ExecProgram } from './factory';
import * as channel from './channel';
import kill from 'tree-kill';
import * as smtpd_pb from '@halon/protobuf-schemas/js/smtpd_pb';
import * as hsh_pb from '@halon/protobuf-schemas/js/hsh_pb';
import { HSLLaunchRequestArguments } from './debug';

export const smtpd = (
  connector: IConnector,
  appConfig: any,
  debugId: string,
  conditions: HSLLaunchRequestArguments['conditions'],
  onData: (data: string, error: boolean) => void,
  onError: (error: any) => void,
  getBreakPoint: (bp: smtpd_pb.HSLBreakPointResponse) => void
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
    channel.setupIPC(stream, (response: any) => {
      try {
        if (cmd === 'c') {
          if (!stream.destroyed) {
            stream.destroy();
          }
        } else if (cmd === 'e') {
          if (!response) {
            return;
          }
          const bp = smtpd_pb.HSLBreakPointResponse.deserializeBinary(response);
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
    }, (response: any) => {
      try {
        const log = smtpd_pb.HSLLogResponse.deserializeBinary(response);
        onData(`[${log.getId()}] ${log.getText()}\n`, false);
      } catch (error) {
        onError(error);
      }
    });
      let request = new smtpd_pb.ConfigGreenDeployRequest();
      request.setId(debugId);
      request.setConfig(yaml.stringify(appConfig));
      request.setConnectionbound(true);

      if (conditions !== undefined) {
        let cond = new smtpd_pb.ConfigGreenConditions();
        if (conditions.remoteips !== undefined) {
          cond.setRemoteipsList(conditions.remoteips);
        }
        if (conditions.serverids !== undefined) {
          cond.setServeridsList(conditions.serverids);
        }
        if (conditions.probability !== undefined) {
          cond.setProbability(conditions.probability);
        }
        if (conditions.time !== undefined) {
          cond.setTime(conditions.time);
        }
        if (conditions.count !== undefined) {
          cond.setCount(conditions.count);
        }
      }
    stream.write(channel.packRequest('a', true, request.serializeBinary()));  
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
  getBreakPoint: (bp: hsh_pb.HSLBreakPointResponse) => void
) => {
  return new Promise<{ terminate: () => void, continue: () => void }>(async (resolve, reject) => {
    const hshPath = '/opt/halon/bin/hsh';
    let pid: number | null | undefined = null;
    const debugPath = '/tmp/hsh-debug.' + (new Date()).getTime();
    connector.openServerChannel(debugPath, (stream) => {
      var cmd = 'e';
      channel.setupIPC(stream, (response: any) => {
        try {
          if (cmd === 'e') {
            if (!response) {
              return;
            }
            const bp = hsh_pb.HSLBreakPointResponse.deserializeBinary(response);
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
      }, (response: any) => {
        try {
          const log = hsh_pb.HSLLogResponse.deserializeBinary(response);
          onData(`${log.getText()}\n`, false);
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
