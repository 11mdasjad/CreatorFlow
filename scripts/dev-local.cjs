// One-command local setup. Uses only loopback services and project-local data.
const { spawn } = require('node:child_process');
const { existsSync, copyFileSync, readFileSync } = require('node:fs');
require('dotenv').config();
if (process.env.NODE_ENV === 'production')
  throw new Error('Use the production deployment workflow');
if (!existsSync('.env')) copyFileSync('.env.example', '.env');
const localAdminKey = existsSync('.local/admin-access.json')
  ? JSON.parse(readFileSync('.local/admin-access.json', 'utf8')).actionKey
  : '';
const liveEmail = process.argv.includes('--email');
if (liveEmail && !['smtp', 'ses'].includes(process.env.EMAIL_PROVIDER))
  throw new Error('Set EMAIL_PROVIDER=smtp or ses and configure a verified sender before using --email');
const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5433/postgres',
  DATABASE_POOL_MAX: '1',
  REDIS_URL: '',
  EMAIL_PROVIDER: liveEmail ? process.env.EMAIL_PROVIDER : 'local',
  EMAIL_DELIVERY_SINCE: liveEmail ? new Date().toISOString() : '',
  APP_URL: 'http://127.0.0.1:3000',
  META_APPROVED: 'false',
  META_PRIVATE_REPLY_POLICY_VERIFIED: 'false',
  PAYMENTS_ENABLED: 'false',
  BILLING_ENABLED: 'false',
  ADMIN_ACTION_KEY: process.env.ADMIN_ACTION_KEY || localAdminKey,
};
const children = [];
let stopping = false;
function start(args, pipe = false) {
  const child = spawn('npm', args, {
    env,
    stdio: pipe ? ['inherit', 'pipe', 'inherit'] : 'inherit',
    detached: process.platform !== 'win32',
  });
  children.push(child);
  return child;
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = start(args);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} failed`)),
    );
  });
}
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children)
    if (child.exitCode === null) {
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, 'SIGTERM');
        else child.kill('SIGTERM');
      } catch {}
    }
}
process.on('SIGINT', () => {
  stop();
  setTimeout(() => process.exit(0), 500);
});
process.on('SIGTERM', () => {
  stop();
  setTimeout(() => process.exit(0), 500);
});
(async () => {
  const db = start(['run', 'db:local'], true);
  await new Promise((resolve, reject) => {
    db.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      if (String(chunk).includes('listening at')) resolve();
    });
    db.on('exit', (code) => {
      if (!stopping)
        reject(
          new Error(`Local database exited (${code}). Check whether port 5433 is already in use.`),
        );
    });
  });
  await run(['run', 'db:generate']);
  await run(['run', 'db:migrate']);
  await run(['run', 'db:seed']);
  if (process.argv.includes('--demo')) await run(['run', 'db:demo']);
  start(['run', 'worker:local']);
  if (liveEmail) {
    await run(['run', 'email:check']);
    start(['run', 'email:worker']);
    console.log('Live transactional email enabled for messages created during this run. Older local preview messages are excluded.');
  }
  console.log(
    '\nCreatorFlow: http://127.0.0.1:3000\nSocial and payment integrations are disabled in local mode. Ctrl+C stops this session.\n',
  );
  const app = start(['run', 'dev']);
  app.on('exit', () => {
    stop();
    process.exit(0);
  });
})().catch((e) => {
  console.error(e.message);
  stop();
  process.exit(1);
});
