import net from "net";
import * as stream from "stream";
import { EventEmitter } from "events";
import * as child_process from "child_process";

export interface ExecProgram extends EventEmitter {
  stdin: stream.Writable;
  stdout: stream.Readable;
  stderr: stream.Readable;
  pid?: number;
}

export interface IConnector {
  openChannel: (options: any) => Promise<stream.Duplex>;
  openServerChannel: (
    path: string,
    callback: (stream: stream.Duplex) => void,
  ) => Promise<net.Server>;
  closeServerChannel: (server: net.Server) => void;
  exec: (program: string, argv: string[]) => Promise<ExecProgram>;
  dispose: () => void;
}

export const ConnectorFactory = () => {
  return new SocketConnector();
};

export class SocketConnector implements IConnector {
  openChannel(options: net.NetConnectOpts) {
    return new Promise<stream.Duplex>((resolve, reject) => {
      const client = net.createConnection(options, async () => {
        resolve(client);
      });
      client.on("error", (err) => {
        reject(err);
      });
    });
  }
  openServerChannel(path: string, callback: (stream: stream.Duplex) => void) {
    return new Promise<net.Server>(async (resolve, reject) => {
      var s = net.createServer((client) => {
        callback(client);
      });
      s.listen(path);
      resolve(s);
    });
  }
  closeServerChannel(server: net.Server) {
    server.close();
  }
  exec(program: string, argv: string[]) {
    return new Promise<ExecProgram>((resolve, reject) => {
      resolve(child_process.spawn(program, argv));
    });
  }
  dispose() {}
}
