import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Stethoscope } from 'lucide-react';
import { firebaseAuth } from '../../services/firebase';

interface CheckResult {
  group: string;
  name: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
  ms: number;
}

interface SystemCheckReport {
  startedAt: string;
  finishedAt: string;
  summary: { pass: number; warn: number; fail: number };
  results: CheckResult[];
}

async function authHeaders(): Promise<Record<string, string>> {
  await firebaseAuth?.authStateReady?.().catch(() => undefined);
  const token = await firebaseAuth?.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const ICON = {
  pass: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />,
  warn: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />,
  fail: <XCircle className="h-4 w-4 shrink-0 text-rose-400" />,
};

interface PronunciationResult {
  text: string;
  code: string;
  source: string;
  speaker: string;
  trials: number;
  passes: number;
  heard: string[];
  geminiHeard?: string[];
}

interface PronunciationReport {
  finishedAt: string;
  variants: Array<{ name: string; trials: number; passRate: number; byLanguage: Record<string, number> }>;
  results: PronunciationResult[];
}

const LANG_LABEL: Record<string, string> = { 'te-IN': 'Telugu', 'hi-IN': 'Hindi', 'en-IN': 'English' };

// Every word and line a child can hear, spoken by the live voice and heard
// back by speech recognition; lists the ones that didn't come back exactly.
const PronunciationSection: React.FC = () => {
  const [report, setReport] = useState<PronunciationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch('/api/superadmin/pronunciation-check', { headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setReport(data.report || null);
      setRunning(Boolean(data.running));
      return Boolean(data.running);
    } catch (e: any) {
      setError(e?.message || 'Could not load the pronunciation check.');
      return false;
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(async () => {
      if (!(await load())) window.clearInterval(timer);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [running]);

  const runNow = async () => {
    setError(null);
    try {
      const res = await fetch('/api/superadmin/pronunciation-check', { method: 'POST', headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setRunning(true);
    } catch (e: any) {
      setError(e?.message || 'The check could not start.');
    }
  };

  const misses = (report?.results || []).filter((r) => r.passes < r.trials);
  const summary = report?.variants?.[0];

  return (
    <div id="pronunciation-check" className="space-y-3 rounded-xl border border-stone-800 bg-stone-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Pronunciation of every word</h3>
          <p className="text-xs text-stone-400">
            Every dictionary word and sentence, Learn &amp; Play card and line, spoken and heard back (about 7 minutes).
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          id="btn-run-pronunciation-check"
          className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-3 py-1.5 text-xs font-black text-white disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
          {running ? 'Checking every word…' : 'Check every word'}
        </button>
      </div>
      {error && <p className="text-xs font-bold text-rose-400">{error}</p>}
      {!report && !error && <p className="text-xs text-stone-400">{running ? 'Running…' : 'Not run yet.'}</p>}
      {report && summary && (
        <>
          <p className="text-xs font-bold text-stone-300">
            {summary.passRate}% of {summary.trials} tries heard back exactly ·{' '}
            {Object.entries(summary.byLanguage)
              .map(([code, rate]) => `${LANG_LABEL[code] || code} ${rate}%`)
              .join(' · ')}{' '}
            <span className="font-semibold text-stone-500">({new Date(report.finishedAt).toLocaleString()})</span>
          </p>
          {misses.length === 0 ? (
            <p className="text-xs font-bold text-emerald-400">Every word and line came back exactly.</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {misses.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  {r.passes === 0 ? ICON.fail : ICON.warn}
                  <span className="min-w-0">
                    <span className="font-bold text-stone-200">{r.text}</span>{' '}
                    <span className="text-stone-500">
                      ({LANG_LABEL[r.code] || r.code}, {r.speaker}, {r.passes}/{r.trials})
                    </span>
                    <span className="block break-words text-stone-400">
                      heard: {r.heard.map((h) => `"${h}"`).join(', ')}
                      {r.geminiHeard?.length ? ` · second opinion: ${r.geminiHeard.map((h) => `"${h}"`).join(', ')}` : ''}
                    </span>
                    <span className="block text-[10px] text-stone-600">{r.source}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

// Live check of Firestore, every Sarvam/Gemini key and each voice (spoken,
// then heard back by speech recognition). Open it before a classroom test.
export const SystemCheckPanel: React.FC = () => {
  const [report, setReport] = useState<SystemCheckReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/superadmin/system-check', { headers: await authHeaders() });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        setReport(data.report || null);
        setRunning(Boolean(data.running));
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Could not load the system check.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runNow = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/superadmin/system-check', { method: 'POST', headers: await authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setReport(data.report);
    } catch (e: any) {
      setError(e?.message || 'The check could not run.');
    } finally {
      setRunning(false);
    }
  };

  const groups = report ? [...new Set(report.results.map((r) => r.group))] : [];

  return (
    <section id="system-check" className="space-y-4 rounded-2xl border border-stone-800 bg-stone-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black text-white">
            <Stethoscope className="h-5 w-5 text-sky-400" /> System check
          </h2>
          <p className="text-xs text-stone-400">
            Database, every voice and AI key, and each voice spoken then heard back. Run it before a classroom test (about a minute).
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          id="btn-run-system-check"
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-black text-white disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
          {running ? 'Checking…' : 'Run check now'}
        </button>
      </div>

      {error && <p className="text-sm font-bold text-rose-400">{error}</p>}
      {!report && !error && <p className="text-sm text-stone-400">{running ? 'A check is running…' : 'No check has run yet.'}</p>}

      {report && (
        <>
          <div className="flex flex-wrap gap-3 text-sm font-black">
            <span className="rounded-lg bg-emerald-500/15 px-3 py-1 text-emerald-300">{report.summary.pass} passed</span>
            <span className="rounded-lg bg-amber-500/15 px-3 py-1 text-amber-300">{report.summary.warn} to listen to</span>
            <span className="rounded-lg bg-rose-500/15 px-3 py-1 text-rose-300">{report.summary.fail} failed</span>
            <span className="self-center text-xs font-semibold text-stone-500">
              {new Date(report.finishedAt).toLocaleString()}
            </span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.map((group) => (
              <div key={group} className="rounded-xl border border-stone-800 bg-stone-950/60 p-3">
                <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-stone-400">{group}</h3>
                <ul className="space-y-1.5">
                  {report.results
                    .filter((r) => r.group === group)
                    .map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        {ICON[r.status]}
                        <span className="min-w-0">
                          <span className="font-bold text-stone-200">{r.name}</span>
                          <span className="block break-words text-stone-400">{r.detail}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
      <PronunciationSection />
    </section>
  );
};
