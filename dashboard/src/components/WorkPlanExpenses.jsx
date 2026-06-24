import { useState } from 'react';
import { DEFAULT_OP_EXPENSES, DEFAULT_SALARIES, DEFAULT_FUEL_PURCHASES } from '../defaultWorkPlan';
import MonthSelector from './MonthSelector';

const fmt = n => '₪' + Number(n).toLocaleString('he-IL');

const BAR_COLORS = ['#d32f2f','#e62020','#b30000','#990000','#ff5555','#ff7070','#ff3333'];

const DEFAULT_DATA = {
  operationalExpenses: DEFAULT_OP_EXPENSES,
  salaries:            DEFAULT_SALARIES,
  fuelPurchases:       DEFAULT_FUEL_PURCHASES,
};

/* ── Shared UI ──────────────────────────────────────────────── */
const Card = ({ children, style = {} }) => (
  <div className="card card-pad" style={style}>{children}</div>
);

const SectionTitle = ({ children }) => (
  <p className="section-title">{children}</p>
);

const HBar = ({ label, amount, total, color, sub }) => {
  const pct = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-1)' }}>{label}</span>
        <span style={{ fontSize: 12.5, fontWeight: 800, color, flexShrink: 0 }}>
          {fmt(amount)} <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
      {sub && <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, display: 'block' }}>{sub}</span>}
    </div>
  );
};

const budgetColor = pct =>
  pct > 100 ? 'var(--red)' : pct >= 85 ? '#f59e0b' : pct >= 60 ? 'var(--blue)' : 'var(--green)';

const BudgetCell = ({ item }) => {
  if (!item.budget || item.budget <= 0) {
    return <td className="data-table" style={{ padding: '10px 12px', color: 'var(--text-3)', fontSize: 11 }}>—</td>;
  }
  const pct   = (item.amount / item.budget) * 100;
  const color = budgetColor(pct);
  const gap   = item.budget - item.amount;
  return (
    <td style={{ padding: '10px 12px', minWidth: 140 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <div className="progress-track" style={{ flex: 1, height: 4 }}>
          <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color, height: '100%' }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color, flexShrink: 0 }}>{pct.toFixed(0)}%</span>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmt(item.budget)} · </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: gap >= 0 ? 'var(--green)' : 'var(--red)' }}>
        {gap >= 0 ? '+' : ''}{fmt(gap)}
      </span>
    </td>
  );
};

const EMPTY_FORM = { category: 'operational', name: '', amount: '', budget: '', liters: '', pricePerLiter: '', note: '' };

