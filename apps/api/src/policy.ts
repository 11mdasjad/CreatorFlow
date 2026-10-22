export function eligibleDate(occurredAt: Date, now = new Date()) {
  const age = now.getTime() - occurredAt.getTime();
  return Number.isFinite(age) && age >= 0 && age < 7 * 86400000;
}
