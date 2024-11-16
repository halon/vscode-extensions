import yaml from "yaml";
import { IConnector } from "./factory";

const hsllint_program = "/opt/halon/bin/hsl-lint";

export const syntax = (connector: IConnector, syntax: any) => {
  return new Promise(async (resolve, reject) => {
    var stderr = Buffer.alloc(0);
    var program = await connector.exec(hsllint_program, []);
    program.on("close", (code: number, signal: string) => {
      switch (code) {
        case 0:
          resolve(undefined);
          break;
        case 1:
          resolve(yaml.parse(stderr.toString()));
          break;
        default:
          reject(
            new Error(
              "hsl-lint exited with code: " +
                code +
                ", stderr: " +
                stderr.toString(),
            ),
          );
      }
    });
    program.on("data", (data: Buffer) => {
      console.log(data);
    });
    program.stderr.on("data", (data: Buffer) => {
      stderr = Buffer.concat([stderr, data]);
    });
    program.stdin.end(yaml.stringify(syntax));
  });
};
