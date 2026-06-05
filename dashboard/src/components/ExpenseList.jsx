import { useState } from 'react';

const CAT = {
  'שכר עובדים':      { bg: '#fce7f3', text: '#9d174d' },
  'שיווק ופרסום':    { bg: '#fee2e2', text: '#991b1b' },
  'ציוד משרדי':      { bg: '#fef3c7', text: '#92400e' },
  'שכירות':          { bg: '#fecaca', text: '#b91c1c' },
  'חשמל ומים':       { bg: '#fed7aa', text: '#9a3412' },
  'תוכנה ורישיונות': { bg: '#fde8d8', text: '#c2410c' },
  'נסיעות':          { bg: '#ffe4e6', text: '#be123c' },
  'ייעוץ מקצועי':    { bg: '#fef2f2', text: '#dc2626' },
  'אחר':             { bg: '#f3f4f6', text: '#4b5563' },
};
const DEF = { bg: '#f3f4f6', text: '#4b5563' };

const selStyle = { border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff', color: '#374151', outline: 'none' };
const th = { padding: '11px 16px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'right', whiteSpace: 'nowrap', cursor: 'pointer', letterSpacing: 0.5, textTransform: 'uppercase', userSelect: 'none' };
const td = { padding: '13px 16px', fontSize: 14, textAlign: 'right', verticalAlign: 'middle' };

export default function ExpenseList({ expenses, categories, onEdit, onDelete }) {
  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [sortBy,      setSortBy]      = useState('date');
  const [sortDir,     setSortDir]     = useState('desc');
  const [confirmDel,  setConfirmDel]  = useState(null);

  const months = [...new Set(expenses.map(e => e.date.slice(0,7)))].sort().reverse();

  const filtered = expenses
    .filter(e => {
      const q = search.toLowerCase();
      return (!search || [e.description, e.vendor, e.category].some(f => f?.toLowerCase().includes(q)))
        && (!filterCat   || e.category === filterCat)
        && (!filterMonth || e.date.startsWith(filterMonth));
    })
    .sort((a, b) => {
      const va = sortBy === 'amount' ? Number(a[sortBy]) : (a[sortBy] ?? '');
      const vb = sortBy === 'amount' ? Number(b[sortBy]) : (b[sortBy] ?? '');
      return sortDir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
    });

  const toggleSort = col => { if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy(col); setSortDir('desc'); } };
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
        <h2 style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginRight: 'auto' }}>רשימת הוצאות</h2>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 13 }}>🔍</span>
          <input type="text" placeholder="חיפוש..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...selStyle, paddingRight: 30, width: 140 }} />
        </div>
        <select value={filterCat}   onChange={e => setFilterCat(e.target.value)}   style={selStyle}>
          <option value="">כל הקטגוריות</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={selStyle}>
          <option value="">כל החודשים</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f9fafb' }}>
            <tr>
              {[['date','תאריך'],['category','קטגוריה'],['vendor','ספק'],['description','תיאור'],['amount','סכום']].map(([col,lbl]) => (
                <th key={col} style={th} onClick={() => toggleSort(col)}>
                  {lbl} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : <span style={{ color: '#d1d5db' }}>↕</span>}
                </th>
              ))}
              <th style={{ ...th, cursor: 'default' }}>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '56px 0', color: '#d1d5db' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 36 }}>🔍</span><span>אין הוצאות להצגה</span>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((e, i) => {
              const cat = CAT[e.category] || DEF;
              return (
                <tr key={e.id} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff', transition: 'background 0.1s' }}
                  onMouseEnter={ev => ev.currentTarget.style.background = '#fff5f5'}
                  onMouseLeave={ev => ev.currentTarget.style.background = i % 2 ? '#fafafa' : '#fff'}>
                  <td style={{ ...td, color: '#6b7280', fontFamily: 'monospace', fontSize: 12 }}>{e.date}</td>
                  <td style={td}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: cat.bg, color: cat.text, whiteSpace: 'nowrap' }}>{e.category}</span>
                  </td>
                  <td style={{ ...td, color: '#374151', fontWeight: 500 }}>{e.vendor || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td style={{ ...td, color: '#6b7280', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || <span style={{ color: '#d1d5db' }}>—</span>}</td>
                  <td style={{ ...td, fontWeight: 800, color: '#cc0000', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>₪{Number(e.amount).toLocaleString('he-IL')}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => onEdit(e)} style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, background: '#fef2f2', border: '1px solid #fecaca', color: '#cc0000', cursor: 'pointer' }}>עריכה</button>
                      <button onClick={() => { if (confirmDel === e.id) { onDelete(e.id); setConfirmDel(null); } else setConfirmDel(e.id); }}
                        style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: confirmDel === e.id ? '#cc0000' : '#f3f4f6', border: '1px solid', borderColor: confirmDel === e.id ? '#cc0000' : '#e5e7eb', color: confirmDel === e.id ? '#fff' : '#6b7280' }}>
                        {confirmDel === e.id ? 'אשר ✓' : 'מחיקה'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid #f3f4f6', background: '#fafafa' }}>
          <span style={{ color: '#9ca3af', fontSize: 13 }}>{filtered.length} רשומות</span>
          <span style={{ fontWeight: 800, fontSize: 17, color: '#cc0000', fontVariantNumeric: 'tabular-nums' }}>₪{total.toLocaleString('he-IL')}</span>
        </div>
      )}
    </div>
  );
}
