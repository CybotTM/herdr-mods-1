import assert from 'node:assert/strict';
import { parseRows, age, resumeArgv } from './logic.mjs';
assert.deepEqual(resumeArgv('hermes', 'local-123'), ['hermes', '--resume', 'local-123']);
assert.deepEqual(resumeArgv('pig', 'abcd'), ['pig', '--session', 'abcd']);
assert.equal(resumeArgv('pi', 'bad;cmd'), null);
assert.equal(age(100, 100 + 2 * 86400), '2d');
assert.deepEqual(parseRows('[{"app":"pi","id":"abcd","timestamp":1},{"app":"hermes","id":"efgh","timestamp":3}]').map(x => x.id), ['efgh','abcd']);
assert.deepEqual(parseRows('not json'), []);
console.log('sessions logic ok');
