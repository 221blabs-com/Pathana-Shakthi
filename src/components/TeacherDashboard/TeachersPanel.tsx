import React, { useState } from 'react';
import { Copy, KeyRound, Loader2, Pencil, UserPlus, X } from 'lucide-react';
import { backendApi, SchoolTeacher } from '../../services/backendApi';
import { ALL_GRADES } from '../../data/grades';

const GRADES: string[] = ALL_GRADES;

const when = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never';

const GradePicker: React.FC<{ value: string[]; onChange: (grades: string[]) => void }> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {GRADES.map((g) => {
      const on = value.includes(g);
      return (
        <button
          key={g}
          type="button"
          aria-pressed={on}
          onClick={() => onChange(on ? value.filter((x) => x !== g) : GRADES.filter((x) => x === g || value.includes(x)))}
          className={`teacher-grade rounded-lg px-2.5 py-1 text-xs font-black ${on ? 'bg-sky-600 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}
        >
          {g}
        </button>
      );
    })}
  </div>
);

// The headmaster's teacher accounts: create one (a temporary password is
// shown once, to pass on), change a teacher's classes, reset a forgotten
// password, or deactivate a teacher who has left.
export const TeachersPanel: React.FC<{ teachers: SchoolTeacher[]; onChanged: () => void }> = ({ teachers, onChanged }) => {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', grades: [] as string[] });
  const [editing, setEditing] = useState<string | null>(null);
  const [editGrades, setEditGrades] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [secret, setSecret] = useState<{ name: string; email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the change.');
    } finally {
      setBusy(false);
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { teacher, temporaryPassword } = await backendApi.school.addTeacher(form);
      setSecret({ name: teacher.name, email: teacher.email, password: temporaryPassword });
      setCopied(false);
      setAdding(false);
      setForm({ name: '', email: '', grades: [] });
    });
  };

  const reset = (t: SchoolTeacher) => {
    if (!window.confirm(`Make a new password for ${t.name}? Their old password stops working.`)) return;
    void run(async () => {
      const { temporaryPassword } = await backendApi.school.updateTeacher(t.uid, { resetPassword: true });
      if (temporaryPassword) {
        setSecret({ name: t.name, email: t.email, password: temporaryPassword });
        setCopied(false);
      }
    });
  };

  const inputCls = 'mt-1 w-full rounded-lg border border-stone-300 px-2.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400';

  return (
    <section id="teachers-panel" className="mb-8 overflow-hidden rounded-3xl border border-sky-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-sky-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-stone-900">Teachers</h2>
          <p className="text-xs text-stone-600">Accounts, classes and what each teacher has published.</p>
        </div>
        <button
          type="button"
          id="btn-add-teacher"
          onClick={() => setAdding((v) => !v)}
          className="btn-3d inline-flex items-center gap-1.5 self-start rounded-xl bg-sky-600 px-3 py-2 text-xs font-black text-white"
        >
          <UserPlus className="h-4 w-4" /> Add a teacher
        </button>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {secret && (
          <div id="teacher-temp-password" role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-stone-800">
                <p className="font-black">Sign-in details for {secret.name}</p>
                <p className="mt-1">
                  Email: <b>{secret.email}</b>
                </p>
                <p>
                  Temporary password: <code className="rounded bg-white px-1.5 py-0.5 text-sm font-black tracking-wider">{secret.password}</code>
                </p>
                <p className="mt-1 text-[11px] text-stone-600">This password is shown only once. Give it to the teacher privately.</p>
              </div>
              <button type="button" onClick={() => setSecret(null)} aria-label="Close" className="rounded-lg p-1 hover:bg-amber-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(`Pathana Shakthi sign-in\nEmail: ${secret.email}\nPassword: ${secret.password}`).then(() => setCopied(true));
              }}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-[11px] font-bold"
            >
              <Copy className="h-3 w-3" /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}

        {adding && (
          <form id="add-teacher-form" onSubmit={create} className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
            <label className="text-[10px] font-black uppercase text-stone-500">
              Full name
              <input id="teacher-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. K. Ratna Kumari" className={inputCls} />
            </label>
            <label className="text-[10px] font-black uppercase text-stone-500">
              Email (used to sign in)
              <input id="teacher-email" required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@school.gov.in" className={inputCls} />
            </label>
            <div className="text-[10px] font-black uppercase text-stone-500 sm:col-span-2">
              Classes they teach
              <div className="mt-1">
                <GradePicker value={form.grades} onChange={(grades) => setForm({ ...form, grades })} />
              </div>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                id="add-teacher-submit"
                disabled={busy || !form.grades.length}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Create account
              </button>
              <button type="button" onClick={() => setAdding(false)} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold">
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">{error}</p>}

        <div className="overflow-x-auto rounded-2xl border border-stone-200">
          <table id="teachers-table" className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-stone-50 text-[10px] font-black uppercase text-stone-500">
              <tr>
                <th className="px-3 py-2.5">Teacher</th>
                <th className="px-3 py-2.5">Classes</th>
                <th className="px-3 py-2.5 text-right">Books</th>
                <th className="px-3 py-2.5 text-right">Chapters</th>
                <th className="px-3 py-2.5">Last published</th>
                <th className="px-3 py-2.5">Last sign-in</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {teachers.map((t) => (
                <tr key={t.uid} className={`teacher-row ${t.active ? '' : 'text-stone-400'}`} data-email={t.email}>
                  <td className="px-3 py-2.5">
                    <p className="font-black text-stone-900">
                      {t.avatar} {t.name} {!t.active && <span className="ml-1 rounded bg-stone-100 px-1.5 text-[10px] text-stone-500">Deactivated</span>}
                    </p>
                    <p className="text-[11px] text-stone-500">{t.email}</p>
                  </td>
                  <td className="px-3 py-2.5">
                    {editing === t.uid ? (
                      <div className="space-y-1.5">
                        <GradePicker value={editGrades} onChange={setEditGrades} />
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={busy || !editGrades.length}
                            onClick={() =>
                              void run(async () => {
                                await backendApi.school.updateTeacher(t.uid, { grades: editGrades });
                                setEditing(null);
                              })
                            }
                            className="teacher-save-grades rounded-lg bg-sky-600 px-2 py-1 text-[11px] font-black text-white disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="font-semibold">{t.grades.length ? t.grades.join(', ') : '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">{t.books ?? 0}</td>
                  <td className="px-3 py-2.5 text-right">{t.chapters ?? 0}</td>
                  <td className="px-3 py-2.5">{when(t.lastPublishedAt)}</td>
                  <td className="px-3 py-2.5">{when(t.lastSignInAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    {t.active && (
                      <>
                        <button
                          type="button"
                          title="Change classes"
                          onClick={() => {
                            setEditing(t.uid);
                            setEditGrades(t.grades);
                          }}
                          className="teacher-edit mr-1 rounded-lg border border-stone-200 p-1.5 hover:border-sky-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" title="New password" onClick={() => reset(t)} className="teacher-reset mr-1 rounded-lg border border-stone-200 p-1.5 hover:border-amber-300">
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (t.active && !window.confirm(`Deactivate ${t.name}? They will be signed out and cannot sign in. Their books stay published.`)) return;
                        void run(async () => {
                          await backendApi.school.updateTeacher(t.uid, { active: !t.active });
                        });
                      }}
                      className="teacher-toggle rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-bold hover:border-rose-300"
                    >
                      {t.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-stone-500">
                    No teacher accounts yet.
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
