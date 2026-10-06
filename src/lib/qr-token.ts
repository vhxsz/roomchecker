import { createHmac, timingSafeEqual } from "node:crypto";

export type StudentQrPayload = { sub: string; studentCode: string; roomId: string; roomNumber: string; iat: number; exp: number };

function secret() {
  const value = process.env.QR_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error("QR_SIGNING_SECRET must contain at least 32 characters");
  return value;
}

function sign(encoded: string) {
  return createHmac("sha256", secret()).update(encoded).digest("base64url");
}

export function createStudentQrToken(payload: StudentQrPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyStudentQrToken(token: string): StudentQrPayload | null {
 try {
  if(token.length>4096)return null;
  const parts=token.split(".");
  if(parts.length!==2)return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;
  const expected = Buffer.from(sign(encoded));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as StudentQrPayload;
  const now=Math.floor(Date.now()/1000);
  if (typeof payload.sub!=="string" || typeof payload.roomId!=="string" || !payload.sub || !payload.roomId || !Number.isInteger(payload.exp) || !Number.isInteger(payload.iat) || payload.exp<=now || payload.iat>now+5 || payload.exp-payload.iat>30 || payload.exp<=payload.iat) return null;
  return payload;
 }catch{return null;}
}
