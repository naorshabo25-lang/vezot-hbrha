import { useState, useEffect } from 'react';

const SERVER = (window.location.port === '5173' || window.location.port === '5174')
  ? `http://${window.location.hostname}:8000`
  : '';

const VAT = 0.18;

function fmtDateTime(s) {
  if (!s) return '';
  const [d, t] = s.split(' ');
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}${t ? ' ' + t.slice(0, 5) : ''}`;
}

const card = { background: 'var(--card-bg, #fff)', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 14, padding: 18 };
const inp = { padding: '10px 14px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, background: 'var(--bg, #fafafa)', color: 'var(--text-1, #1f2937)', width: '100%', boxSizing: 'border-box' };
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text-2, #9ca3af)', display: 'block', marginBottom: 6 };
const th = { textAlign: 'right', padding: '8px 10px', fontWeight: 700, fontSize: 12, color: 'var(--text-2)' };
const td = { padding: '10px', fontSize: 13, color: 'var(--text-1)', borderTop: '1px solid var(--border, #f1f5f9)' };

export default function QuotesTab() {
  const [quotes, setQuotes] = useState([]);
  const [form, setForm] = useState({ customer: '', price: '', payment_terms: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const q = await fetch(`${SERVER}/api/quotes`).then(r => r.json());
    setQuotes(Array.isArray(q) ? q : []);
  }

  async function create() {
    setError('');
    if (!form.customer.trim() || !form.price || !form.payment_terms.trim()) {
      setError('נא למלא שם לקוח, מחיר ותנאי תשלום');
      return;
    }
    setBusy(true);
    const pdfWindow = window.open('', '_blank');
    try {
      const res = await fetch(`${SERVER}/api/quotes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'יצירת ההצעה נכשלה');
      setForm({ customer: '', price: '', payment_terms: form.payment_terms });
      if (pdfWindow) pdfWindow.location.href = `${SERVER}/api/quotes/${data.id}/pdf`;
      load();
    } catch (e) {
      pdfWindow?.close();
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id) {
    if (!confirm('למחוק את ההצעה?')) return;
    await fetch(`${SERVER}/api/quotes/${id}`, { method: 'DELETE' });
    load();
  }

  const price = parseFloat(form.price);
  const shown = quotes.filter(q => !search || q.customer.includes(search));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 980, width: '100%', margin: '0 auto' }}>
      <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-1)' }}>📄 הצעות מחיר</h2>

      <div style={card}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 12 }}>הצעה חדשה</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label style={lbl}>שם לקוח</label>
            <input style={inp} value={form.customer} placeholder="כפי שיופיע בהצעה"
              onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>מחיר לליטר לפני מע״מ (₪)</label>
            <input style={inp} type="number" step="0.001" min="0" value={form.price} placeholder="8.623"
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>תנאי תשלום</label>
            <input style={inp} value={form.payment_terms} placeholder="שוטף + 30 בהעברה"
              onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))} />
          </div>
        </div>
        {price > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10 }}>
            מע״מ 18%: ₪{(price * VAT).toFixed(3)} · סה״כ לליטר: <b style={{ color: 'var(--text-1)' }}>₪{(price * (1 + VAT)).toFixed(3)}</b>
          </div>
        )}
        {error && <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginTop: 10 }}>{error}</div>}
        <button onClick={create} disabled={busy} className="btn btn-primary" style={{ marginTop: 14 }}>
          {busy ? 'מפיק PDF...' : 'הפק הצעה'}
        </button>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>כל ההצעות ({quotes.length})</div>
          <input style={{ ...inp, width: 220 }} value={search} placeholder="חיפוש לקוח..." onChange={e => setSearch(e.target.value)} />
        </div>
        {shown.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-2)' }}>
            {quotes.length ? 'לא נמצאו הצעות' : 'עוד לא הופקו הצעות. הצעות מהוואטסאפ (״הצעת מחיר״) יישמרו כאן אוטומטית.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th style={th}>#</th><th style={th}>תאריך</th><th style={th}>לקוח</th><th style={th}>מחיר לפני מע״מ</th><th style={th}>סה״כ כולל מע״מ</th><th style={th}>תנאי תשלום</th><th style={th}></th></tr>
              </thead>
              <tbody>
                {shown.map(q => {
                  const p = parseFloat(q.price) || 0;
                  return (
                    <tr key={q.id}>
                      <td style={td}>{q.id}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateTime(q.created_at)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{q.customer}</td>
                      <td style={td}>₪{p.toFixed(3)}</td>
                      <td style={td}>₪{(p * (1 + VAT)).toFixed(3)}</td>
                      <td style={td}>{q.payment_terms}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>
                        <a href={`${SERVER}/api/quotes/${q.id}/pdf`} target="_blank" rel="noopener noreferrer"
                          className="btn btn-soft btn-sm" style={{ textDecoration: 'none' }}>📄 PDF</a>
                        <button onClick={() => del(q.id)} title="מחק"
                          style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14, marginRight: 6 }}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
