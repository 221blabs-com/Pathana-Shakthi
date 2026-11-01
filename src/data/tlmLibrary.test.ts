import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TLM_LIBRARY, tlmById, tlmsFor } from './tlmLibrary';
import { COMPETENCIES } from './competencies';
import { HANDBOOK, handbookFind, handbookText } from './teacherHandbook';

test('every TLM is complete: unique id, real competencies, how to make and use it, all three levels', () => {
  const ids = new Set<string>();
  const competencyIds = new Set(COMPETENCIES.map((c) => c.id));
  for (const t of TLM_LIBRARY) {
    assert.ok(!ids.has(t.id), `duplicate ${t.id}`);
    ids.add(t.id);
    assert.ok(t.learning.length > 40, t.id);
    assert.ok(t.materials.length >= 1 && t.make.length >= 1 && t.use.length >= 2, t.id);
    assert.ok(t.levels.beginner && t.levels.developing && t.levels.proficient, t.id);
    assert.ok(t.check, t.id);
    assert.ok(t.grades[0] >= 1 && t.grades[0] <= t.grades[1], t.id);
    for (const c of t.competencies) assert.ok(competencyIds.has(c), `${t.id}: unknown competency ${c}`);
  }
  assert.ok(TLM_LIBRARY.length >= 20);
});

test('TLMs for a class, a subject, a competency or a few words', () => {
  const c1maths = tlmsFor({ grade: 'Class 1', subject: 'Maths' }).map((t) => t.id);
  assert.ok(c1maths.includes('ten-frame'));
  assert.ok(!c1maths.includes('fraction-kit')); // Class 3-5
  assert.ok(tlmsFor({ grade: 'Class 1', subject: 'Telugu' }).every((t) => t.area === 'Literacy'));
  assert.deepEqual(tlmsFor({ grade: 'Class 4', query: 'fractions half' }).map((t) => t.id)[0], 'fraction-kit');
  assert.ok(tlmsFor({ competency: 'num-measurement' }).every((t) => t.competencies.includes('num-measurement')));
  // An unknown word does not empty the list.
  assert.equal(tlmsFor({ grade: 'Class 2', query: 'zzzz' }).length, tlmsFor({ grade: 'Class 2' }).length);
  assert.equal(tlmById('clock')?.printable, 'clock');
});

test('handbook: government ORF norms in the table, sections findable by topic', () => {
  const goals = HANDBOOK.find((s) => s.id === 'fln-goals')!;
  const table = goals.blocks.find((b) => b.kind === 'table') as { kind: 'table'; rows: string[][] };
  assert.deepEqual(table.rows[1], ['Class 2', '45–60 wcpm', '25 wcpm', 'NIPUN Bharat, Class 2; Tholimettu (Telangana) Telugu goal']);
  assert.match(table.rows[4][1], /app goal/);
  assert.equal(handbookFind('period steps')[0].id, 'period');
  assert.equal(handbookFind('').length, HANDBOOK.length);
  assert.match(handbookText(goals), /NIPUN Bharat/);
  assert.equal(new Set(HANDBOOK.map((s) => s.id)).size, HANDBOOK.length);
});
