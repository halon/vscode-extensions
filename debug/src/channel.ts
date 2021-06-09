import * as stream from 'stream';

export const setupIPC = (stream: stream.Duplex, onData: Function, onError: Function) =>
{
  var buffer = Buffer.alloc(0);
  stream.on('error', (error: any) => {
    onError(error);
  });
  stream.on('data', (data: Buffer) => {
    buffer = Buffer.concat([buffer, data]);
    if (buffer.length > 0) {
      if (buffer[0] == '+'.charCodeAt(0) || buffer[0] == 'E'.charCodeAt(0)) {
        if (buffer.length >= 9) {
          const len = buffer.readUIntLE(1, 6);
          if (buffer.readUInt16LE(7) != 0) {
            onError(new Error('Too large response'));
            return;
          }
          if (buffer.length > len + 9) {
            onError(new Error('Too much data in response'));
            return;
          }
          if (buffer.length == len + 9) {
            if (buffer[0] == 'E'.charCodeAt(0)) {
              onError(new Error(buffer.slice(9, len + 9).toString()));
              return;
            }
						var buf = buffer.slice(9, len + 9);
						buffer = Buffer.alloc(0);
						onData(buf);
          }
        }
      } else {
        onError(Error('Invalid protocol response: ' + buffer[0]));
        return;
      }
    }
  });
}

export const sendAndWait = (stream: stream.Duplex, data: Uint8Array) =>
{
  return new Promise<Buffer>((resolve, reject) => {
    var buffer = Buffer.alloc(0);
    stream.on('error', (error) => {
      reject(error);
    });
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
              return;
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

export const packRequest = (command: string, protobuf?: Uint8Array): Buffer =>
{
  // 5.6
  var version = Buffer.alloc(2);
  version.writeInt8(5, 0);
  version.writeInt8(6, 1);

  if (!protobuf)
    return Buffer.concat([version, Buffer.from(command)]);

  var buf = Buffer.alloc(8);
  buf.writeUInt32LE(protobuf.length, 0);
  return Buffer.concat([version, Buffer.from(command), buf, protobuf]);
}
