import yaml from 'yaml';
import * as pb from './protobuf';
import * as channel from './channel';
import { IConnector } from './factory';

const smtpd_socket = '/var/run/halon/smtpd.ctl';
const hsllint_program = '/opt/halon/bin/hsl-lint';

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

export const startLiveStage = async (connector: IConnector, id: string, conditions: any, config: string) =>
{
  const buffer = await pb.protobufPacker('smtpd.proto', 'smtpd.ConfigGreenDeployRequest', { id: id, conditions: conditions, config: config });

  return new Promise(async (resolve, reject) => {
    var s = await connector.openChannel(smtpd_socket);
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