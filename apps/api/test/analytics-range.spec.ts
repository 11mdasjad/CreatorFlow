import { resolveAnalyticsRange } from '../src/analytics-range';

describe('dashboard calendar ranges', () => {
  const now = new Date('2026-10-22T20:00:00Z');
  it('uses Kolkata calendar dates including the entire final day', () => {
    const range = resolveAnalyticsRange(
      { startDate: '2026-10-01', endDate: '2026-10-23' },
      'Asia/Kolkata',
      now,
    );
    expect(range.days).toBe(23);
    expect(range.start.toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-10-23T18:30:00.000Z');
  });
  it('supports Today and inclusive last-30-day defaults', () => {
    expect(resolveAnalyticsRange({ days: 1 }, 'Asia/Kolkata', now)).toMatchObject({
      startDate: '2026-10-23',
      endDate: '2026-10-23',
      days: 1,
    });
    expect(resolveAnalyticsRange({}, 'Asia/Kolkata', now)).toMatchObject({
      startDate: '2026-09-24',
      endDate: '2026-10-23',
      days: 30,
    });
  });
  it.each([
    ['2026-03-08', 23],
    ['2026-11-01', 25],
  ])('respects DST for %s', (day, hours) => {
    const range = resolveAnalyticsRange(
      { startDate: day, endDate: day },
      'America/New_York',
      new Date('2026-12-01'),
    );
    expect(+range.endExclusive - +range.start).toBe(hours * 3600000);
  });
  it('supports leap days and an inclusive 366-day range', () => {
    const range = resolveAnalyticsRange(
      { startDate: '2024-01-01', endDate: '2024-12-31' },
      'UTC',
      now,
    );
    expect(range.days).toBe(366);
  });
  it.each([
    { startDate: '2026-02-30', endDate: '2026-03-01' },
    { startDate: '2026-10-01' },
    { endDate: '2026-10-01' },
    { startDate: '2026-10-23', endDate: '2026-10-01' },
    { startDate: '2026-10-01', endDate: '2026-10-24' },
    { startDate: '2024-01-01', endDate: '2025-01-01' },
    { startDate: '2026-10-01', endDate: '2026-10-23', days: 30 },
    { days: 0 },
    { days: 367 },
  ])('rejects invalid, future or ambiguous ranges: %j', (input) => {
    expect(() => resolveAnalyticsRange(input, 'Asia/Kolkata', now)).toThrow();
  });
});
