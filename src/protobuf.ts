import protobuf from 'protobufjs';
import path from 'path';

export const protobufPacker = (file: string, type: string, payload: any) =>
{
  return new Promise<Buffer>((resolve, reject) => {
    protobuf.load(path.join(__dirname, '/protobuf-schemas/', file), (err, root: any) => {
      if (err) {
        reject(err);
        return;
      }
      const pbuftype = root.lookupType(type);
      const errMsg = pbuftype.verify(payload);
      if (errMsg) {
        reject(errMsg);
        return;
      }
      const message = pbuftype.create(payload);
      resolve(pbuftype.encode(message).finish());
    });
  });
}

export const protobufLoader = (file: string, type: string, payload: any) =>
{
  return new Promise<any>((resolve, reject) => {
    protobuf.load(path.join(__dirname, '/protobuf-schemas/', file), (err, root: any) => {
      if (err) {
        reject(err);
        return;
      }
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