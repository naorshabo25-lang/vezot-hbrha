import { useState } from 'react';

const card  = { background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' };
const inpSt = { border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%', background: '#fff', color: '#111827', outline: 'none' };
const lbl   = (txt) => <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{txt}</label>;

export default function BudgetSettings({ categories, budgets, onSetBudget, expenses, expanded, alertsOnly }) {
  const [open,  setOpen]  = useState(!!expanded);
  const [draft, setDraft] = useState({});

  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();
  const getSpend = cat => expenses.filter(e => { const d = new Date(e.date); return e.category === cat && d.getMonth() === m && d.getFullYear() === y; }).reduce((s, e) => s + Number(e.amount), 0);
  const alerts  = categories.filter(cat => { const b = budgets[cat]; return b && getSpend(cat) >= b * 0.8; });
  const save    = () => { Object.entries(draft).forEach(([cat, val]) => { if (val !== '' && !isNaN(val)) onSetBudget(cat, val); }); setDraft({}); };

  if (alertsOnly) {
    return (
      <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <h2 style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 14 }}>התראות תקציב</h2>
        {alerts.length === 0
          ? <p style={{ color: '#9ca3af', fontSize: 14 }}>אין התראות פעילות</p>
          : alerts.map(cat => {
              const budget = Number(budgets[cat]), spend = getSpend(cat), pct = Math.round(spend/budget*100), over = spend > budget;
              return (
                <div key={cat} style={{ background: over ? '#fef2f2' : '#fffbeb', border: `1px solid ${over ? '#fecaca' : '#fde68a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 18 }}>{over ? '🚨' : '⚠️'}</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: over ? '#991b1b' : '#92400e', margin: 0 }}>{cat} — {pct}%</p>
                    <p style={{ fontSize: 12, color: over ? '#b91c1c' : '#a16207', margin: 0 }}>₪{spend.toLocaleString('he-IL')} מתוך ₪{budget.toLocaleString('he-IL')}</p>
                  </div>
                </div>
              );
            })}
      </div>
    );
  }

  return (
    <div style={card}>
      {alerts.length > 0 && (
        <div style={{ padding: '16px 24px 0' }}>
          {alerts.map(cat => {
            const budget = Number(budgets[cat]), spend = getSpend(cat), pct = Math.round(spend/budget*100), over = spend > budget;
            return (
              <div key={cat} style={{ background: over ? '#fef2f2' : '#fffbeb', border: `1px solid ${over ? '#fecaca' : '#fde68a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
                <span>{over ? '🚨' : '⚠️'}</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 13, color: over ? '#991b1b' : '#92400e', margin: 0 }}>{cat} — {over ? 'חריגה' : `${pct}%`}</p>
                  <p style={{ fontSize: 12, color: over ? '#b91c1c' : '#a16207', margin: 0 }}>₪{spend.toLocaleString('he-IL')} / ₪{budget.toLocaleString('he-IL')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>תקציב חודשי</span>
        <span style={{ color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 24px 24px', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ color: '#9ca3af', fontSize: 13, margin: '14px 0 20px' }}>אזהרה תופיע כאשר תגיע ל-80% מהתקציב.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
            {categories.map(cat => {
              const spend = getSpend(cat), budget = Number(draft[cat] ?? budgets[cat] ?? 0);
              const pct = budget ? Math.min(Math.round(spend/budget*100), 100) : 0;
              const over = budget && spend > budget;
              const barColor = over ? '#cc0000' : pct >= 80 ? '#f59e0b' : '#16a34a';
              return (
                <div key={cat}>
                  {lbl(cat)}
                  <input type="number" min="0" placeholder="הגדר תקציב..." value={draft[cat] ?? budgets[cat] ?? ''} onChange={e => setDraft(p => ({ ...p, [cat]: e.target.value }))} style={inpSt} />
                  {budget > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ height: 5, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 99, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                        <span>₪{spend.toLocaleString('he-IL')}</span>
                        <span style={{ color: barColor, fontWeight: 700 }}>{pct}%</span>
                        <span>₪{budget.toLocaleString('he-IL')}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={save} style={{ marginTop: 22, borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#cc0000', color: '#fff', border: 'none', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            שמור תקציב
          </button>
        </div>
      )}
    </div>
  );
}
