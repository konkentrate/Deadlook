import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBuild, encodeBuild } from './hero-build-codec.ts';

test('clipboard build codec round-trips categories, item annotations, and opaque ability order', async () => {
  const original = {
    heroId: 123,
    name: 'Browser build',
    description: 'A test build',
    categories: [{
      name: 'Core', description: 'Buy these first', width: 2, height: 3, optional: true,
      items: [{ itemId: 456, annotation: 'early', flex: true, sellPriority: 2, imbueTarget: 789 }]
    }],
    // Opaque nested protobuf payload. The editor preserves but does not interpret it.
    abilityOrder: [0x0a, 0x04, 0x08, 0x01, 0x10, 0x01]
  };
  const code = await encodeBuild(original);
  const compressed = Uint8Array.from(atob(code), c => c.charCodeAt(0));
  assert.deepEqual([...compressed.slice(0, 4)], [0x28, 0xb5, 0x2f, 0xfd]);
  const decoded = await decodeBuild(code);
  assert.deepEqual(decoded, original);
});

test('clipboard codec rejects text that is not a compressed build', async () => {
  await assert.rejects(decodeBuild('not a build'), /build code|base64|header|zstd/i);
});
