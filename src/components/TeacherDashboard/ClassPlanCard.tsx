import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { backendApi, ClassPlan } from '../../services/backendApi';

// "Plan my week": Shakthi Mitra turns this class's real numbers into 3-4
// things the teacher can do in class this week. Written only on request.
export const ClassPlanCard: React.FC<{ grade: string }> = ({ grade }) => {
  const [plan, setPlan] = useState<ClassPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPlan(null);
    setError('');
  }, [grade]);

  const make = async (refresh = false) => {
    setLoading(true);
    setError('');
    try {
      setPlan(await backendApi.classPlan(grade, refresh));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not write a plan right now.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="class-plan" className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-sm font-black text-stone-900">
            <Sparkles className="h-4 w-4 text-violet-600" /> This week's plan for {grade}
          </h3>
          <p className="text-[11px] text-stone-600">Shakthi Mitra reads your class's numbers and suggests what to do next.</p>
        </div>
        <button
          type="button"
          id="btn-class-plan"
          onClick={() => void make(Boolean(plan))}
          disabled={loading}
          className="btn-3d inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : plan ? <RefreshCw className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? 'Writing…' : plan ? 'Write again' : 'Plan my week'}
        </button>
      </div>
      {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{error}</p>}
      {plan && (
        <div className="mt-3 space-y-3">
          {plan.summary && <p className="text-sm font-semibold text-stone-800">{plan.summary}</p>}
          <ol className="grid gap-2 md:grid-cols-2">
            {plan.actions.map((a, i) => (
              <li key={a.title} className="class-plan-action rounded-xl border border-violet-100 bg-white p-3">
                <p className="text-xs font-black text-violet-800">
                  {i + 1}. {a.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-stone-700">{a.detail}</p>
                {a.students.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {a.students.map((n) => (
                      <span key={n} className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-800">
                        {n}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
          {plan.wordsToPractise.length > 0 && (
            <p className="text-xs text-stone-700">
              <span className="font-black">Words to practise together: </span>
              {plan.wordsToPractise.join(', ')}
            </p>
          )}
          <p className="text-[10px] text-stone-500">Suggestions only — written by AI from this class's readings. Use your own judgement.</p>
        </div>
      )}
    </div>
  );
};
