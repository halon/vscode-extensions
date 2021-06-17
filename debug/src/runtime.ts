import * as path from 'path';
import pathIsInside from 'path-is-inside';
import { extensions, workspace, Uri, WorkspaceFolder } from 'vscode';
import { EventEmitter } from 'events';
import { DebugProtocol } from 'vscode-debugprotocol';
import * as remote from './remote';
import * as factory from './factory';
import { HSLLaunchRequestArguments } from './debug';
import { v4 as uuidv4 } from 'uuid';
import * as smtpd_pb from '@halon/protobuf-schemas/js/smtpd_pb';
import * as hsh_pb from '@halon/protobuf-schemas/js/hsh_pb';
import { Smtpd } from '@halon/json-schemas/ts/smtpd';
import { SmtpdApp } from '@halon/json-schemas/ts/smtpd-app';

export interface SmtpdAppDebug extends SmtpdApp {
  __entrypoint?: string;
}

interface HSLBreakpoint extends DebugProtocol.Breakpoint {
  logMessage?: string;
  condition?: string;
  hitCondition?: string;
}

export class HSLRuntime extends EventEmitter {
  private _debug: boolean = true;
  private _debugId: string | undefined;
  private _workspaceFolder: WorkspaceFolder | undefined;
  private _currentFile: string | undefined;
  private _currentLine = 0;
  private _currentEndLine: number | undefined;
  private _currentColumn = 0;
  private _currentEndColumn: number | undefined;
  private _sourceLines = new Map<string, string[]>();
  private _breakpointId = 1;
  private _breakPoints = new Map<string, HSLBreakpoint[]>();
  private _variables = new Map<number, DebugProtocol.Variable[]>();
  private _variablesReference = 1;
  private _stackFrames = new Array<DebugProtocol.StackFrame>();
  private _exceptionFilters: string[] = [];
  private _uncaughtException: boolean = true;
  private _exceptionMessage: string = '';
  private _terminate: { () : void } | null = null;
  private _continue: { () : void } | null = null;
  
  constructor() {
    super();
  }
  
