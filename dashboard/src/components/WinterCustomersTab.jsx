import { useState, useEffect, useCallback } from 'react';

const API = (window.location.port === '5173' || window.location.port === '5174')
  ? `http://${window.location.hostname}:8000` : '';

const PRODUCTS   = ['נפט', 'סולר', 'נוזל הסקה', 'גנרטורים'];
const PAYMENTS   = ['מזומן', 'העברה בנקאית', "צ'ק", 'אשראי', 'ביט', 'פייבוקס'];
const STATUSES   = ['ממתין', 'נקבע', 'סופק', 'בוטל'];
const STATUS_CLR = { 'ממתין': '#f59e0b', 'נקבע': '#3b82f6', 'סופק': '#22c55e', 'בוטל': '#ef4444' };
const PROD_ICON  = { 'נפט': '🛢️', 'סולר': '⛽', 'נוזל הסקה': '🔥', 'גנרטורים': '⚡' };

const EMPTY_FORM = {
  agent_name: '', customer_name: '', customer_phone: '',
  address: '', city: '', contact_name: '', contact_phone: '',
  product: 'נפט', quantity: '', price_per_unit: '',
  payment_method: 'מזומן', delivery_date: '', status: 'ממתין', notes: '',
};

const inp = (extra = {}) => ({
  padding: '9px 11px', borderRadius: 8, border: '1px solid #dde3ee',
  fontSize: 13, background: '#f8fafc', color: '#1e2d3d',
  outline: 'none', width: '100%', fontFamily: 'inherit', ...extra,
});

