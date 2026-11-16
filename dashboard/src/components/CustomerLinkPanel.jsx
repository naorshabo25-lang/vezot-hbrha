import React, { useState, useEffect } from 'react';

const API = (window.location.port === '5173' || window.location.port === '5174') ? `http://${window.location.hostname}:8000` : '';

const input = {
  padding: '9px 12px', borderRadius: 9, border: '1px solid #e5e7eb',
  fontSize: 13, background: '#fff', color: '#1e2d3d', outline: 'none', width: '100%',
};
const label = { fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 5 };

const PRODUCTS = ['סולר תחבורה', 'נפט', 'נוזל גנרטורים וחימום'];
const emptyForm = () => ({ label: '', quantity: '', order_date: tomorrowISO(), product: PRODUCTS[0] });

function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA');
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${+d}/${+m}`;
}

// יצירת קישור חד-פעמי ללקוח מזדמן — הלקוח ממלא פרטים, ונוצרים לקוח מזדמן + הזמנה
export default function CustomerLinkPanel({ onCustomerAdded }) {
  const [form, setForm] = useState(emptyForm);
  const [created, setCreated] = useState(null);
  const [links, setLinks] = useState([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const loadLinks = () =>
    fetch(`${API}/api/customer-links`).then(r => r.ok ? r.json() : [])
      .then(l => {
        const list = Array.isArray(l) ? l : [];
        setLinks(prev => {
          if (prev.some(p => !p.used_at && list.find(n => n.token === p.token)?.used_at)) onCustomerAdded?.();
          return list;
        });
      }).catch(() => {});

  useEffect(() => {
    loadLinks();
    const t = setInterval(loadLinks, 30000);
    return () => clearInterval(t);
  }, []);

  const create = async () => {
    setError('');
    try {
      const r = await fetch(`${API}/api/customer-links`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      });
      if (!r.ok) throw new Error();
      setCreated(await r.json());
      setForm(emptyForm());
      loadLinks();
    } catch {
      setError('שגיאה ביצירת הקישור');
    }
  };

  const copy = async (url) => {
    try { await navigator.clipboard.writeText(url); setCopied(url); setTimeout(() => setCopied(''), 2000); }
    catch { window.prompt('העתק את הקישור:', url); }
  };

  const waText = (url) => encodeURIComponent(
    `שלום, תודה שבחרת בוזאת הברכה דלקים 🙏\nלהשלמת ההזמנה נא למלא את הפרטים בקישור:\n${url}`);

  const remove = async (token) => {
    await fetch(`${API}/api/customer-links/${token}`, { method: 'DELETE' }).catch(() => {});
    if (created?.token === token) setCreated(null);
    loadLinks();
  };

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '2px solid #fde68a', boxShadow: '0 2px 12px rgba(217,119,6,0.08)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: '#b45309', margin: '0 0 6px' }}>🔗 קישור ללקוח מזדמן</h3>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>
        אחרי סגירה טלפונית — שלח ללקוח קישור. הוא ממלא שם, ת.ז, כתובת, איש קשר, טלפון, טווח שעות ואופן תשלום,
        והמערכת פותחת לקוח מזדמן + הזמנה ושולחת לך התראה בוואטסאפ.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
        <div>
          <label style={label}>תזכורת לעצמך (לא חובה)</label>
          <input style={input} placeholder="למשל: משה מבית שמש" value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
        </div>
        <div>
          <label style={label}>מוצר</label>
          <select style={input} value={form.product}
            onChange={e => setForm(f => ({ ...f, product: e.target.value }))}>
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>כמות שסוכמה (ליטר)</label>
          <input style={input} inputMode="numeric" placeholder="ריק = הלקוח ימלא" value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
        </div>
        <div>
          <label style={label}>תאריך אספקה</label>
          <input style={input} type="date" value={form.order_date}
            onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
        </div>
        <button onClick={create} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: '#d97706',
          color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
          צור קישור
        </button>
      </div>
      {error && <div style={{ marginTop: 10, fontSize: 12, color: '#dc2626', fontWeight: 700 }}>{error}</div>}

      {created && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8 }}>✅ הקישור מוכן — שלח אותו ללקוח:</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <code dir="ltr" style={{ flex: '1 1 260px', padding: '8px 10px', background: '#fff', borderRadius: 8,
              border: '1px solid #fde68a', fontSize: 12, wordBreak: 'break-all' }}>{created.url}</code>
            <button onClick={() => copy(created.url)} style={smallBtn('#fff', '#92400e', '#fcd34d')}>
              {copied === created.url ? '✓ הועתק' : '📋 העתק'}
            </button>
            <a href={`https://wa.me/?text=${waText(created.url)}`} target="_blank" rel="noreferrer"
              style={{ ...smallBtn('#16a34a', '#fff', '#16a34a'), textDecoration: 'none' }}>
              💬 שלח בוואטסאפ
            </a>
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', marginBottom: 8 }}>קישורים אחרונים</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {links.slice(0, 8).map(l => (
              <div key={l.token} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                padding: '8px 12px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f0f2f7', fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: l.used_at ? '#16a34a' : '#b45309' }}>
                  {l.used_at ? '✅ מולא' : '⏳ ממתין'}
                </span>
                <span style={{ color: '#374151', fontWeight: 600 }}>{l.label || 'ללא שם'}</span>
                <span style={{ color: '#9ca3af' }}>
                  {l.product ? `${l.product} · ` : ''}{l.quantity ? `${l.quantity} ל׳ · ` : ''}אספקה {fmtDate(l.order_date)}
                </span>
                <span style={{ flex: 1 }} />
                {!l.used_at && (
                  <>
                    <button onClick={() => copy(l.url)} style={smallBtn('#fff', '#374151', '#e5e7eb')}>
                      {copied === l.url ? '✓ הועתק' : 'העתק'}
                    </button>
                    <button onClick={() => remove(l.token)} title="בטל קישור" style={smallBtn('#fff5f5', '#dc2626', '#fecaca')}>✕</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function smallBtn(bg, color, border) {
  return { padding: '7px 12px', borderRadius: 8, border: `1px solid ${border}`, background: bg, color,
    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-block' };
}
