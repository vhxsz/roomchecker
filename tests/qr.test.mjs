import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStudentQrToken,verifyStudentQrToken} from '../src/lib/qr-token.ts';
process.env.QR_SIGNING_SECRET='test-secret-never-used-in-production-123456789';
const now=Math.floor(Date.now()/1000);
const payload={sub:'student-id',studentCode:'KWC-123',roomId:'room-id',roomNumber:'101',iat:now,exp:now+30};
test('Signed QR validates student identity and expires',()=>{
 assert.deepEqual(verifyStudentQrToken(createStudentQrToken(payload)),payload);
 assert.equal(verifyStudentQrToken(createStudentQrToken({...payload,iat:now-60,exp:now-30})),null);
 assert.equal(verifyStudentQrToken(createStudentQrToken({...payload,exp:now})),null);
});
test('Tampered, malformed, oversized and extended QR credentials fail safely',()=>{
 const token=createStudentQrToken(payload);
 assert.equal(verifyStudentQrToken(token+'extra'),null);
 assert.equal(verifyStudentQrToken(token+'.third'),null);
 assert.equal(verifyStudentQrToken('invalid'),null);
 assert.equal(verifyStudentQrToken('a'.repeat(5000)),null);
 assert.equal(verifyStudentQrToken(createStudentQrToken({...payload,exp:now+3600})),null);
 assert.equal(verifyStudentQrToken(createStudentQrToken({...payload,iat:now+100,exp:now+130})),null);
});
