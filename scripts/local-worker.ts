import 'dotenv/config';
import { Db } from '../apps/api/src/core';
import { runWorkflows } from '../apps/api/src/workflow-engine';
if (
  process.env.NODE_ENV === 'production' ||
  !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')
)
  throw new Error('Local workflow runner requires a loopback development database');
const db = new Db();
let stopped = false;
async function tick() {
  try {
    await runWorkflows(db);
  } catch (e) {
    console.error('Local workflow runner:', (e as Error).name);
  }
  if (!stopped) setTimeout(tick, 3000);
}
console.log('Local internal workflow runner started. No external messages or emails will be sent.');
void tick();
async function stop() {
  stopped = true;
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
