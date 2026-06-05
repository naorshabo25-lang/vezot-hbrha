import { useState } from 'react';

const HEB_MONTHS = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר',
];

export default function MonthSelector({ monthId, allMonths, onMonthSwitch, onNewMonth }) {
  const [showNew, setShowNew] = useState(false);
  const [newMonth, setNewMonth] = useState('');
  const [newYear, setNewYear]   = useState('');
  const [copyExp, setCopyExp]   = useState(true);

  const openForm = () => {
    const [y, m] = (monthId || '2026-05').split('-').map(Number);
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    setNewMonth(String(nm).padStart(2, '0'));
    setNewYear(String(ny));
    setShowNew(true);
  };

  const handleCreate = () => {
    const id    = `${newYear}-${newMonth}`;
    const label = `${HEB_MONTHS[+newMonth - 1]} ${newYear}`;
    if (allMonths.some(m => m.id === id)) {
      onMonthSwitch(id);
    } else {
      onNewMonth(id, label, copyExp);
    }
    setShowNew(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, letterSpacing: 0.4 }}>חודש:</span>

        {allMonths.map(m => {
          const active = m.id === monthId;
          return (
            <button
              key={m.id}
              onClick={() => onMonthSwitch(m.id)}
              style={{
                padding: '4px 14px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                border: `1.5px solid ${active ? 'var(--red)' : 'var(--border)'}`,
                background: active ? 'var(--red-soft)' : 'transparent',
                color: active ? 'var(--red)' : 'var(--text-2)',
                transition: 'all 0.12s',
              }}
            >
              {m.label}
            </button>
          );
        })}

        <button
          onClick={showNew ? () => setShowNew(false) : openForm}
          style={{
            padding: '4px 14px',
            borderRadius: 99,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            border: '1.5px dashed var(--border-2)',
            background: 'transparent',
            color: 'var(--text-3)',
            transition: 'all 0.12s',
          }}
        >
          {showNew ? '✕ ביטול' : '+ חודש חדש'}
        </button>
      </div>

      {showNew && (
        <div style={{
          background: 'var(--surface-2)',
          borderRadius: 'var(--r-md)',
          padding: '12px 16px',
          border: '1px solid var(--border)',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>חודש חדש:</span>

          <select
            value={newMonth}
            onChange={e => setNewMonth(e.target.value)}
            className="input"
            style={{ width: 'auto', padding: '5px 10px', fontSize: 12 }}
          >
            {HEB_MONTHS.map((m, i) => (
              <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
            ))}
          </select>

          <input
            type="number"
            value={newYear}
            onChange={e => setNewYear(e.target.value)}
            className="input"
            style={{ width: 75, padding: '5px 10px', fontSize: 12 }}
          />

          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--text-2)', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={copyExp}
              onChange={e => setCopyExp(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            העתק הוצאות ומשכורות
          </label>

          <button className="btn btn-primary btn-sm" onClick={handleCreate}>
            פתח חודש
          </button>
        </div>
      )}
    </div>
  );
}
