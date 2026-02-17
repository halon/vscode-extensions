import net from "net";
import * as stream from "stream";
import { EventEmitter } from "events";
import * as ChildProcess from "child_process";
import * as tls from "tls";
import { NetConnectOpts } from "net";

export interface ExecProgram extends EventEmitter {
  stdin: stream.Writable;
  stdout: stream.Readable;
  stderr: stream.Readable;
  pid?: number;
}

export interface IConnector {
  openChannel(
    options: NetConnectOpts,
    tlsOptions?: tls.ConnectionOptions | null,
  ): Promise<stream.Duplex>;
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
  async openChannel(
    options: NetConnectOpts,
    tlsOptions?: tls.ConnectionOptions | null,
  ): Promise<stream.Duplex> {
    return new Promise((resolve, reject) => {
      if (tlsOptions) {
        const client = tls.connect({ ...options, ...tlsOptions }, () => {
          resolve(client);
        });
        client.on("error", (err) => {
          reject(err);
        });
      } else {
        const client = net.connect(options, () => {
          resolve(client);
        });
        client.on("error", (err) => {
          reject(err);
        });
      }
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
      resolve(ChildProcess.spawn(program, argv));
    });
  }
  dispose() {}
}
