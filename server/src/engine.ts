/**
 * The roster engine, imported straight from the web app's domain layer so the
 * server and the browser can never disagree about what a month looks like.
 */
export { daysInMonth, monthKey, shiftMonth } from '../../src/domain/calendar.ts';
export { generateMonth, rosterId, setCell } from '../../src/domain/generator.ts';
export { autoRotate, buildHistory, fairness } from '../../src/domain/rotation.ts';
export { summarise } from '../../src/domain/summary.ts';
export { suggestCover, validate } from '../../src/domain/validate.ts';
export type {
  Employee as DomainEmployee,
  LeaveBlock as DomainLeave,
  RosterMonth,
  ShiftCode as DomainCode,
} from '../../src/domain/types.ts';
