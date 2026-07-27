import { useState } from 'react';
import { DEFAULT_WORKPLAN, DEFAULT_CLIENTS } from '../defaultWorkPlan';

const fmt = n => '₪' + Number(n).toLocaleString('he-IL');

const Card = ({ children, style = {} }) => (
  <div className="card card-pad" style={style}>{children}</div>
);

const statusInfo = (limit, balance) => {
  if (!limit) return { label: 'ללא מסגרת', color: 'var(--text-3)', bg: 'var(--surface-2)', pct: 0 };
  const pct = (balance / limit) * 100;
  if (pct > 100) return { label: 'חריגה',        color: 'var(--red)',    bg: 'var(--red-soft)',    pct };
  if (pct >= 85)  return { label: 'קרוב לגבול',  color: 'var(--orange)', bg: 'var(--orange-soft)', pct };
  if (pct >= 60)  return { label: 'בשימוש',       color: '#d97706',      bg: '#fffbeb',             pct };
  return                 { label: 'תקין',          color: 'var(--green)', bg: 'var(--green-soft)',   pct };
};

const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const fmtDate   = d => `${d.getDate()} ${MONTHS_HE[d.getMonth()]} ${d.getFullYear()}`;

const parseDays = terms => {
  if (!terms) return null;
  const m = terms.match(/שוטף\+?(\d+)/);
  return m ? parseInt(m[1]) : null;
};

const calcDueDate = (terms, monthId) => {
  const days = parseDays(terms);
  if (days === null) return null;
  let year, month;
  if (monthId) {
    const [y, m] = monthId.split('-').map(Number);
    // Use previous month: obligo invoices are from the prior billing cycle
    if (m === 1) { year = y - 1; month = 11; }
    else         { year = y;     month = m - 2; } // 0-indexed previous month
  } else {
    const now = new Date();
    year  = now.getFullYear();
    month = now.getMonth() - 1;
    if (month < 0) { month = 11; year--; }
  }
  const endOfMonth = new Date(year, month + 1, 0); // last day of the billing month
  const due        = new Date(endOfMonth);
  due.setDate(due.getDate() + days);
  return due;
};

const daysUntil = date => {
  if (!date) return null;
  return Math.round((date - new Date()) / (1000 * 60 * 60 * 24));
};

const urgencyStyle = days => {
  if (days === null) return { color: 'var(--text-3)', bg: 'var(--surface-2)', border: 'var(--border)' };
  if (days <= 7)     return { color: 'var(--red)',    bg: 'var(--red-soft)',   border: 'var(--red-border)' };
  if (days <= 20)    return { color: 'var(--orange)', bg: 'var(--orange-soft)', border: '#fed7aa' };
  if (days <= 40)    return { color: '#d97706',       bg: '#fffbeb',            border: '#fde68a' };
  return                    { color: 'var(--green)',  bg: 'var(--green-soft)', border: 'var(--green-border)' };
};

const actionBtn = color => ({
  background: 'none', border: 'none', cursor: 'pointer',
  color, fontSize: 14, padding: '2px 5px', borderRadius: 4, lineHeight: 1,
});

const editRowStyle = { background: '#fffbeb', borderBottom: '1px solid #fcd34d' };

