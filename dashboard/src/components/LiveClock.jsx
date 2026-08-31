import { useState, useEffect } from 'react';

const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const pad = n => String(n).padStart(2, '0');

export default function LiveClock({ dark = false }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const date = `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  if (dark) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
      <span style={{ fontWeight: 700, fontSize: 14, color: '#e53935', fontVariantNumeric: 'tabular-nums', fontFamily: '"Courier New", monospace', letterSpacing: 1 }}>{time}</span>
      <span style={{ fontSize: 10, color: '#556080' }}>{date}</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: '4px 12px',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#22c55e',
          flexShrink: 0,
          boxShadow: '0 0 0 2px rgba(34,197,94,0.25)',
        }} />
        <span style={{
          fontWeight: 700,
          fontSize: 14,
          color: 'var(--text-1)',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: '"Courier New", monospace',
          letterSpacing: 1.5,
        }}>
          {time}
        </span>
      </div>
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{date}</span>
    </div>
  );
}
