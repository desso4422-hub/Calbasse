/// <reference types="node" />
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

const racine = new URL('../../../', import.meta.url).pathname;

test('les fichiers à coller dans Supabase (supabase/installation) sont à jour', { skip: !existsSync(`${racine}server/node_modules/.bin/esbuild`) && 'esbuild absent' }, () => {
  const r = spawnSync(process.execPath, [`${racine}scripts/preparer-installation.mjs`, '--verifier'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `${r.stderr} Lance « npm run installation ».`);
});
