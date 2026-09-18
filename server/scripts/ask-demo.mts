const base = 'http://127.0.0.1:4400';
const seed = await import('/home/ababeel/Desktop/RosterDashboard /src/data/seed.ts');
const { generateMonth } = await import('/home/ababeel/Desktop/RosterDashboard /src/domain/generator.ts');
const roster = generateMonth({ year: 2026, month: 9, lineId: 'line5', employees: seed.SEED_EMPLOYEES, leaveBlocks: seed.SEED_LEAVE });
const context = { roster, employees: seed.SEED_EMPLOYEES, codes: seed.SEED_CODES, leave: seed.SEED_LEAVE };
for (const question of [
  'Which days are short-staffed and why?',
  'Fix the Night shortage on the 25th and 26th by bringing in someone who is off those days.',
]) {
  const t = Date.now();
  const r = await fetch(base + '/ai/ask', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lineId: 'line5', year: 2026, month: 9, question, context }) });
  const j = await r.json();
  console.log(`\n=== Q: ${question}  (${r.status}, ${Date.now() - t} ms)`);
  console.log('A:', j.answer ?? j.error);
  if (j.actions?.length) { console.log('actions:', JSON.stringify(j.actions)); console.log('preview:', JSON.stringify(j.preview)); }
}
