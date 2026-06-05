import { useState } from 'react';

const fmt = (n) => '₪' + Number(n).toLocaleString('he-IL');

const Card = ({ children, style = {} }) => (
  <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e9ecef', ...style }}>
    {children}
  </div>
);

const ProgressBar = ({ pct, color }) => (
  <div style={{ background: '#f3f4f6', borderRadius: 99, height: 8, overflow: 'hidden', flex: 1 }}>
    <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(pct, 100)}%`, background: color, transition: 'width 0.4s' }} />
  </div>
);

const statusColor = (pct) =>
  pct > 100 ? '#dc2626' : pct >= 85 ? '#f59e0b' : pct >= 60 ? '#0891b2' : '#16a34a';

const SECTIONS = [
  { key: 'operationalExpenses', label: 'הוצאות תפעוליות', color: '#cc0000', bg: '#fff5f5', border: '#fecaca' },
  { key: 'fuelPurchases',       label: 'רכישת דלקים',    color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  { key: 'salaries',            label: 'משכורות',         color: '#3730a3', bg: '#eef2ff', border: '#c7d2fe' },
];

export default function WorkPlanBudget({ data, budgetLimits, onSetBudget }) {
  const [drafts,   setDrafts]   = useState({});
  const [expanded, setExpanded] = useState({ operationalExpenses: true, fuelPurchases: true, salaries: true });

  const opEx  = data?.operationalExpenses || [];
  const fuel  = data?.fuelPurchases       || [];
  const sal   = data?.salaries            || [];

  const getItems = (key) => key === 'operationalExpenses' ? opEx : key === 'fuelPurchases' ? fuel : sal;

  const itemBudget = (item) => budgetLimits[item.name] ?? item.amount;
  const secActual  = (items) => items.reduce((s, e) => s + e.amount, 0);
  const secBudget  = (items) => items.reduce((s, e) => s + itemBudget(e), 0);

  const totalActual = secActual(opEx) + secActual(fuel) + secActual(sal);
  const totalBudget = secBudget(opEx) + secBudget(fuel) + secBudget(sal);
  const totalPct    = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;

  const saveDraft = (name) => {
    const v = drafts[name];
    if (v !== undefined && v !== '' && !isNaN(+v) && +v > 0) onSetBudget(name, +v);
    setDrafts(p => { const n = { ...p }; delete n[name]; return n; });
  };

  const inputStyle = {
    padding: '5px 8px', borderRadius: 7, border: '1px solid #e9ecef',
    fontSize: 12, width: 100, outline: 'none', background: '#f8fafc', textAlign: 'left',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Summary cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'סה"כ מתוכנן',  value: fmt(totalActual), color: '#cc0000', border: '#fecaca', bg: '#fff5f5' },
          { label: 'סה"כ תקציב',   value: fmt(totalBudget), color: '#1e2d3d', border: '#e9ecef', bg: '#f8fafc' },
          { label: 'ניצול תקציב',  value: `${totalPct.toFixed(1)}%`, color: statusColor(totalPct), border: '#e9ecef', bg: '#f8fafc' },
          { label: 'פער מהתקציב',  value: fmt(totalBudget - totalActual), color: totalBudget >= totalActual ? '#16a34a' : '#dc2626', border: totalBudget >= totalActual ? '#bbf7d0' : '#fecaca', bg: totalBudget >= totalActual ? '#f0fdf4' : '#fff5f5' },
        ].map((k, i) => (
          <div key={i} style={{ background: k.bg, borderRadius: 14, padding: '18px 20px', border: `1px solid ${k.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, fontWeight: 600 }}>{k.label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Section breakdown ── */}
      {SECTIONS.map(({ key, label, color, bg, border }) => {
        const items  = getItems(key);
        const actual = secActual(items);
        const budget = secBudget(items);
        const pct    = budget > 0 ? (actual / budget) * 100 : 0;
        const sc     = statusColor(pct);
        const open   = expanded[key];

        return (
          <Card key={key}>
            {/* Section header */}
            <button
              onClick={() => setExpanded(e => ({ ...e, [key]: !e[key] }))}
              style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'right' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: open ? 16 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ background: bg, color, border: `1px solid ${border}`, borderRadius: 8, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>{label}</span>
                  <span style={{ fontSize: 13, color: '#6b7280' }}>{items.length} סעיפים</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>מתוכנן: <b style={{ color }}>{fmt(actual)}</b></span>
                  <span style={{ fontSize: 13, color: '#9ca3af' }}>תקציב: <b style={{ color: '#1e2d3d' }}>{fmt(budget)}</b></span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sc, minWidth: 48 }}>{pct.toFixed(0)}%</span>
                  <span style={{ color: '#9ca3af', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
                </div>
              </div>
              {open && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ProgressBar pct={pct} color={sc} />
                  </div>
                </div>
              )}
            </button>

            {open && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                    {['סעיף', 'מתוכנן', 'תקציב', 'ניצול', 'פער', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const bud    = itemBudget(item);
                    const p      = bud > 0 ? (item.amount / bud) * 100 : 0;
                    const sc2    = statusColor(p);
                    const gap    = bud - item.amount;
                    const draft  = drafts[item.name];

                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e2d3d' }}>{item.name}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color }}>{fmt(item.amount)}</td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                            <input
                              type="number" min="0"
                              value={draft ?? bud}
                              onChange={e => setDrafts(p => ({ ...p, [item.name]: e.target.value }))}
                              onBlur={() => saveDraft(item.name)}
                              onKeyDown={e => e.key === 'Enter' && saveDraft(item.name)}
                              style={inputStyle}
                            />
                            {draft !== undefined && (
                              <button onClick={() => saveDraft(item.name)}
                                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                                ✓
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', minWidth: 130 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ProgressBar pct={p} color={sc2} />
                            <span style={{ fontSize: 11, fontWeight: 700, color: sc2, flexShrink: 0 }}>{p.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 700, color: gap >= 0 ? '#16a34a' : '#dc2626' }}>
                          {gap >= 0 ? '+' : ''}{fmt(gap)}
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          {p > 100 && <span style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>חריגה</span>}
                          {p >= 85 && p <= 100 && <span style={{ background: '#fffbeb', color: '#f59e0b', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700 }}>⚠ קרוב לגבול</span>}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Section total */}
                  <tr style={{ background, borderTop: `2px solid ${border}` }}>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: '#1e2d3d' }}>סה"כ</td>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color }}>{fmt(actual)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: '#1e2d3d' }}>{fmt(budget)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ProgressBar pct={pct} color={sc} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: sc }}>{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 800, color: budget >= actual ? '#16a34a' : '#dc2626' }}>
                      {budget >= actual ? '+' : ''}{fmt(budget - actual)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            )}
          </Card>
        );
      })}

      <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
        לחץ על שדה התקציב לעריכה · Enter או לחץ מחוץ לשדה לשמירה
      </p>
    </div>
  );
}
