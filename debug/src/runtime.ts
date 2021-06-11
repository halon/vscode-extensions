import * as path from 'path';
import pathIsInside from 'path-is-inside';
import { extensions, workspace, Uri } from 'vscode';
import { EventEmitter } from 'events';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as remote from './remote';
import * as factory from './factory';
import { HSLLaunchRequestArguments } from './debug';

interface HSLBreakpoint extends DebugProtocol.Breakpoint {
  logMessage?: string;
  condition?: string;
  hitCondition?: string;
}

export class HSLRuntime extends EventEmitter {
  private _debugId: string | undefined;
  private _debug: boolean = true;
  private _currentFile: string | undefined;
  private _currentLine = 0;
  private _currentColumn = 0;
  private _currentEndColumn = 0;
  private _sourceLines = new Map<string, string[]>();
  private _breakpointId = 1;
  private _breakPoints = new Map<string, HSLBreakpoint[]>();
  private _variables = new Map<number, DebugProtocol.Variable[]>();
  private _variablesReference = 1;
  private _stackFrames = new Array<DebugProtocol.StackFrame>();
  private _terminate: { () : void } | null = null;
  private _continue: { () : void } | null = null;
  
  constructor() {
    super();
  }
  
  public async start(args: HSLLaunchRequestArguments): Promise<void> {
    this._debugId = args.debugId;
    this._debug = args.debug !== undefined ? args.debug : this._debug;

    let extension = extensions.getExtension('Halon.vscode-halon');
    if (!extension) {
      this.sendEvent('end');
      return;
    }
    const build = extension.exports.build;

    const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(args.program));
    if (typeof workspaceFolder === 'undefined') {
      this.sendEvent('output', '\x1b[31mYou need to have a workspace folder open\x1b[0m\n');
      this.sendEvent('end');
      return;
    }

    if (args.type === 'hsl') {
      const filesPath = path.join(workspaceFolder.uri.fsPath, 'src', 'files');
      if (!pathIsInside(args.program, filesPath)) {
        this.sendEvent('output', '\x1b[31mOnly files inside the "files" directory can be run\x1b[0m\n');
        this.sendEvent('end');
        return;
      }
    }
    
    let config: any = {};

    try {
      config = build.generate(workspaceFolder.uri.fsPath);
      if (config.smtpd_app === undefined) {
        throw new Error('Missing running configuration');
      }
    } catch (error) {
      this.sendEvent('output', `\x1b[31m${error.message || error}\x1b[0m`);
      this.sendEvent('end');
      return;
    }

    if (this._debug && config.smtpd_app.scripting !== undefined) {
      if (config.smtpd_app.scripting.hooks !== undefined) {
        for (const hook of Object.keys(config.smtpd_app.scripting.hooks)) {
          if (hook === 'predelivery' || hook === 'postdelivery') {
            const filePath = path.join(workspaceFolder.uri.fsPath, 'src', 'hooks', 'queue', `${hook}.hsl`);
            const bps = this._breakPoints.get(filePath);
            const srcLines = this._sourceLines.get(filePath);
            if (bps && srcLines) {
              config.smtpd_app.scripting.hooks[hook] = this.applyBreakPoints(bps, srcLines);
            }
          } else {
            config.smtpd_app.scripting.hooks[hook] = config.smtpd_app.scripting.hooks[hook].map((file: any) => {
              const filePath = path.join(workspaceFolder.uri.fsPath, 'src', 'hooks', hook, file.id.split(path.posix.sep).join(path.sep) + '.hsl');
              const bps = this._breakPoints.get(filePath);
              const srcLines = this._sourceLines.get(filePath);
              if (bps && srcLines) {
                return { ...file, data: this.applyBreakPoints(bps, srcLines) };
              } else {
                return file;
              }
            });
          }
        }
      }
      if (config.smtpd_app.scripting.files !== undefined) {
        config.smtpd_app.scripting.files = config.smtpd_app.scripting.files.map((file: any) => {
          const filePath = path.join(workspaceFolder.uri.fsPath, 'src', 'files', file.id.split(path.posix.sep).join(path.sep));
          const bps = this._breakPoints.get(filePath);
          const srcLines = this._sourceLines.get(filePath);
          if (bps && srcLines) {
            return { ...file, data: this.applyBreakPoints(bps, srcLines) };
          } else {
            return file;
          }
        });
      }
    }

