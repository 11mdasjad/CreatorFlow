import 'dotenv/config';
import { Db } from '../apps/api/src/core';
async function main() {
  if (process.env.NODE_ENV === 'production' || process.env.EMAIL_PROVIDER !== 'local')
    throw new Error('Mailbox is only available for local development');
  if (process.argv.includes('--local'))
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5433/postgres';
  const db = new Db();
  const messages = await db.emailOutbox.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  for (const m of messages) console.log(`\nTo: ${m.to}\n${m.subject}\n${m.text}\n`);
  await db.$disconnect();
}
void main();
