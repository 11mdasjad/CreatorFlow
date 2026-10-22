import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import * as argon2 from 'argon2';
import { Db } from '../apps/api/src/core';

async function main() {
  const database = new URL(process.env.DATABASE_URL || '');
  if (
    process.env.NODE_ENV === 'production' ||
    database.hostname !== '127.0.0.1' ||
    database.port !== '5433'
  ) {
    throw new Error('This command is only for the local development database on 127.0.0.1:5433.');
  }
  const db = new Db();
  const email = 'admin@creatorflow.local';
  const file = '.local/admin-access.json';
  try {
    if (await db.user.findUnique({ where: { email } })) {
      console.log('Local admin account already exists. Its credentials were not changed.');
      return;
    }
    if (existsSync(file))
      throw new Error(
        'An admin access file already exists. Review it before creating a new account.',
      );
    const password = `CF-${randomBytes(15).toString('base64url')}!`;
    const actionKey = process.env.ADMIN_ACTION_KEY || randomBytes(32).toString('hex');
    const user = await db.user.create({
      data: {
        email,
        name: 'Md Asjad',
        verifiedAt: new Date(),
        isSuperAdmin: true,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      },
    });
    await db.auditLog.create({
      data: {
        actorId: 'local-admin-cli',
        action: 'LOCAL_SUPER_ADMIN_CREATED',
        targetId: user.id,
      },
    });
    mkdirSync('.local', { recursive: true });
    writeFileSync(
      file,
      JSON.stringify(
        {
          url: 'http://127.0.0.1:3000/login',
          email,
          password,
          actionKey,
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx', mode: 0o600 },
    );
    console.log(
      `Separate local admin created. Private credentials: ${file}. Restart dev:local to enable the local action key.`,
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
