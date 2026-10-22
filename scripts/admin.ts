import 'dotenv/config';
import { Db } from '../apps/api/src/core';
async function main() {
  const email = process.argv[2]?.toLowerCase();
  if (!email) throw new Error('Usage: npm run admin:create -- verified-user@example.com');
  const db = new Db();
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  if (!user.verifiedAt) throw new Error('Verify the account first');
  await db.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } });
  await db.auditLog.create({
    data: { actorId: 'deployment-cli', action: 'SUPER_ADMIN_GRANTED', targetId: user.id },
  });
  console.log(
    'Platform admin role granted. Privileged changes also require password reauthentication and ADMIN_ACTION_KEY.',
  );
  await db.$disconnect();
}
void main();
