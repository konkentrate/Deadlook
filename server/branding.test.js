import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const file=path=>readFile(new URL('../'+path,import.meta.url));
test('original eye artwork is preserved byte-for-byte',async()=>{
 const svg=await file('assets/branding/backup/deadlook-eye-v1.svg');
 assert.equal(createHash('sha256').update(svg).digest('hex'),'9fa323915e64a6c2c1dc883e4ecd2dc53b2aa08aa5931df44c964928a5ce710a');
 const png=await file('assets/branding/backup/deadlook-header-v1.png');
 assert.equal(png.subarray(1,4).toString(),'PNG');
});
test('current logo artwork is outlined and has no background-colored paint or external fonts',async()=>{
 for(const path of ['deadlook-eye.svg','deadlook-wordmark.svg','deadlook-logo.svg']){
  const svg=(await file('public/'+path)).toString();
  assert.doesNotMatch(svg,/<rect|<text|<image|#1a1a1a|@font-face|font-family/i);
  assert.match(svg,/<path/);assert.match(svg,/viewBox=/);
 }
 const eye=(await file('public/deadlook-eye.svg')).toString();
 assert.match(eye,/fill-rule="evenodd"/);
});
