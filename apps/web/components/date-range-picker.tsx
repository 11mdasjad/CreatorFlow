'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  DateRange,
  displayDate,
  presetRange,
  rangeError,
  rangePresets,
  todayInZone,
} from '@/lib/date-range';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function changeMonth(month: string, offset: number) {
  const date = new Date(month + '-01T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
function Month({
  month,
  start,
  end,
  today,
  choose,
}: {
  month: string;
  start: string;
  end: string;
  today: string;
  choose: (day: string) => void;
}) {
  const first = new Date(month + '-01T12:00:00Z');
  const length = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return (
    <section
      className="range-month"
      aria-label={first.toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      })}
    >
      <h3>
        {first.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
      </h3>
      <div className="range-weekdays">
        {weekdays.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="range-days">
        {Array.from({ length: first.getUTCDay() }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, '0')}`;
          const selected = day >= start && day <= end;
          return (
            <button
              type="button"
              key={day}
              data-day={day}
              disabled={day > today || day < '2000-01-01'}
              aria-label={displayDate(day)}
              aria-pressed={selected}
              aria-current={day === today ? 'date' : undefined}
              className={`${selected ? 'in-range' : ''} ${day === start || day === end ? 'range-edge' : ''}`}
              onClick={() => choose(day)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function DateRangePicker({
  value,
  onApply,
  timezone,
}: {
  value: DateRange;
  onApply: (range: DateRange) => void;
  timezone: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState(value.startDate.slice(0, 7));
  const [pickingEnd, setPickingEnd] = useState(false);
  const today = todayInZone(timezone);
  const error = rangeError(draft.startDate, draft.endDate, today);
  function choose(day: string) {
    if (!pickingEnd) {
      setDraft({ startDate: day, endDate: day, label: 'Custom range' });
      setPickingEnd(true);
    } else {
      setDraft({
        startDate: day < draft.startDate ? day : draft.startDate,
        endDate: day < draft.startDate ? draft.startDate : day,
        label: 'Custom range',
      });
      setPickingEnd(false);
    }
  }
  function show(next: boolean) {
    if (next) {
      setDraft(value);
      setMonth(value.label === 'Last 30 days' ? today.slice(0, 7) : value.startDate.slice(0, 7));
      setPickingEnd(false);
    }
    setOpen(next);
  }
  const zoneLabel =
    timezone === 'Asia/Kolkata' || timezone === 'Asia/Calcutta'
      ? 'Kolkata Time'
      : timezone.replaceAll('_', ' ');
  return (
    <Dialog.Root open={open} onOpenChange={show}>
      <Dialog.Trigger asChild>
        <button className="dashboard-date-trigger" aria-label={`Date range: ${value.label}`}>
          <CalendarDays size={16} />
          <span>
            {value.label === 'Custom range'
              ? `${displayDate(value.startDate)} – ${displayDate(value.endDate)}`
              : value.label}
          </span>
          <ChevronDown size={14} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="date-range-overlay" />
        <Dialog.Content className="date-range-dialog" aria-describedby="date-range-description">
          <Dialog.Title className="sr-only">Choose a date range</Dialog.Title>
          <Dialog.Description id="date-range-description" className="sr-only">
            Select a preset or a start and end date, then apply. Dates use {zoneLabel}.
          </Dialog.Description>
          <Dialog.Close className="date-range-close" aria-label="Close date range">
            <X size={17} />
          </Dialog.Close>
          <div className="range-body">
            <aside className="range-presets">
              <h2>Quick ranges</h2>
              <div role="radiogroup" aria-label="Date presets">
                {rangePresets.map((p) => {
                  const range = presetRange(p.id, today);
                  const active =
                    draft.startDate === range.startDate &&
                    draft.endDate === range.endDate &&
                    draft.label === p.label;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setDraft(range);
                        setMonth(
                          (p.id === 'month' || p.id === 'last30' ? today : range.startDate).slice(
                            0,
                            7,
                          ),
                        );
                        setPickingEnd(false);
                      }}
                    >
                      <i>{active && <span />}</i>
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <p>Select dates on the calendar for a custom range.</p>
            </aside>
            <div className="range-calendar-content">
              <div className="range-month-nav">
                <button
                  aria-label="Previous month"
                  disabled={month <= '2000-01'}
                  onClick={() => setMonth(changeMonth(month, -1))}
                >
                  <ChevronLeft size={19} />
                </button>
                <button
                  aria-label="Next month"
                  disabled={month >= today.slice(0, 7)}
                  onClick={() => setMonth(changeMonth(month, 1))}
                >
                  <ChevronRight size={19} />
                </button>
              </div>
              <div className="range-calendars">
                <Month
                  month={month}
                  start={draft.startDate}
                  end={draft.endDate}
                  today={today}
                  choose={choose}
                />
                <Month
                  month={changeMonth(month, 1)}
                  start={draft.startDate}
                  end={draft.endDate}
                  today={today}
                  choose={choose}
                />
              </div>
              <p className="range-selection-hint" aria-live="polite">
                {pickingEnd
                  ? 'Choose an end date, or apply for a single day.'
                  : `${displayDate(draft.startDate || today)} – ${displayDate(draft.endDate || today)}`}
              </p>
              <div className="range-date-inputs">
                <label>
                  Start date
                  <input
                    type="date"
                    aria-label="Start date"
                    min="2000-01-01"
                    max={today}
                    value={draft.startDate}
                    onChange={(e) => {
                      const startDate = e.target.value;
                      setDraft({ ...draft, startDate, label: 'Custom range' });
                      if (/^\d{4}-\d{2}-\d{2}$/.test(startDate)) setMonth(startDate.slice(0, 7));
                      setPickingEnd(false);
                    }}
                  />
                </label>
                <label>
                  End date
                  <input
                    type="date"
                    aria-label="End date"
                    min="2000-01-01"
                    max={today}
                    value={draft.endDate}
                    onChange={(e) => {
                      setDraft({ ...draft, endDate: e.target.value, label: 'Custom range' });
                      setPickingEnd(false);
                    }}
                  />
                </label>
              </div>
              {error && (
                <p className="range-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          </div>
          <footer className="range-footer">
            <span>Dates are shown in {zoneLabel}</span>
            <div>
              <Dialog.Close className="range-cancel">
                <X size={16} />
                Cancel
              </Dialog.Close>
              <button
                className="range-apply"
                disabled={!!error}
                onClick={() => {
                  if (!error) {
                    onApply(draft);
                    setOpen(false);
                  }
                }}
              >
                <Check size={17} />
                Apply
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
