import { Client, ClientChannel } from 'ssh2';
import net from 'net';
import * as stream from 'stream';
import { EventEmitter } from 'events';
import * as child_process from 'child_process';

export interface ExecProgram extends EventEmitter
{
  stdin: stream.Writable
  stdout: stream.Readable
  stderr: stream.Readable
}

export interface IConnector
{
  openChannel: (path: string) => Promise<stream.Duplex>
  openServerChannel: (path: string, callback: (stream: stream.Duplex) => void) => any
  closeServerChannel: (server: any) => void
  exec: (program: string, argv: string[]) => Promise<ExecProgram>
  dispose: () => void
}

export const ConnectorFactory = (settings: any) =>
{
  if (settings.ssh2)
    return new SSH2Connector(settings.ssh2);
  return new UNIXConnector();
}

export class SSH2Connector implements IConnector
{
  settings: any;
  connected: boolean;
  conn?: Client;

  constructor(settings: any)
  {
    this.settings = settings;
    this.connected = false;
  }
  async connect(settings: any)
  {
    return new Promise<Client>((resolve, reject) => {
      var conn = new Client();
      conn.on('error', (err) => {
        conn.end();
        this.connected = false;
        reject(err);
      });
      conn.on('close', () => {
        this.connected = false;
      });
      conn.on('ready', () => {
        this.connected = true;
        resolve(conn);
      });
      conn.connect(settings);
    });
  }
  async openServerChannel(path: string, callback: (stream: stream.Duplex) => void)
  {
    return new Promise<any>(async (resolve, reject) => {
      if (!this.conn || !this.connected)
        this.conn = await this.connect(this.settings);
      this.conn.openssh_forwardInStreamLocal(path, (err) => {
        reject(err);
      });
      this.conn.on('unix connection', (info: any, accept: any, reject: any) => {
        callback(accept());
      });
      resolve(path);
    });
  }
  closeServerChannel(server: any)
  {
    if (this.conn && this.connected)
      this.conn.openssh_unforwardInStreamLocal(server);
  }
  async openChannel(path: string)
  {
    if (!this.conn || !this.connected)
      this.conn = await this.connect(this.settings);
    return new Promise<ClientChannel>((resolve, reject) => {
      if (!this.conn) reject('No open connection');
      else this.conn.openssh_forwardOutStreamLocal(path, (err, stream) => {
        if (err) reject(err);
        resolve(stream);
      });
    });
  }
  async exec(program: string, argv: string[])
  {
    if (!this.conn || !this.connected)
      this.conn = await this.connect(this.settings);
    return new Promise<ExecProgram>((resolve, reject) => {
      if (!this.conn) reject('No open connection');
      else this.conn.exec(program + " " + argv.join(" "), (err, stream) => {
        if (err) reject(err);
        resolve(stream);
      });
    });
  }
  dispose()
  {
    if (this.conn && this.connected) {
      this.conn.end();
    }
  }
}

export class UNIXConnector implements IConnector
{
  openChannel(path: string)
  {
    return new Promise<stream.Duplex>((resolve, reject) => {
      const client = net.createConnection({ path: path }, async () => {
        resolve(client);
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