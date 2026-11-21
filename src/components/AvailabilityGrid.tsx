import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AvailabilitySlot, SlotStatus } from '../types.ts';

interface AvailabilityGridProps {
  talentId: string;
  availability: AvailabilitySlot[];
  selectedDates: string[];
  onToggleDate: (dateStr: string, slot?: AvailabilitySlot) => void;
  allowSelectOccupied?: boolean;
  compact?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatMonthYear(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function toIsoDate(year: number, monthIndex: number, day: number): string {
  const m = String(monthIndex + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({
  talentId,
  availability,
  selectedDates,
  onToggleDate,
  allowSelectOccupied = false,
  compact = false,
}) => {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const initialDate = useMemo(() => new Date(), []);
  const [year, setYear] = useState(initialDate.getUTCFullYear());
  const [monthIndex, setMonthIndex] = useState(initialDate.getUTCMonth());

  const slotMap = useMemo(() => {
    const map = new Map<string, AvailabilitySlot>();
    for (const s of availability) {
      if (s.talentId === talentId) {
        map.set(s.date, s);
      }
    }
    return map;
  }, [availability, talentId]);

  const cells = useMemo(() => {
    const firstDayOfWeek = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const arr: Array<{ day: number; dateStr: string } | null> = [];
    for (let i = 0; i < firstDayOfWeek; i++) arr.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      arr.push({ day, dateStr: toIsoDate(year, monthIndex, day) });
    }
    return arr;
  }, [year, monthIndex]);

  const prevMonth = () => {
    if (monthIndex === 0) {
      setYear((y) => y - 1);
      setMonthIndex(11);
    } else {
      setMonthIndex((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (monthIndex === 11) {
      setYear((y) => y + 1);
      setMonthIndex(0);
    } else {
      setMonthIndex((m) => m + 1);
    }
  };

  const statusMeta: Record<SlotStatus, { label: string; cellClass: string }> = {
    available: {
      label: 'Open',
      cellClass: 'bg-white border-zinc-200 text-zinc-950 hover:border-zinc-950',
    },
    hold: {
      label: 'Hold',
      cellClass: 'bg-amber-50 border-amber-300 text-amber-900',
    },
    booked: {
      label: 'Booked',
      cellClass: 'bg-zinc-950 border-zinc-950 text-white',
    },
    blocked: {
      label: 'Blocked',
      cellClass: 'bg-zinc-100 border-zinc-200 text-zinc-400',
    },
    travel: {
      label: 'Travel',
      cellClass: 'bg-blue-50 border-blue-200 text-blue-900',
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-zinc-950">
          {formatMonthYear(year, monthIndex)}
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={prevMonth}
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs border border-zinc-300 bg-white inline-block" />
          Open
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-amber-200 border border-amber-400 inline-block" />
          Hold
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-zinc-950 inline-block" />
          Booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-blue-200 border border-blue-300 inline-block" />
          Travel
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-xs bg-zinc-200 inline-block" />
          Blocked
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((dayName) => (
          <div key={dayName} className="text-center text-[11px] font-medium text-zinc-400 py-1">
            {dayName}
          </div>
        ))}

        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className={compact ? 'h-10' : 'h-14'} />;
          }

          const slot = slotMap.get(cell.dateStr);
          const status: SlotStatus = slot?.status || 'available';
          const isPast = cell.dateStr < todayStr;
          const isSelected = selectedDates.includes(cell.dateStr);
          const selectable = !isPast && (allowSelectOccupied || status === 'available');

          const meta = statusMeta[status];

          return (
            <button
              key={cell.dateStr}
              type="button"
              disabled={!selectable}
              onClick={() => onToggleDate(cell.dateStr, slot)}
              title={slot?.note ? `${meta.label}: ${slot.note}` : meta.label}
              className={`relative rounded-xl border text-left transition-all flex flex-col justify-between ${
                compact ? 'h-11 p-1.5' : 'h-16 p-2'
              } ${
                isPast
                  ? 'bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed'
                  : isSelected
                    ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-600/20 cursor-pointer'
                    : selectable
                      ? `${meta.cellClass} cursor-pointer`
                      : `${meta.cellClass} opacity-85 cursor-not-allowed`
              }`}
            >
              <span className="font-mono tabular-nums text-xs font-medium leading-none">
                {cell.day}
              </span>
              {!isPast && (
                <span
                  className={`text-[10px] leading-none truncate ${
                    isSelected
                      ? 'text-blue-100 font-medium'
                      : status === 'booked'
                        ? 'text-zinc-300'
                        : 'opacity-80'
                  }`}
                >
                  {isSelected ? 'Selected' : meta.label}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
