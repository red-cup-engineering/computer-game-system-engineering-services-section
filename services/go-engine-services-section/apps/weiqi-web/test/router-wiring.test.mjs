// Guards weiqi.561.group's Cloudflare wiring after the 2026-08-31 GCP exit: weiqi.561.group is
// its own tiny Workers-static-assets site (own wrangler.jsonc, own custom_domain route), never
// proxied through the shared cloudflare-router's Cloud Run map -- that router carries no
// Cloud Run origin for weiqi.561.group any more (removed outright, not shimmed). This does not
// test deployment (see the root session's deploy record); it only proves the source is
// internally consistent before anyone runs `wrangler deploy`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(HERE, '..');
test('both Weiqi public receivers bind to the same static-assets Worker', async () => {
  const wrangler = JSON.parse(await readFile(path.join(SITE_ROOT, 'wrangler.jsonc'), 'utf8'));
  const acceptedHosts = ['weiqi.561.group', 'weiqi.play.561.group'];
  assert.deepEqual(wrangler.routes.map((route) => route.pattern).sort(), acceptedHosts.sort());
  for (const hostname of acceptedHosts) {
    const route = wrangler.routes.find((candidate) => candidate.pattern === hostname);
    assert.equal(route?.custom_domain, true, `expected an exact custom domain for ${hostname}`);
  }
  assert.ok(wrangler.assets && typeof wrangler.assets.directory === 'string', 'expected an assets.directory binding');
});
