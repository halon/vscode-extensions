import * as stream from 'stream';

export const setupIPC = (stream: stream.Duplex, onData: Function, onError: Function, onLog: Function) =>
{
  let buffer = Buffer.alloc(0);

  stream.on('error', (error: any) => {
    onError(error);
  });

  stream.on('data', (data: Buffer) => {
    buffer = Buffer.concat([buffer, data]);
    while (buffer.length > 0) {
      if (buffer[0] === '+'.charCodeAt(0) || buffer[0] === 'E'.charCodeAt(0) || buffer[0] === '='.charCodeAt(0)) {
        const len = buffer.readUIntLE(1, 6);
        if (buffer.readUInt16LE(7) !== 0) {
          onError(new Error('Too large response'));
          buffer = Buffer.alloc(0);
          return;
        }
        if (buffer.length >= len + 9) {
          if (buffer[0] === 'E'.charCodeAt(0)) {
            onError(new Error(buffer.slice(9, len + 9).toString()));
          } else if (buffer[0] === '='.charCodeAt(0)) {
            onLog(buffer.slice(9, len + 9));
          } else {
            onData(buffer.slice(9, len + 9));
          }
          buffer = buffer.slice(len + 9);
        } else {
          return;
        }
      } else {
        onError(new Error('Invalid protocol response: ' + buffer[0]));
        buffer = Buffer.alloc(0);
        return;
      }
    }
  });
};

export const packRequest = (command: string, version?: boolean, protobuf?: Uint8Array): Buffer =>
{
  let buffers: Array<Buffer|Uint8Array> = [];

  if (version) {
    const buffer = Buffer.alloc(2);
    buffer.writeInt8(5, 0);
    buffer.writeInt8(7, 1);
    buffers.push(buffer);
  }

  const buffer = Buffer.from(command);
  buffers.push(buffer);

  if (protobuf) {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32LE(protobuf.length, 0);
    buffers.push(buffer, protobuf);
  }

  if (!protobuf && command === 'e') {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32LE(0, 0);
    buffers.push(buffer);
  }

  return Buffer.concat(buffers);
};
