import 'dotenv/config';
import * as argon2 from 'argon2';
import { Db } from '../apps/api/src/core';
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo fixtures are forbidden in production');
  const db = new Db();
  const email = 'demo@creatorflow.local';
  const user = await db.user.upsert({
    where: { email },
    create: {
      email,
      name: 'Demo Creator',
      verifiedAt: new Date(),
      passwordHash: await argon2.hash('CreatorFlow-demo-2026!'),
    },
    update: {},
  });
  const plan = await db.subscriptionPlan.findUniqueOrThrow({ where: { name: 'Free Trial' } });
  const workspace = await db.workspace.upsert({
    where: { slug: 'creatorflow-demo' },
    create: {
      name: 'Demo Studio',
      slug: 'creatorflow-demo',
      onboardingStep: 8,
      members: { create: { userId: user.id, role: 'OWNER' } },
      subscription: {
        create: { planId: plan.id, trialEndsAt: new Date(Date.now() + 14 * 86400000) },
      },
      store: { create: { name: 'Demo Studio', slug: 'creatorflow-demo' } },
    },
    update: {},
  });
  console.log('Local demo account ready: demo@creatorflow.local / CreatorFlow-demo-2026!');
  console.log(
    'Workspace contains no fabricated metrics. Demo credentials never run in production.',
  );
  await db.$disconnect();
}
void main();
