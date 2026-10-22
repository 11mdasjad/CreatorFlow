export type DateRange = { startDate: string; endDate: string; label: string };
export const rangePresets = [
  { id: 'last30', label: 'Last 30 days' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'last14', label: 'Last 14 days' },
  { id: 'month', label: 'This month' },
];
export function todayInZone(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function shiftDay(day: string, amount: number) {
  return new Date(+new Date(day + 'T12:00:00Z') + amount * 86400000).toISOString().slice(0, 10);
}
export function presetRange(id: string, today: string): DateRange {
  const preset = rangePresets.find((p) => p.id === id) || rangePresets[0];
  const endDate = id === 'yesterday' ? shiftDay(today, -1) : today;
  const startDate =
    id === 'month'
      ? today.slice(0, 7) + '-01'
      : shiftDay(endDate, id === 'last30' ? -29 : id === 'last14' ? -13 : id === 'last7' ? -6 : 0);
  return { startDate, endDate, label: preset.label };
}
export function displayDate(day: string) {
  if (isNaN(+new Date(day + 'T12:00:00Z'))) return '—';
  return new Date(day + 'T12:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
export function rangeError(start: string, end: string, today: string) {
  const valid = (day: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    !isNaN(+new Date(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
  if (!valid(start) || !valid(end)) return 'Choose a valid start and end date.';
  if (start < '2000-01-01') return 'Choose a start date on or after 1 Jan 2000.';
  if (start > end) return 'End date must be on or after start date.';
  if (end > today) return 'End date cannot be in the future.';
  if ((+new Date(end) - +new Date(start)) / 86400000 >= 366)
    return 'Choose a range of up to 366 days.';
  return '';
}
