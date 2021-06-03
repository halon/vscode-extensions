import protobuf from 'protobufjs';
import rated from '@halon/protobuf-schemas/rated.json';
import smtpd from '@halon/protobuf-schemas/smtpd.json';
import hsh from '@halon/protobuf-schemas/hsh.json';

const programs = {
  rated: rated,
  smtpd: smtpd,
  hsh: hsh
};

export const protobufPacker = (program: string, type: string, payload: any) =>
{
  return new Promise<Uint8Array>((resolve, reject) => {
    if (!programs[program]) {
      reject('Invalid program');
      return;
    }
    const root = protobuf.Root.fromJSON(programs[program]);
    const pbuftype = root.lookupType(type);
    const errMsg = pbuftype.verify(payload);
    if (errMsg) {
      reject(errMsg);
      return;
    }
    const message = pbuftype.create(payload);
    resolve(pbuftype.encode(message).finish());
  });
}

export const protobufLoader = (program: string, type: string, payload: any) =>
{
  return new Promise<any>((resolve, reject) => {
    if (!programs[program]) {
      reject('Invalid program');
      return;
    }
    const root = protobuf.Root.fromJSON(programs[program]);
    const pbuftype = root.lookupType(type);
    const message = pbuftype.decode(payload);
    resolve(pbuftype.toObject(message, {
      longs: Number,
      enums: String,
      defaults: true
    }));
  });
}