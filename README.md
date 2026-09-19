# ShiftLine

**Workforce roster planning for multi-shift operations.**

A shift-roster planning tool. Enter each person's shift, rest-day pair, any
mid-month rotation and any leave — the whole month builds itself, with live
headcounts, coverage warnings and fair auto-rotation. Imports and exports the
existing `Line N_MMM-YYYY Roster` Excel layout.

Local-first: everything lives in the browser (IndexedDB). No server, no login.

## Run

```bash
npm install
npm run dev        # opens http://localhost:5173
```

```bash
npm test           # 67 tests, incl. cell-for-cell reproduction of the real Sept 2026 sheet
npm run build      # static bundle in dist/ — host anywhere, or open via any static server
```

## Assistant

The **Ask ShiftLine** chat bubble (bottom-right, Ctrl+/) works in either of two ways:

- **No server** — paste a free Groq key from console.groq.com/keys under
  **Setup › Assistant** (or straight into the chat when it asks). The browser
  calls Groq itself; the key stays on that device.
- **Through the server** — when `VITE_API_URL` points at a running API, the
  chat uses the server's key and no per-browser key is needed.

The chat prefers the server when one answers, and falls back to the browser key otherwise.

## Server (optional)

`server/` is a Node + Express + MongoDB API with a Groq assistant. The web app
works fully without it. With it, set `VITE_API_URL` at build time and the app
gains **Setup › Cloud** (sign in, push / pull the dataset) and the server-side
assistant. See [server/README.md](server/README.md).

## Layout

```
src/domain/    pure scheduling engine — generator, rotation, validation, summaries (no React)
src/data/      Dexie schema + the seeded September 2026 Line 5 roster
src/io/        Excel import (reverse-engineers rules from a grid) and branded export
src/features/  planner grid, people, setup, insights, import/export dialogs
src/app/       store (state + persistence), shift-colour tokens, API client
server/        Express + Mongoose API, Groq assistant, audit log
docs/          client user guide (source of the published artifact)
```

## How a month is built

For every person and day, first match wins:

1. a hand edit on that cell
2. a leave / status block covering the date
3. one of the person's rest weekdays → `-`
4. a rotation rule whose day range covers the date
5. the person's default shift

Hand edits are stored separately from generated cells, so regenerating never
destroys them unless you ask it to.

## Shift codes

Editable in **Setup**. Seeded from the client's sheet: `M` `E` `N` `GS` `P`,
the support categories his COUNTIF formulas reference (`MT` `ET` `NT`), and
two statuses (`LV` leave, `FLRT`). Minimum headcounts default to 2 / 2 / 3
for Morning / Evening / Night, inferred from his thinnest days — confirm with
him.

## Keyboard

With a cell focused: `M` `E` `N` `G` `P` write that shift, `-` writes a day
off, arrows move, `Ctrl+Z` / `Ctrl+Shift+Z` undo / redo, `Esc` drops the brush.
