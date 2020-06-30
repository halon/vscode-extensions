import protobuf from "protobufjs";
import path from "path";
import fs from "fs";

export const findProtobufRoot = () : string[] =>
{
  if (fs.existsSync(path.join(__dirname, "..", "node_modules", "@halon", "protobuf-schemas"))) {
    return [__dirname, "..", "node_modules", "@halon", "protobuf-schemas"];
  } else {
    return [__dirname, "..", "..", "protobuf-schemas"];
  }
}

export const protobufPacker = async (file: string, type: string, payload: any) =>
{
  return new Promise<Buffer>((resolve, reject) => {
    protobuf.load(path.join(...findProtobufRoot(), file), (err, root: any) => {
      if (err) reject(err);
      const pbuftype = root.lookupType(type);
      const errMsg = pbuftype.verify(payload);
      if (errMsg) reject(errMsg);
      const message = pbuftype.create(payload);
      resolve(pbuftype.encode(message).finish());
    });
  });
}

export const protobufLoader = async (file: string, type: string, payload: any) =>
{
  return new Promise<any>((resolve, reject) => {
    protobuf.load(path.join(...findProtobufRoot(), file), (err, root: any) => {
      if (err) reject(err);
      const pbuftype = root.lookupType(type);
      const message = pbuftype.decode(payload);
      resolve(pbuftype.toObject(message, {
          longs: Number,
          enums: String,
          defaults: true
        }));
    });
  });
}