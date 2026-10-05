import React, { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, Pencil, Printer, UserPlus, X } from 'lucide-react';
import { backendApi, RosterStudent } from '../../services/backendApi';
import { ALL_GRADES } from '../../data/grades';

const GRADES: string[] = ALL_GRADES;
const AVATARS = ['👦', '👧', '🧒'];

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// A printable sheet of sign-in cards: each child's name, class and roll
// number, cut out and handed over so every child knows how to sign in.
function printLoginCards(grade: string, students: RosterStudent[]) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  const cards = students
    .map(
      (s) => `<div class="card"><div class="avatar">${escapeHtml(s.avatar)}</div><div><p class="name">${escapeHtml(s.name)}</p>
<p class="meta">${escapeHtml(grade)} · Roll <b>${escapeHtml(s.rollNumber)}</b></p>
<p class="how">Sign in: tap <b>${escapeHtml(grade)}</b>, then your name (or type roll ${escapeHtml(s.rollNumber)}).</p></div></div>`
    )
    .join('');
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(grade)} sign-in cards</title>
<style>body{font-family:'Noto Sans','Noto Sans Telugu','Noto Sans Devanagari',system-ui,sans-serif;margin:16px;color:#1c1917}
h1{font-size:18px;margin:0 0 12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.card{display:flex;gap:12px;align-items:center;border:2px dashed #a8a29e;border-radius:14px;padding:12px;break-inside:avoid}
.avatar{font-size:40px}.name{font-size:18px;font-weight:800;margin:0}.meta{margin:2px 0;font-size:14px}.how{margin:4px 0 0;font-size:11px;color:#57534e}
@media print{button{display:none}}</style></head><body><h1>Pathana Shakthi · ${escapeHtml(grade)} sign-in cards</h1>
<button onclick="window.print()" style="margin-bottom:12px;padding:8px 14px;font-weight:700">Print</button><div class="grid">${cards}</div></body></html>`);
  win.document.close();
}

// The class list itself: add a child, fix a name or roll number, move a child
// to another class, or deactivate a child who has left (their progress is
// kept). Used on the teacher dashboard and the headmaster's dashboard.
export const RosterPanel: React.FC<{ grade: string; onSelectGrade: (grade: string) => void }> = ({ grade, onSelectGrade }) => {
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [nextRoll, setNextRoll] = useState('1');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [avatar, setAvatar] = useState('🧒');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', rollNumber: '', grade: '', avatar: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await backendApi.school.roster(grade);
      setStudents(data.students);
      setNextRoll(data.nextRoll);
      setRoll(data.nextRoll);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the class list.');
    } finally {
      setLoading(false);
    }
  }, [grade]);

  useEffect(() => {
    setEditing(null);
    setNotice('');
    void load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { student } = await backendApi.school.addStudent({ grade, name, rollNumber: roll, avatar });
      setNotice(`${student.name} added to ${grade} with roll number ${student.rollNumber}.`);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the student.');
    } finally {
      setSaving(false);
    }
  };

  const save = async (s: RosterStudent, changes: Parameters<typeof backendApi.school.updateStudent>[1], message: string) => {
    setSaving(true);
    setError('');
    try {
      await backendApi.school.updateStudent(s.id, changes);
      setNotice(message);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the change.');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = (s: RosterStudent) => {
    const changes: Record<string, string> = {};
    if (draft.name.trim() !== s.name) changes.name = draft.name;
    if (draft.rollNumber.trim() !== s.rollNumber) changes.rollNumber = draft.rollNumber;
    if (draft.grade !== grade) changes.grade = draft.grade;
    if (draft.avatar !== s.avatar) changes.avatar = draft.avatar;
    if (!Object.keys(changes).length) return setEditing(null);
    const moved = changes.grade ? ` and moved to ${changes.grade}` : '';
    void save(s, changes, `${draft.name.trim() || s.name} updated${moved}.`);
  };

  const active = students.filter((s) => s.active);
  const inputCls = 'rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400';

  return (
    <section id="roster-panel" className="mb-8 overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50/30 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-emerald-100 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-black text-stone-900">Students & roll numbers</h2>
          <p className="text-xs text-stone-600">Children sign in by tapping their class and their name — keep this list right.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Class" className="flex flex-wrap gap-1.5">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={g === grade}
                onClick={() => onSelectGrade(g)}
                className={`roster-tab rounded-xl px-3 py-1.5 text-xs font-black ${
                  g === grade ? 'bg-emerald-600 text-white shadow' : 'border border-stone-200 bg-white text-stone-700 hover:border-emerald-300'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <button
            type="button"
            id="btn-print-login-cards"
            onClick={() => printLoginCards(grade, active)}
            disabled={!active.length}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" /> Sign-in cards
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <form onSubmit={add} id="roster-add-form" className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-3">
          <label className="flex flex-col text-[10px] font-black uppercase text-stone-500">
            Child's name
            <input
              id="roster-add-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ravi Teja"
              className={`${inputCls} mt-1 w-56`}
            />
          </label>
          <label className="flex flex-col text-[10px] font-black uppercase text-stone-500">
            Roll no.
            <input
              id="roster-add-roll"
              required
              inputMode="numeric"
              value={roll}
              onChange={(e) => setRoll(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className={`${inputCls} mt-1 w-20`}
            />
          </label>
          <div className="flex flex-col text-[10px] font-black uppercase text-stone-500">
            Picture
            <div className="mt-1 flex gap-1">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={avatar === a}
                  onClick={() => setAvatar(a)}
                  className={`h-8 w-8 rounded-lg text-lg ${avatar === a ? 'bg-emerald-100 ring-2 ring-emerald-500' : 'bg-stone-50'}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            id="roster-add-submit"
            disabled={saving}
            className="btn-3d inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
          >
            <UserPlus className="h-3.5 w-3.5" /> Add to {grade}
          </button>
          <span className="text-[11px] text-stone-500">Next free roll number: {nextRoll}</span>
        </form>

        {error && <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">{error}</p>}
        {notice && !error && <p className="rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">{notice}</p>}

        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
          <table id="roster-table" className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-stone-50 text-[10px] font-black uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2.5">Roll</th>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Class</th>
                <th className="px-3 py-2.5 text-right">Readings</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-500">
                    <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading {grade}…
                  </td>
                </tr>
              )}
              {!loading &&
                students.map((s) =>
                  editing === s.id ? (
                    <tr key={s.id} className="roster-row bg-sky-50/50">
                      <td className="px-3 py-2">
                        <input
                          aria-label="Roll number"
                          value={draft.rollNumber}
                          onChange={(e) => setDraft({ ...draft, rollNumber: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          className={`${inputCls} w-16`}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <select aria-label="Picture" value={draft.avatar} onChange={(e) => setDraft({ ...draft, avatar: e.target.value })} className={inputCls}>
                            {AVATARS.map((a) => (
                              <option key={a}>{a}</option>
                            ))}
                          </select>
                          <input aria-label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`${inputCls} w-48`} />
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <select aria-label="Class" value={draft.grade} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} className={inputCls}>
                          {GRADES.map((g) => (
                            <option key={g}>{g}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">{s.sessionsCount}</td>
                      <td className="px-3 py-2" />
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => saveEdit(s)} disabled={saving} className="roster-save mr-1 rounded-lg bg-sky-600 p-1.5 text-white" aria-label="Save">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-stone-200 p-1.5" aria-label="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id} data-roll={s.rollNumber} className={`roster-row ${s.active ? '' : 'text-stone-400'}`}>
                      <td className="px-3 py-2.5 font-bold">{s.rollNumber}</td>
                      <td className="px-3 py-2.5 font-black text-stone-900">
                        <span className={s.active ? '' : 'opacity-50'}>
                          {s.avatar} {s.name}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{grade}</td>
                      <td className="px-3 py-2.5 text-right">{s.sessionsCount}</td>
                      <td className="px-3 py-2.5">
                        {s.active ? (
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">Active</span>
                        ) : (
                          <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-black text-stone-500">Left school</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {s.active && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(s.id);
                              setDraft({ name: s.name, rollNumber: s.rollNumber, grade, avatar: s.avatar });
                            }}
                            className="roster-edit mr-1 inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold hover:border-sky-300"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            if (s.active && !window.confirm(`Mark ${s.name} as left school? They will not be able to sign in. Their progress is kept.`)) return;
                            void save(s, { active: !s.active }, s.active ? `${s.name} can no longer sign in.` : `${s.name} can sign in again.`);
                          }}
                          className="roster-toggle rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold hover:border-rose-300"
                        >
                          {s.active ? 'Left school' : 'Bring back'}
                        </button>
                      </td>
                    </tr>
                  )
                )}
              {!loading && students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-stone-500">
                    No students in {grade} yet — add the first one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
