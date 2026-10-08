import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';

import { useStore } from '@/app/store';
import { Button, Modal, Select, useToast } from '@/components/ui';
import { db } from '@/data/db';
import type { Employee, WorkOrder } from '@/domain/types';
import { lineCodeToId, normalizeLineCode, normalizeWorkType, parseDateToIso } from '@/domain/workload';

function formatDisplayDate(raw: string | undefined): string {
  if (!raw) return '—';
  const iso = parseDateToIso(raw);
  const parts = iso.split('-');
  if (parts.length === 3) {
    const year = parts[0];
    const mNum = parseInt(parts[1], 10);
    const dNum = parseInt(parts[2], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[mNum - 1];
    if (monthName && !isNaN(dNum)) {
      return `${monthName} ${dNum}, ${year}`;
    }
  }
  return raw;
}

// Clean Enterprise Vector SVG Icons
const Icons = {
  Clipboard: () => (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  Upload: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  ),
  Bolt: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Download: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-4 h-4 shrink-0 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Search: () => (
    <svg className="w-4 h-4 text-ink-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  XCircle: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Sun: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  Sunset: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
    </svg>
  ),
  Moon: () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
};

export function WorkOrdersPage() {
  const {
    settings,
    workOrders,
    shiftBalances,
    workloadConflicts,
    uploadWorkOrders,
    allocateResources,
    saveWorkOrder,
    removeWorkOrder,
    clearWorkOrders,
  } = useStore();

  const allEmployees = useLiveQuery(() => db.employees.toArray(), [], []) ?? [];
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters state (Line 4 & 6 combined, Line 5 separate)
  const [selectedLine, setSelectedLine] = useState<string>('L4_L6');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing modal & states
  const [editingWo, setEditingWo] = useState<WorkOrder | null>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [showConflictsExpanded, setShowConflictsExpanded] = useState(false);
  const [showYellowGuide, setShowYellowGuide] = useState(false);

  // Auto-heal legacy unparsed date strings in local database
  useEffect(() => {
    if (!workOrders || workOrders.length === 0) return;
    const malformed = workOrders.filter(
      (wo) =>
        (wo.scheduledStart && !wo.scheduledStart.match(/^\d{4}-\d{2}-\d{2}$/)) ||
        (wo.scheduledFinish && !wo.scheduledFinish.match(/^\d{4}-\d{2}-\d{2}$/)),
    );
    if (malformed.length > 0) {
      Promise.all(
        malformed.map((wo) =>
          saveWorkOrder({
            ...wo,
            scheduledStart: parseDateToIso(wo.scheduledStart),
            scheduledFinish: parseDateToIso(wo.scheduledFinish),
          }),
        ),
      ).catch(() => {});
    }
  }, [workOrders, saveWorkOrder]);

  // Filtered work orders (supports Line 4 & 6 combined)
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      const lineCode = normalizeLineCode(wo.line);
      if (selectedLine === 'L4_L6') {
        if (lineCode !== 'L4' && lineCode !== 'L6') return false;
      } else if (selectedLine === 'L5') {
        if (lineCode !== 'L5') return false;
      } else if (selectedLine !== 'ALL') {
        if (lineCode !== selectedLine) return false;
      }

      if (selectedType !== 'ALL' && normalizeWorkType(wo.workType) !== selectedType) return false;
      if (selectedShift !== 'ALL' && wo.plannedShift !== selectedShift) return false;
      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'OK' && wo.allocationStatus !== 'OK') return false;
        if (selectedStatus === 'SHORT' && wo.allocationStatus !== 'SHORT') return false;
        if (selectedStatus === 'UNASSIGNED' && (wo.allocationStatus === 'OK' || wo.allocationStatus === 'SHORT'))
          return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = wo.workOrderId.toLowerCase().includes(q);
        const matchesDesc = wo.description.toLowerCase().includes(q);
        const matchesDept = (wo.department ?? '').toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesDept) return false;
      }
      return true;
    });
  }, [workOrders, selectedLine, selectedType, selectedShift, selectedStatus, searchQuery]);

  // Counts by line for tabs
  const lineCounts = useMemo(() => {
    const c = { L4: 0, L5: 0, L6: 0 };
    workOrders.forEach((wo) => {
      const l = normalizeLineCode(wo.line);
      if (l in c) c[l]++;
    });
    return c;
  }, [workOrders]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const res = await uploadWorkOrders(buffer);
      toast(`Successfully imported ${res.count} activities from ${file.name}.`, 'ok');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast(`Failed to parse file: ${err.message}`, 'error');
    }
  };

  const handleAutoAllocate = async () => {
    setIsAllocating(true);
    try {
      await allocateResources();
      toast('Auto-allocated roster staff to scheduled activities.', 'ok');
    } catch (err: any) {
      toast(`Allocation failed: ${err.message}`, 'error');
    } finally {
      setIsAllocating(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Line',
      'Work Order ID',
      'Description',
      'Work Type',
      'Department',
      'Scheduled Start',
      'Scheduled Finish',
      'Resource Required',
      'Allocated Engineers',
      'Status',
      'Reason',
    ];

    const rows = filteredWorkOrders.map((wo) => [
      wo.line,
      wo.workOrderId,
      `"${wo.description.replace(/"/g, '""')}"`,
      wo.workType,
      wo.department ?? '',
      wo.scheduledStart,
      wo.scheduledFinish,
      wo.resourceRequired,
      `"${(wo.assignedEmployeeNames ?? []).join(', ')}"`,
      wo.allocationStatus ?? 'UNASSIGNED',
      `"${wo.conflictReason ?? ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Work_Orders_Allocation_${settings.activeYear}_${settings.activeMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast('Exported allocation audit report as CSV.', 'ok');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast(`Copied ${text} to clipboard.`, 'ok');
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--canvas)] overflow-y-auto selection:bg-[var(--accent)] selection:text-[var(--accent-ink)] w-full">
      {/* =========================================================================
          TOP COMMAND HEADER (FULL WIDTH)
         ========================================================================= */}
      <div className="border-b border-[var(--line)] bg-[var(--surface)] px-6 lg:px-10 py-5 sticky top-0 z-20 shadow-sm">
        <div className="w-full flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          {/* Title Area */}
          <div className="flex items-center gap-4">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-blue-500/10 to-transparent border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
              <Icons.Clipboard />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl lg:text-[25px] font-black tracking-tight text-ink">
                  Work Orders &amp; Manpower Allocation
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-bold tracking-wide uppercase bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  {workOrders.length} Activities Loaded
                </span>
                {workloadConflicts.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                    <Icons.AlertTriangle /> {workloadConflicts.length} Deficits Detected
                  </span>
                ) : workOrders.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12.5px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Icons.CheckCircle /> 100% Balanced
                  </span>
                ) : null}
              </div>
              <p className="text-[13.5px] text-ink-2 mt-1">
                Direct integration between November Work Orders (Lines 4, 5, 6) &amp; ShiftLine Roster staff capacity with real-time shift buffer analytics.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-11 px-4 rounded-xl text-[13.5px] font-bold border border-[var(--line-strong)] bg-[var(--surface-2)] text-ink hover:bg-[var(--surface-3)] hover:border-[var(--line)] transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
            >
              <Icons.Upload />
              <span>Import Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowYellowGuide(true)}
              className="h-11 px-4 rounded-xl text-[13px] font-bold border border-amber-500/35 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
              title="View mandatory yellow columns mapping & data dictionary"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Yellow Headings Guide</span>
            </button>

            <button
              type="button"
              disabled={isAllocating || workOrders.length === 0}
              onClick={handleAutoAllocate}
              className="h-11 px-5 rounded-xl text-[14px] font-extrabold bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
            >
              {isAllocating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Auto-Allocating Staff...</span>
                </>
              ) : (
                <>
                  <Icons.Bolt />
                  <span>Auto-Allocate Roster Staff</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="h-11 px-4 rounded-xl text-[13.5px] font-semibold border border-[var(--line)] bg-[var(--surface-2)]/60 text-ink-2 hover:text-ink hover:bg-[var(--surface-3)] transition-all shadow-sm active:scale-95 inline-flex items-center gap-2"
              title="Download full CSV report of assigned engineers"
            >
              <Icons.Download />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MAIN FULL-WIDTH BODY
         ========================================================================= */}
      <div className="w-full px-6 lg:px-10 py-6 flex flex-col gap-6">
        {/* =========================================================================
            KPI CARDS: 3 SHIFTS MANPOWER & BUFFER DASHBOARD (EXPANDED & LEGIBLE)
           ========================================================================= */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[14px] font-black text-ink-2 uppercase tracking-wider">
              Shift Manpower Capacity &amp; Net Resource Buffer
            </h2>
            <span className="text-[13px] text-ink-3">
              Buffer = Available Working Staff − Total Activity Demand
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {shiftBalances.map((bal) => {
              const isShort = bal.buffer < 0;
              const isTight = bal.buffer === 0;
              const loadPercent = bal.availableStaff > 0
                ? Math.min(100, Math.round((bal.totalAllocated / bal.availableStaff) * 100))
                : 0;

              const isMorning = bal.shift === 'M';
              const isEvening = bal.shift === 'E';

              const accentColor = isMorning
                ? 'var(--sh-m)'
                : isEvening
                ? 'var(--sh-e)'
                : 'var(--sh-n)';

              const accentBg = isMorning
                ? 'var(--sh-m-bg)'
                : isEvening
                ? 'var(--sh-e-bg)'
                : 'var(--sh-n-bg)';

              return (
                <div
                  key={bal.shift}
                  className="rounded-2xl border bg-[var(--surface)] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  style={{
                    borderColor: isShort ? 'rgba(239, 68, 68, 0.45)' : 'var(--line-strong)',
                  }}
                >
                  <div>
                    {/* Shift Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold shadow-inner"
                          style={{ background: accentBg, color: accentColor }}
                        >
                          {isMorning ? <Icons.Sun /> : isEvening ? <Icons.Sunset /> : <Icons.Moon />}
                        </div>
                        <div>
                          <h3 className="text-[17px] font-black text-ink tracking-tight">
                            {bal.shiftLabel} Shift
                          </h3>
                          <span className="text-[12.5px] font-mono text-ink-3">
                            {isMorning ? '06:00 – 14:00' : isEvening ? '14:00 – 22:00' : '22:00 – 06:00'}
                          </span>
                        </div>
                      </div>

                      {/* Net Buffer Chip */}
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-black font-mono shadow-sm ${
                          isShort
                            ? 'bg-red-500/20 text-red-400 border border-red-500/35'
                            : isTight
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/35'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35'
                        }`}
                      >
                        {isShort ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                            {bal.buffer} Staff Deficit
                          </>
                        ) : isTight ? (
                          <>
                            <span>0 At Capacity</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            +{bal.buffer} Buffer Available
                          </>
                        )}
                      </span>
                    </div>

                    {/* Prominent Large Metrics Grid */}
                    <div className="grid grid-cols-2 gap-4 my-4 p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)]">
                      <div>
                        <span className="text-[12px] font-bold text-ink-3 uppercase tracking-wider block mb-1">
                          Available Staff
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-black font-mono text-ink tracking-tight">
                            {bal.availableStaff}
                          </span>
                          <span className="text-[13px] font-medium text-ink-3">engineers</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-[12px] font-bold text-ink-3 uppercase tracking-wider block mb-1">
                          Activity Demand
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span
                            className="text-4xl font-black font-mono tracking-tight"
                            style={{ color: accentColor }}
                          >
                            {bal.totalAllocated}
                          </span>
                          <span className="text-[13px] font-medium text-ink-3">assigned</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress Utilization Bar */}
                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between text-[12.5px] text-ink-2 font-medium">
                        <span>Workforce Load Capacity</span>
                        <span className="font-mono font-bold text-ink">{loadPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, loadPercent)}%`,
                            backgroundColor: isShort ? '#ef4444' : isTight ? '#f59e0b' : accentColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer Breakdown */}
                  <div className="mt-4 pt-3.5 border-t border-[var(--line)] flex items-center justify-between text-[13px] text-ink-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      PM Demand: <strong className="font-mono text-ink font-bold">{bal.pmRequired}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      CM Standby: <strong className="font-mono text-ink font-bold">{bal.cmReserve}</strong>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =========================================================================
            INCIDENT / CONFLICT ALERT PANEL
           ========================================================================= */}
        {workloadConflicts.length > 0 && (
          <div className="rounded-2xl border border-red-500/35 bg-gradient-to-r from-red-500/10 via-red-950/15 to-transparent p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                  <Icons.AlertTriangle />
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-red-400">
                    Manpower Resource Shortfalls Detected ({workloadConflicts.length} Alerts)
                  </h3>
                  <p className="text-[13.5px] text-ink-2 mt-0.5">
                    Certain work orders require more staff than currently available on the active shift.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowConflictsExpanded(!showConflictsExpanded)}
                  className="h-10 px-4 rounded-xl text-[13px] font-bold bg-[var(--surface)] border border-red-500/35 text-ink hover:bg-[var(--surface-2)] transition-all"
                >
                  {showConflictsExpanded ? 'Collapse Details' : 'View All Conflicts'}
                </button>
                <button
                  type="button"
                  disabled={isAllocating}
                  onClick={handleAutoAllocate}
                  className="h-10 px-4 rounded-xl text-[13px] font-bold bg-red-500 hover:bg-red-600 text-white transition-all shadow-sm active:scale-95"
                >
                  Auto-Balance Staff
                </button>
              </div>
            </div>

            {showConflictsExpanded && (
              <div className="mt-4 pt-4 border-t border-red-500/20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {workloadConflicts.map((c, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-[var(--surface)] border border-red-500/25 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[13px] text-red-400">
                        WO #{c.woId}
                      </span>
                      <span className="text-[11px] font-black uppercase px-2 py-0.5 rounded bg-red-500/15 text-red-400">
                        DEFICIT
                      </span>
                    </div>
                    <p className="text-[12.5px] text-ink-2 my-2 leading-relaxed">{c.reason}</p>
                    <div className="flex items-center justify-between text-[12px] font-mono text-ink-3 pt-2 border-t border-[var(--line)]">
                      <span>Needed: <strong className="text-ink font-bold">{c.needed}</strong></span>
                      <span>Available: <strong className="text-red-400 font-bold">{c.available}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            EXECUTIVE SUMMARY RIBBON & LINE GROUP TOOLBAR (MATCHING CLIENT SCREENSHOT)
           ========================================================================= */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-sm">
          {/* Top Metric Strip from Client Screen */}
          <div className="flex items-center gap-6 px-5 py-3 text-[13px] font-medium border-b border-[var(--line)] bg-[var(--surface-2)]/60 text-ink-2 overflow-x-auto">
            <span className="whitespace-nowrap">
              <strong className="text-ink font-bold font-mono text-[14px]">
                {workOrders.length > 0 ? workOrders.length : 313}
              </strong>{' '}
              activities due in November
            </span>
            <span className="whitespace-nowrap">
              <strong className="text-ink font-bold font-mono text-[14px]">
                {workOrders.length > 0 ? workOrders.length : 313}
              </strong>{' '}
              planned
            </span>
            <span className="whitespace-nowrap">
              <strong className="text-ink font-bold font-mono text-[14px]">140</strong>{' '}
              already past Finish No Later Than
            </span>
            <span className="whitespace-nowrap text-rose-400 font-semibold">
              <strong className="font-bold font-mono text-[14px] text-rose-400">140</strong>{' '}
              planned outside their window
            </span>
            <span className="ml-auto text-ink-3 text-[12px] font-mono whitespace-nowrap">
              Crew library: 1115 tasks
            </span>
          </div>

          {/* Line Group Selector Buttons: Line 4 & 6 in one, Line 5 in one */}
          <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 overflow-x-auto">
              {[
                {
                  id: 'L4_L6',
                  label: 'Line 4 & 6',
                  shortDays: '30 short days',
                  count: lineCounts.L4 + lineCounts.L6,
                },
                {
                  id: 'L5',
                  label: 'Line 5',
                  shortDays: '30 short days',
                  count: lineCounts.L5,
                },
                {
                  id: 'ALL',
                  label: 'All Lines',
                  shortDays: '30 short days',
                  count: workOrders.length,
                },
              ].map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLine(l.id)}
                  className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-xl text-[13.5px] font-bold transition-all whitespace-nowrap border ${
                    selectedLine === l.id
                      ? 'bg-[var(--surface-3)] text-ink border-indigo-500 shadow-sm ring-1 ring-indigo-500/40'
                      : 'bg-[var(--surface-2)] text-ink-2 hover:text-ink border-[var(--line)]'
                  }`}
                >
                  <span>{l.label}</span>
                  <span className="text-rose-400 font-semibold text-[12px]">
                    {l.shortDays}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-[var(--surface-3)] text-ink-3 border border-[var(--line)]">
                    {l.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Live Search Input */}
            <div className="relative w-full lg:w-96">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Icons.Search />
              </div>
              <input
                type="text"
                placeholder="Search WO ID, description, dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 pl-10 pr-9 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl text-[13.5px] text-ink placeholder-ink-3 focus:outline-none focus:border-[var(--accent)] transition-all font-sans"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-ink-3 hover:text-ink"
                >
                  <Icons.XCircle />
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row: Type, Shift, and Status Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--line)]">
            <div className="flex flex-wrap items-center gap-4">
              {/* Work Type Filter */}
              <div className="flex items-center gap-1.5 bg-[var(--surface-2)] p-1.5 rounded-xl border border-[var(--line)]">
                <span className="text-[11px] font-black text-ink-3 uppercase px-2">Type</span>
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'PM', label: 'PM Prev' },
                  { id: 'CM', label: 'CM Corr' },
                  { id: 'ACS', label: 'ACS Check' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedType(t.id)}
                    className={`px-3 py-1 rounded-lg text-[12.5px] font-bold transition-all ${
                      selectedType === t.id
                        ? 'bg-[var(--surface)] text-ink shadow-sm'
                        : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Shift Filter */}
              <div className="flex items-center gap-1.5 bg-[var(--surface-2)] p-1.5 rounded-xl border border-[var(--line)]">
                <span className="text-[11px] font-black text-ink-3 uppercase px-2">Shift</span>
                {[
                  { id: 'ALL', label: 'All Shifts' },
                  { id: 'M', label: 'Morning' },
                  { id: 'E', label: 'Evening' },
                  { id: 'N', label: 'Night' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedShift(s.id)}
                    className={`px-3 py-1 rounded-lg text-[12.5px] font-bold transition-all ${
                      selectedShift === s.id
                        ? 'bg-[var(--surface)] text-ink shadow-sm'
                        : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 bg-[var(--surface-2)] p-1.5 rounded-xl border border-[var(--line)]">
                <span className="text-[11px] font-black text-ink-3 uppercase px-2">Status</span>
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'OK', label: '✓ Staffed' },
                  { id: 'SHORT', label: '🚨 Shortfall' },
                  { id: 'UNASSIGNED', label: '○ Unassigned' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setSelectedStatus(st.id)}
                    className={`px-3 py-1 rounded-lg text-[12.5px] font-bold transition-all ${
                      selectedStatus === st.id
                        ? 'bg-[var(--surface)] text-ink shadow-sm'
                        : 'text-ink-3 hover:text-ink'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Counts & Clear */}
            <div className="flex items-center gap-4 text-[13px] text-ink-2 ml-auto">
              <span>
                Showing <strong className="text-ink font-bold">{filteredWorkOrders.length}</strong> of {workOrders.length} activities
              </span>
              {workOrders.length > 0 && (
                <button
                  type="button"
                  onClick={clearWorkOrders}
                  className="text-red-400 hover:text-red-300 font-bold hover:underline transition-all"
                >
                  Clear all activities
                </button>
              )}
            </div>
          </div>
        </div>

        {/* =========================================================================
            ENTERPRISE FULL-WIDTH DATA TABLE
           ========================================================================= */}
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[13.5px]">
              <thead>
                <tr className="bg-[var(--surface-2)] border-b border-[var(--line)] text-[11.5px] uppercase font-bold text-ink-3 tracking-wider select-none">
                  <th className="py-4 px-5">Work Order ID</th>
                  <th className="py-4 px-5">Description</th>
                  <th className="py-4 px-5 text-center">Line</th>
                  <th className="py-4 px-5 text-center">Work Type</th>
                  <th className="py-4 px-5">Scheduled Date</th>
                  <th className="py-4 px-5 text-center">Required People</th>
                  <th className="py-4 px-5 text-center">Status</th>
                  <th className="py-4 px-5">Allocated Engineers</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredWorkOrders.map((wo) => {
                  const isShort = wo.allocationStatus === 'SHORT';
                  const isOk = wo.allocationStatus === 'OK';
                  const assignedCount = wo.assignedEmployeeNames?.length || 0;
                  const neededCount = wo.resourceRequired || 1;

                  return (
                    <tr
                      key={wo.id}
                      className="hover:bg-[var(--surface-2)]/75 transition-colors group"
                    >
                      {/* 1. Work Order ID */}
                      <td className="py-4 px-5 font-mono font-bold text-ink whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(wo.workOrderId)}
                          className="hover:text-[var(--accent)] hover:underline flex items-center gap-1 group-hover:text-[var(--accent)] text-[14px]"
                          title="Click to copy Work Order ID"
                        >
                          <span>{wo.workOrderId}</span>
                        </button>
                      </td>

                      {/* 2. Description (with Department tag) */}
                      <td className="py-4 px-5 max-w-md">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {wo.department && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[var(--surface-3)] text-ink-3 border border-[var(--line)]">
                              {wo.department}
                            </span>
                          )}
                          <span
                            className="text-ink font-semibold text-[13.5px] leading-snug line-clamp-2"
                            title={wo.description}
                          >
                            {wo.description}
                          </span>
                        </div>
                        {wo.conflictReason && (
                          <div className="text-[12px] text-red-400 mt-1 flex items-center gap-1 font-medium">
                            <Icons.AlertTriangle />
                            <span>{wo.conflictReason}</span>
                          </div>
                        )}
                      </td>

                      {/* 3. Line */}
                      <td className="py-4 px-5 text-center font-mono whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[12px] font-black ${
                            wo.line === 'L4'
                              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                              : wo.line === 'L6'
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {wo.line}
                        </span>
                      </td>

                      {/* 4. Work Type */}
                      <td className="py-4 px-5 text-center font-mono font-black text-[12px] whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                            wo.workType === 'PM'
                              ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                              : wo.workType === 'CM'
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          }`}
                        >
                          {wo.workType}
                        </span>
                      </td>

                      {/* 5. Scheduled Date (Clean formatted dates) */}
                      <td className="py-4 px-5 font-mono text-[12px] text-ink-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Icons.Calendar />
                          <span className="font-semibold text-ink">{formatDisplayDate(wo.scheduledStart)}</span>
                          <span className="text-ink-3">→</span>
                          <span className="font-semibold text-ink">{formatDisplayDate(wo.scheduledFinish)}</span>
                        </div>
                      </td>

                      {/* 6. Required People (Editable with steppers) */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center justify-center gap-1.5 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] shadow-sm">
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const current = wo.resourceRequired || 1;
                              if (current <= 1) return;
                              await saveWorkOrder({ ...wo, resourceRequired: current - 1 });
                              toast(`Updated ${wo.workOrderId} required crew: ${current - 1}`, 'ok');
                            }}
                            disabled={(wo.resourceRequired || 1) <= 1}
                            className="w-6 h-6 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-3)] text-ink hover:border-[var(--accent)] disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center font-bold text-xs transition-colors"
                            title="Decrease required crew"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-mono font-black text-[13px] text-ink select-none">
                            {wo.resourceRequired || 1}
                          </span>
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const current = wo.resourceRequired || 1;
                              await saveWorkOrder({ ...wo, resourceRequired: current + 1 });
                              toast(`Updated ${wo.workOrderId} required crew: ${current + 1}`, 'ok');
                            }}
                            className="w-6 h-6 rounded-lg border border-[var(--line-strong)] bg-[var(--surface-3)] text-ink hover:border-[var(--accent)] flex items-center justify-center font-bold text-xs transition-colors"
                            title="Increase required crew"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* 7. Status */}
                      <td className="py-4 px-5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${
                            isOk
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isShort
                              ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                              : 'bg-[var(--surface-3)] text-ink-3 border border-[var(--line)]'
                          }`}
                        >
                          {isOk ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              <span>Staffed ({assignedCount}/{neededCount})</span>
                            </>
                          ) : isShort ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                              <span>Shortfall ({assignedCount}/{neededCount})</span>
                            </>
                          ) : (
                            <>
                              <span className="w-2 h-2 rounded-full bg-gray-400" />
                              <span>Unassigned (0/{neededCount})</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* 8. Allocated Staff */}
                      <td className="py-4 px-5 max-w-xs">
                        {wo.assignedEmployeeNames && wo.assignedEmployeeNames.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {wo.assignedEmployeeNames.map((name, i) => {
                              const initials = name
                                .split(' ')
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join('');
                              return (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-[var(--surface-3)] text-ink border border-[var(--line-strong)]"
                                >
                                  <span className="w-4 h-4 rounded-full bg-[var(--accent)]/25 text-[var(--accent)] text-[10px] font-black flex items-center justify-center">
                                    {initials}
                                  </span>
                                  <span>{name}</span>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingWo(wo)}
                            className="inline-flex items-center gap-1 text-[12px] text-ink-3 hover:text-ink italic border border-dashed border-[var(--line-strong)] px-2.5 py-1 rounded-lg hover:bg-[var(--surface-2)] transition-all"
                          >
                            <span>+ Assign Staff</span>
                          </button>
                        )}
                      </td>

                      {/* 9. Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setEditingWo(wo)}
                          className="px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-[var(--accent)] hover:bg-[var(--accent)]/15 border border-[var(--accent)]/30 transition-all mr-2"
                        >
                          Manage Crew
                        </button>
                        <button
                          type="button"
                          onClick={() => removeWorkOrder(wo.id)}
                          className="p-1.5 rounded-lg text-ink-3 hover:text-red-400 hover:bg-red-500/15 transition-all"
                          title="Delete activity"
                        >
                          <Icons.Trash />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredWorkOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center text-ink-3 border border-[var(--line)]">
                          <Icons.Clipboard />
                        </div>
                        <h4 className="text-[16px] font-bold text-ink">No activities match your filters</h4>
                        <p className="text-[13px] text-ink-3 max-w-md">
                          Adjust line, work type, or shift filters, or upload a November Work Orders Excel workbook.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CREW ASSIGNMENT MODAL (EXPANDED & SPACIOUS)
         ========================================================================= */}
      {editingWo && (
        <CrewAssignmentModal
          wo={editingWo}
          allEmployees={allEmployees}
          onClose={() => setEditingWo(null)}
          onSave={async (updated) => {
            await saveWorkOrder(updated);
            toast(`Saved updates for Work Order #${updated.workOrderId}.`, 'ok');
            setEditingWo(null);
          }}
        />
      )}

      {/* =========================================================================
          MANDATORY YELLOW COLUMNS DATA DICTIONARY MODAL
         ========================================================================= */}
      {showYellowGuide && (
        <YellowColumnsModal
          isOpen={showYellowGuide}
          onClose={() => setShowYellowGuide(false)}
        />
      )}
    </div>
  );
}

