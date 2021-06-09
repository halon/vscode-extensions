import net from 'net';
import * as stream from 'stream';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';

export interface ExecProgram extends EventEmitter
{
  stdin: stream.Writable;
  stdout: stream.Readable;
  stderr: stream.Readable;
}

export interface IConnector
{
  openChannel: (path: string) => Promise<stream.Duplex>;
  openServerChannel: (path: string, callback: (stream: stream.Duplex) => void) => Promise<any>;
  closeServerChannel: (server: any) => void;
  exec: (program: string, argv: string[]) => Promise<ExecProgram>;
  dispose: () => void;
}

export const ConnectorFactory = () =>
{
  return new UNIXConnector();
}

export class UNIXConnector implements IConnector
{
  openChannel(path: string)
  {
    return new Promise<stream.Duplex>((resolve, reject) => {
      const client = net.createConnection({ path: path }, async () => {
        resolve(client);
      });
      client.on('error', (err) => {
        reject(err);
      });
    });
  }
  openServerChannel(path: string, callback: (stream: stream.Duplex) => void)
  {
    return new Promise<any>(async (resolve, reject) => {
      var s = net.createServer((client) => {
        callback(client);
      });
      s.listen(path);
      resolve(s);
    });
  }
  closeServerChannel(server: any)
  {
    server.close();
  }
  exec(program: string, argv: string[])
  {
    return new Promise<ExecProgram>((resolve, reject) => {
      resolve(child_process.spawn(program, argv));
    });
  }
  dispose()
  {
  }
}
