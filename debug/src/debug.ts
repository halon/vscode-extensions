import * as path from 'path';
import {
  DebugSession,
  InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent,
  Thread, Scope, Source
} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { HSLRuntime } from './runtime';
import { Subject } from 'await-notify';

interface HSLLaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
  program: string;
  debug?: boolean;
  plugins?: string[];
  config?: string;
}

export class HSLLoggingDebugSession extends DebugSession {
  private static threadID = 1;
  private _runtime: HSLRuntime;
  private _configurationDone = new Subject();
  
  public constructor() {
    super();

    this.setDebuggerLinesStartAt1(false);
    this.setDebuggerColumnsStartAt1(false);
    
    this._runtime = new HSLRuntime();

    this._runtime.on('stopOnBreakpoint', () => {
      this.sendEvent(new StoppedEvent('breakpoint', HSLLoggingDebugSession.threadID));
    });

    this._runtime.on('breakpointValidated', (bp: DebugProtocol.Breakpoint) => {
      const line = bp.line !== undefined ? this.convertDebuggerLineToClient(bp.line) : undefined;
      this.sendEvent(new BreakpointEvent('changed', {
        ...bp,
        line: line
      } as DebugProtocol.Breakpoint));
    });

    this._runtime.on('output', (text, filePath, line, column) => {
      const event: DebugProtocol.OutputEvent = new OutputEvent(text);
      if (filePath) event.body.source = new Source(path.basename(filePath), this.convertDebuggerPathToClient(filePath));
      if (line) event.body.line = this.convertDebuggerLineToClient(line);
      if (column) event.body.column = this.convertDebuggerColumnToClient(column);
      this.sendEvent(event);
    });

    this._runtime.on('end', () => {
      this.sendEvent(new TerminatedEvent());
    });
  }
  
  protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
    response.body = response.body || {};
    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsTerminateRequest = true;
    this.sendResponse(response);
    this.sendEvent(new InitializedEvent());
  }
  
  protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
    super.configurationDoneRequest(response, args);
    this._configurationDone.notify();
  }
  
  protected async launchRequest(response: DebugProtocol.LaunchResponse, args: HSLLaunchRequestArguments) {
    await this._configurationDone.wait(1000);
    await this._runtime.start(args.program, args.debug, args.plugins, args.config);
    this.sendResponse(response);
  }
  
  protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {
    const bps = await this._runtime.setBreakPoints(args.source.path as string, args.breakpoints ? args.breakpoints.map((bp) => ({
      ...bp,
      line: this.convertClientLineToDebugger(bp.line)
    })) : []);

    response.body = {
      breakpoints: bps.map((bp) => {
        const line = bp.line !== undefined ? this.convertDebuggerLineToClient(bp.line) : undefined;
        return {
          ...bp,
          line: line
        };
      })
    };
    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [new Thread(HSLLoggingDebugSession.threadID, 'thread 1')] };
    this.sendResponse(response);
  }
  
  protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
    const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
    const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
    const endFrame = startFrame + maxLevels;
    const stackFrames = this._runtime.getStackFrames(startFrame, endFrame);
    response.body = {
      stackFrames: stackFrames.map((stackFrame) => ({
        ...stackFrame,
        line: stackFrame.source !== undefined ? this.convertDebuggerLineToClient(stackFrame.line) : 0,
        column: stackFrame.source !== undefined ? this.convertDebuggerColumnToClient(stackFrame.column) : 0,
        endColumn: stackFrame.endColumn !== undefined ? this.convertDebuggerColumnToClient(stackFrame.endColumn) : undefined,
        source: stackFrame.source !== undefined ? {
          path: stackFrame.source.path !== undefined ? this.convertDebuggerPathToClient(stackFrame.source.path) : undefined
        } : undefined
      }))
    };
    this.sendResponse(response);
  }
  
  protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
    response.body = { scopes: [new Scope('Local', 1, false)] };
    this.sendResponse(response);
  }
  
  protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request) {
    response.body = { variables: this._runtime.getVariables(args.variablesReference) };
    this.sendResponse(response);
  }
  
  protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
    this._runtime.continue();
    this.sendResponse(response);
  }
  
  protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
    this._runtime.continue();
    this.sendResponse(response);
  }
  
  protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
    this._runtime.continue();
    this.sendResponse(response);
  }
  
  protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
    this._runtime.continue();
    this.sendResponse(response);
  }
  
  protected terminateRequest(response: DebugProtocol.TerminateResponse, args: DebugProtocol.TerminateArguments): void {
    this._runtime.terminate();
    this.sendResponse(response);
  }
}
