import React, { useRef, useState } from 'react';

// Small dependency-free SVG charts for the class dashboard. One hue per
// chart (a single series never needs a legend), thin marks with rounded data
// ends on the baseline, a recessive grid, and a hover tooltip on every mark.
export const VIZ = {
  series: '#2a78d6',
  seriesSoft: '#cde2fb',
  grid: '#e7e5e0',
  axis: '#8a8984',
  text: '#0b0b0b',
  textSecondary: '#52514e',
};

type Tip = { x: number; y: number; lines: string[] } | null;

const Tooltip: React.FC<{ tip: Tip }> = ({ tip }) =>
  tip ? (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl border border-stone-200 bg-white px-3 py-2 text-[11px] shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <p className="font-black text-stone-900">{tip.lines[0]}</p>
      {tip.lines.slice(1).map((line) => (
        <p key={line} className="text-stone-600">
          {line}
        </p>
      ))}
    </div>
  ) : null;

const niceMax = (value: number) => {
  if (value <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / pow) * pow;
};

// Vertical bars over time (e.g. readings per day).
export const ColumnChart: React.FC<{
  data: { label: string; value: number; tip: string[] }[];
  height?: number;
  ariaLabel: string;
}> = ({ data, height = 170, ariaLabel }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const [active, setActive] = useState<number | null>(null);
  const width = 560;
  const pad = { top: 10, right: 8, bottom: 22, left: 28 };
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(4, Math.min(22, slot - 6));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];

  const show = (i: number, e: React.MouseEvent | React.FocusEvent) => {
    const box = wrap.current?.getBoundingClientRect();
    const target = (e.currentTarget as SVGElement).getBoundingClientRect();
    if (!box) return;
    setActive(i);
    setTip({ x: target.left - box.left + target.width / 2, y: target.top - box.top, lines: data[i].tip });
  };

  return (
    <div ref={wrap} className="relative w-full" onMouseLeave={() => { setTip(null); setActive(null); }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke={VIZ.grid} strokeWidth={1} />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill={VIZ.axis}>
              {Math.round(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const h = Math.max(0, y(0) - y(d.value));
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={d.label}>
              {h > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(d.value) + r} Q${x},${y(d.value)} ${x + r},${y(d.value)} H${x + barW - r} Q${x + barW},${y(d.value)} ${x + barW},${y(d.value) + r} V${y(0)} Z`}
                  fill={VIZ.series}
                  opacity={active === null || active === i ? 1 : 0.45}
                />
              )}
              {/* Hit target taller and wider than the bar */}
              <rect
                x={pad.left + i * slot}
                y={pad.top}
                width={slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={d.tip.join(', ')}
                onMouseEnter={(e) => show(i, e)}
                onFocus={(e) => show(i, e)}
                onBlur={() => { setTip(null); setActive(null); }}
              />
              {(i % 2 === 0 || data.length <= 8) && (
                <text x={pad.left + i * slot + slot / 2} y={height - 6} textAnchor="middle" fontSize={9} fill={VIZ.axis}>
                  {d.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
};

// A 0-100 line over time with a crosshair; gaps where there is no value.
export const PercentLineChart: React.FC<{
  data: { label: string; value: number | null; tip: string[] }[];
  height?: number;
  ariaLabel: string;
}> = ({ data, height = 170, ariaLabel }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const [active, setActive] = useState<number | null>(null);
  const width = 560;
  const pad = { top: 12, right: 12, bottom: 22, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / 100) * innerH;

  // Split into runs of consecutive values so missing days are gaps.
  const runs: { i: number; v: number }[][] = [];
  data.forEach((d, i) => {
    if (d.value === null) return;
    const last = runs[runs.length - 1];
    if (last && last[last.length - 1].i === i - 1) last.push({ i, v: d.value });
    else runs.push([{ i, v: d.value }]);
  });

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = wrap.current?.getBoundingClientRect();
    const svgBox = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    if (!box) return;
    const rel = ((e.clientX - svgBox.left) / svgBox.width) * width;
    const i = Math.max(0, Math.min(data.length - 1, Math.round(((rel - pad.left) / innerW) * (data.length - 1))));
    setActive(i);
    const d = data[i];
    const px = (x(i) / width) * svgBox.width + (svgBox.left - box.left);
    const py = ((d.value === null ? pad.top + innerH / 2 : y(d.value)) / height) * svgBox.height + (svgBox.top - box.top);
    setTip({ x: px, y: py, lines: d.tip });
  };

  return (
    <div ref={wrap} className="relative w-full" onMouseLeave={() => { setTip(null); setActive(null); }}>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={ariaLabel}>
        {[0, 50, 70, 100].map((t) => (
          <g key={t}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(t)}
              y2={y(t)}
              stroke={VIZ.grid}
              strokeDasharray={t === 70 ? '4 4' : undefined}
              strokeWidth={1}
            />
            <text x={pad.left - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill={VIZ.axis}>
              {t}%
            </text>
          </g>
        ))}
        <text x={width - pad.right} y={y(70) - 4} textAnchor="end" fontSize={9} fill={VIZ.textSecondary}>
          70% pass mark
        </text>
        {runs.map((run, k) => (
          <g key={k}>
            {run.length > 1 && (
              <polyline
                points={run.map((p) => `${x(p.i)},${y(p.v)}`).join(' ')}
                fill="none"
                stroke={VIZ.series}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {run.map((p) => (
              <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={active === p.i ? 5 : 4} fill={VIZ.series} stroke="#fff" strokeWidth={2} />
            ))}
          </g>
        ))}
        {active !== null && (
          <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + innerH} stroke={VIZ.axis} strokeWidth={1} />
        )}
        {data.map((d, i) =>
          i % 2 === 0 || data.length <= 8 ? (
            <text key={d.label + i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={9} fill={VIZ.axis}>
              {d.label}
            </text>
          ) : null
        )}
        <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} />
      </svg>
      <Tooltip tip={tip} />
    </div>
  );
};

// Horizontal bars with the value written at the end (few categories).
export const BarList: React.FC<{
  rows: { label: string; value: number; note?: string }[];
  unit?: string;
  empty?: string;
}> = ({ rows, unit = '', empty = 'No data yet.' }) => {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-4 text-center text-xs text-stone-500">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.value}${unit}${r.note ? ` · ${r.note}` : ''}`}>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-bold text-stone-800">{r.label}</span>
            <span className="font-black text-stone-900">
              {r.value}
              {unit}
              {r.note && <span className="ml-1.5 font-semibold text-stone-500">{r.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-2.5 w-full rounded-full bg-stone-100">
            <div
              className="h-2.5 rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, background: VIZ.series, minWidth: r.value > 0 ? 6 : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
