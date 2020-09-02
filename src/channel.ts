import * as pb from './protobuf';
import * as stream from 'stream';

export const statusLiveStage = async (stream: stream.Duplex) =>
{
  var response = await sendAndWait(stream, packRequest('b'));
  return await pb.protobufLoader('smtpd.proto', 'smtpd.ConfigGreenStatusResponse', response);
}

export const cancelLiveStage = async (stream: stream.Duplex) =>
{
  await sendAndWait(stream, packRequest('c'));
}

export const startLiveStage = (stream: stream.Duplex, buffer: Buffer) =>
{
  return sendAndWait(stream, packRequest('a', buffer));
}

const sendAndWait = (stream: stream.Duplex, data: Buffer) =>
{
  return new Promise<Buffer>((resolve, reject) => {
    var buffer = Buffer.alloc(0);
    stream.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      if (buffer.length > 0) {
        if (buffer[0] == '+'.charCodeAt(0) || buffer[0] == 'E'.charCodeAt(0)) {
          if (buffer.length >= 9) {
            const len = buffer.readUIntLE(1, 6);
            if (buffer.readUInt16LE(7) != 0) {
              reject(new Error('Too large response'));
              return;
            }
            if (buffer.length > len + 9) {
              reject(new Error('Too much data in response'));
              return
            }
            if (buffer.length == len + 9) {
              if (buffer[0] == 'E'.charCodeAt(0)) {
                reject(new Error(buffer.slice(9, len + 9).toString()));
                return;
              }
              resolve(buffer.slice(9, len + 9));
            }
          }
        } else {
          reject(new Error('Invalid protocol response: ' + buffer[0]));
          return;
        }
      }
    });
    stream.write(data);
  });
}

export const packRequest = (command: string, protobuf?: Buffer): Buffer =>
{
  // 5.4
  var version = Buffer.alloc(2);
  version.writeInt8(5, 0);
  version.writeInt8(4, 1);

  if (!protobuf)
    return Buffer.concat([version, Buffer.from(command)]);

  var buf = Buffer.alloc(8);
  buf.writeUInt32LE(protobuf.length, 0);
  return Buffer.concat([version, Buffer.from(command), buf, protobuf]);
}
