import { useState, useEffect } from 'react';

const empty = { date: new Date().toISOString().slice(0, 10), category: '', vendor: '', description: '', amount: '' };

const inp = (err) => ({
  border: `1px solid ${err ? '#fca5a5' : '#e5e7eb'}`,
  borderRadius: 10, padding: '10px 14px', fontSize: 14, width: '100%',
  background: err ? '#fef2f2' : '#fff', color: '#111827', outline: 'none', transition: 'border 0.15s',
});

export default function ExpenseForm({ categories, onAdd, onUpdate, editingExpense, onCancelEdit }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (editingExpense) setForm({ date: editingExpense.date || empty.date, category: editingExpense.category || '', vendor: editingExpense.vendor || '', description: editingExpense.description || '', amount: editingExpense.amount || '' });
  }, [editingExpense]);

  const validate = () => {
    const e = {};
    if (!form.date) e.date = 'חובה';
    if (!form.category) e.category = 'חובה';
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) e.amount = 'סכום לא תקין';
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    const data = { ...form, amount: Number(form.amount) };
    if (editingExpense) { onUpdate(editingExpense.id, data); }
    else { onAdd(data); setFlash(true); setTimeout(() => setFlash(false), 2500); }
    setForm(empty);
  };

  const label = (txt) => <label style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{txt}</label>;

  return (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', background: '#fafafa', borderBottom: '1px solid #f3f4f6' }}>
        {flash && <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>✓ נשמר בהצלחה</span>}
        {!flash && <span />}
        <h2 style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{editingExpense ? 'עריכת הוצאה' : 'הוספת הוצאה חדשה'}</h2>
      </div>

      <form onSubmit={submit} style={{ padding: '20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>
          <div>
            {label('תאריך')}
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} style={inp(errors.date)} />
            {errors.date && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.date}</p>}
          </div>
          <div>
            {label('קטגוריה')}
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp(errors.category), cursor: 'pointer' }}>
              <option value="">בחר...</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.category}</p>}
          </div>
          <div>
            {label('ספק')}
            <input type="text" value={form.vendor} placeholder="שם הספק" onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} style={inp(false)} />
          </div>
          <div>
            {label('תיאור')}
            <input type="text" value={form.description} placeholder="תיאור" onChange={e => setForm(p => ({ ...p, description: e.target.value }))} style={inp(false)} />
          </div>
          <div>
            {label('סכום ₪')}
            <input type="number" value={form.amount} placeholder="0" min="0" step="0.01" onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} style={inp(errors.amount)} />
            {errors.amount && <p style={{ color: '#dc2626', fontSize: 11, marginTop: 4 }}>{errors.amount}</p>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="submit" style={{ borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#cc0000', color: '#fff', border: 'none', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
            {editingExpense ? 'שמור שינויים' : '+ הוסף הוצאה'}
          </button>
          {editingExpense && (
            <button type="button" onClick={() => { setForm(empty); setErrors({}); onCancelEdit(); }}
              style={{ borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>
              ביטול
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
