import 'dotenv/config';
import { Db } from '../apps/api/src/core';
import { publicPlans } from './plan-catalog';

async function main() {
  const db = new Db();
  try {
    await db.$transaction(async (tx) => {
      for (const plan of publicPlans) {
        const data = { ...plan, currency: 'INR', published: true };
        await tx.subscriptionPlan.upsert({
          where: { name: plan.name },
          create: data,
          update: data,
        });
      }
      // Hide the previous placeholder catalog; preserve its existing subscriptions.
      await tx.subscriptionPlan.updateMany({
        where: { name: { in: ['Free Trial', 'Growth', 'Professional', 'Enterprise'] } },
        data: { published: false },
      });
    });
    console.log(
      'Published: Starter Free, Creator INR 99/month, Pro INR 121/month, Custom by discussion.',
    );
  } finally {
    await db.$disconnect();
  }
}
void main();
