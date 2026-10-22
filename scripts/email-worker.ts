import 'dotenv/config';
import { Db } from '../apps/api/src/core';
import { sendEmails, validateMailConfig } from '../apps/api/src/mail';
validateMailConfig();
if (!['smtp', 'ses'].includes(process.env.EMAIL_PROVIDER || '')) throw new Error('Configure SMTP or SES before starting the email worker');
const db = new Db();
let stopped = false;
async function tick() {
  try { await sendEmails(db); }
  catch (error) { console.error('Email worker cycle failed:', (error as Error).name); }
  if (!stopped) setTimeout(tick, 3000);
  else await db.$disconnect();
}
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });
console.log('Transactional email worker started. SENT means accepted by provider, not confirmed inbox delivery.');
void tick();
