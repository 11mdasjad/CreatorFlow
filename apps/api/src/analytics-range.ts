import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const DAY = 86400000;
const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const time = new Date(value + 'T00:00:00Z');
    return value >= '2000-01-01' && !isNaN(+time) && time.toISOString().slice(0, 10) === value;
  }, 'Use a valid calendar date');
const rangeSchema = z
  .object({
    days: z.coerce.number().int().min(1).max(366).optional(),
    startDate: daySchema.optional(),
    endDate: daySchema.optional(),
  })
  .strict();

export function resolveAnalyticsRange(input: unknown, timezone: string, now = new Date()) {
  const parsed = rangeSchema.safeParse(input);
  if (!parsed.success) throw new BadRequestException('Use valid dates or a range of 1–366 days');
  const { startDate: requestedStart, endDate: requestedEnd, days } = parsed.data;
  if (!!requestedStart !== !!requestedEnd || (requestedStart && days !== undefined))
    throw new BadRequestException('Provide both startDate and endDate, or days');
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = formatter.format(now);
  const endDate = requestedEnd || today;
  const startDate =
    requestedStart ||
    new Date(+new Date(endDate + 'T00:00:00Z') - ((days || 30) - 1) * DAY)
      .toISOString()
      .slice(0, 10);
  const count = Math.round((+new Date(endDate) - +new Date(startDate)) / DAY) + 1;
  if (count < 1 || count > 366) throw new BadRequestException('Choose a date range of 1–366 days');
  if (endDate > today) throw new BadRequestException('The end date cannot be in the future');
  // Find a calendar day's first instant, including zones with DST at midnight.
  function boundary(day: string) {
    const center = +new Date(day + 'T00:00:00Z');
    let low = center - 36 * 3600000,
      high = center + 36 * 3600000;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (formatter.format(new Date(middle)) < day) low = middle + 1;
      else high = middle;
    }
    return new Date(low);
  }
  const nextDay = new Date(+new Date(endDate + 'T00:00:00Z') + DAY).toISOString().slice(0, 10);
  return {
    startDate,
    endDate,
    days: count,
    start: boundary(startDate),
    endExclusive: boundary(nextDay),
  };
}