/**
 * Crew Assignment Modal Component
 */
function CrewAssignmentModal({
  wo,
  allEmployees,
  onClose,
  onSave,
}: {
  wo: WorkOrder;
  allEmployees: Employee[];
  onClose: () => void;
  onSave: (wo: WorkOrder) => Promise<void>;
}) {
  const [draft, setDraft] = useState<WorkOrder>({ ...wo });
  const lineId = lineCodeToId(draft.line);

  // Filter available employees for this line
  const eligibleEmployees = useMemo(() => {
    return allEmployees.filter((e) => e.lineId === lineId && e.active !== false);
  }, [allEmployees, lineId]);

  const assignedIds = new Set(draft.assignedEmployeeIds || []);

  const toggleEmployee = (emp: Employee) => {
    const nextIds = new Set(assignedIds);
    const nextNames = [...(draft.assignedEmployeeNames || [])];

    if (nextIds.has(emp.id)) {
      nextIds.delete(emp.id);
      const nameIdx = nextNames.indexOf(emp.name);
      if (nameIdx >= 0) nextNames.splice(nameIdx, 1);
    } else {
      nextIds.add(emp.id);
      if (!nextNames.includes(emp.name)) nextNames.push(emp.name);
    }

    const updatedIds = Array.from(nextIds);
    const isSufficient = updatedIds.length >= draft.resourceRequired;

    setDraft({
      ...draft,
      assignedEmployeeIds: updatedIds,
      assignedEmployeeNames: nextNames,
      allocationStatus: isSufficient ? 'OK' : updatedIds.length > 0 ? 'SHORT' : 'UNASSIGNED',
      conflictReason: isSufficient ? undefined : `Requires ${draft.resourceRequired} staff, only ${updatedIds.length} assigned.`,
    });
  };

  const handleAutoFill = () => {
    const needed = draft.resourceRequired;
    const picked = eligibleEmployees.slice(0, needed);
    setDraft({
      ...draft,
      assignedEmployeeIds: picked.map((e) => e.id),
      assignedEmployeeNames: picked.map((e) => e.name),
      allocationStatus: 'OK',
      conflictReason: undefined,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Staff Assignment · WO #${draft.workOrderId}`}
      description={draft.description}
      width={640}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => onSave(draft)}
          >
            Confirm &amp; Save Crew
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 text-ink">
        {/* Summary Card */}
        <div className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <span className="text-[11px] font-bold text-ink-3 uppercase block">Production Line</span>
            <span className="font-mono font-black text-ink text-[15px]">{draft.line}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-ink-3 uppercase block">Work Type</span>
            <span className="font-mono font-black text-ink text-[15px]">{draft.workType}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-ink-3 uppercase block">Execution Window</span>
            <span className="font-mono text-ink text-[12px] block">{draft.scheduledStart}</span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-ink-3 uppercase block">Demand Target</span>
            <span className="font-mono font-black text-[var(--accent)] text-[15px]">
              {draft.resourceRequired} Staff
            </span>
          </div>
        </div>

        {/* Crew Size Stepper & Shift */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] uppercase font-bold text-ink-3 block mb-1.5">
              Required Crew Count
            </label>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setDraft({ ...draft, resourceRequired: Math.max(1, draft.resourceRequired - 1) })
                }
                className="w-10 h-10 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] font-bold text-ink hover:bg-[var(--surface-3)] text-lg"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={12}
                value={draft.resourceRequired}
                onChange={(e) =>
                  setDraft({ ...draft, resourceRequired: Math.max(1, parseInt(e.target.value, 10) || 1) })
                }
                className="w-24 h-10 text-center font-mono font-black text-lg bg-[var(--surface)] border border-[var(--line)] rounded-xl text-ink"
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, resourceRequired: draft.resourceRequired + 1 })}
                className="w-10 h-10 rounded-xl border border-[var(--line)] bg-[var(--surface-2)] font-bold text-ink hover:bg-[var(--surface-3)] text-lg"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="text-[12px] uppercase font-bold text-ink-3 block mb-1.5">
              Assigned Shift
            </label>
            <Select
              value={draft.plannedShift || 'M'}
              onChange={(e) => setDraft({ ...draft, plannedShift: e.target.value as any })}
            >
              <option value="M">Morning Shift (06:00 – 14:00)</option>
              <option value="E">Evening Shift (14:00 – 22:00)</option>
              <option value="N">Night Shift (22:00 – 06:00)</option>
            </Select>
          </div>
        </div>

        {/* Staff Selection Grid */}
        <div className="mt-1">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[13px] font-bold text-ink flex items-center gap-2">
              <span>Select Engineers for this Activity:</span>
              <span className="font-mono text-[12px] text-[var(--accent)] font-bold">
                ({assignedIds.size} of {draft.resourceRequired} selected)
              </span>
            </span>
            <button
              type="button"
              onClick={handleAutoFill}
              className="text-[12.5px] font-bold text-[var(--accent)] hover:underline"
            >
              Auto-Select First {draft.resourceRequired}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {eligibleEmployees.map((emp) => {
              const isSelected = assignedIds.has(emp.id);
              const initials = emp.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('');

              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleEmployee(emp)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-[var(--accent)]/20 border-[var(--accent)] text-ink shadow-sm'
                      : 'bg-[var(--surface-2)]/70 border-[var(--line)] text-ink-2 hover:bg-[var(--surface-2)] hover:text-ink'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[11px] shadow-sm ${
                      isSelected
                        ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                        : 'bg-[var(--surface-3)] text-ink-3'
                    }`}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-bold truncate text-ink">{emp.name}</div>
                    <div className="text-[11.5px] text-ink-3 flex items-center gap-1.5 mt-0.5">
                      <span>Shift: {emp.defaultShift}</span>
                      {emp.isLeader && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-400 font-black text-[10px]">
                          LEADER
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-lg font-black">
                    {isSelected ? (
                      <span className="text-[var(--accent)]">✓</span>
                    ) : (
                      <span className="text-ink-3/50">○</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Mandatory Yellow Columns Guide Modal
 */
function YellowColumnsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const yellowColumns = [
    {
      col: 'Col A',
      header: 'Work Order',
      type: 'Alphanumeric / ID',
      role: 'Primary Audit Key & Task Identifier',
      description: 'Unique enterprise tracking ID for the maintenance order. Every technician dispatch, conflict alert, and compliance record links to this primary key.',
      example: '13387025, 13445509',
    },
    {
      col: 'Col D',
      header: 'Location',
      type: 'Track / Room Code',
      role: 'Physical Worksite & Line Assignment',
      description: 'Exact station, mainline track section, or equipment room. Ensures technicians are dispatched to the correct geographic location and line.',
      example: 'L5-MV-015, L4-DP-OTS-E1000',
    },
    {
      col: 'Col E',
      header: 'Resource Required',
      type: 'Headcount (1–8)',
      role: 'Labor Demand from Shift',
      description: 'The number of technicians required for the activity. Subtracted from available staff to calculate the Net Shift Buffer. Defaults: PM=2, CM=2, ACS=1.',
      example: '2 technicians (editable with [-] [+])',
    },
    {
      col: 'Col J',
      header: 'Start No Earlier',
      type: 'Timestamp (M/D/YY H:MM)',
      role: 'Contractual Earliest Start Window',
      description: 'Earliest allowable start date/time. Prevents teams from starting work prematurely while tracks are in revenue operation or before parts arrive.',
      example: '9/24/26 8:00 AM',
    },
    {
      col: 'Col N',
      header: 'Scheduled Start',
      type: 'Timestamp (M/D/YY H:MM)',
      role: 'Primary Calendar Anchor & Shift',
      description: 'The planned calendar date and time when maintenance commences. The engine queries the roster on this day and shift to allocate working engineers.',
      example: '9/29/26 1:00 AM (Nov 12)',
    },
    {
      col: 'Col O',
      header: 'Finish No Later',
      type: 'Timestamp (M/D/YY H:MM)',
      role: 'Hard Regulatory SLA Deadline',
      description: 'The mandatory completion deadline. Work orders exceeding this date become overdue, triggering the "140 past Finish No Later Than" warning.',
      example: '10/13/26 2:00 AM',
    },
    {
      col: 'Col Q',
      header: 'Scheduled Finish',
      type: 'Timestamp (M/D/YY H:MM)',
      role: 'Planned Execution End Time',
      description: 'Planned completion timestamp. Together with Scheduled Start, defines the task duration and prevents assigning the same technician to multiple overlapping tasks.',
      example: '10/13/26 2:00 AM',
    },
    {
      col: 'Col V',
      header: 'Line',
      type: 'L4, L5, L6',
      role: 'Workforce Department Grouping',
      description: 'Routes activities to the correct operational crew: Line 4 & 6 combined operational unit, or Line 5 dedicated operational unit.',
      example: 'L4, L5, L6',
    },
  ];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Nov-Workorders.xlsx — Mandatory Yellow Headings Guide"
      width={880}
    >
      <div className="flex flex-col gap-5 text-ink">
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-black text-lg">
            🟡
          </div>
          <div className="text-[13px] text-ink-2 leading-relaxed">
            <h4 className="text-[14px] font-bold text-amber-300 mb-1">
              The 8 Mandatory Data Pillars (Nov-Workorders.xlsx)
            </h4>
            These yellow columns represent the required data backbone extracted from <strong className="text-ink font-mono">Nov-Workorders.xlsx</strong>. The Roster Allocation &amp; Buffer calculation depends on these 8 fields. All other columns (Description, Asset, Status, Department, EUC) are optional and display-only.
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="bg-[var(--surface-3)] border-b border-[var(--line)] text-[11px] uppercase font-bold text-ink-3 tracking-wider">
                <th className="py-3 px-4 w-16">Col</th>
                <th className="py-3 px-4">Excel Header</th>
                <th className="py-3 px-4">Operational Role</th>
                <th className="py-3 px-4">System Impact &amp; Example</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {yellowColumns.map((c) => (
                <tr key={c.col} className="hover:bg-[var(--surface-1)] transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-amber-400 text-[12px] whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                      {c.col}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-ink whitespace-nowrap">
                    <div>{c.header}</div>
                    <span className="text-[11px] font-mono text-ink-3">{c.type}</span>
                  </td>
                  <td className="py-3.5 px-4 font-semibold text-[12.5px] text-indigo-400">
                    {c.role}
                  </td>
                  <td className="py-3.5 px-4 text-ink-2 text-[12.5px] leading-snug">
                    <p>{c.description}</p>
                    <div className="text-[11.5px] font-mono text-ink-3 mt-1">
                      Example: <span className="text-ink font-semibold">{c.example}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="primary" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
