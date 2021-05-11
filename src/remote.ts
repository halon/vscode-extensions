import yaml from 'yaml';
import * as pb from './protobuf';
import * as channel from './channel';
import { IConnector, ExecProgram } from './factory';
import * as stream from 'stream';

const smtpd_socket = '/var/run/halon/smtpd.ctl';
const hsllint_program = '/opt/halon/bin/hsl-lint';
const hsh_program = "/opt/halon/bin/hsh";

export const syntax = (connector: IConnector, syntax: any) =>
{
  return new Promise(async (resolve, reject) => {
    var stderr = Buffer.alloc(0);
    var program = await connector.exec(hsllint_program, []);
    program.on('close', (code: number, signal: string) => {
      switch (code)
      {
        case 0: resolve(undefined); break;
        case 1: resolve(yaml.parse(stderr.toString())); break;
        default: reject(new Error('hsl-lint exited with code: ' + code + ', stderr: ' + stderr.toString()));
      }
    });
    program.on('data', (data: Buffer) => {
      console.log(data);
    });
    program.stderr.on('data', (data: Buffer) => {
      stderr = Buffer.concat([stderr, data]);
    });
    program.stdin.end(yaml.stringify(syntax));
  });
}

export const startLiveStage = (connector: IConnector, id: string, conditions: any, config: string) =>
{
  return new Promise(async (resolve, reject) => {
    try {
      var buffer = await pb.protobufPacker('smtpd.proto', 'smtpd.ConfigGreenDeployRequest', { id: id, conditions: conditions, config: config });
      var s = await connector.openChannel(smtpd_socket);
    } catch (err) {
      reject(err);
      return;
    }
    channel.startLiveStage(s, buffer).then(() => {
      s.end();
      resolve(undefined);
    }).catch(async (err) => {
      await channel.cancelLiveStage(s);
      s.end();
      reject(err);
    });
  });
}

export const cancelLiveStage = async (connector: IConnector) =>
{
  var s = await connector.openChannel(smtpd_socket);
  await channel.cancelLiveStage(s);
  s.end();
}

export const statusLiveStage = (connector: IConnector) =>
{
  return new Promise((resolve, reject) => {
    connector.openChannel(smtpd_socket).then((stream) => {
      channel.statusLiveStage(stream).then((result) => {
        stream.end();
        resolve(result);
      }).catch((error) => {
        stream.end();
        reject(error);
      });
    }).catch(reject);
  });
}

export const run = (connector: IConnector, smtpd_app: any, onData: (data: string, err: boolean) => void, getStdin: (stdin: stream.Writable) => void) =>
{
  return new Promise<{ code: number, signal: string }>(async (resolve, reject) => {
    let args = ["-A", "-", "-"];
    connector.exec(hsh_program, args).then((program: ExecProgram) => {
      getStdin(program.stdin);

      program.on('close', (code: number, signal: string) => {
        resolve({ code: code, signal: signal });
      });

      program.stdout.on('data', (data: Buffer) => {
        onData(data.toString(), false);
      });

      program.stderr.on('data', (data: Buffer) => {
        onData(data.toString(), true);
      });

      try {
        program.stdin.write(yaml.stringify(smtpd_app) + '\x04');
      } catch (e) {
        reject(e);
      }
    }).catch(reject);
  });
}