export default function WorkPlanExpenses({ data: externalData, onChange, monthId, monthLabel, allMonths = [], onMonthSwitch, onNewMonth }) {
  const data = {
    operationalExpenses: externalData?.operationalExpenses || DEFAULT_DATA.operationalExpenses,
    salaries:            externalData?.salaries            || DEFAULT_DATA.salaries,
    fuelPurchases:       externalData?.fuelPurchases       || DEFAULT_DATA.fuelPurchases,
  };
  const clients = externalData?.clients || [];

  const [showForm,       setShowForm]       = useState(false);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [error,          setError]          = useState('');
  const [editing,        setEditing]        = useState(null);
  const [globalPrice,    setGlobalPrice]    = useState('');
  const [showPricePanel, setShowPricePanel] = useState(false);
  const [clientPrices,   setClientPrices]   = useState({});

  const set = (k, v) => setForm(f => {
    const upd = { ...f, [k]: v };
    if (f.category === 'fuel' && (k === 'liters' || k === 'pricePerLiter')) {
      const liters = +(k === 'liters' ? v : f.liters);
      const price  = +(k === 'pricePerLiter' ? v : f.pricePerLiter);
      if (liters > 0 && price > 0) upd.amount = String(Math.round(liters * price));
    }
    return upd;
  });

  const setEf = (k, v) => setEditing(ed => {
    const f = { ...ed.form, [k]: v };
    if (ed.type === 'fuel' && (k === 'liters' || k === 'pricePerLiter')) {
      const liters = +(k === 'liters' ? v : f.liters);
      const price  = +(k === 'pricePerLiter' ? v : f.pricePerLiter);
      if (liters > 0 && price > 0) f.amount = String(Math.round(liters * price));
    }
    return { ...ed, form: f };
  });

  const handleSubmit = () => {
    if (!form.name.trim()) return setError('נא להזין שם');
    if (form.category === 'fuel') {
      if (!form.liters || isNaN(+form.liters) || +form.liters <= 0) return setError('נא להזין כמות ליטרים');
      if (!form.pricePerLiter || isNaN(+form.pricePerLiter) || +form.pricePerLiter <= 0) return setError('נא להזין מחיר לליטר');
    } else {
      if (!form.amount || isNaN(+form.amount) || +form.amount <= 0) return setError('נא להזין סכום תקין');
    }
    const budgetVal = form.budget && +form.budget > 0 ? { budget: +form.budget } : {};
    const entry = form.category === 'fuel'
      ? { name: form.name.trim(), amount: +form.amount, liters: +form.liters, pricePerLiter: +form.pricePerLiter, note: form.note.trim() }
      : { name: form.name.trim(), amount: +form.amount, ...budgetVal, note: form.note.trim() };
    onChange(prev => {
      const base = prev || DEFAULT_DATA;
      if (form.category === 'salary') return { ...base, salaries: [...base.salaries, entry] };
      if (form.category === 'fuel')   return { ...base, fuelPurchases: [...(base.fuelPurchases || []), entry] };
      return { ...base, operationalExpenses: [...base.operationalExpenses, entry] };
    });
    setForm(EMPTY_FORM); setError(''); setShowForm(false);
  };

  const startEdit = (type, idx, item) => {
    const f = type === 'fuel'
      ? { name: item.name, amount: String(item.amount), liters: String(item.liters || ''), pricePerLiter: String(item.pricePerLiter || ''), note: item.note || '' }
      : { name: item.name, amount: String(item.amount), budget: String(item.budget || ''), note: item.note || '' };
    setEditing({ type, idx, form: f });
    setShowForm(false);
  };

  const handleSaveEdit = () => {
    const { type, idx, form: ef } = editing;
    if (!ef.name.trim() || !ef.amount || isNaN(+ef.amount) || +ef.amount <= 0) return;
    const budgetVal = ef.budget && +ef.budget > 0 ? { budget: +ef.budget } : {};
    const updated = type === 'fuel'
      ? { name: ef.name.trim(), amount: +ef.amount, liters: +ef.liters || 0, pricePerLiter: +ef.pricePerLiter || 0, note: ef.note.trim() }
      : { name: ef.name.trim(), amount: +ef.amount, ...budgetVal, note: ef.note.trim() };
    onChange(prev => {
      const base = prev || DEFAULT_DATA;
      if (type === 'op')   { const ops   = [...base.operationalExpenses]; ops[idx]   = updated; return { ...base, operationalExpenses: ops }; }
      if (type === 'fuel') { const fuels = [...(base.fuelPurchases || [])]; fuels[idx] = updated; return { ...base, fuelPurchases: fuels }; }
      const sals = [...base.salaries]; sals[idx] = updated; return { ...base, salaries: sals };
    });
    setEditing(null);
  };

  const handleDelete = (type, idx) => {
    if (!window.confirm('למחוק את הסעיף?')) return;
    onChange(prev => {
      const base = prev || DEFAULT_DATA;
      if (type === 'op')   return { ...base, operationalExpenses: base.operationalExpenses.filter((_, i) => i !== idx) };
      if (type === 'fuel') return { ...base, fuelPurchases: (base.fuelPurchases || []).filter((_, i) => i !== idx) };
      return { ...base, salaries: base.salaries.filter((_, i) => i !== idx) };
    });
    if (editing) setEditing(null);
  };

  const totalOpEx  = data.operationalExpenses.reduce((s, e) => s + e.amount, 0);
  const totalSal   = data.salaries.reduce((s, e) => s + e.amount, 0);
  const totalFuel  = data.fuelPurchases.reduce((s, e) => s + e.amount, 0);
  const totalEx    = totalOpEx + totalSal + totalFuel;

  const sortedFuel = [...data.fuelPurchases].map((item, i) => ({ ...item, _idx: i })).sort((a, b) => b.amount - a.amount);
  const sortedOp   = [...data.operationalExpenses].map((item, i) => ({ ...item, _idx: i })).sort((a, b) => b.amount - a.amount);

  const actionBtn = (color) => ({
    background: 'none', border: 'none', cursor: 'pointer',
    color, fontSize: 14, padding: '2px 5px', borderRadius: 4, lineHeight: 1,
  });

  const editRowStyle = { background: '#fffbeb', borderBottom: '1px solid #fcd34d' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <MonthSelector monthId={monthId} allMonths={allMonths} onMonthSwitch={onMonthSwitch} onNewMonth={onNewMonth} />

      {/* Add button */}
      <div>
        <button
          className={`btn ${showForm ? 'btn-soft' : 'btn-primary'}`}
          onClick={() => { setShowForm(v => !v); setError(''); setEditing(null); }}
        >
          {showForm ? '✕ ביטול' : '+ הוספת הוצאה'}
        </button>

        {showForm && (
          <div className="card card-pad" style={{ marginTop: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14 }}>הוספת הוצאה חדשה</p>

            {/* Category tabs */}
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 0.4, marginBottom: 8 }}>קטגוריה</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['operational','הוצאה תפעולית'],['fuel','רכישת דלקים'],['salary','משכורת']].map(([val, lbl]) => (
                  <button key={val} onClick={() => set('category', val)} style={{
                    padding: '6px 16px', borderRadius: 'var(--r-md)', fontSize: 12.5, fontWeight: 600,
                    cursor: 'pointer', border: `1.5px solid ${form.category === val ? 'var(--red)' : 'var(--border)'}`,
                    background: form.category === val ? 'var(--red-soft)' : 'transparent',
                    color: form.category === val ? 'var(--red)' : 'var(--text-2)',
                  }}>{lbl}</button>
                ))}
              </div>
            </div>

            {/* Fields */}
            {form.category === 'fuel' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr', gap: 12 }}>
                {[
                  { label: 'שם ספק', key: 'name', type: 'text',   placeholder: 'למשל: פז' },
                  { label: 'כמות ליטרים', key: 'liters', type: 'number', placeholder: '0' },
                  { label: 'מחיר לליטר (₪)', key: 'pricePerLiter', type: 'number', step: '0.001', placeholder: '0.000' },
                ].map(({ label, key, ...rest }) => (
                  <div key={key}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>{label}</label>
                    <input className="input" value={form[key]} onChange={e => set(key, e.target.value)} {...rest} />
                  </div>
                ))}
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>סכום כולל (מחושב)</label>
                  <input className="input" value={form.amount ? fmt(+form.amount) : '—'} readOnly
                    style={{ background: 'var(--surface-2)', color: 'var(--orange)', fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>הערה</label>
                  <input className="input" value={form.note} onChange={e => set('note', e.target.value)} placeholder="אופציונלי..." />
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>
                    {form.category === 'salary' ? 'שם עובד' : 'שם הסעיף'}
                  </label>
                  <input className="input" value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder={form.category === 'salary' ? 'למשל: דוד' : 'למשל: דלק'} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>סכום חודשי (₪)</label>
                  <input className="input" type="number" min="0" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>תקציב (₪)</label>
                  <input className="input" type="number" min="0" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="אופציונלי" />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>הערה</label>
                  <input className="input" value={form.note} onChange={e => set('note', e.target.value)} placeholder="אופציונלי..." />
                </div>
              </div>
            )}

            {error && <p style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600, marginTop: 8 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="btn btn-primary" onClick={handleSubmit}>שמור</button>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setError(''); }}>ביטול</button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Row */}
      <div className="grid-3">
        {[
          {
            label: 'הוצאות תפעוליות', value: fmt(totalOpEx), sub: `${data.operationalExpenses.length} סעיפים`,
            bg: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
          },
          {
            label: 'רכישת דלקים', value: fmt(totalFuel), sub: `${data.fuelPurchases.length} ספקים`,
            bg: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
          },
          {
            label: 'משכורות', value: fmt(totalSal), sub: `${data.salaries.length} עובדים`,
            bg: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
          },
          {
            label: 'סה"כ הוצאות', value: fmt(totalEx), sub: 'חודשי · תפעול + דלקים + שכר',
            bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          },
          {
            label: 'סה"כ הוצאות לפני מע"מ', value: fmt(Math.round(totalOpEx + totalFuel)), sub: 'תפעול + דלקים · ללא משכורות',
            bg: 'linear-gradient(135deg, #0891b2 0%, #0369a1 100%)',
          },
          {
            label: 'סה"כ הוצאות אחרי מע"מ', value: fmt(Math.round((totalOpEx + totalFuel) * 1.18)), sub: 'כולל מע"מ 18% · ללא משכורות',
            bg: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
          },
        ].map((k, i) => (
          <div key={i} style={{
            background: k.bg,
            borderRadius: 'var(--r-lg)',
            padding: '18px 20px 16px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3 }}>{k.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid-2-1">
        <Card>
          <SectionTitle>הוצאות תפעוליות — {fmt(totalOpEx)}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sortedOp.map((item, i) => {
              const pct   = (item.amount / sortedOp[0].amount) * 100;
              const color = i === 0 ? 'var(--red)' : i <= 2 ? '#ea580c' : 'var(--border-2)';
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-1)' }}>{item.name}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color, flexShrink: 0, marginRight: 8 }}>{fmt(item.amount)}</span>
                  </div>
                  <div className="progress-track" style={{ height: 5 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: color, height: '100%' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle>הרכב הוצאות — {fmt(totalEx)}</SectionTitle>
          <HBar label="הוצאות תפעוליות" amount={totalOpEx} total={totalEx} color="var(--red)"
            sub={`${data.operationalExpenses.length} סעיפים`} />
          <HBar label="רכישת דלקים" amount={totalFuel} total={totalEx} color="var(--orange)"
            sub={`${data.fuelPurchases.length} ספקים`} />
          <HBar label="משכורות" amount={totalSal} total={totalEx} color="#7c3aed"
            sub={`${data.salaries.length} עובדים`} />
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>סה"כ</span>
            <span style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-1)' }}>{fmt(totalEx)}</span>
          </div>
        </Card>
      </div>

      {/* Salaries card */}
      <Card>
        <SectionTitle>משכורות — {fmt(totalSal)}</SectionTitle>
        <div className="grid-sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
            {data.salaries.map((s, i) => (
              <HBar key={i} label={s.name} amount={s.amount} total={totalSal}
                color={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </div>
          <table className="data-table">
            <thead>
              <tr>
                {['שם', 'משכורת', 'תקציב / ניצול', '% משכר', 'הערה', ''].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.salaries.map((s, i) => {
                const isEd = editing?.type === 'sal' && editing.idx === i;
                return isEd ? (
                  <tr key={i} style={editRowStyle}>
                    <td style={{ padding: '6px 12px' }}><input className="input-sm" value={editing.form.name} onChange={e => setEf('name', e.target.value)} /></td>
                    <td style={{ padding: '6px 12px' }}><input className="input-sm" type="number" value={editing.form.amount} onChange={e => setEf('amount', e.target.value)} style={{ width: 90 }} /></td>
                    <td style={{ padding: '6px 12px' }}><input className="input-sm" type="number" value={editing.form.budget} onChange={e => setEf('budget', e.target.value)} style={{ width: 90 }} placeholder="אופציונלי" /></td>
                    <td style={{ padding: '6px 12px', color: 'var(--text-3)', fontSize: 11 }}>
                      {editing.form.amount && !isNaN(+editing.form.amount) ? ((+editing.form.amount / totalSal) * 100).toFixed(0) + '%' : '—'}
                    </td>
                    <td style={{ padding: '6px 12px' }}><input className="input-sm" value={editing.form.note} onChange={e => setEf('note', e.target.value)} placeholder="הערה..." /></td>
                    <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                      <button onClick={handleSaveEdit} style={actionBtn('var(--green)')}>✓</button>
                      <button onClick={() => setEditing(null)} style={actionBtn('var(--text-3)')}>✕</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</td>
                    <td style={{ color: 'var(--red)', fontWeight: 700 }}>{fmt(s.amount)}</td>
                    <BudgetCell item={s} />
                    <td style={{ color: 'var(--text-2)' }}>{((s.amount / totalSal) * 100).toFixed(0)}%</td>
                    <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{s.note || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button onClick={() => startEdit('sal', i, s)} style={actionBtn('var(--blue)')}>✎</button>
                      <button onClick={() => handleDelete('sal', i)} style={actionBtn('var(--red)')}>🗑</button>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td style={{ fontWeight: 800, color: 'var(--text-1)' }}>סה"כ</td>
                <td style={{ fontWeight: 800, color: 'var(--red)', fontSize: 14 }}>{fmt(totalSal)}</td>
                <td colSpan={4} />
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detailed table */}
      <Card>
        <SectionTitle>רשימת הוצאות מפורטת — סה"כ {fmt(totalEx)}</SectionTitle>
        <table className="data-table">
          <thead>
            <tr>
              {['#', 'סעיף', 'קטגוריה', 'סכום חודשי', 'תקציב / ניצול', 'הערות', ''].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>

            {/* Operational group */}
            <tr>
              <td colSpan={7} style={{ padding: '6px 12px', fontWeight: 700, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--red)', background: 'var(--red-soft)', borderBottom: '1px solid var(--border)' }}>
                הוצאות תפעוליות — {fmt(totalOpEx)}
              </td>
            </tr>
            {sortedOp.map((item, i) => {
              const isEd = editing?.type === 'op' && editing.idx === item._idx;
              return isEd ? (
                <tr key={i} style={editRowStyle}>
                  <td style={{ padding: '6px 12px', color: 'var(--text-3)', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" value={editing.form.name} onChange={e => setEf('name', e.target.value)} /></td>
                  <td style={{ padding: '6px 12px' }}><span className="badge badge-red">תפעול</span></td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" type="number" value={editing.form.amount} onChange={e => setEf('amount', e.target.value)} style={{ width: 100 }} /></td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" type="number" value={editing.form.budget} onChange={e => setEf('budget', e.target.value)} style={{ width: 100 }} placeholder="תקציב..." /></td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" value={editing.form.note} onChange={e => setEf('note', e.target.value)} placeholder="הערה..." /></td>
                  <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={handleSaveEdit} style={actionBtn('var(--green)')}>✓</button>
                    <button onClick={() => setEditing(null)} style={actionBtn('var(--text-3)')}>✕</button>
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td style={{ color: 'var(--text-3)', fontSize: 11, width: 32 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{item.name}</td>
                  <td><span className="badge badge-red">תפעול</span></td>
                  <td style={{ fontWeight: 700, color: 'var(--red)' }}>{fmt(item.amount)}</td>
                  <BudgetCell item={item} />
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{item.note || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit('op', item._idx, item)} style={actionBtn('var(--blue)')}>✎</button>
                    <button onClick={() => handleDelete('op', item._idx)} style={actionBtn('var(--red)')}>🗑</button>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: 'var(--red-soft)', borderTop: '1px solid var(--red-border)', borderBottom: '1px solid var(--red-border)' }}>
              <td colSpan={3} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-2)', fontSize: 12 }}>סה"כ תפעול</td>
              <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--red)', fontSize: 14 }}>{fmt(totalOpEx)}</td>
              <td colSpan={3} />
            </tr>

            <tr><td colSpan={7} style={{ padding: 4 }} /></tr>

            {/* Fuel group */}
            <tr>
              <td colSpan={7} style={{ padding: '6px 12px', fontWeight: 700, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--orange)', background: 'var(--orange-soft)', borderBottom: '1px solid var(--border)' }}>
                רכישת דלקים — {fmt(totalFuel)}
              </td>
            </tr>
            {sortedFuel.map((item, i) => {
              const isEd = editing?.type === 'fuel' && editing.idx === item._idx;
              return isEd ? (
                <tr key={i} style={editRowStyle}>
                  <td style={{ padding: '6px 12px', color: 'var(--text-3)', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" value={editing.form.name} onChange={e => setEf('name', e.target.value)} /></td>
                  <td style={{ padding: '6px 12px' }}><span className="badge badge-orange">דלקים</span></td>
                  <td style={{ padding: '6px 12px' }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input className="input-sm" type="number" value={editing.form.liters} onChange={e => setEf('liters', e.target.value)} style={{ width: 80 }} placeholder="ליטרים" />
                      <span style={{ color: 'var(--text-3)', fontSize: 11 }}>×</span>
                      <input className="input-sm" type="number" step="0.001" value={editing.form.pricePerLiter} onChange={e => setEf('pricePerLiter', e.target.value)} style={{ width: 68 }} placeholder="₪/ל'" />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)' }}>{editing.form.amount ? fmt(+editing.form.amount) : '—'}</span>
                  </td>
                  <td style={{ padding: '6px 12px', color: 'var(--text-3)', fontSize: 11 }}>—</td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" value={editing.form.note} onChange={e => setEf('note', e.target.value)} placeholder="הערה..." /></td>
                  <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={handleSaveEdit} style={actionBtn('var(--green)')}>✓</button>
                    <button onClick={() => setEditing(null)} style={actionBtn('var(--text-3)')}>✕</button>
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td style={{ color: 'var(--text-3)', fontSize: 11, width: 32 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{item.name}</td>
                  <td><span className="badge badge-orange">דלקים</span></td>
                  <td>
                    <span style={{ fontWeight: 700, color: 'var(--orange)' }}>{fmt(item.amount)}</span>
                    {item.liters > 0 && item.pricePerLiter > 0 && (
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                        {Number(item.liters).toLocaleString('he-IL')} ל' × ₪{Number(item.pricePerLiter).toFixed(3)}
                      </span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 11 }}>—</td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{item.note || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit('fuel', item._idx, item)} style={actionBtn('var(--blue)')}>✎</button>
                    <button onClick={() => handleDelete('fuel', item._idx)} style={actionBtn('var(--red)')}>🗑</button>
                  </td>
                </tr>
              );
            })}
            {data.fuelPurchases.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '14px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>אין סעיפים — לחץ "+ הוספת הוצאה" ובחר "רכישת דלקים"</td></tr>
            )}
            <tr style={{ background: 'var(--orange-soft)', borderTop: '1px solid #fed7aa', borderBottom: '1px solid #fed7aa' }}>
              <td colSpan={3} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-2)', fontSize: 12 }}>סה"כ רכישת דלקים</td>
              <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--orange)', fontSize: 14 }}>{fmt(totalFuel)}</td>
              <td colSpan={3} />
            </tr>

            <tr><td colSpan={7} style={{ padding: 4 }} /></tr>

            {/* Salaries group */}
            <tr>
              <td colSpan={7} style={{ padding: '6px 12px', fontWeight: 700, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--purple)', background: 'var(--purple-soft)', borderBottom: '1px solid var(--border)' }}>
                משכורות — {fmt(totalSal)}
              </td>
            </tr>
            {data.salaries.map((s, i) => {
              const isEd = editing?.type === 'sal' && editing.idx === i;
              return isEd ? (
                <tr key={i} style={editRowStyle}>
                  <td style={{ padding: '6px 12px', color: 'var(--text-3)', fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" value={editing.form.name} onChange={e => setEf('name', e.target.value)} /></td>
                  <td style={{ padding: '6px 12px' }}><span className="badge badge-purple">משכורת</span></td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" type="number" value={editing.form.amount} onChange={e => setEf('amount', e.target.value)} style={{ width: 100 }} /></td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" type="number" value={editing.form.budget} onChange={e => setEf('budget', e.target.value)} style={{ width: 100 }} placeholder="תקציב..." /></td>
                  <td style={{ padding: '6px 12px' }}><input className="input-sm" value={editing.form.note} onChange={e => setEf('note', e.target.value)} placeholder="הערה..." /></td>
                  <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                    <button onClick={handleSaveEdit} style={actionBtn('var(--green)')}>✓</button>
                    <button onClick={() => setEditing(null)} style={actionBtn('var(--text-3)')}>✕</button>
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td style={{ color: 'var(--text-3)', fontSize: 11, width: 32 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500, color: 'var(--text-1)' }}>{s.name}</td>
                  <td><span className="badge badge-purple">משכורת</span></td>
                  <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{fmt(s.amount)}</td>
                  <BudgetCell item={s} />
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{s.note || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit('sal', i, s)} style={actionBtn('var(--blue)')}>✎</button>
                    <button onClick={() => handleDelete('sal', i)} style={actionBtn('var(--red)')}>🗑</button>
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: 'var(--purple-soft)', borderTop: '1px solid #ddd6fe', borderBottom: '1px solid #ddd6fe' }}>
              <td colSpan={3} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-2)', fontSize: 12 }}>סה"כ משכורות</td>
              <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--purple)', fontSize: 14 }}>{fmt(totalSal)}</td>
              <td colSpan={3} />
            </tr>

            {/* Grand total */}
            <tr style={{ background: 'var(--text-1)' }}>
              <td colSpan={3} style={{ padding: '12px 12px', fontWeight: 700, color: '#fff', fontSize: 12 }}>
                סה"כ הוצאות חודשיות (תפעול + דלקים + שכר)
              </td>
              <td style={{ padding: '12px 12px', fontWeight: 900, color: '#fff', fontSize: 16 }}>{fmt(totalEx)}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </Card>

      {/* Purchase prices panel */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <SectionTitle style={{ marginBottom: 0 }}>מחירי קניה לדלק (לפי לקוח)</SectionTitle>
          <button
            className={`btn btn-sm ${showPricePanel ? 'btn-soft' : 'btn-ghost'}`}
            onClick={() => setShowPricePanel(v => !v)}
          >
            {showPricePanel ? '✕ סגור' : '✎ עדכון מחירים'}
          </button>
        </div>

        {showPricePanel && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 14 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 10 }}>עדכון מחיר קניה אחיד לכל הלקוחות</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  className="input" type="number" step="0.001" min="0"
                  value={globalPrice}
                  onChange={e => setGlobalPrice(e.target.value)}
                  placeholder="₪ לליטר"
                  style={{ width: 140 }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const p = +globalPrice;
                    if (!p || p <= 0) return;
                    onChange(prev => {
                      const base = prev || {};
                      return { ...base, clients: (base.clients || []).map(c => ({ ...c, purchasePrice: p })) };
                    });
                    setGlobalPrice('');
                  }}
                >
                  החל לכולם
                </button>
              </div>
            </div>

            {clients.length > 0 && (
              <table className="data-table">
                <thead>
                  <tr>
                    {['לקוח', 'מחיר קניה נוכחי', 'מחיר חדש', ''].map(h => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ color: c.purchasePrice > 0 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500 }}>
                        {c.purchasePrice > 0 ? `₪${Number(c.purchasePrice).toFixed(3)}` : '—'}
                      </td>
                      <td style={{ width: 140 }}>
                        <input
                          className="input-sm"
                          type="number" step="0.001" min="0"
                          value={clientPrices[c.name] ?? ''}
                          onChange={e => setClientPrices(p => ({ ...p, [c.name]: e.target.value }))}
                          placeholder={c.purchasePrice > 0 ? String(c.purchasePrice) : '₪ לליטר'}
                          style={{ width: '100%' }}
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-sm"
                          disabled={!clientPrices[c.name]}
                          style={{
                            background: clientPrices[c.name] ? 'var(--green)' : 'var(--surface-2)',
                            color: clientPrices[c.name] ? '#fff' : 'var(--text-3)',
                            border: 'none',
                          }}
                          onClick={() => {
                            const p = +clientPrices[c.name];
                            if (!p || p <= 0) return;
                            onChange(prev => {
                              const base = prev || {};
                              return { ...base, clients: (base.clients || []).map(cl => cl.name === c.name ? { ...cl, purchasePrice: p } : cl) };
                            });
                            setClientPrices(p => { const n = { ...p }; delete n[c.name]; return n; });
                          }}
                        >
                          עדכן
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {clients.length === 0 && (
              <p style={{ color: 'var(--text-3)', fontSize: 13, textAlign: 'center', padding: 16 }}>אין לקוחות — הוסף לקוחות בלשונית "לקוחות והזמנות"</p>
            )}
          </div>
        )}

        {clients.filter(c => c.purchasePrice > 0).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {clients.filter(c => c.purchasePrice > 0).map((c, i) => (
              <span key={i} className="badge badge-orange">
                {c.name}: ₪{Number(c.purchasePrice).toFixed(3)}
              </span>
            ))}
          </div>
        )}
        {clients.filter(c => c.purchasePrice > 0).length === 0 && !showPricePanel && (
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>לא הוגדרו מחירי קניה — לחץ "עדכון מחירים"</p>
        )}
      </Card>

    </div>
  );
}
