import 'dotenv/config';
import { Db } from '../apps/api/src/core';
import { publicPlans } from './plan-catalog';
async function main() {
  const db = new Db();
  // Keep the legacy trial for existing workspaces and older deployments.
  await db.subscriptionPlan.upsert({
    where: { name: 'Free Trial' },
    create: {
      name: 'Free Trial',
      description: '14 days to build your first flow.',
      published: false,
      priceMinor: null,
      limits: { accounts: 1, automations: 3, executions: 100, leads: 100, team: 3, workflows: 3 },
      features: ['Lead CRM', 'Draft automations', 'Visual workflows'],
    },
    update: {},
  });
  for (const plan of publicPlans) {
    await db.subscriptionPlan.upsert({
      where: { name: plan.name },
      create: { ...plan, currency: 'INR', published: true },
      update: {},
    });
  }
  const trial = await db.subscriptionPlan.findUniqueOrThrow({ where: { name: 'Free Trial' } });
  await db.systemSetting.upsert({
    where: { key: 'trialPlanId' },
    create: { key: 'trialPlanId', value: trial.id },
    update: {},
  });
  console.log(
    'Seeded Starter Free, Creator ₹99/month, Pro ₹121/month, and Custom plans. Existing administrator changes were preserved.',
  );
  await db.$disconnect();
}
void main();
