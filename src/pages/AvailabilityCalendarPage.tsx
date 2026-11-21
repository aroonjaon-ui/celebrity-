import React, { useMemo, useState } from 'react';
import { AvailabilityGrid } from '../components/AvailabilityGrid.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import { usePlatform } from '../context/PlatformContext.tsx';
import type { SlotStatus } from '../types.ts';

export const AvailabilityCalendarPage: React.FC = () => {
  const {
    talents,
    availability,
    workspace,
    updateCalendarSlots,
    setCheckoutDraft,
    navigate,
    pushToast,
    wsConnected,
  } = usePlatform();

  const [selectedTalentId, setSelectedTalentId] = useState<string>('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [managerSlotStatus, setManagerSlotStatus] = useState<SlotStatus>('blocked');
  const [managerNote, setManagerNote] = useState('Studio production hold');
  const [savingSlot, setSavingSlot] = useState(false);

  const activeTalent = useMemo(
    () => talents.find((t) => t.id === selectedTalentId) || talents[0],
    [talents, selectedTalentId]
  );

  const toggleDate = (dateStr: string) => {
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const handleManagerApply = async () => {
    if (!activeTalent || selectedDates.length === 0) return;
    setSavingSlot(true);
    try {
      await updateCalendarSlots(activeTalent.id, selectedDates, managerSlotStatus, managerNote);
      pushToast(
        'Calendar Broadcasted',
        `Updated ${selectedDates.length} date(s) for ${activeTalent.name} to "${managerSlotStatus}".`,
        'success'
      );
      setSelectedDates([]);
    } catch (err) {
      pushToast('Update Error', err instanceof Error ? err.message : 'Unable to update calendar.', 'error');
    } finally {
      setSavingSlot(false);
    }
  };

  const upcomingRows = useMemo(() => {
    if (!activeTalent) return [];
    const today = new Date().toISOString().slice(0, 10);
    return availability
      .filter((s) => s.talentId === activeTalent.id && s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [availability, activeTalent]);

  if (!activeTalent) return null;

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <p className="text-xs text-zinc-500">
            Real-Time Scheduling <span aria-hidden="true">·</span>{' '}
            {wsConnected ? 'Live WebSocket Sync Active' : 'Reconnecting...'}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-zinc-950 tracking-tight">
            Availability Calendar
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Select a principal to inspect real-time studio holds, travel buffers, and open appearance dates.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/talent/${activeTalent.slug}`)}
          className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-white border border-zinc-200 hover:border-zinc-950 rounded-xl whitespace-nowrap cursor-pointer transition-colors"
        >
          Open {activeTalent.name}&apos;s Full Profile
        </button>
      </div>

      {/* Talent Selector Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {talents.map((t) => {
          const isSelected = t.id === activeTalent.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSelectedTalentId(t.id);
                setSelectedDates([]);
              }}
              className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-white text-zinc-950 border-zinc-200 hover:border-zinc-950'
              }`}
            >
              <SafeImage
                src={t.portraitUrl}
                alt={t.name}
                fallbackText={t.name}
                className="w-10 h-10 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{t.name}</p>
                <p className={`text-[11px] font-mono tabular-nums ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  ${t.dailyRate.toLocaleString('en-US')}/d
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-2xl p-6">
          <AvailabilityGrid
            talentId={activeTalent.id}
            availability={availability}
            selectedDates={selectedDates}
            onToggleDate={toggleDate}
            allowSelectOccupied={workspace.role === 'manager'}
          />
        </div>

        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-zinc-950">
              {workspace.role === 'manager' ? 'Manager Slot Controls' : 'Selected Dates Summary'}
            </h2>

            <div className="text-xs space-y-1">
              <p className="text-zinc-500">Selected Dates ({selectedDates.length})</p>
              <p className="font-mono tabular-nums font-medium text-zinc-950">
                {selectedDates.length > 0 ? selectedDates.join(', ') : 'Click calendar dates to select'}
              </p>
            </div>

            {workspace.role === 'manager' ? (
              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Set Slot Status</span>
                  <select
                    value={managerSlotStatus}
                    onChange={(e) => setManagerSlotStatus(e.target.value as SlotStatus)}
                    className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl"
                  >
                    <option value="available">Open / Available</option>
                    <option value="blocked">Blocked (Studio / Personal)</option>
                    <option value="travel">Travel Buffer</option>
                    <option value="hold">Manager Hold</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-zinc-700">Schedule Note</span>
                  <input
                    type="text"
                    value={managerNote}
                    onChange={(e) => setManagerNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl"
                  />
                </label>
                <button
                  type="button"
                  disabled={selectedDates.length === 0 || savingSlot}
                  onClick={handleManagerApply}
                  className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {savingSlot ? 'Broadcasting...' : 'Update & Broadcast Slots'}
                </button>
              </div>
            ) : (
              <div className="space-y-3 border-t border-zinc-100 pt-4">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-600">Estimated Fee</span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-950">
                    ${(activeTalent.dailyRate * selectedDates.length).toLocaleString('en-US')} USD
                  </span>
                </div>
                <button
                  type="button"
                  disabled={selectedDates.length === 0}
                  onClick={() => {
                    setCheckoutDraft({ talentId: activeTalent.id, dates: selectedDates });
                    navigate('/checkout');
                  }}
                  className="w-full px-4 py-2.5 text-xs font-semibold text-white bg-zinc-950 hover:bg-blue-600 rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
                >
                  Proceed to Escrow Checkout
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/talent/${activeTalent.slug}`)}
                  className="w-full px-4 py-2.5 text-xs font-semibold text-zinc-950 bg-zinc-100 hover:bg-zinc-200 rounded-xl cursor-pointer transition-colors"
                >
                  Submit Formal Booking Inquiry
                </button>
              </div>
            )}
          </div>

          <div className="bg-white border border-zinc-200 rounded-2xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-950">Upcoming Holds &amp; Commitments</h3>
            {upcomingRows.length === 0 ? (
              <p className="text-xs text-zinc-500">All upcoming dates are currently open.</p>
            ) : (
              <div className="divide-y divide-zinc-100 max-h-60 overflow-y-auto">
                {upcomingRows.map((slot) => (
                  <div key={`${slot.talentId}-${slot.date}`} className="py-2 flex items-start justify-between gap-2 text-xs">
                    <div>
                      <p className="font-mono tabular-nums font-medium text-zinc-950">{slot.date}</p>
                      <p className="text-[11px] text-zinc-500">{slot.note || 'Scheduled commitment'}</p>
                    </div>
                    <span className="text-[11px] font-medium capitalize text-zinc-700">{slot.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