    if (args.type === 'hsl') {
      const filesPath = path.join(workspaceFolder.uri.fsPath, 'src', 'files');
      const id = path.relative(filesPath, args.program).split(path.sep).join(path.posix.sep);
      config.smtpd_app.__entrypoint = 'include "' + id + '";';
    }

    let configPath = args.config;
    if (configPath === undefined && config.smtpd !== undefined) {
      configPath = path.join(workspaceFolder.uri.fsPath, 'src', 'config', 'smtpd.yaml');
    }

    const connector = factory.ConnectorFactory();
    remote.hsh(connector, configPath, config.smtpd_app, args.plugins, (data: string, err: boolean) => {
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
      this.sendEvent('end');
    }, (error) => {
      if (error.message !== 'No breakpoint' && error.code !== 'EPIPE' && error.code !== 'ECONNRESET') {
        this.sendEvent('output', `\x1b[31m${error.message || error}\x1b[0m\n`);
      }
    }, (bp) => {
      if (this.findBreakPoint(parseInt(bp.id))) {
        this.parseBreakPoint(bp);
        this.parseStackFrames(bp.callstack);
        this.sendEvent('stopOnBreakpoint');
      } else {
        this.continue();
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

  public terminate() {
    if (this._terminate) {
      this._terminate();
    }
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
      await this.verifyBreakPoints(path);
    }
    
    return newBps;
  }
  
  private async verifyBreakPoints(path: string): Promise<void> {
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

  private applyBreakPoints(bps: HSLBreakpoint[], srcLines: string[]) {
    const lines = [...srcLines];
    for (const bp of bps) {
      if (bp.verified && bp.line !== undefined) {
        lines[bp.line] = `__debug ["${this._debugId}", "${bp.id}"] ${lines[bp.line]}`;
      }
    }
    return lines.join('\n');
  }

  private parseBreakPoint(bp: any) {
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
      this.parseBreakPointValue(value);
    }
    this._variables.set(variablesReference, variables);
    this._currentLine = bp.location.beginline - 1;
    this._currentColumn = bp.location.begincolumn - 1;
    this._currentEndColumn = bp.location.endcolumn - 1;
  }

  private parseBreakPointValue(value: any) {
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
        this.parseBreakPointValue(value);
      }
      this._variables.set(variablesReference, variables);
    }
  }

  private findBreakPoint(id: number) {
    for (const [sourceFile, breakpoints] of this._breakPoints) {
      if (breakpoints) {
        const bp = breakpoints.find(bp => bp.id === id);
        if (bp && bp.verified) {
          this._currentFile = sourceFile;
          return true;
        }
      }
    }
    return false;
  }

  private parseStackFrames(callstack: any) {
    this._stackFrames = [];
    const srcLine = this._currentFile ? this._sourceLines.get(this._currentFile) : '';
    const stackFrame: DebugProtocol.StackFrame = {
      id: 0,
      name: srcLine ? srcLine[this._currentLine].substring(this._currentColumn, this._currentEndColumn) : '',
      source: { path: this._currentFile },
      line: this._currentLine,
      column: this._currentColumn,
      endColumn: this._currentEndColumn
    };
    this._stackFrames.push(stackFrame);
    if (callstack !== undefined) {
      for (const [index, value] of callstack.reverse().entries()) {
        const stackFrame: DebugProtocol.StackFrame = {
          id: index + 1,
          name: value.function,
          line: 0,
          column: 0
        };
        this._stackFrames.push(stackFrame);
      }
    }
  }
  
  private sendEvent(event: string, ... args: any[]) {
    setImmediate(() => {
      this.emit(event, ...args);
    });
  }
}
