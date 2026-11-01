import React from 'react';
import { TlmPictureKind } from '../../data/tlmLibrary';

// A small drawing of each kind of TLM (src/data/tlmLibrary.ts), so a teacher
// sees what to make. Plain SVG shapes, no external images (works offline).

const C = { ink: '#44403c', sky: '#0ea5e9', amber: '#f59e0b', rose: '#f43f5e', green: '#22c55e', violet: '#8b5cf6', paper: '#fffbeb', wood: '#b45309' };

const pictures: Record<TlmPictureKind, React.ReactNode> = {
  cards: (
    <>
      <rect x="22" y="22" width="52" height="66" rx="6" fill="#fff" stroke={C.ink} strokeWidth="2" transform="rotate(-10 48 55)" />
      <rect x="54" y="18" width="52" height="66" rx="6" fill={C.paper} stroke={C.ink} strokeWidth="2" />
      <circle cx="80" cy="42" r="12" fill={C.amber} />
      <text x="80" y="76" textAnchor="middle" fontSize="12" fontWeight="700" fill={C.ink}>sun</text>
      <rect x="88" y="24" width="52" height="66" rx="6" fill="#fff" stroke={C.ink} strokeWidth="2" transform="rotate(10 114 57)" />
      <text x="116" y="62" textAnchor="middle" fontSize="14" fontWeight="700" fill={C.sky} transform="rotate(10 114 57)">cat</text>
    </>
  ),
  wheel: (
    <>
      <circle cx="80" cy="55" r="44" fill={C.paper} stroke={C.ink} strokeWidth="2" />
      {['ా', 'ి', 'ీ', 'ు', 'ూ', 'ె', 'ే', 'ో'].map((s, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <text key={i} x={80 + Math.cos(a) * 34} y={59 + Math.sin(a) * 34} textAnchor="middle" fontSize="13" fill={C.violet}>
            {'క' + s}
          </text>
        );
      })}
      <circle cx="80" cy="55" r="20" fill="#fff" stroke={C.ink} strokeWidth="2" />
      <text x="80" y="61" textAnchor="middle" fontSize="16" fontWeight="700" fill={C.rose}>
        క
      </text>
      <circle cx="80" cy="55" r="2.5" fill={C.ink} />
    </>
  ),
  wall: (
    <>
      <rect x="10" y="10" width="140" height="90" rx="4" fill={C.paper} stroke={C.ink} strokeWidth="2" />
      {['A', 'B', 'C'].map((h, i) => (
        <text key={h} x={30 + i * 50} y="28" fontSize="13" fontWeight="800" fill={C.rose}>
          {h}
        </text>
      ))}
      {[0, 1, 2].map((col) =>
        [0, 1, 2].map((row) => <rect key={`${col}${row}`} x={18 + col * 50} y={36 + row * 20} width="40" height="14" rx="3" fill={[C.sky, C.green, C.amber][row]} opacity="0.75" />)
      )}
    </>
  ),
  strips: (
    <>
      {['The crow saw a pot.', 'It dropped stones.', 'The water came up.'].map((s, i) => (
        <g key={i}>
          <rect x="14" y={16 + i * 28} width="132" height="20" rx="4" fill={[C.paper, '#e0f2fe', '#dcfce7'][i]} stroke={C.ink} strokeWidth="1.5" />
          <text x="22" y={30 + i * 28} fontSize="11" fontWeight="700" fill={C.ink}>
            {s}
          </text>
        </g>
      ))}
    </>
  ),
  chart: (
    <>
      <rect x="18" y="10" width="124" height="90" rx="4" fill="#fff" stroke={C.ink} strokeWidth="2" />
      <rect x="18" y="70" width="124" height="30" fill="#bbf7d0" />
      <circle cx="120" cy="30" r="10" fill={C.amber} />
      <rect x="40" y="44" width="30" height="26" fill="#fde68a" stroke={C.ink} strokeWidth="1.5" />
      <polygon points="36,46 55,30 74,46" fill={C.rose} />
      <line x1="95" y1="70" x2="95" y2="48" stroke={C.wood} strokeWidth="4" />
      <circle cx="95" cy="44" r="12" fill={C.green} />
    </>
  ),
  sequence: (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={10 + i * 50} y="26" width="40" height="52" rx="5" fill="#fff" stroke={C.ink} strokeWidth="2" />
          <text x={30 + i * 50} y="22" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.violet}>
            {i + 1}
          </text>
          <circle cx={30 + i * 50} cy="46" r={6 + i * 3} fill={[C.amber, C.sky, C.green][i]} />
          {i < 2 && <path d={`M${52 + i * 50} 52 l6 0`} stroke={C.ink} strokeWidth="2" markerEnd="url(#arr)" />}
        </g>
      ))}
    </>
  ),
  puppet: (
    <>
      {[50, 110].map((x, i) => (
        <g key={x}>
          <line x1={x} y1="60" x2={x} y2="102" stroke={C.wood} strokeWidth="4" />
          <circle cx={x} cy="40" r="20" fill={i ? '#fde68a' : '#fecaca'} stroke={C.ink} strokeWidth="2" />
          <circle cx={x - 7} cy="36" r="2.5" fill={C.ink} />
          <circle cx={x + 7} cy="36" r="2.5" fill={C.ink} />
          <path d={`M${x - 7} 46 q7 6 14 0`} stroke={C.ink} strokeWidth="2" fill="none" />
        </g>
      ))}
      <path d="M72 22 q8 -10 16 0" stroke={C.sky} strokeWidth="2" fill="none" />
    </>
  ),
  grid: (
    <>
      <rect x="10" y="10" width="140" height="90" fill="#fff" stroke={C.ink} strokeWidth="2" />
      {['క', 'గ', 'త'].map((c, r) =>
        ['', 'ా', 'ి', 'ీ', 'ు'].map((s, k) => (
          <g key={`${r}${k}`}>
            <rect x={14 + k * 27} y={16 + r * 28} width="25" height="25" fill={k === 0 ? '#fee2e2' : '#f5f5f4'} />
            <text x={26 + k * 27} y={34 + r * 28} textAnchor="middle" fontSize="13" fill={k === 0 ? C.rose : C.ink}>
              {c + s}
            </text>
          </g>
        ))
      )}
    </>
  ),
  dice: (
    <>
      <polygon points="50,30 95,18 130,34 85,48" fill="#e0f2fe" stroke={C.ink} strokeWidth="2" />
      <polygon points="50,30 85,48 85,96 50,78" fill="#fef3c7" stroke={C.ink} strokeWidth="2" />
      <polygon points="85,48 130,34 130,82 85,96" fill="#dcfce7" stroke={C.ink} strokeWidth="2" />
      <text x="90" y="37" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.ink}>Who?</text>
      <text x="67" y="66" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.ink}>Why?</text>
      <text x="108" y="70" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.ink}>How?</text>
    </>
  ),
  bundles: (
    <>
      {[0, 1].map((b) => (
        <g key={b}>
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={20 + b * 34 + i * 2.6} y="20" width="2" height="70" fill={C.wood} />
          ))}
          <rect x={18 + b * 34} y="50" width="30" height="6" fill={C.rose} />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={100 + i * 12} y="20" width="3" height="70" fill={C.wood} />
      ))}
      <text x="80" y="105" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.ink}>2 tens + 3 ones = 23</text>
    </>
  ),
  numberline: (
    <>
      <line x1="8" y1="70" x2="152" y2="70" stroke={C.ink} strokeWidth="2.5" />
      {Array.from({ length: 11 }, (_, i) => (
        <g key={i}>
          <line x1={12 + i * 13.6} y1="64" x2={12 + i * 13.6} y2="76" stroke={C.ink} strokeWidth="2" />
          <text x={12 + i * 13.6} y="92" textAnchor="middle" fontSize="10" fill={C.ink}>
            {i}
          </text>
        </g>
      ))}
      {[5, 6, 7].map((i) => (
        <path key={i} d={`M${12 + i * 13.6} 62 q6.8 -18 13.6 0`} stroke={C.rose} strokeWidth="2" fill="none" />
      ))}
      <text x="108" y="36" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.rose}>5 + 3</text>
    </>
  ),
  tenframe: (
    <>
      <rect x="20" y="25" width="120" height="50" fill="#fff" stroke={C.ink} strokeWidth="2" />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i}>
          <rect x={20 + (i % 5) * 24} y={25 + Math.floor(i / 5) * 25} width="24" height="25" fill="none" stroke={C.ink} strokeWidth="1.5" />
          {i < 7 && <circle cx={32 + (i % 5) * 24} cy={37.5 + Math.floor(i / 5) * 25} r="8" fill={i < 5 ? C.rose : C.sky} />}
        </g>
      ))}
      <text x="80" y="95" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.ink}>7 = 5 and 2</text>
    </>
  ),
  abacus: (
    <>
      <rect x="14" y="14" width="132" height="82" rx="4" fill="none" stroke={C.wood} strokeWidth="5" />
      {[0, 1, 2].map((r) => (
        <g key={r}>
          <line x1="16" y1={34 + r * 22} x2="144" y2={34 + r * 22} stroke={C.ink} strokeWidth="1.5" />
          {Array.from({ length: [3, 5, 8][r] }, (_, i) => (
            <circle key={i} cx={24 + i * 11} cy={34 + r * 22} r="5" fill={i < 5 ? C.rose : C.sky} />
          ))}
        </g>
      ))}
    </>
  ),
  pocket: (
    <>
      {['H', 'T', 'O'].map((h, i) => (
        <g key={h}>
          <rect x={14 + i * 46} y="40" width="42" height="50" fill={['#fee2e2', '#e0f2fe', '#dcfce7'][i]} stroke={C.ink} strokeWidth="2" />
          <text x={35 + i * 46} y="34" textAnchor="middle" fontSize="13" fontWeight="800" fill={C.ink}>
            {h}
          </text>
          {Array.from({ length: [3, 4, 5][i] }, (_, k) => (
            <rect key={k} x={18 + i * 46 + k * 7} y="22" width="4" height="34" fill={[C.rose, C.sky, C.green][i]} />
          ))}
        </g>
      ))}
      <text x="80" y="104" textAnchor="middle" fontSize="11" fontWeight="800" fill={C.ink}>345</text>
    </>
  ),
  clock: (
    <>
      <circle cx="80" cy="55" r="44" fill="#fff" stroke={C.ink} strokeWidth="3" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = ((i + 1) / 12) * Math.PI * 2 - Math.PI / 2;
        return (
          <text key={i} x={80 + Math.cos(a) * 35} y={59 + Math.sin(a) * 35} textAnchor="middle" fontSize="10" fill={C.ink}>
            {i + 1}
          </text>
        );
      })}
      <line x1="80" y1="55" x2="80" y2="24" stroke={C.rose} strokeWidth="3" />
      <line x1="80" y1="55" x2="100" y2="55" stroke={C.ink} strokeWidth="4" />
      <circle cx="80" cy="55" r="3" fill={C.ink} />
    </>
  ),
  money: (
    <>
      <rect x="14" y="22" width="80" height="40" rx="4" fill="#bbf7d0" stroke={C.ink} strokeWidth="2" />
      <text x="54" y="48" textAnchor="middle" fontSize="16" fontWeight="800" fill={C.ink}>₹ 20</text>
      <rect x="40" y="52" width="80" height="40" rx="4" fill="#fde68a" stroke={C.ink} strokeWidth="2" />
      <text x="80" y="78" textAnchor="middle" fontSize="16" fontWeight="800" fill={C.ink}>₹ 10</text>
      {[0, 1].map((i) => (
        <g key={i}>
          <circle cx={128 + i * 6} cy={30 + i * 22} r="13" fill="#e7e5e4" stroke={C.ink} strokeWidth="2" />
          <text x={128 + i * 6} y={35 + i * 22} textAnchor="middle" fontSize="11" fontWeight="800" fill={C.ink}>
            ₹{i ? 2 : 5}
          </text>
        </g>
      ))}
    </>
  ),
  fraction: (
    <>
      <circle cx="44" cy="52" r="32" fill="#fff" stroke={C.ink} strokeWidth="2" />
      <path d="M44 52 L44 20 A32 32 0 0 1 76 52 Z" fill={C.amber} />
      <path d="M44 52 L76 52 A32 32 0 0 1 44 84 Z" fill={C.amber} />
      <path d="M44 52 L44 84 A32 32 0 0 1 12 52 Z" fill={C.amber} />
      <line x1="12" y1="52" x2="76" y2="52" stroke={C.ink} strokeWidth="2" />
      <line x1="44" y1="20" x2="44" y2="84" stroke={C.ink} strokeWidth="2" />
      <text x="44" y="104" textAnchor="middle" fontSize="12" fontWeight="800" fill={C.ink}>¾</text>
      {[0, 1, 2].map((r) => (
        <g key={r}>
          {Array.from({ length: [1, 2, 4][r] }, (_, i) => (
            <rect key={i} x={92 + (i * 56) / [1, 2, 4][r]} y={26 + r * 22} width={56 / [1, 2, 4][r]} height="16" fill={[C.rose, C.sky, C.green][r]} stroke="#fff" strokeWidth="2" />
          ))}
        </g>
      ))}
    </>
  ),
  shapes: (
    <>
      <circle cx="34" cy="38" r="20" fill={C.sky} />
      <rect x="66" y="20" width="36" height="36" fill={C.amber} />
      <polygon points="128,18 150,56 106,56" fill={C.rose} />
      <rect x="26" y="70" width="56" height="26" fill={C.green} />
      <polygon points="96,96 110,70 138,70 124,96" fill={C.violet} />
    </>
  ),
  balance: (
    <>
      <path d="M80 18 v8" stroke={C.ink} strokeWidth="3" />
      <path d="M80 26 L30 40 L130 40 Z" fill="none" stroke={C.ink} strokeWidth="3" />
      <line x1="34" y1="40" x2="34" y2="60" stroke={C.ink} strokeWidth="1.5" />
      <line x1="126" y1="40" x2="126" y2="54" stroke={C.ink} strokeWidth="1.5" />
      <path d="M20 60 h28 l-4 12 h-20 z" fill={C.sky} />
      <path d="M112 54 h28 l-4 12 h-20 z" fill={C.sky} />
      <circle cx="34" cy="54" r="7" fill={C.amber} />
      <circle cx="126" cy="50" r="4" fill="#78716c" />
      <rect x="20" y="90" width="120" height="10" fill={C.paper} stroke={C.ink} strokeWidth="1.5" />
      {Array.from({ length: 13 }, (_, i) => (
        <line key={i} x1={20 + i * 10} y1="90" x2={20 + i * 10} y2={i % 5 === 0 ? 98 : 94} stroke={C.ink} strokeWidth="1" />
      ))}
    </>
  ),
  pictograph: (
    <>
      {['🥭', '🍌', '🍎'].map((f, r) => (
        <g key={r}>
          <text x="14" y={34 + r * 26} fontSize="16">
            {f}
          </text>
          {Array.from({ length: [5, 3, 4][r] }, (_, i) => (
            <circle key={i} cx={46 + i * 20} cy={28 + r * 26} r="8" fill={[C.amber, '#facc15', C.rose][r]} />
          ))}
        </g>
      ))}
      <line x1="34" y1="12" x2="34" y2="96" stroke={C.ink} strokeWidth="2" />
    </>
  ),
  jar: (
    <>
      <rect x="50" y="22" width="60" height="78" rx="8" fill="#e0f2fe" stroke={C.ink} strokeWidth="2" />
      <rect x="54" y="14" width="52" height="10" rx="3" fill="#a8a29e" />
      <rect x="54" y="60" width="52" height="36" fill="#fff" opacity="0.8" />
      <ellipse cx="72" cy="66" rx="6" ry="4" fill={C.wood} />
      <path d="M72 66 q2 -20 8 -28" stroke={C.green} strokeWidth="3" fill="none" />
      <ellipse cx="84" cy="36" rx="8" ry="4" fill={C.green} transform="rotate(-20 84 36)" />
      <path d="M72 70 q-4 10 0 22" stroke={C.wood} strokeWidth="2" fill="none" />
    </>
  ),
  calendar: (
    <>
      <rect x="18" y="14" width="124" height="86" rx="4" fill="#fff" stroke={C.ink} strokeWidth="2" />
      <rect x="18" y="14" width="124" height="18" fill={C.rose} />
      <text x="80" y="27" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">JULY</text>
      {Array.from({ length: 14 }, (_, i) => (
        <text key={i} x={30 + (i % 7) * 17} y={50 + Math.floor(i / 7) * 22} textAnchor="middle" fontSize="11">
          {['☀️', '🌧️', '☁️', '☀️', '🌧️', '🌧️', '☀️'][i % 7]}
        </text>
      ))}
    </>
  ),
};

export const TlmPicture: React.FC<{ kind: TlmPictureKind; className?: string; title?: string }> = ({ kind, className = '', title }) => (
  <svg viewBox="0 0 160 110" className={className} role="img" aria-label={title || kind}>
    <defs>
      <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L6,3 L0,6 Z" fill={C.ink} />
      </marker>
    </defs>
    <rect width="160" height="110" rx="10" fill="#fafaf9" />
    {pictures[kind]}
  </svg>
);
