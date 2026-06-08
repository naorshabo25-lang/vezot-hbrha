import { useState, useEffect } from 'react';

const API = window.location.port === '5173' || window.location.port === '5174' ? 'http://localhost:8000' : '';

const Card = ({ children, style = {} }) => (
  <div style={{
    background: '#fff', borderRadius: 14, padding: 22,
    boxShadow: '0 1px 3px rgba(0,0,0,0.07)', border: '1px solid #e9ecef', ...style,
  }}>{children}</div>
);

const inputStyle = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #e9ecef',
  fontSize: 13, background: '#fff', color: '#1e2d3d', outline: 'none', width: '100%',
};

const STATUS_COLORS = {
  'הושלם':  { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  'בביצוע': { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
  'ממתין':  { bg: '#f0f9ff', color: '#0891b2', border: '#bae6fd' },
};

const EMPTY = {
  name: '', phone: '', area: '', site_address: '', contact_name: '', contact_phone: '',
  order_contact_name: '', order_contact_phone: '',
  intendedLiters: '', dailyLiters: '', creditLimit: '', currentBalance: '', paymentTerms: '',
};

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function CustomerOrdersTab({ onChange, workPlanData }) {
  const [customers, setCustomers] = useState([]);
  const [orders,    setOrders]    = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(EMPTY);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editError,       setEditError]       = useState('');
  const [salePriceEdit,   setSalePriceEdit]   = useState(null);
  const [salePriceSaved,  setSalePriceSaved]  = useState(false);
  const [syncing,         setSyncing]         = useState(false);
  const [syncMsg,         setSyncMsg]         = useState('');
  const [editingNoteId,     setEditingNoteId]     = useState(null);
  const [noteDraft,         setNoteDraft]         = useState('');

  const load = () =>
    Promise.all([
      fetch(`${API}/api/customers`).then(r => r.json()),
      fetch(`${API}/api/orders`).then(r => r.json()),
    ]).then(([c, o]) => {
      setCustomers(c);
      setOrders(o);
      setLoading(false);
    }).catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.area || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedCustomer = customers.find(c => c.id === selectedId);
  const customerOrders   = selectedId ? orders.filter(o => o.customer_id === selectedId) : [];
  const sortedOrders     = [...customerOrders].sort((a, b) =>
    (b.order_date || '').localeCompare(a.order_date || '')
  );
  const completedOrders  = customerOrders.filter(o => o.status === 'הושלם').length;

  const syncAllCustomers = async () => {
    setSyncing(true);
    setSyncMsg('');
    try {
      const res = await fetch(`${API}/api/customers`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dbCustomers = await res.json();
      if (!onChange || !Array.isArray(dbCustomers) || dbCustomers.length === 0)
        throw new Error('אין לקוחות במסד הנתונים');

      const existingNames = new Set((workPlanData?.clients || []).map(c => c.name));
      const existingObligo = workPlanData?.obligo || {};
      let added = 0;

      const newClients = [...(workPlanData?.clients || [])];
      const newObligo  = { ...existingObligo };

      dbCustomers.forEach(c => {
        const name = c.name?.trim();
        if (!name) return;
        if (!existingNames.has(name)) {
          newClients.push({ name, liters: 0, profit: 0, dailyLiters: 0 });
          added++;
        }
        if (!newObligo[name]) {
          newObligo[name] = { creditLimit: 0, currentBalance: 0, paymentTerms: '', note: '' };
        }
      });

      onChange(prev => ({ ...(prev || {}), clients: newClients, obligo: newObligo }));
      setSyncMsg(`✓ סונכרנו ${dbCustomers.length} לקוחות — ${added} חדשים נוספו`);
    } catch (e) {
      setSyncMsg(`שגיאה: ${e.message}`);
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(''), 6000);
  };

  const handleAdd = async () => {
    if (!form.name.trim())  return setError('נא להזין שם לקוח');
    if (!form.phone.trim()) return setError('נא להזין מספר טלפון');
    try {
      const res = await fetch(`${API}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const addedName = form.name.trim();

      // סנכרן עם הכנסות ואובליגו לפני load() כדי שהנתונים לא יידרסו
      if (onChange) {
        const liters         = +form.intendedLiters || 0;
        const dailyLiters    = +form.dailyLiters    || 0;
        const creditLimit    = +form.creditLimit    || 0;
        const currentBalance = +form.currentBalance || 0;
        const paymentTerms   = form.paymentTerms.trim();
        onChange(prev => {
          const base = prev || {};
          const clients = Array.isArray(base.clients) ? base.clients : [];
          const already = clients.some(c => c.name === addedName);
          const newClients = already
            ? clients
            : [...clients, { name: addedName, liters, dailyLiters, profit: 0 }];
          const obligo    = base.obligo || {};
          const newObligo = {
            ...obligo,
            [addedName]: { creditLimit, currentBalance, paymentTerms, note: '' },
          };
          return { ...base, clients: newClients, obligo: newObligo };
        });
      }

      await load();

      setForm(EMPTY);
      setError('');
      setShowForm(false);
      setSuccessMsg(`הלקוח "${addedName}" נוסף ומסונכרן עם מערכת ההזמנות, הכנסות ואובליגו ✓`);
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch {
      setError('שגיאה בהוספת לקוח');
    }
  };

  const openSalePrice = (name) => {
    const clients = workPlanData?.clients || [];
    const existing = clients.find(c => c.name === name);
    setSalePriceEdit({ name, value: existing?.salePrice ? String(existing.salePrice) : '' });
    setSalePriceSaved(false);
  };

  const saveSalePrice = () => {
    if (!salePriceEdit) return;
    const price = +salePriceEdit.value;
    if (!price || price <= 0) return;
    onChange(prev => {
      const base = prev || {};
      const clients = Array.isArray(base.clients) ? base.clients : [];
      const idx = clients.findIndex(c => c.name === salePriceEdit.name);
      const newClients = idx >= 0
        ? clients.map((c, i) => i === idx ? { ...c, salePrice: price } : c)
        : [...clients, { name: salePriceEdit.name, liters: 0, profit: 0, salePrice: price }];
      return { ...base, clients: newClients };
    });
    setSalePriceSaved(true);
    setTimeout(() => setSalePriceEdit(null), 1200);
  };

  const startEdit = (c) => {
    const obligoData = workPlanData?.obligo?.[c.name] || {};
    setEditingCustomer({
      id: c.id, name: c.name, phone: c.phone || '', area: c.area || '',
      site_address: c.site_address || '', contact_name: c.contact_name || '',
      contact_phone: c.contact_phone || '', email: c.email || '',
      order_contact_name: c.order_contact_name || '', order_contact_phone: c.order_contact_phone || '',
      currentBalance: obligoData.currentBalance != null ? String(obligoData.currentBalance) : '',
    });
    setEditError('');
    setShowForm(false);
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer.name.trim()) return setEditError('נא להזין שם לקוח');
    try {
      const { currentBalance, ...apiFields } = editingCustomer;
      const res = await fetch(`${API}/api/customers/${editingCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiFields),
      });
      if (!res.ok) throw new Error();
      if (onChange && currentBalance !== '') {
        onChange(prev => {
          const base   = prev || {};
          const obligo = { ...(base.obligo || {}) };
          const name   = editingCustomer.name.trim();
          obligo[name] = { ...(obligo[name] || {}), currentBalance: +currentBalance || 0 };
          return { ...base, obligo };
        });
      }
      await load();
      setEditingCustomer(null);
      setEditError('');
    } catch {
      setEditError('שגיאה בשמירת הלקוח');
    }
  };

  const toggleWhatsapp = async (customer) => {
    const newVal = !customer.whatsapp_enabled;
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, whatsapp_enabled: newVal } : c));
    try {
      await fetch(`${API}/api/customers/${customer.id}/whatsapp`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newVal }),
      });
    } catch {
      setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, whatsapp_enabled: !newVal } : c));
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#9ca3af', fontSize: 15 }}>
      טוען נתונים...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      <>

      {/* כפתור סנכרון */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={syncAllCustomers}
          disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', border: 'none',
            opacity: syncing ? 0.7 : 1,
          }}
        >
          {syncing ? '⏳ מסנכרן...' : '🔄 סנכרן לקוחות למערכת'}
        </button>
        {syncMsg && (
          <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>✓ {syncMsg}</span>
        )}
      </div>

      {/* הוספת לקוח */}
      <div>
        <button
          onClick={() => { setShowForm(v => !v); setError(''); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: '#1e2d3d', color: '#fff', border: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2e4560'}
          onMouseLeave={e => e.currentTarget.style.background = '#1e2d3d'}>
          {showForm ? '✕ ביטול' : '+ הוספת לקוח חדש'}
        </button>

        {successMsg && (
        <div style={{
          marginTop: 12, padding: '12px 18px', borderRadius: 10,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{successMsg}</span>
          <a href="http://localhost:8000/dashboard#customers" target="_blank" rel="noreferrer"
            style={{
              fontSize: 12, fontWeight: 700, color: '#0891b2', textDecoration: 'none',
              background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 7,
              padding: '5px 12px', whiteSpace: 'nowrap',
            }}>
            פתח במערכת ההזמנות ←
          </a>
        </div>
      )}

      {showForm && (
          <div style={{
            marginTop: 14, background: '#fff', borderRadius: 14, padding: 24,
            border: '1px solid #e9ecef', boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1e2d3d', marginBottom: 16 }}>הוספת לקוח חדש</h3>

            {/* פרטי לקוח */}
            <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' }}>פרטי לקוח</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { key: 'name',          label: 'שם לקוח/חברה *',  placeholder: 'שם החברה / הלקוח', type: 'text' },
                { key: 'contact_name',  label: 'איש קשר',          placeholder: 'שם מלא',            type: 'text' },
                { key: 'site_address',  label: 'כתובת',             placeholder: 'כתובת מלאה',        type: 'text' },
                { key: 'phone',         label: 'טלפון *',           placeholder: '05X-XXXXXXX',       type: 'text' },
                { key: 'contact_phone', label: 'טלפון איש קשר',    placeholder: '05X-XXXXXXX',       type: 'text' },
                { key: 'area',          label: 'אזור',              placeholder: 'ירושלים / מודיעין', type: 'text' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{label}</label>
                  <input type={type} style={inputStyle} value={form[key]} placeholder={placeholder}
                    onChange={e => setForm(f => {
                      const upd = { ...f, [key]: e.target.value };
                      if (key === 'contact_name')  upd.order_contact_name  = e.target.value;
                      if (key === 'contact_phone') upd.order_contact_phone = e.target.value;
                      return upd;
                    })} />
                </div>
              ))}
            </div>

            {/* איש קשר להזמנות */}
            <div style={{ borderTop: '1px dashed #e9ecef', paddingTop: 18, marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' }}>איש קשר להזמנות</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>שם איש קשר להזמנות</label>
                  <input type="text" style={inputStyle} value={form.order_contact_name} placeholder="שם מלא"
                    onChange={e => setForm(f => ({ ...f, order_contact_name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>טלפון איש קשר להזמנות</label>
                  <input type="text" style={inputStyle} value={form.order_contact_phone} placeholder="05X-XXXXXXX"
                    onChange={e => setForm(f => ({ ...f, order_contact_phone: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* הגדרות כלכליות */}
            <div style={{ borderTop: '1px dashed #e9ecef', paddingTop: 18, marginBottom: 14 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' }}>הגדרות כלכליות</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>כמות חודשית (ליטרים)</label>
                  <input type="number" min="0" style={{ ...inputStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}
                    value={form.intendedLiters} placeholder="0"
                    onChange={e => setForm(f => ({ ...f, intendedLiters: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>כמות יומית (ליטרים)</label>
                  <input type="number" min="0" style={{ ...inputStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}
                    value={form.dailyLiters} placeholder="0"
                    onChange={e => setForm(f => ({ ...f, dailyLiters: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>מסגרת אשראי (₪)</label>
                  <input type="number" min="0" style={{ ...inputStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}
                    value={form.creditLimit} placeholder="₪ 0"
                    onChange={e => setForm(f => ({ ...f, creditLimit: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>חוב נוכחי (₪)</label>
                  <input type="number" min="0" style={{ ...inputStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}
                    value={form.currentBalance} placeholder="₪ 0"
                    onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>תנאי תשלום</label>
                  <input type="text" style={{ ...inputStyle, background: '#f0f9ff', borderColor: '#bae6fd' }}
                    value={form.paymentTerms} placeholder="שוטף+30"
                    onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} />
                </div>
              </div>
            </div>
            {error && <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleAdd} style={{ padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#1e2d3d', color: '#fff', border: 'none' }}>
                שמור
              </button>
              <button onClick={() => { setShowForm(false); setError(''); }} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>
                ביטול
              </button>
            </div>
          </div>
        )}
      </div>

      {/* גוף — רשימת לקוחות + הזמנות */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* רשימת לקוחות */}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: '#f8fafc' }}>
            <input
              style={{ ...inputStyle, border: '1px solid #e9ecef', fontSize: 12, padding: '7px 10px' }}
              placeholder="חיפוש לקוח..."
              value={search}
              onChange={e => setSearch(e.target.value)} />
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, fontWeight: 600 }}>
              {filteredCustomers.length} לקוחות
            </div>
          </div>
          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ padding: 24, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>לא נמצאו לקוחות</div>
            ) : filteredCustomers.map(c => {
              const count      = orders.filter(o => o.customer_id === c.id).length;
              const isSelected = selectedId === c.id;
              return (
                <button key={c.id}
                  onClick={() => setSelectedId(isSelected ? null : c.id)}
                  style={{
                    width: '100%', padding: '12px 16px', border: 'none', cursor: 'pointer',
                    textAlign: 'right', background: isSelected ? '#1e2d3d' : 'transparent',
                    borderBottom: '1px solid #f3f4f6', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? '#fff' : '#1e2d3d', marginBottom: 2 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: isSelected ? 'rgba(200,210,220,0.75)' : '#9ca3af' }}>
                    {c.area ? `${c.area} · ` : ''}{count} הזמנות
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* צד ימין — פרטי לקוח + הזמנות */}
        {!selectedCustomer ? (
          <Card style={{ textAlign: 'center', padding: 64 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
            <p style={{ color: '#9ca3af', fontSize: 14 }}>בחר לקוח מהרשימה כדי לראות את ההזמנות שלו</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* כרטיס פרטי לקוח */}
            {editingCustomer?.id === selectedCustomer.id ? (
              <Card>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1e2d3d', marginBottom: 16 }}>עריכת לקוח</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
                  {[
                    { key: 'name',                label: 'שם לקוח/חברה *',        placeholder: 'שם החברה / הלקוח' },
                    { key: 'contact_name',        label: 'איש קשר',               placeholder: 'שם מלא' },
                    { key: 'site_address',        label: 'כתובת',                  placeholder: 'כתובת מלאה' },
                    { key: 'phone',               label: 'טלפון',                  placeholder: '05X-XXXXXXX' },
                    { key: 'contact_phone',       label: 'טלפון איש קשר',         placeholder: '05X-XXXXXXX' },
                    { key: 'area',                label: 'אזור',                   placeholder: 'ירושלים / מודיעין' },
                    { key: 'email',               label: 'מייל',                   placeholder: 'example@mail.com' },
                    { key: 'order_contact_name',  label: 'איש קשר להזמנות',       placeholder: 'שם מלא' },
                    { key: 'order_contact_phone', label: 'טלפון איש קשר להזמנות', placeholder: '05X-XXXXXXX' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{label}</label>
                      <input style={inputStyle} value={editingCustomer[key] || ''} placeholder={placeholder}
                        onChange={e => setEditingCustomer(p => ({ ...p, [key]: e.target.value }))} />
                    </div>
                  ))}
                </div>

                {/* יתרת חוב */}
                <div style={{ borderTop: '1px dashed #e9ecef', paddingTop: 16, marginBottom: 12 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' }}>פיננסי</p>
                  <div style={{ maxWidth: 220 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>יתרת חוב נוכחי (₪)</label>
                    <input
                      type="number" min="0" step="0.01"
                      style={{ ...inputStyle, background: '#fff5f5', borderColor: '#fecaca', color: '#dc2626', fontWeight: 700 }}
                      value={editingCustomer.currentBalance || ''}
                      placeholder="₪ 0"
                      onChange={e => setEditingCustomer(p => ({ ...p, currentBalance: e.target.value }))} />
                  </div>
                </div>

                {editError && <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{editError}</p>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleSaveEdit} style={{ padding: '9px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#1e2d3d', color: '#fff', border: 'none' }}>
                    שמור שינויים
                  </button>
                  <button onClick={() => { setEditingCustomer(null); setEditError(''); }} style={{ padding: '9px 18px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>
                    ביטול
                  </button>
                </div>
              </Card>
            ) : (
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d3d', marginBottom: 8 }}>{selectedCustomer.name}</h2>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                      {selectedCustomer.phone         && <span style={{ fontSize: 13, color: '#6b7280' }}>📞 {selectedCustomer.phone}</span>}
                      {selectedCustomer.area          && <span style={{ fontSize: 13, color: '#6b7280' }}>📍 {selectedCustomer.area}</span>}
                      {selectedCustomer.contact_name  && <span style={{ fontSize: 13, color: '#6b7280' }}>👤 {selectedCustomer.contact_name}</span>}
                      {selectedCustomer.contact_phone && <span style={{ fontSize: 13, color: '#6b7280' }}>📱 {selectedCustomer.contact_phone}</span>}
                      {selectedCustomer.site_address  && <span style={{ fontSize: 13, color: '#6b7280' }}>🏠 {selectedCustomer.site_address}</span>}
                      {selectedCustomer.email         && <span style={{ fontSize: 13, color: '#6b7280' }}>✉️ {selectedCustomer.email}</span>}
                      {selectedCustomer.order_contact_name && (
                        <span style={{ fontSize: 13, color: '#0891b2', fontWeight: 600, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 20, padding: '2px 10px' }}>
                          🚚 איש קשר להזמנות: {selectedCustomer.order_contact_name}
                          {selectedCustomer.order_contact_phone ? ` · ${selectedCustomer.order_contact_phone}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {/* מחיר מכירה */}
                    {salePriceEdit?.name === selectedCustomer.name ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '8px 12px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0891b2', whiteSpace: 'nowrap' }}>מחיר מכירה ₪/ל׳</span>
                        <input
                          type="number" step="0.001" min="0"
                          value={salePriceEdit.value}
                          onChange={e => setSalePriceEdit(p => ({ ...p, value: e.target.value }))}
                          style={{ width: 90, padding: '5px 8px', borderRadius: 6, border: '1px solid #bae6fd', fontSize: 13, fontWeight: 700, color: '#0891b2', outline: 'none' }}
                          autoFocus
                        />
                        <button onClick={saveSalePrice}
                          style={{ background: salePriceSaved ? '#16a34a' : '#0891b2', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                          {salePriceSaved ? '✓' : 'שמור'}
                        </button>
                        <button onClick={() => setSalePriceEdit(null)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => openSalePrice(selectedCustomer.name)}
                        style={{ padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#e0f2fe'}
                        onMouseLeave={e => e.currentTarget.style.background = '#f0f9ff'}>
                        💲 {(workPlanData?.clients || []).find(c => c.name === selectedCustomer.name)?.salePrice
                          ? `מחיר מכירה: ₪${(workPlanData.clients.find(c => c.name === selectedCustomer.name).salePrice).toFixed(3)}`
                          : 'הגדר מחיר מכירה'}
                      </button>
                    )}
                    <button onClick={() => toggleWhatsapp(selectedCustomer)}
                      title={selectedCustomer.whatsapp_enabled ? 'לחץ להשבית הודעות וואטסאפ' : 'לחץ להפעיל הודעות וואטסאפ'}
                      style={{
                        padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                        background: selectedCustomer.whatsapp_enabled ? '#f0fdf4' : '#f9fafb',
                        color: selectedCustomer.whatsapp_enabled ? '#16a34a' : '#9ca3af',
                        border: `1px solid ${selectedCustomer.whatsapp_enabled ? '#bbf7d0' : '#e5e7eb'}`,
                      }}>
                      {selectedCustomer.whatsapp_enabled ? '💬 וואטסאפ פעיל' : '💬 וואטסאפ כבוי'}
                    </button>
                    <button onClick={() => startEdit(selectedCustomer)}
                      style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#e0f2fe'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f0f9ff'}>
                      ✎ עריכה
                    </button>
                    <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#0891b2' }}>{customerOrders.length}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>סה"כ הזמנות</div>
                    </div>
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#16a34a' }}>{completedOrders}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>הושלמו</div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* טבלת הזמנות */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: '#f8fafc' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>הזמנות ללקוח</span>
              </div>
              {sortedOrders.length === 0 ? (
                <div style={{ padding: 48, color: '#9ca3af', fontSize: 14, textAlign: 'center' }}>אין הזמנות ללקוח זה</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e9ecef' }}>
                        {['#', 'תאריך', 'כתובת', 'איש קשר', 'כמות', 'שעת אספקה', 'נהג', 'סטטוס'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'right', color: '#6b7280', fontWeight: 700, fontSize: 11, letterSpacing: 0.5 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedOrders.map(o => {
                        const sc = STATUS_COLORS[o.status] || { bg: '#f8f9fa', color: '#6b7280', border: '#e9ecef' };
                        return (
                          <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 11 }}>{o.id}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(o.order_date)}</td>
                            <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.site_address || '—'}</td>
                            <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 600 }}>{o.contact_name || '—'}</div>
                              {o.contact_phone && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{o.contact_phone}</div>}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: 700, color: '#1e2d3d', whiteSpace: 'nowrap' }}>{o.quantity} ל'</td>
                            <td style={{ padding: '10px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{o.delivery_time || '—'}</td>
                            <td style={{ padding: '10px 14px', color: '#374151' }}>{o.driver_name || '—'}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                                {o.status || 'ממתין'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      </>

    </div>
  );
}