const lbl = { fontSize: 11, fontWeight: 700, color: '#8492a6',
              display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

function fmt(n) {
  const v = parseFloat(n);
  if (!v) return '—';
  return '₪' + v.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

function fmtQty(n, prod) {
  const v = parseFloat(n);
  if (!v) return '—';
  const unit = prod === 'גנרטורים' ? 'יחידות' : 'ליטר';
  return v.toLocaleString('he-IL') + ' ' + unit;
}

// ─── Modal ───────────────────────────────────────────────────────────────────
function OrderModal({ order, agents, onSave, onClose }) {
  const [form, setForm] = useState(order ? { ...order } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const total = () => {
    const q = parseFloat(form.quantity) || 0;
    const p = parseFloat(form.price_per_unit) || 0;
    return q && p ? '₪' + (q * p).toLocaleString('he-IL', { maximumFractionDigits: 2 }) : '—';
  };

  const save = async () => {
    if (!form.customer_name.trim()) return alert('שם לקוח חובה');
    setSaving(true);
    try {
      const url  = order ? `${API}/api/winter-orders/${order.id}` : `${API}/api/winter-orders`;
      const meth = order ? 'PUT' : 'POST';
      const res  = await fetch(url, { method: meth, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error(await res.text());
      onSave(await res.json());
    } catch (e) { alert('שגיאה: ' + e.message); }
    finally { setSaving(false); }
  };

  const F = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  );

  const sel = (k, opts) => (
    <select value={form[k]} onChange={e => set(k, e.target.value)} style={inp()}>
      {opts.map(o => <option key={o}>{o}</option>)}
    </select>
  );

  const ti = (k, ph = '') => (
    <input value={form[k]} onChange={e => set(k, e.target.value)}
      placeholder={ph} style={inp()} />
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: '100%',
                    maxWidth: 680, maxHeight: '92vh', overflowY: 'auto', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e2d3d', margin: 0 }}>
            {order ? '✏️ עריכת הזמנה' : '❄️ הוספת לקוח חורף'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        {/* Row 1: agent + status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="סוכן">
            <select value={form.agent_name} onChange={e => set('agent_name', e.target.value)} style={inp()}>
              <option value="">— ללא סוכן —</option>
              {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              <option value="__other__">אחר / הזן ידנית</option>
            </select>
            {form.agent_name === '__other__' && (
              <input style={inp({ marginTop: 6 })} placeholder="שם הסוכן"
                onChange={e => set('agent_name', e.target.value === '__other__' ? '' : e.target.value)} />
            )}
          </F>
          <F label="סטטוס">{sel('status', STATUSES)}</F>
        </div>

        {/* Row 2: customer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="שם לקוח *">{ti('customer_name', 'ישראל ישראלי')}</F>
          <F label="טלפון לקוח">{ti('customer_phone', '050-0000000')}</F>
        </div>

        {/* Row 3: address */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          <F label="כתובת">{ti('address', 'רחוב, מספר')}</F>
          <F label="עיר">{ti('city', 'ירושלים')}</F>
        </div>

        {/* Row 4: contact */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="איש קשר">{ti('contact_name')}</F>
          <F label="טלפון איש קשר">{ti('contact_phone')}</F>
        </div>

        {/* Row 5: product + qty + price */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <F label="מוצר">{sel('product', PRODUCTS)}</F>
          <F label={form.product === 'גנרטורים' ? 'כמות (יחידות)' : 'כמות (ליטר)'}>
            <input type="number" min="0" value={form.quantity}
              onChange={e => set('quantity', e.target.value)} style={inp()} placeholder="0" />
          </F>
          <F label="מחיר ליחידה (₪)">
            <input type="number" min="0" step="0.01" value={form.price_per_unit}
              onChange={e => set('price_per_unit', e.target.value)} style={inp()} placeholder="0.00" />
          </F>
        </div>

        {/* Total preview */}
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '10px 16px',
                      marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>סה"כ להזמנה:</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#15803d' }}>{total()}</span>
        </div>

        {/* Row 6: payment + delivery */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <F label="אמצעי תשלום">{sel('payment_method', PAYMENTS)}</F>
          <F label="תאריך אספקה">
            <input type="date" value={form.delivery_date}
              onChange={e => set('delivery_date', e.target.value)} style={inp()} />
          </F>
        </div>

        {/* Notes */}
        <F label="הערות">
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={3} placeholder="הערות נוספות..." style={inp({ resize: 'vertical' })} />
        </F>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{ padding: '10px 22px', borderRadius: 8,
            border: '1px solid #dde3ee', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            ביטול
          </button>
          <button onClick={save} disabled={saving} style={{ padding: '10px 28px', borderRadius: 8,
            background: '#2563eb', color: '#fff', border: 'none', cursor: saving ? 'default' : 'pointer',
            fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'שומר...' : order ? 'שמור שינויים' : '➕ הוסף הזמנה'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Manager Modal ──────────────────────────────────────────────────────
function AgentsModal({ agents, onClose, onRefresh }) {
  const [newName,  setNewName]  = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [saving,   setSaving]   = useState(false);

  const add = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/winter-agents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewName(''); setNewPhone('');
      onRefresh();
    } catch (e) { alert('שגיאה: ' + e.message); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!window.confirm('למחוק סוכן זה?')) return;
    await fetch(`${API}/api/winter-agents/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: '100%',
                    maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>👤 ניהול סוכנים</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="שם הסוכן" style={{ ...inp(), flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') add(); }} />
          <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
            placeholder="טלפון" style={{ ...inp(), width: 120 }} />
          <button onClick={add} disabled={saving || !newName.trim()}
            style={{ padding: '9px 16px', borderRadius: 8, background: '#2563eb',
                     color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            +
          </button>
        </div>

        {agents.length === 0 && (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>אין סוכנים עדיין</p>
        )}
        {agents.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '9px 12px', borderRadius: 8, background: '#f8fafc',
                                    marginBottom: 6, border: '1px solid #eaedf2' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</span>
              {a.phone && <span style={{ fontSize: 12, color: '#9ca3af', marginRight: 8 }}>{a.phone}</span>}
            </div>
            <button onClick={() => del(a.id)}
              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Tab ─────────────────────────────────────────────────────────────────
export default function WinterCustomersTab() {
  const [orders,  setOrders]  = useState([]);
  const [agents,  setAgents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(null);   // null | 'new' | order-object
  const [agMgr,   setAgMgr]   = useState(false);
  const [search,  setSearch]  = useState('');
  const [fAgent,  setFAgent]  = useState('');
  const [fProd,   setFProd]   = useState('');
  const [fStatus, setFStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, a] = await Promise.all([
        fetch(`${API}/api/winter-orders`).then(r => r.json()),
        fetch(`${API}/api/winter-agents`).then(r => r.json()),
      ]);
      setOrders(Array.isArray(o) ? o : []);
      setAgents(Array.isArray(a) ? a : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = (saved) => {
    setOrders(prev => {
      const idx = prev.findIndex(o => o.id === saved.id);
      return idx >= 0 ? prev.map(o => o.id === saved.id ? saved : o) : [saved, ...prev];
    });
    setModal(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק הזמנה זו?')) return;
    await fetch(`${API}/api/winter-orders/${id}`, { method: 'DELETE' });
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleStatus = async (order, newStatus) => {
    const updated = { ...order, status: newStatus };
    const res = await fetch(`${API}/api/winter-orders/${order.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (res.ok) { const d = await res.json(); setOrders(prev => prev.map(o => o.id === d.id ? d : o)); }
  };

  // ─ Stats ─
  const totalRevenue = orders.reduce((s, o) => s + (parseFloat(o.total_price) || 0), 0);
  const supplied     = orders.filter(o => o.status === 'סופק').length;
  const pending      = orders.filter(o => o.status === 'ממתין' || o.status === 'נקבע').length;

  const byProduct = PRODUCTS.map(p => ({
    label: p, count: orders.filter(o => o.product === p).length,
    qty: orders.filter(o => o.product === p).reduce((s, o) => s + (parseFloat(o.quantity) || 0), 0),
    rev: orders.filter(o => o.product === p).reduce((s, o) => s + (parseFloat(o.total_price) || 0), 0),
  })).filter(p => p.count > 0);

  // ─ Filters ─
  const visible = orders.filter(o => {
    const q = search.toLowerCase();
    if (q && !o.customer_name.toLowerCase().includes(q) &&
             !o.address.toLowerCase().includes(q) &&
             !o.city.toLowerCase().includes(q) &&
             !o.agent_name.toLowerCase().includes(q)) return false;
    if (fAgent  && o.agent_name !== fAgent)  return false;
    if (fProd   && o.product    !== fProd)   return false;
    if (fStatus && o.status     !== fStatus) return false;
    return true;
  });

  const cardStyle = {
    background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(20px)',
    borderRadius: 14, padding: '18px 22px', border: '1px solid rgba(255,255,255,0.9)',
    boxShadow: '0 4px 24px rgba(99,102,241,0.07)',
  };

  return (
    <div style={{ direction: 'rtl', maxWidth: 1300, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e2d3d', margin: 0 }}>❄️ לקוחות חורף</h1>
          <p style={{ fontSize: 13, color: '#8492a6', margin: '4px 0 0' }}>מעקב הזמנות עונתיות — נפט, סולר, נוזל הסקה וגנרטורים</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setAgMgr(true)}
            style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #dde3ee',
                     background: '#fff', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
            👤 סוכנים
          </button>
          <button onClick={() => setModal('new')}
            style={{ padding: '9px 20px', borderRadius: 8, background: '#2563eb',
                     color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            ➕ הוספת הזמנה
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ ...cardStyle, borderTop: '3px solid #3b82f6' }}>
          <div style={{ fontSize: 11, color: '#8492a6', fontWeight: 700, marginBottom: 4 }}>סה"כ הזמנות</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1e2d3d' }}>{orders.length}</div>
        </div>
        <div style={{ ...cardStyle, borderTop: '3px solid #22c55e' }}>
          <div style={{ fontSize: 11, color: '#8492a6', fontWeight: 700, marginBottom: 4 }}>סופקו</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#22c55e' }}>{supplied}</div>
        </div>
        <div style={{ ...cardStyle, borderTop: '3px solid #f59e0b' }}>
          <div style={{ fontSize: 11, color: '#8492a6', fontWeight: 700, marginBottom: 4 }}>ממתינות</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b' }}>{pending}</div>
        </div>
        <div style={{ ...cardStyle, borderTop: '3px solid #8b5cf6' }}>
          <div style={{ fontSize: 11, color: '#8492a6', fontWeight: 700, marginBottom: 4 }}>סה"כ הכנסות</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#8b5cf6' }}>
            {'₪' + totalRevenue.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
          </div>
        </div>
        {byProduct.map(p => (
          <div key={p.label} style={{ ...cardStyle }}>
            <div style={{ fontSize: 11, color: '#8492a6', fontWeight: 700, marginBottom: 4 }}>
              {PROD_ICON[p.label]} {p.label}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#1e2d3d' }}>{p.count}</div>
            <div style={{ fontSize: 11, color: '#8492a6' }}>
              {p.qty.toLocaleString('he-IL')} {p.label === 'גנרטורים' ? 'יח\'' : 'ל\''}
              {' · '}₪{p.rev.toLocaleString('he-IL', { maximumFractionDigits: 0 })}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ ...cardStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 חפש לקוח / כתובת / סוכן..."
            style={{ ...inp(), flex: '1 1 200px', minWidth: 160 }} />
          <select value={fAgent} onChange={e => setFAgent(e.target.value)} style={inp({ flex: '0 0 130px' })}>
            <option value="">כל הסוכנים</option>
            {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
          <select value={fProd} onChange={e => setFProd(e.target.value)} style={inp({ flex: '0 0 130px' })}>
            <option value="">כל המוצרים</option>
            {PRODUCTS.map(p => <option key={p}>{p}</option>)}
          </select>
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={inp({ flex: '0 0 120px' })}>
            <option value="">כל הסטטוסים</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          {(search || fAgent || fProd || fStatus) && (
            <button onClick={() => { setSearch(''); setFAgent(''); setFProd(''); setFStatus(''); }}
              style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #dde3ee',
                       background: '#fff', cursor: 'pointer', fontSize: 13, color: '#9ca3af' }}>
              ✕ נקה
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>טוען...</div>
        ) : visible.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            {orders.length === 0 ? 'אין הזמנות עדיין — לחץ ➕ להוספה' : 'לא נמצאו תוצאות לסינון'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e9ecef' }}>
                  {['#', 'לקוח', 'כתובת', 'מוצר', 'כמות', 'מחיר/יח\'', "סה\"כ", 'תשלום', 'אספקה', 'סוכן', 'סטטוס', ''].map((h, i) => (
                    <th key={i} style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 700,
                                         color: '#8492a6', fontSize: 11, whiteSpace: 'nowrap',
                                         textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((o, idx) => (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9',
                                           background: idx % 2 === 0 ? '#fff' : '#fafbfc' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#fff' : '#fafbfc'}>
                    <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{o.id}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#1e2d3d' }}>{o.customer_name}</div>
                      {o.customer_phone && <div style={{ fontSize: 11, color: '#8492a6' }}>{o.customer_phone}</div>}
                      {o.contact_name   && <div style={{ fontSize: 11, color: '#8492a6' }}>איש קשר: {o.contact_name}</div>}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {o.address}{o.city ? ', ' + o.city : ''}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 6,
                                     padding: '3px 9px', fontSize: 12, fontWeight: 600 }}>
                        {PROD_ICON[o.product]} {o.product}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{fmtQty(o.quantity, o.product)}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{fmt(o.price_per_unit)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: '#15803d' }}>{fmt(o.total_price)}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{o.payment_method}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>
                      {o.delivery_date ? o.delivery_date.split('-').reverse().join('/') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{o.agent_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <select value={o.status}
                        onChange={e => handleStatus(o, e.target.value)}
                        style={{ padding: '4px 8px', borderRadius: 6, border: '1.5px solid',
                                 borderColor: STATUS_CLR[o.status] || '#dde3ee',
                                 background: '#fff', color: STATUS_CLR[o.status] || '#1e2d3d',
                                 fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        {STATUSES.map(s => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => setModal(o)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                                 fontSize: 14, padding: '2px 5px', color: '#2563eb' }} title="עריכה">
                        ✏️
                      </button>
                      <button onClick={() => handleDelete(o.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer',
                                 fontSize: 14, padding: '2px 5px', color: '#ef4444' }} title="מחיקה">
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {visible.length > 0 && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9',
                         fontSize: 12, color: '#8492a6', textAlign: 'left' }}>
            מציג {visible.length} מתוך {orders.length} הזמנות
          </div>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <OrderModal
          order={modal === 'new' ? null : modal}
          agents={agents}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {agMgr && (
        <AgentsModal
          agents={agents}
          onClose={() => setAgMgr(false)}
          onRefresh={() => { load(); }}
        />
      )}
    </div>
  );
}
