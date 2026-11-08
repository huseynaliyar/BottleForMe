import assert from 'node:assert/strict';
import test from 'node:test';
import { isAdminUser } from '../lib/admin-policy';

test('admin access defaults to deny and requires an exact allowlisted account ID', () => {
  const admin = '11223344-abcd-4321-abcd-112233445566';
  const other = '88776655-1234-4321-1234-665544332211';
  assert.equal(isAdminUser(admin), false);
  assert.equal(isAdminUser(admin, ',  ,'), false);
  assert.equal(isAdminUser('', ','), false);
  assert.equal(isAdminUser(other, admin), false);
  assert.equal(isAdminUser(admin, 'prefix-' + admin), false);
  assert.equal(isAdminUser(admin, other + ', ' + admin.toUpperCase()), true);
});
