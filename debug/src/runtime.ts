import * as path from 'path';
import pathIsInside from 'path-is-inside';
import { extensions, workspace, Uri } from 'vscode';
import { EventEmitter } from 'events';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as remote from './remote';
import * as factory from './factory';

interface HSLBreakpoint extends DebugProtocol.Breakpoint {
  logMessage?: string;
  condition?: string;
  hitCondition?: string;
}

export class HSLRuntime extends EventEmitter {
  private _terminate: { () : void } | null = null;
  private _continue: { () : void } | null = null;
  private _debug = true;
  private _currentFile: string = '';
  private _currentLine = 0;
  private _currentColumn = 0;
  private _currentEndColumn = 0;
  private _sourceLines = new Map<string, string[]>();
  private _breakpointId = 1;
  private _breakPoints = new Map<string, HSLBreakpoint[]>();
  private _variables = new Map<number, DebugProtocol.Variable[]>();
  private _variablesReference = 1;
  private _stackFrames = new Array<DebugProtocol.StackFrame>();
  
  constructor() {
    super();
  }
  
  public async start(program: string, debug: boolean = true, plugins: string[] = [], configPath: string | undefined): Promise<void> {
    this._debug = debug;
    this._currentFile = program;

    let extension = extensions.getExtension('Halon.vscode-halon');
    if (!extension) {
      this.sendEvent('end');
      return;
    }
    const build = extension.exports.build;

    const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(program));
    if (typeof workspaceFolder === 'undefined') {
      this.sendEvent('output', '\x1b[31mYou need to have a workspace folder open\x1b[0m\n');
      this.sendEvent('end');
      return;
    }

    const filesPath = path.join(workspaceFolder.uri.fsPath, 'src', 'files');
    if (!pathIsInside(program, filesPath)) {
      this.sendEvent('output', '\x1b[31mOnly files inside the "files" directory can be run\x1b[0m\n');
      this.sendEvent('end');
      return;
    }
    
    const id = path.relative(filesPath, program).split(path.sep).join(path.posix.sep);
    let config: any = {};
    try {
      config = build.generate(workspaceFolder.uri.fsPath);
      if (typeof config.smtpd_app === 'undefined') {
        throw new Error('Missing running configuration');
      }
      if (this._debug) {
        config.smtpd_app.scripting.files = config.smtpd_app.scripting.files.map((file: any) => {
          const filePath = path.join(workspaceFolder.uri.fsPath, 'src', 'files', file.id.split(path.posix.sep).join(path.sep));
          const bps = this._breakPoints.get(filePath);
          if (bps) {
            const srcLines = this._sourceLines.get(filePath);
            if (srcLines) {
              const lines = [...srcLines];
              if (bps) {
                for (const bp of bps) {
                  if (bp.verified && bp.line !== undefined) {
                    lines[bp.line] = `__debug ["", "${bp.id}"] ${lines[bp.line]}`;
                  }
                }
              }
              return {
                ...file,
                data: lines.join('\n')
              };
            } else {
              return file;
            }
          } else {
            return file;
          }
        });
      }
      config.smtpd_app.__entrypoint = 'include "' + id + '";';
    } catch (error) {
      this.sendEvent('output', `\x1b[31m${error.message || error}\x1b[0m`);
      this.sendEvent('end');
      return;
    }

    if (configPath === undefined && config.smtpd !== undefined) {
      configPath = path.join(workspaceFolder.uri.fsPath, 'src', 'config', 'smtpd.yaml');
    }

