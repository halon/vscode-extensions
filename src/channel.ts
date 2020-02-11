import * as pb from './protobuf';
import * as stream from 'stream';

export const statusLiveStage = async (stream: stream.Duplex) =>
{
	var response = await sendAndWait(stream, packRequest("b"));
	return await pb.protobufLoader("smtpd.proto", "smtpd.ConfigGreenStatusResponse", response);
}

export const cancelLiveStage = async (stream: stream.Duplex) =>
{
	await sendAndWait(stream, packRequest("c"));
}

export const startLiveStage = (stream: stream.Duplex, buffer: Buffer) =>
{
	return sendAndWait(stream, packRequest("a", buffer));
}

const sendAndWait = async(stream: stream.Duplex, data: Buffer) =>
{
	return new Promise<Buffer>((resolve, reject) => {
		var buffer = Buffer.alloc(0);
		stream.on('data', (data: Buffer) => {
			buffer = Buffer.concat([buffer, data]);
			if (buffer.length > 0)
			{
				if (buffer[0] == '+'.charCodeAt(0) || buffer[0] == 'E'.charCodeAt(0))
				{
					if (buffer.length >= 9)
					{
						const len = buffer.readUIntLE(1, 6);
						if (buffer.readUInt16LE(7) != 0)
							reject(Error("Too large response"));
						if (buffer.length == len + 9)
						{
							if (buffer[0] == 'E'.charCodeAt(0))
								reject(Error(buffer.slice(9, len + 9).toString()));
							resolve(buffer.slice(9, len + 9));
						}
						if (buffer.length > len + 9)
							reject(Error("Too much data in response"));
					}
				} else {
					reject(Error('Invalid protocol response: ' + buffer[0]));
				}
			}
		});
		stream.write(data);
	});
}

export const setupIPC = (stream: stream.Duplex, resolve: Function, reject: Function) =>
{
	var buffer = Buffer.alloc(0);
	stream.on('error', (err: any) => {
		reject(err)
	});
	stream.on('data', (data: Buffer) => {
		buffer = Buffer.concat([buffer, data]);
		if (buffer.length > 0)
		{
			if (buffer[0] == '+'.charCodeAt(0) || buffer[0] == 'E'.charCodeAt(0))
			{
				if (buffer.length >= 9)
				{
					const len = buffer.readUIntLE(1, 6);
					if (buffer.readUInt16LE(7) != 0)
						return reject(Error("Too large response"));
					if (buffer.length == len + 9)
					{
						if (buffer[0] == 'E'.charCodeAt(0))
							return reject(Error(buffer.slice(9, len + 9).toString()));
						var buf = buffer.slice(9, len + 9);
						buffer = Buffer.alloc(0);
						return resolve(buf);
					}
					if (buffer.length > len + 9)
						return reject(Error("Too much data in response"));
				}
			} else {
				return reject(Error('Invalid protocol response: ' + buffer[0]));
			}
		}
	});
}

export const packRequest = (command: string, protobuf?: Buffer): Buffer =>
{
  // 5.3
  var version = Buffer.alloc(2);
	version.writeInt8(5, 0);
	version.writeInt8(3, 1);

	if (!protobuf)
		return Buffer.concat([version, Buffer.from(command)]);

	var buf = Buffer.alloc(8);
	buf.writeUInt32LE(protobuf.length, 0);
	return Buffer.concat([version, Buffer.from(command), buf, protobuf]);
}
