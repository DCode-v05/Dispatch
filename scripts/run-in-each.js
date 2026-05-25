#!/usr/bin/env node
/**
 * Runs an npm script in every workspace (5 services + frontend).
 * Usage: node scripts/run-in-each.js <script-name> [-- extra args]
 *
 * Example:
 *   node scripts/run-in-each.js lint
 *   node scripts/run-in-each.js test -- --passWithNoTests
 */

const { spawnSync } = require('child_process');
const path = require('path');

const WORKSPACES = [
  'services/user-service',
  'services/chat-service',
  'services/message-service',
  'services/notification-service',
  'services/presence-service',
  'frontend',
];

const [, , script, ...rest] = process.argv;
if (!script) {
  console.error('usage: run-in-each.js <script> [-- extra args]');
  process.exit(2);
}

let extraArgs = [];
const dashIdx = rest.indexOf('--');
if (dashIdx !== -1) {
  extraArgs = rest.slice(dashIdx + 1);
}

const root = path.resolve(__dirname, '..');
let failed = 0;
for (const ws of WORKSPACES) {
  const cwd = path.join(root, ws);
  process.stdout.write(`\n── ${ws} (npm run ${script}) ──\n`);
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', script, ...(extraArgs.length ? ['--', ...extraArgs] : [])],
    { cwd, stdio: 'inherit', shell: false },
  );
  if (result.status !== 0) {
    console.error(`✖ ${ws} failed (${script})`);
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} workspace(s) failed.`);
  process.exit(1);
}
console.log('\n✓ All workspaces passed.');
