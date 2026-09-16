import type { ShiftCode, ShiftTone } from '@/domain/types';

/** CSS custom-property triple backing each shift tone. */
export interface ToneVars {
  bg: string;
  fg: string;
  accent: string;
}

const TONES: Record<ShiftTone, ToneVars> = {
  morning: { bg: 'var(--sh-m-bg)', fg: 'var(--sh-m-ink)', accent: 'var(--sh-m)' },
  evening: { bg: 'var(--sh-e-bg)', fg: 'var(--sh-e-ink)', accent: 'var(--sh-e)' },
  night: { bg: 'var(--sh-n-bg)', fg: 'var(--sh-n-ink)', accent: 'var(--sh-n)' },
  general: { bg: 'var(--sh-gs-bg)', fg: 'var(--sh-gs-ink)', accent: 'var(--sh-gs)' },
  project: { bg: 'var(--sh-p-bg)', fg: 'var(--sh-p-ink)', accent: 'var(--sh-p)' },
  leave: { bg: 'var(--sh-leave-bg)', fg: 'var(--sh-leave-ink)', accent: 'var(--sh-leave)' },
  off: { bg: 'var(--sh-off)', fg: 'var(--sh-off-ink)', accent: 'var(--ink-3)' },
};

export function toneVars(tone: ShiftTone): ToneVars {
  return TONES[tone] ?? TONES.off;
}

export function toneOf(codes: ShiftCode[], id: string): ShiftTone {
  return codes.find((c) => c.id === id)?.tone ?? 'off';
}

export const TONE_OPTIONS: { value: ShiftTone; label: string }[] = [
  { value: 'morning', label: 'Amber (Morning)' },
  { value: 'evening', label: 'Teal (Evening)' },
  { value: 'night', label: 'Indigo (Night)' },
  { value: 'general', label: 'Green (General)' },
  { value: 'project', label: 'Violet (Project)' },
  { value: 'leave', label: 'Red (Leave / status)' },
  { value: 'off', label: 'Muted (Off)' },
];

/**
 * Hex equivalents of the tone palette, for the Excel export.
 *
 * SheetJS writes literal ARGB fills, so the exported workbook can't reference
 * the CSS variables — these are the light-theme values, which is what a
 * printed or emailed sheet should look like.
 */
export const EXPORT_COLORS: Record<ShiftTone, { fill: string; font: string }> = {
  morning: { fill: 'FFF3D9A6', font: 'FF6B4200' },
  evening: { fill: 'FFB9E8EA', font: 'FF05494C' },
  night: { fill: 'FFC8CEFB', font: 'FF20297E' },
  general: { fill: 'FFC3E6CE', font: 'FF14512C' },
  project: { fill: 'FFE0CCF7', font: 'FF4A1D79' },
  leave: { fill: 'FFF7C2C7', font: 'FF7E0F1A' },
  off: { fill: 'FFE9EBEF', font: 'FF8A93A6' },
};