  public async start(args: HSLLaunchRequestArguments): Promise<void> {
    if (args.type !== 'hsl' && args.type !== 'halon') {
      this.sendEvent('output', '\x1b[31mUnsupported type\x1b[0m\n');
      this.sendEvent('end');
      return;
    }

    this._debug = args.debug !== undefined ? args.debug : this._debug;
  
    if (args.type === 'halon') {
      this._debugId = args.debugId || uuidv4();
    }

    if (args.folder === undefined) {
      this.sendEvent('output', '\x1b[31mNo workspace folder found\x1b[0m\n');
      this.sendEvent('end');
      return;
    }

    this._workspaceFolder = workspace.getWorkspaceFolder(Uri.file(args.folder));

    if (this._workspaceFolder === undefined) {
      this.sendEvent('output', '\x1b[31mNo workspace folder found\x1b[0m\n');
      this.sendEvent('end');
      return;
    }

    if (args.type === 'hsl') {
      const filesPath = path.join(this._workspaceFolder.uri.fsPath, 'src', 'files');
      if (!pathIsInside(args.program as string, filesPath)) {
        this.sendEvent('output', '\x1b[31mOnly files inside the "files" directory can be run\x1b[0m\n');
        this.sendEvent('end');
        return;
      }
    }

    let config: { smtpd?: Smtpd, smtpd_app?: SmtpdAppDebug };
    try {
      config = this.generateConfig(this._workspaceFolder);
    } catch (error) {
      this.sendEvent('output', `\x1b[31m${error.message || error}\x1b[0m`);
      this.sendEvent('end');
      return;
    }

    if (config.smtpd_app === undefined) {
      this.sendEvent('output', `\x1b[31mMissing running configuration\x1b[0m`);
      this.sendEvent('end');
      return;
    }

    if (args.type === 'hsl') {
      const filesPath = path.join(this._workspaceFolder.uri.fsPath, 'src', 'files');
      const id = path.relative(filesPath, args.program as string).split(path.sep).join(path.posix.sep);
      config.smtpd_app.__entrypoint = 'include "' + id + '";';
    }

    const connector = factory.ConnectorFactory();

    if (args.type === 'halon') {
      remote.smtpd(connector, config.smtpd_app, this._debugId as string, args.conditions, (data: string, error: boolean) => {
        this.sendEvent('output', error ? `\x1b[31m${data}\x1b[0m` : data);
      }, (error) => {
        this.sendEvent('output', `\x1b[31m${error.message || error}\x1b[0m\n`);
        if (error.message !== 'Aborted') {
          this.sendEvent('end');
        }
      }, (bp) => {
        if (this.findBreakPoint(parseInt(bp.getId()))) {
          this.parseBreakPoint(bp);
          this.parseStackFrames(bp.getCallstackList());
          this.sendEvent('stopOnBreakpoint');
        } else if (!bp.getId()) {
            this.parseBreakPoint(bp);
            this.parseStackFrames(bp.getCallstackList());
            if (this._exceptionFilters.includes(this._uncaughtException ? 'uncaughtExceptions' : 'caughtExceptions')) {
              this.sendEvent('stopOnException');
            } else {
              this.continue();
            }
        } else {
          this.continue();
        }
      }).then((commands) => {
        this._terminate = commands.terminate;
        this._continue = commands.continue;
      });
    }

    if (args.type === 'hsl') {
      let configPath = args.config;
      if (configPath === undefined && config.smtpd !== undefined) {
        configPath = path.join(this._workspaceFolder.uri.fsPath, 'src', 'config', 'smtpd.yaml');
      }
  
      remote.hsh(connector, config.smtpd_app, configPath, args.plugins, (data: string, error: boolean) => {
        this.sendEvent('output', error ? `\x1b[31m${data}\x1b[0m` : data);
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
        if (error.message !== 'No breakpoint') {
          this.sendEvent('output', `\x1b[31m${error.message || error}\x1b[0m\n`);
        }
      }, (bp) => {
        if (this.findBreakPoint(parseInt(bp.getId()))) {
          this.parseBreakPoint(bp);
          this.parseStackFrames(bp.getCallstackList());
          this.sendEvent('stopOnBreakpoint');
        } else if (!bp.getId()) {
            this.parseBreakPoint(bp);
            this.parseStackFrames(bp.getCallstackList());
            if (this._exceptionFilters.includes(this._uncaughtException ? 'uncaughtExceptions' : 'caughtExceptions')) {
              this.sendEvent('stopOnException');
            } else {
              this.continue();
            }
        } else {
          this.continue();
        }
      }).then((commands) => {
        this._terminate = commands.terminate;
        this._continue = commands.continue;
      });
    }
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

  public setExceptionsFilters(exceptionFilters: string[]): void {
		this._exceptionFilters = exceptionFilters;
	}

  public getExceptionMessage() {
		return this._exceptionMessage;
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

  private parseBreakPoint(bp: smtpd_pb.HSLBreakPointResponse | hsh_pb.HSLBreakPointResponse) {
    this._variables.clear();
    this._variablesReference = 1;
    const variablesReference = this._variablesReference;
    const variables: DebugProtocol.Variable[] = [];
    const values: any = Object.entries(JSON.parse(bp.getValues()));
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
      if (index === '__throw') {
        this._uncaughtException = _value.uncaught;
        this._exceptionMessage = _value.message !== undefined ? _value.message : '';
      }
      this.parseBreakPointValue(value);
    }
    this._variables.set(variablesReference, variables);
    const location = bp.getLocation();
    this._currentLine = location !== undefined ? location.getBeginline() - 1 : 0;
    this._currentEndLine = location !== undefined ? location.getEndline() - 1 : undefined;
    this._currentColumn = location !== undefined ? location.getBegincolumn() - 1 : 0;
    this._currentEndColumn = location !== undefined ? location.getEndcolumn() - 1 : undefined;
    if (!bp.getId()) {
      if (this._workspaceFolder && location && location.getId() && location.getType() === '') {
        this._currentFile = path.join(this._workspaceFolder.uri.fsPath, 'src', 'files', location.getId().split(path.posix.sep).join(path.sep));
      } else {
        this._currentFile = undefined;
      }
    }
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

  private parseStackFrames(callstack: Array<hsh_pb.HSLBreakPointResponse.Callstack | hsh_pb.HSLBreakPointResponse.Callstack>) {
    this._stackFrames = [];
    const stackFrame: DebugProtocol.StackFrame = {
      id: 0,
      name: '0',
      source: this._currentFile ? { path: this._currentFile } : undefined,
      line: this._currentLine,
      endLine: this._currentEndLine,
      column: this._currentColumn,
      endColumn: this._currentEndColumn
    };
    this._stackFrames.push(stackFrame);
    if (callstack !== undefined) {
      for (const [index, value] of callstack.reverse().entries()) {
        const stackFrame: DebugProtocol.StackFrame = {
          id: index + 1,
          name: value.getFunction(),
          line: 0,
          column: 0
        };
        this._stackFrames.push(stackFrame);
      }
    }
  }

  private generateConfig(workspaceFolder: WorkspaceFolder) {
    let extension = extensions.getExtension('Halon.vscode-halon');
    if (!extension) {
      throw new Error('Missing extension');
    }
    const build = extension.exports.build;
  
    const config: { smtpd?: Smtpd, smtpd_app?: SmtpdAppDebug } = build.generate(workspaceFolder.uri.fsPath);

    if (config.smtpd_app) {
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
              config.smtpd_app.scripting.hooks[hook] = config.smtpd_app.scripting.hooks[hook].map((file: { id: string, data: string }) => {
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
          config.smtpd_app.scripting.files = config.smtpd_app.scripting.files.map((file) => {
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
    }

    return config;
  }
  
  private sendEvent(event: string, ... args: any[]) {
    setImmediate(() => {
      this.emit(event, ...args);
    });
  }
}