export default function WorkPlanObligo({ data: externalData, onChange, monthId }) {
  const clients = externalData?.clients || DEFAULT_CLIENTS;
  const obligo  = externalData?.obligo  || {};

  const [editing,  setEditing]  = useState(null);
  const [adding,   setAdding]   = useState(false);
  const [addForm,  setAddForm]  = useState({ name: '', creditLimit: '', currentBalance: '', paymentTerms: '', note: '' });
  const [payment,  setPayment]  = useState(false);
  const [payForm,  setPayForm]  = useState({ name: '', amount: '', note: '' });
  const [payError, setPayError] = useState('');

  const saveObligo = obligoUpdater =>
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      const cur  = base.obligo || {};
      const newObligo = typeof obligoUpdater === 'function' ? obligoUpdater(cur) : obligoUpdater;
      return { ...base, obligo: newObligo };
    });

  const startEdit = name => {
    const o = obligo[name] || { creditLimit: 0, currentBalance: 0, paymentTerms: '', note: '' };
    setEditing({ name, form: {
      creditLimit:    String(o.creditLimit    || ''),
      currentBalance: String(o.currentBalance || ''),
      paymentTerms:   o.paymentTerms || '',
      note:           o.note        || '',
    }});
  };

  const saveEdit = () => {
    const { name, form } = editing;
    saveObligo(cur => ({
      ...cur,
      [name]: {
        creditLimit:    +form.creditLimit    || 0,
        currentBalance: +form.currentBalance || 0,
        paymentTerms:   form.paymentTerms.trim(),
        note:           form.note.trim(),
      },
    }));
    setEditing(null);
  };

  const deleteRow = name => {
    if (!window.confirm(`למחוק את ${name} מהמערכת?`)) return;
    onChange(prev => {
      const base       = prev || DEFAULT_WORKPLAN;
      const newObligo  = { ...(base.obligo || {}) };
      delete newObligo[name];
      const newClients = (base.clients || []).filter(c => c.name !== name);
      return { ...base, obligo: newObligo, clients: newClients };
    });
    if (editing?.name === name) setEditing(null);
  };

  const saveAdd = () => {
    if (!addForm.name.trim()) return;
    const key = addForm.name.trim();
    saveObligo(cur => ({
      ...cur,
      [key]: {
        creditLimit:    +addForm.creditLimit    || 0,
        currentBalance: +addForm.currentBalance || 0,
        paymentTerms:   addForm.paymentTerms.trim(),
        note:           addForm.note.trim(),
      },
    }));
    setAddForm({ name: '', creditLimit: '', currentBalance: '', paymentTerms: '', note: '' });
    setAdding(false);
  };

  const savePayment = () => {
    const name   = payForm.name.trim();
    const amount = +payForm.amount;
    if (!name)          return setPayError('נא לבחור לקוח');
    if (!amount || amount <= 0) return setPayError('נא להזין סכום תקין');
    saveObligo(cur => {
      const current    = cur[name] || { creditLimit: 0, currentBalance: 0, paymentTerms: '', note: '' };
      const newBalance = Math.max(0, (current.currentBalance || 0) - amount);
      return { ...cur, [name]: { ...current, currentBalance: newBalance } };
    });
    setPayForm({ name: '', amount: '', note: '' });
    setPayError('');
    setPayment(false);
  };

  const _seen = new Set();
  const clientNames = [
    ...clients.map(c => (c.name || '').trim()).filter(Boolean),
    ...Object.keys(obligo).map(k => k.trim()).filter(Boolean),
  ].filter(n => { if (_seen.has(n)) return false; _seen.add(n); return true; });
  const rows = clientNames.map(name => {
    const o  = obligo[name] || { creditLimit: 0, currentBalance: 0, note: '' };
    const st = statusInfo(o.creditLimit, o.currentBalance);
    return { name, ...o, ...st };
  });

  const totalLimit   = rows.reduce((s, r) => s + (r.creditLimit || 0), 0);
  const totalBalance = rows.reduce((s, r) => s + (r.currentBalance || 0), 0);
  const overLimit    = rows.filter(r => r.creditLimit > 0 && r.currentBalance > r.creditLimit).length;

  const scheduleMap = {};
  rows.forEach(r => {
    if (!r.currentBalance) return;
    const terms = r.paymentTerms || 'לא מוגדר';
    const due   = calcDueDate(r.paymentTerms, monthId);
    if (!scheduleMap[terms]) scheduleMap[terms] = { terms, due, total: 0, clients: [] };
    scheduleMap[terms].total   += r.currentBalance;
    scheduleMap[terms].clients.push(r.name);
  });
  const schedule = Object.values(scheduleMap).sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1; if (!b.due) return -1;
    return a.due - b.due;
  });

  const nextMonthBalance = schedule
    .filter(s => { const d = daysUntil(s.due); return d !== null && d <= 45; })
    .reduce((s, r) => s + r.total, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* KPI */}
      <div className="grid-5">
        {[
          {
            label: 'סה"כ מסגרת אשראי', value: fmt(totalLimit), sub: 'מסגרת כוללת',
            bg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          },
          {
            label: 'סה"כ לגביה', value: fmt(totalBalance), sub: 'חוב פתוח',
            bg: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
          },
          {
            label: 'צפוי ב-45 יום', value: fmt(nextMonthBalance), sub: 'לפי תנאי תשלום',
            bg: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
          },
          {
            label: 'אשראי פנוי', value: fmt(Math.max(0, totalLimit - totalBalance)), sub: 'יתרה זמינה',
            bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          },
          {
            label: 'לקוחות בחריגה', value: overLimit, sub: overLimit > 0 ? 'מעל מסגרת' : 'הכל תקין',
            bg: overLimit > 0 ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
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

      {/* Collection schedule */}
      {schedule.length > 0 && (
        <Card>
          <p className="section-title" style={{ marginBottom: 14 }}>לוח גביה לפי תנאי תשלום</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {schedule.map((s, i) => {
              const days = daysUntil(s.due);
              const urg  = urgencyStyle(days);
              return (
                <div key={i} style={{ borderRadius: 'var(--r-md)', border: `1.5px solid ${urg.border}`, background: urg.bg, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: urg.color }}>{fmt(s.total)}</span>
                    <span style={{ background: urg.color, color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {s.terms}
                    </span>
                  </div>
                  {s.due ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
                        מועד גביה: {fmtDate(s.due)}
                      </div>
                      <div style={{ fontSize: 11, color: urg.color, fontWeight: 600 }}>
                        {days <= 0 ? 'עבר המועד!' : `בעוד ${days} ימים`}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>תאריך לא מחושב</div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-2)' }}>{s.clients.join(' • ')}</div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>סה"כ יתרות לגביה:</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--blue)' }}>{fmt(totalBalance)}</span>
          </div>
        </Card>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className={`btn ${payment ? 'btn-soft' : 'btn-primary'}`}
          style={payment ? {} : { background: 'var(--green)', borderColor: 'var(--green)' }}
          onClick={() => { setPayment(v => !v); setPayError(''); setAdding(false); }}
        >
          {payment ? '✕ ביטול' : '💰 עדכן תשלום'}
        </button>
        <button
          className={`btn ${adding ? 'btn-soft' : 'btn-ghost'}`}
          onClick={() => { setAdding(v => !v); setPayment(false); }}
        >
          {adding ? '✕ ביטול' : '+ לקוח חדש'}
        </button>
      </div>

      {/* Payment form */}
      {payment && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>רישום תשלום — יפחית מהחוב</p>
          <div className="grid-3-form" style={{ marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>לקוח</label>
              <select className="input" value={payForm.name} onChange={e => setPayForm(p => ({ ...p, name: e.target.value }))}>
                <option value="">-- בחר לקוח --</option>
                {rows.filter(r => r.currentBalance > 0).map(r => (
                  <option key={r.name} value={r.name}>{r.name} — חוב: {fmt(r.currentBalance)}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>סכום ששולם (₪)</label>
              <input className="input" type="number" min="0" value={payForm.amount} onChange={e => setPayForm(p => ({ ...p, amount: e.target.value }))} placeholder="₪ 0" style={{ borderColor: 'var(--green-border)', background: 'var(--green-soft)', color: 'var(--green)', fontWeight: 700 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>הערה</label>
              <input className="input" value={payForm.note} onChange={e => setPayForm(p => ({ ...p, note: e.target.value }))} placeholder="מספר צ'ק, העברה..." />
            </div>
          </div>

          {payForm.name && payForm.amount > 0 && (
            <div style={{ background: 'var(--green-soft)', border: '1px solid var(--green-border)', borderRadius: 'var(--r-md)', padding: '8px 14px', marginBottom: 12, fontSize: 13 }}>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                חוב לאחר תשלום: {fmt(Math.max(0, (obligo[payForm.name]?.currentBalance || 0) - +payForm.amount))}
              </span>
              <span style={{ color: 'var(--text-3)', marginRight: 12 }}>
                (לפני: {fmt(obligo[payForm.name]?.currentBalance || 0)})
              </span>
            </div>
          )}

          {payError && <p style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{payError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ background: 'var(--green)', color: '#fff', border: 'none' }} onClick={savePayment}>אשר תשלום</button>
            <button className="btn btn-ghost" onClick={() => { setPayment(false); setPayError(''); }}>ביטול</button>
          </div>
        </Card>
      )}

      {/* Add client form */}
      {adding && (
        <Card>
          <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>לקוח חדש</p>
          <div className="grid-3-form" style={{ marginBottom: 12 }}>
            {[
              { label: 'שם לקוח', key: 'name', placeholder: 'שם...' },
              { label: 'מסגרת אשראי (₪)', key: 'creditLimit', type: 'number', placeholder: '0' },
              { label: 'חוב נוכחי (₪)', key: 'currentBalance', type: 'number', placeholder: '0' },
              { label: 'תנאי תשלום', key: 'paymentTerms', placeholder: 'שוטף+30' },
              { label: 'הערה', key: 'note', placeholder: 'אופציונלי' },
            ].map(({ label, key, ...rest }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>{label}</label>
                <input className="input" value={addForm[key]} onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))} {...rest} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={saveAdd}>שמור</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>ביטול</button>
          </div>
        </Card>
      )}

      {/* Obligo table */}
      <Card>
        <p className="section-title" style={{ marginBottom: 14 }}>פירוט אובליגו לקוחות</p>
        <table className="data-table">
          <thead>
            <tr>
              {['לקוח','תנאי תשלום','מסגרת אשראי','חוב נוכחי','אשראי פנוי','% ניצול','סטטוס','הערה',''].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 36, textAlign: 'center', color: 'var(--text-3)' }}>אין לקוחות — הוסף ידנית או טען קובץ תכנית עבודה</td></tr>
            )}
            {rows.map((r, i) => {
              const isEd     = editing?.name === r.name;
              const available = (r.creditLimit || 0) - (r.currentBalance || 0);
              const st        = statusInfo(r.creditLimit, r.currentBalance);

              if (isEd) return (
                <tr key={i} style={editRowStyle}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td><input className="input-sm" value={editing.form.paymentTerms} onChange={e => setEditing(ed => ({ ...ed, form: { ...ed.form, paymentTerms: e.target.value } }))} style={{ width: 100 }} placeholder="שוטף+30" /></td>
                  <td><input className="input-sm" type="number" value={editing.form.creditLimit}    onChange={e => setEditing(ed => ({ ...ed, form: { ...ed.form, creditLimit:    e.target.value } }))} style={{ width: 100 }} placeholder="₪" /></td>
                  <td><input className="input-sm" type="number" value={editing.form.currentBalance} onChange={e => setEditing(ed => ({ ...ed, form: { ...ed.form, currentBalance: e.target.value } }))} style={{ width: 100 }} placeholder="₪" /></td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>
                    {editing.form.creditLimit && editing.form.currentBalance ? fmt((+editing.form.creditLimit) - (+editing.form.currentBalance)) : '—'}
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>—</td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>—</td>
                  <td><input className="input-sm" value={editing.form.note} onChange={e => setEditing(ed => ({ ...ed, form: { ...ed.form, note: e.target.value } }))} placeholder="הערה..." /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={saveEdit} style={actionBtn('var(--green)')}>✓</button>
                    <button onClick={() => setEditing(null)} style={actionBtn('var(--text-3)')}>✕</button>
                  </td>
                </tr>
              );

              return (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{r.name}</td>
                  <td>
                    {r.paymentTerms
                      ? <span className="badge badge-blue">{r.paymentTerms}</span>
                      : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-1)', fontWeight: 500 }}>
                    {r.creditLimit ? fmt(r.creditLimit) : <span style={{ color: 'var(--text-3)' }}>לא הוגדר</span>}
                  </td>
                  <td style={{ fontWeight: 700, color: r.currentBalance > 0 ? 'var(--blue)' : 'var(--text-3)' }}>
                    {r.currentBalance ? fmt(r.currentBalance) : '—'}
                  </td>
                  <td style={{ fontWeight: 600, color: available >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {r.creditLimit ? fmt(available) : '—'}
                  </td>
                  <td style={{ minWidth: 110 }}>
                    {r.creditLimit > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div className="progress-track" style={{ flex: 1, height: 5 }}>
                          <div className="progress-fill" style={{ width: `${Math.min(st.pct, 100)}%`, background: st.color, height: '100%' }} />
                        </div>
                        <span style={{ fontSize: 10, color: st.color, fontWeight: 700, flexShrink: 0 }}>{st.pct.toFixed(0)}%</span>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-3)', fontSize: 12 }}>{r.note || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(r.name)} style={actionBtn('var(--blue)')}>✎</button>
                    <button onClick={() => deleteRow(r.name)} style={actionBtn('var(--red)')}>🗑</button>
                  </td>
                </tr>
              );
            })}

            {rows.length > 0 && (
              <tr style={{ background: 'var(--blue-soft)', borderTop: '2px solid #bfdbfe' }}>
                <td style={{ fontWeight: 800 }}>סה"כ</td>
                <td />
                <td style={{ fontWeight: 800 }}>{fmt(totalLimit)}</td>
                <td style={{ fontWeight: 800, color: 'var(--blue)' }}>{fmt(totalBalance)}</td>
                <td style={{ fontWeight: 800, color: totalLimit > totalBalance ? 'var(--green)' : 'var(--red)' }}>{fmt(totalLimit - totalBalance)}</td>
                <td colSpan={4} />
              </tr>
            )}
          </tbody>
        </table>
      </Card>

    </div>
  );
}
