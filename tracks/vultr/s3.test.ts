// AWS's published Signature V4 example ("GET Object" with a Range header), so the signer is checked against a
// value we did not compute ourselves.
import assert from 'node:assert/strict';
import test from 'node:test';
import { sign } from './s3.ts';

test('SigV4 matches the AWS documentation example', () => {
  const auth = sign(
    'GET',
    '/test.txt',
    {},
    { host: 'examplebucket.s3.amazonaws.com', range: 'bytes=0-9', 'x-amz-content-sha256': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'x-amz-date': '20130524T000000Z' },
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    '20130524T000000Z',
    { access: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
  );
  assert.match(auth, /Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41$/);
});