    const connector = factory.ConnectorFactory();
    remote.hsh(connector, configPath, config.smtpd_app, plugins, (data: string, err: boolean) => {
      this.sendEvent('output', err ? `\x1b[31m${data}\x1b[0m` : data);
    }, (code: number, signal: string) => {
      if (code !== null) {
        if (code === 0) {
          this.sendEvent('output', '\x1b[32mTerminated successfully\x1b[0m\n');
        } else {
          this.sendEvent('output', `\x1b[31mTerminated with return code ${code}\x1b[0m\n`);
        }
      } else if (signal !== undefined) {
        this.sendEvent('output', `\x1b[31mTerminated with ${signal}\x1b[0m\n`);
      }
      this._terminate = null;
      this._continue = null;
      this.sendEvent('end');
    }, (error) => {
      if (error.message !== 'No breakpoint' && error.code !== 'EPIPE' && error.code !== 'ECONNRESET') {
        this.sendEvent('output', `\x1b[31m${error.message || error}\x1b[0m\n`);
      }
    }, (bp) => {
      this._variables.clear();
      this._variablesReference = 1;
      const variablesReference = this._variablesReference;
      const variables: DebugProtocol.Variable[] = [];
      const values: any = Object.entries(JSON.parse(bp.values));
      for (const [index, _value] of values) {
        this._variablesReference = this._variablesReference += 1;
        const value = _value.format === 'json' ? JSON.parse(_value.value) : Buffer.from(_value.value, 'base64').toString('binary');
        const variable = {
          name: index,
          type: value === null ? 'null' : typeof value,
          value: JSON.stringify(value),
          variablesReference: value !== null && typeof value === 'object' ? this._variablesReference : 0
        };
        variables.push(variable);
        this.parseValue(value);
      }
      this._variables.set(variablesReference, variables);
      this._currentLine = bp.location.beginline - 1;
      this._currentColumn = bp.location.begincolumn - 1;
      this._currentEndColumn = bp.location.endcolumn - 1;
      this.stop(parseInt(bp.id));

      this._stackFrames = [];
      const srcLine = this._sourceLines.get(this._currentFile);
      const stackFrame: DebugProtocol.StackFrame = {
        id: 0,
        name: srcLine ? srcLine[this._currentLine].substring(this._currentColumn, this._currentEndColumn) :  '',
        source: { path: this._currentFile },
        line: this._currentLine,
        column: this._currentColumn,
        endColumn: this._currentEndColumn
      };
      this._stackFrames.push(stackFrame);
      if (bp.callstack !== undefined) {
        for (const [index, value] of bp.callstack.reverse().entries()) {
          const stackFrame: DebugProtocol.StackFrame = {
            id: index + 1,
            name: value.function,
            line: 0,
            column: 0
          };
          this._stackFrames.push(stackFrame);
        }
      }
    }).then((commands) => {
      this._terminate = commands.terminate;
      this._continue = commands.continue;
    });
  }

  public continue() {
    if (this._continue) {
      this._continue();
    }
  }

  private stop(id: number): void {
    for (const [sourceFile, breakpoints] of this._breakPoints) {
      this._currentFile = sourceFile;
      if (breakpoints) {
        const bp = breakpoints.find(bp => bp.id === id);
        if (bp && bp.verified) {
          this.sendEvent('stopOnBreakpoint');
          return;
        }
      }
    }
    this.continue();
  }

  public terminate() {
    if (this._terminate) {
      this._terminate();
      this._terminate = null;
    }
    this._continue = null;
    this.sendEvent('end');
  }

  public getVariables(variablesReference: number) {
    return this._variables.get(variablesReference) || [];
  }
  
  public getStackFrames(startFrame: number, endFrame: number) {
    return this._stackFrames.slice(startFrame, endFrame);
  }
  
  public async setBreakPoints(path: string, breakpoints: DebugProtocol.SourceBreakpoint[]): Promise<HSLBreakpoint[]> {
    let oldBps = this._breakPoints.get(path);
    let newBps = new Array<HSLBreakpoint>();
  
    for (const breakpoint of breakpoints) {
      let bp = oldBps ? oldBps.find((bp) => bp.line === breakpoint.line) : undefined;
      if (!bp) {
        bp = {
          id: this._breakpointId++,
          verified: false,
          ...breakpoint
        };
      }
      newBps.push(bp);
    }

    this._breakPoints.set(path, newBps);
    
    if (!this._terminate) {
      await this.verifyBreakpoints(path);
    }
    
    return newBps;
  }
  
  private async verifyBreakpoints(path: string): Promise<void> {
    if (!this._debug) {
      return;
    }
    
    const bps = this._breakPoints.get(path);
    if (bps) {
      if (!this._sourceLines.get(path)) {
        const uri = Uri.file(path);
        const bytes = await workspace.fs.readFile(uri);
        const contents = Buffer.from(bytes).toString('utf8');
        this._sourceLines.set(path, contents.split(/\r?\n/));
      }
      for (const bp of bps) {
        const srcLines = this._sourceLines.get(path);
        if (srcLines) {
          if (!bp.verified && bp.line !== undefined && bp.line < srcLines.length && bp.logMessage === undefined && bp.condition === undefined && bp.hitCondition === undefined) {
            bp.verified = true;
            this.sendEvent('breakpointValidated', bp);
          }
        }
      }
    }
  }

  private parseValue(value: any) {
    if (value !== null && typeof value === 'object') {
      const variables: DebugProtocol.Variable[] = [];
      const variablesReference = this._variablesReference;
      const values = Array.isArray(value) ? value.entries() : Object.entries(value);
      for (const [index, value] of values) {
        this._variablesReference = this._variablesReference + 1;
        const variable = {
          name: index.toString(),
          type: value === null ? 'null' : typeof value,
          value: JSON.stringify(value),
          variablesReference: value !== null && typeof value === 'object' ? this._variablesReference : 0
        };
        variables.push(variable);
        this.parseValue(value);
      }
      this._variables.set(variablesReference, variables);
    }
  }
  
  private sendEvent(event: string, ... args: any[]) {
    setImmediate(() => {
      this.emit(event, ...args);
    });
  }
}
