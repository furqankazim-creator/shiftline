import mongoose, { Schema } from 'mongoose';

/**
 * Mongo documents mirror the domain types one-to-one. `id` is the app's own
 * string id (e.g. "e01"), kept as a plain field so the web app's ids survive
 * the round trip; Mongo's _id is incidental.
 */

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['supervisor', 'viewer'], default: 'viewer' },
  },
  { timestamps: true },
);

const LineSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  prefix: String,
  order: Number,
});

const ShiftCodeSchema = new Schema({
  id: { type: String, required: true, unique: true },
  label: String,
  timing: String,
  tone: String,
  minHeadcount: Number,
  countsAsEngineer: Boolean,
  rotates: Boolean,
  isStatus: Boolean,
  order: Number,
});

const EmployeeSchema = new Schema({
  id: { type: String, required: true, unique: true },
  lineId: { type: String, index: true },
  name: String,
  contact: String,
  order: Number,
  defaultShift: String,
  restDays: [Number],
  rotations: { type: Schema.Types.Mixed, default: {} },
  pinned: Boolean,
  active: Boolean,
});

const LeaveSchema = new Schema({
  id: { type: String, required: true, unique: true },
  employeeId: { type: String, index: true },
  from: String,
  to: String,
  code: String,
  note: String,
});

const RosterSchema = new Schema(
  {
    id: { type: String, required: true, unique: true }, // `${lineId}:${YYYY-MM}`
    lineId: { type: String, index: true },
    year: Number,
    month: Number,
    cells: { type: Schema.Types.Mixed, default: {} },
    overrides: { type: Schema.Types.Mixed, default: {} },
    updatedAt: Number,
  },
  { minimize: false },
);

const SettingsSchema = new Schema({
  key: { type: String, default: 'app', unique: true },
  data: { type: Schema.Types.Mixed, default: {} },
});

/** Who changed what. Written by every mutating route. */
const AuditSchema = new Schema(
  {
    userId: String,
    userEmail: String,
    action: String, // e.g. "roster.cell", "employee.update", "sync.push"
    target: String, // e.g. "line5:2026-09 / e02 / day 4"
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  },
  { timestamps: true },
);

export const User = mongoose.model('User', UserSchema);
export const Line = mongoose.model('Line', LineSchema);
export const ShiftCode = mongoose.model('ShiftCode', ShiftCodeSchema);
export const Employee = mongoose.model('Employee', EmployeeSchema);
export const Leave = mongoose.model('Leave', LeaveSchema);
export const Roster = mongoose.model('Roster', RosterSchema);
export const Settings = mongoose.model('Settings', SettingsSchema);
export const Audit = mongoose.model('Audit', AuditSchema);
