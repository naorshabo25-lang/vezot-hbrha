import { useState, useEffect } from 'react';

const API = (window.location.port === '5173' || window.location.port === '5174') ? `http://${window.location.hostname}:8000` : '';

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

const STATUS_OPTIONS = ['ממתין', 'אושר', 'נשלח', 'הושלם'];

const STATUS_COLORS = {
  'ממתין': { bg: '#f3f4f6', color: '#6b7280', border: '#e5e7eb' },
  'אושר':  { bg: '#f0f9ff', color: '#1d4ed8', border: '#bae6fd' },
  'נשלח':  { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },
  'הושלם': { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
};

const RECURRING_DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const EMPTY = {
  name: '', phone: '', area: '', site_address: '', contact_name: '', contact_phone: '',
  order_contact_name: '', order_contact_phone: '',
  intendedLiters: '', dailyLiters: '', creditLimit: '', currentBalance: '', paymentTerms: '',
};

const EMPTY_ORDER = {
  site_address: '', contact_name: '', contact_phone: '', quantity: '', order_date: '', area: '',
};

const EMPTY_RECURRING = { days_of_week: [0, 1, 2, 3, 4], start_date: '', end_date: '' };

const todayISO = () => new Date().toISOString().slice(0, 10);

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
  const [deleteConfirmId,   setDeleteConfirmId]   = useState(null);
  const [sendingMsgId,      setSendingMsgId]      = useState(null);
  const [sentMsgId,         setSentMsgId]         = useState(null);
  const [sites,             setSites]             = useState([]);
  const [showSiteForm,      setShowSiteForm]      = useState(false);
  const [siteForm,          setSiteForm]          = useState({ name: '', city: '', address: '' });
  const [siteError,         setSiteError]         = useState('');
  const [deleteSiteId,      setDeleteSiteId]      = useState(null);

  const [drivers,           setDrivers]           = useState([]);
  const [recurring,         setRecurring]         = useState([]);
  const [showOrderForm,     setShowOrderForm]     = useState(false);
  const [orderForm,         setOrderForm]         = useState(EMPTY_ORDER);
  const [orderError,        setOrderError]        = useState('');
  const [orderSuccessMsg,   setOrderSuccessMsg]   = useState('');
  const [statusUpdatingId,  setStatusUpdatingId]  = useState(null);
  const [deleteOrderConfirmId, setDeleteOrderConfirmId] = useState(null);
  const [recurringModalOrder,  setRecurringModalOrder]  = useState(null);
  const [recurringForm,        setRecurringForm]        = useState(EMPTY_RECURRING);
  const [recurringActionError, setRecurringActionError] = useState('');
  const [deleteRecurringConfirmId, setDeleteRecurringConfirmId] = useState(null);

  const load = () =>
    Promise.all([
      fetch(`${API}/api/customers`).then(r => r.json()),
      fetch(`${API}/api/orders`).then(r => r.json()),
      fetch(`${API}/api/drivers`).then(r => r.json()),
      fetch(`${API}/api/recurring-orders`).then(r => r.json()),
    ]).then(([c, o, d, r]) => {
      setCustomers(c);
      setOrders(o);
      setDrivers(d);
      setRecurring(r);
      setLoading(false);
    }).catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const loadSites = (cid) =>
    fetch(`${API}/api/customers/${cid}/sites`)
      .then(r => r.json())
      .then(setSites)
      .catch(() => setSites([]));

  useEffect(() => {
    if (selectedId) { loadSites(selectedId); setShowSiteForm(false); setSiteForm({ name: '', city: '', address: '' }); setSiteError(''); }
    else setSites([]);
    setShowOrderForm(false);
    setOrderForm(EMPTY_ORDER);
    setOrderError('');
  }, [selectedId]);

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
  const customerRecurring = selectedId ? recurring.filter(r => r.customer_id === selectedId) : [];
  const driverAreas       = [...new Set(drivers.map(d => d.area).filter(Boolean))];
  const matchedDriver     = orderForm.area ? drivers.find(d => d.area === orderForm.area) : null;

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

  const handleAddSite = async () => {
    if (!siteForm.name.trim())    return setSiteError('נא להזין שם אתר');
    if (!siteForm.city.trim())    return setSiteError('נא לבחור עיר');
    if (!siteForm.address.trim()) return setSiteError('נא להזין כתובת');
    try {
      const res = await fetch(`${API}/api/customers/${selectedId}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteForm),
      });
      if (!res.ok) throw new Error();
      setSiteForm({ name: '', city: '', address: '' });
      setSiteError('');
      setShowSiteForm(false);
      loadSites(selectedId);
    } catch { setSiteError('שגיאה בהוספת אתר'); }
  };

  const sendOrderMessage = async (c) => {
    setSendingMsgId(c.id);
    try {
      await fetch(`${API}/api/customers/${c.id}/send-order-message`, { method: 'POST' });
      setSentMsgId(c.id);
      setTimeout(() => setSentMsgId(null), 3000);
    } catch {}
    setSendingMsgId(null);
  };

  const handleDeleteSite = async (sid) => {
    await fetch(`${API}/api/customers/${selectedId}/sites/${sid}`, { method: 'DELETE' });
    setDeleteSiteId(null);
    loadSites(selectedId);
  };

  const handleDeleteCustomer = async (id) => {
    try {
      const res = await fetch(`${API}/api/customers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setSelectedId(null);
      setDeleteConfirmId(null);
      await load();
    } catch {
      setDeleteConfirmId(null);
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

  const openOrderForm = () => {
    setOrderForm({
      site_address:  selectedCustomer.site_address || '',
      contact_name:  selectedCustomer.order_contact_name  || selectedCustomer.contact_name  || '',
      contact_phone: selectedCustomer.order_contact_phone || selectedCustomer.contact_phone || '',
      quantity: '',
      order_date: todayISO(),
      area: selectedCustomer.area || '',
    });
    setOrderError('');
    setShowOrderForm(true);
  };

  const handleAddOrder = async () => {
    if (!orderForm.site_address.trim()) return setOrderError('נא להזין כתובת אתר');
    if (!orderForm.contact_name.trim()) return setOrderError('נא להזין איש קשר');
    if (!orderForm.quantity || +orderForm.quantity <= 0) return setOrderError('נא להזין כמות תקינה');
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: selectedCustomer.id,
          customer_name: selectedCustomer.name,
          site_address: orderForm.site_address.trim(),
          contact_name: orderForm.contact_name.trim(),
          contact_phone: orderForm.contact_phone.trim(),
          quantity: orderForm.quantity,
          order_date: orderForm.order_date || todayISO(),
          area: orderForm.area,
        }),
      });
      if (!res.ok) throw new Error();
      await load();
      setShowOrderForm(false);
      setOrderError('');
      setOrderSuccessMsg('ההזמנה נוספה בהצלחה ✓');
      setTimeout(() => setOrderSuccessMsg(''), 4000);
    } catch {
      setOrderError('שגיאה בהוספת ההזמנה');
    }
  };

  const handleStatusChange = async (order, status) => {
    setStatusUpdatingId(order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status } : o));
    try {
      const res = await fetch(`${API}/api/orders/${order.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: order.status } : o));
    }
    setStatusUpdatingId(null);
  };

  const handleDeleteOrder = async (orderId) => {
    const res = await fetch(`${API}/api/orders/${orderId}`, { method: 'DELETE' });
    if (res.ok) setOrders(prev => prev.filter(o => o.id !== orderId));
    setDeleteOrderConfirmId(null);
  };

  const openRecurringModal = (order) => {
    setRecurringModalOrder(order);
    setRecurringForm(EMPTY_RECURRING);
    setRecurringActionError('');
  };

  const closeRecurringModal = () => {
    setRecurringModalOrder(null);
    setRecurringActionError('');
  };

  const toggleRecurringDay = (day) =>
    setRecurringForm(f => ({
      ...f,
      days_of_week: f.days_of_week.includes(day)
        ? f.days_of_week.filter(d => d !== day)
        : [...f.days_of_week, day].sort(),
    }));

  const saveRecurringOrder = async () => {
    if (!recurringModalOrder) return;
    if (recurringForm.days_of_week.length === 0) return setRecurringActionError('יש לבחור לפחות יום אחד');
    const o = recurringModalOrder;
    try {
      const res = await fetch(`${API}/api/recurring-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: o.customer_id,
          customer_name: o.customer_name,
          site_address: o.site_address,
          contact_name: o.contact_name,
          contact_phone: o.contact_phone,
          quantity: o.quantity,
          days_of_week: recurringForm.days_of_week,
          start_date: recurringForm.start_date,
          end_date: recurringForm.end_date,
        }),
      });
      if (!res.ok) throw new Error();
      await load();
      closeRecurringModal();
    } catch {
      setRecurringActionError('שגיאה בשמירת ההזמנה הקבועה');
    }
  };

  const toggleRecurringActive = async (r) => {
    const newVal = !r.active;
    setRecurring(prev => prev.map(x => x.id === r.id ? { ...x, active: newVal } : x));
    try {
      const res = await fetch(`${API}/api/recurring-orders/${r.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: newVal }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRecurring(prev => prev.map(x => x.id === r.id ? { ...x, active: r.active } : x));
    }
  };

  const handleDeleteRecurring = async (rid) => {
    const res = await fetch(`${API}/api/recurring-orders/${rid}`, { method: 'DELETE' });
    if (res.ok) setRecurring(prev => prev.filter(r => r.id !== rid));
    setDeleteRecurringConfirmId(null);
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
            <div className="grid-3-form" style={{ marginBottom: 20 }}>
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
              <div className="grid-3-form">
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
              <div className="grid-3-form">
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
      <div className="grid-master-detail">

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
          <div className="customer-list" style={{ maxHeight: 540, overflowY: 'auto' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ padding: 24, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>לא נמצאו לקוחות</div>
            ) : filteredCustomers.map(c => {
              const count      = orders.filter(o => o.customer_id === c.id).length;
              const isSelected = selectedId === c.id;
              const isSending  = sendingMsgId === c.id;
              const isSent     = sentMsgId === c.id;
              return (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center',
                  background: isSelected ? '#1e2d3d' : 'transparent',
                  borderBottom: '1px solid #f3f4f6', transition: 'background 0.12s',
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
                  <div onClick={() => setSelectedId(isSelected ? null : c.id)}
                    style={{ flex: 1, padding: '12px 16px', cursor: 'pointer', textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isSelected ? '#fff' : '#1e2d3d', marginBottom: 2 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: isSelected ? 'rgba(200,210,220,0.75)' : '#9ca3af' }}>
                      {c.area ? `${c.area} · ` : ''}{count} הזמנות
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); sendOrderMessage(c); }}
                    disabled={isSending || isSent}
                    title="שלח הודעת הזמנה ללקוח"
                    style={{
                      flexShrink: 0, margin: '0 8px', padding: '5px 8px', borderRadius: 7,
                      fontSize: 14, cursor: isSending || isSent ? 'default' : 'pointer',
                      border: 'none', lineHeight: 1,
                      background: isSent ? '#f0fdf4' : isSelected ? 'rgba(255,255,255,0.12)' : '#f0f9ff',
                      color: isSent ? '#16a34a' : '#0891b2',
                      opacity: isSending ? 0.5 : 1,
                    }}>
                    {isSent ? '✓' : isSending ? '⏳' : '💬'}
                  </button>
                </div>
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
                <div className="grid-3-form" style={{ marginBottom: 12 }}>
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
                    <button
                      onClick={() => sendOrderMessage(selectedCustomer)}
                      disabled={sendingMsgId === selectedCustomer.id || sentMsgId === selectedCustomer.id}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                        background: sentMsgId === selectedCustomer.id ? '#f0fdf4' : '#fefce8',
                        color: sentMsgId === selectedCustomer.id ? '#16a34a' : '#ca8a04',
                        border: `1px solid ${sentMsgId === selectedCustomer.id ? '#bbf7d0' : '#fde68a'}`,
                        opacity: sendingMsgId === selectedCustomer.id ? 0.6 : 1,
                      }}>
                      {sentMsgId === selectedCustomer.id ? '✓ נשלח!' : sendingMsgId === selectedCustomer.id ? '⏳ שולח...' : '📨 שלח הודעת הזמנה'}
                    </button>
                    <button onClick={() => startEdit(selectedCustomer)}
                      style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#e0f2fe'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f0f9ff'}>
                      ✎ עריכה
                    </button>
                    {deleteConfirmId === selectedCustomer.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 12px' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>למחוק את הלקוח?</span>
                        <button onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                          style={{ padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#dc2626', color: '#fff', border: 'none' }}>
                          מחק
                        </button>
                        <button onClick={() => setDeleteConfirmId(null)}
                          style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>
                          ביטול
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirmId(selectedCustomer.id)}
                        style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                        onMouseLeave={e => e.currentTarget.style.background = '#fff5f5'}>
                        🗑 מחיקה
                      </button>
                    )}
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

            {/* אתרי אספקה */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1e2d3d', margin: 0 }}>
                  📍 אתרי אספקה ({sites.length})
                </h3>
                <button onClick={() => { setShowSiteForm(v => !v); setSiteError(''); }}
                  style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: showSiteForm ? '#f3f4f6' : '#1e2d3d', color: showSiteForm ? '#374151' : '#fff', border: 'none' }}>
                  {showSiteForm ? '✕ ביטול' : '+ הוסף אתר'}
                </button>
              </div>

              {showSiteForm && (
                <div style={{ background: '#f8fafc', border: '1px solid #e9ecef', borderRadius: 10, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>שם האתר</label>
                      <input style={inputStyle} value={siteForm.name} placeholder='מחסן ראשי, אתר A...'
                        onChange={e => setSiteForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>עיר / אזור</label>
                      <select style={{ ...inputStyle, background: '#fff' }} value={siteForm.city}
                        onChange={e => setSiteForm(f => ({ ...f, city: e.target.value }))}>
                        <option value=''>בחר אזור...</option>
                        <option value='ירושלים'>ירושלים והסביבה</option>
                        <option value='מודיעין'>מודיעין</option>
                        <option value='מעלה אדומים'>מעלה אדומים</option>
                        <option value='בית שמש'>בית שמש</option>
                        <option value='אחר'>אחר</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 4 }}>כתובת מדויקת</label>
                      <input style={inputStyle} value={siteForm.address} placeholder='רחוב, מספר, קומה...'
                        onChange={e => setSiteForm(f => ({ ...f, address: e.target.value }))} />
                    </div>
                  </div>
                  {siteError && <p style={{ color: '#dc2626', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{siteError}</p>}
                  <button onClick={handleAddSite}
                    style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#1e2d3d', color: '#fff', border: 'none' }}>
                    שמור אתר
                  </button>
                </div>
              )}

              {sites.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>
                  אין אתרים — הבוט ישאל על הכתובת בכל הזמנה
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sites.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', border: '1px solid #e9ecef', borderRadius: 9, padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ background: '#1e2d3d', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d3d' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{s.city}, {s.address}</div>
                        </div>
                      </div>
                      {deleteSiteId === s.id ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>למחוק?</span>
                          <button onClick={() => handleDeleteSite(s.id)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#dc2626', color: '#fff', border: 'none' }}>מחק</button>
                          <button onClick={() => setDeleteSiteId(null)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>ביטול</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteSiteId(s.id)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* הזמנה חדשה */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#1e2d3d', margin: 0 }}>🚛 הזמנה חדשה</h3>
                <button onClick={() => showOrderForm ? setShowOrderForm(false) : openOrderForm()}
                  style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: showOrderForm ? '#f3f4f6' : '#1e2d3d', color: showOrderForm ? '#374151' : '#fff', border: 'none' }}>
                  {showOrderForm ? '✕ ביטול' : '+ הזמנה חדשה'}
                </button>
              </div>

              {orderSuccessMsg && (
                <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#16a34a' }}>{orderSuccessMsg}</span>
                </div>
              )}

              {showOrderForm && (() => {
                const orderAreaOptions = [...new Set([...driverAreas, selectedCustomer.area].filter(Boolean))];
                return (
                  <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #e9ecef', borderRadius: 10, padding: 16 }}>
                    <div className="grid-3-form" style={{ marginBottom: 14 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>כתובת אתר *</label>
                        {sites.length > 0 ? (
                          <select style={{ ...inputStyle, background: '#fff' }} value={orderForm.site_address}
                            onChange={e => setOrderForm(f => ({ ...f, site_address: e.target.value }))}>
                            {selectedCustomer.site_address && (
                              <option value={selectedCustomer.site_address}>{selectedCustomer.site_address} (ראשי)</option>
                            )}
                            {sites.map(s => (
                              <option key={s.id} value={`${s.name} — ${s.city}, ${s.address}`}>{s.name} ({s.city})</option>
                            ))}
                          </select>
                        ) : (
                          <input style={inputStyle} value={orderForm.site_address} placeholder="כתובת מלאה"
                            onChange={e => setOrderForm(f => ({ ...f, site_address: e.target.value }))} />
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>איש קשר *</label>
                        <input style={inputStyle} value={orderForm.contact_name} placeholder="שם מלא"
                          onChange={e => setOrderForm(f => ({ ...f, contact_name: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>טלפון איש קשר</label>
                        <input style={inputStyle} value={orderForm.contact_phone} placeholder="05X-XXXXXXX"
                          onChange={e => setOrderForm(f => ({ ...f, contact_phone: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>כמות (ליטר) *</label>
                        <input type="number" min="1" style={inputStyle} value={orderForm.quantity} placeholder="0"
                          onChange={e => setOrderForm(f => ({ ...f, quantity: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>תאריך הזמנה</label>
                        <input type="date" style={inputStyle} value={orderForm.order_date}
                          onChange={e => setOrderForm(f => ({ ...f, order_date: e.target.value }))} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>אזור (לשיוך נהג)</label>
                        <select style={{ ...inputStyle, background: '#fff' }} value={orderForm.area}
                          onChange={e => setOrderForm(f => ({ ...f, area: e.target.value }))}>
                          <option value="">-- בחר אזור --</option>
                          {orderAreaOptions.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                    </div>

                    {orderForm.area && (
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 14, color: matchedDriver ? '#16a34a' : '#dc2626' }}>
                        {matchedDriver
                          ? `נהג משויך: ${matchedDriver.name} (${matchedDriver.phone})`
                          : 'אין נהג רשום לאזור זה — ההזמנה תיווצר בלי שיוך נהג'}
                      </div>
                    )}

                    {orderError && <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{orderError}</p>}
                    <button onClick={handleAddOrder}
                      style={{ padding: '9px 24px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#1e2d3d', color: '#fff', border: 'none' }}>
                      שמור הזמנה
                    </button>
                  </div>
                );
              })()}
            </Card>

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
                        {['#', 'תאריך', 'כתובת', 'איש קשר', 'כמות', 'שעת אספקה', 'נהג', 'סטטוס', 'פעולות'].map(h => (
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
                              <select
                                value={o.status || 'ממתין'}
                                disabled={statusUpdatingId === o.id}
                                onChange={e => handleStatusChange(o, e.target.value)}
                                style={{
                                  background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                                  borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
                                  cursor: statusUpdatingId === o.id ? 'default' : 'pointer', outline: 'none',
                                  opacity: statusUpdatingId === o.id ? 0.6 : 1,
                                }}>
                                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <button onClick={() => openRecurringModal(o)} title="הפוך להזמנה קבועה"
                                  style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd' }}>
                                  🔁
                                </button>
                                {deleteOrderConfirmId === o.id ? (
                                  <>
                                    <button onClick={() => handleDeleteOrder(o.id)}
                                      style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#dc2626', color: '#fff', border: 'none' }}>מחק</button>
                                    <button onClick={() => setDeleteOrderConfirmId(null)}
                                      style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>ביטול</button>
                                  </>
                                ) : (
                                  <button onClick={() => setDeleteOrderConfirmId(o.id)} title="מחק הזמנה"
                                    style={{ padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer', background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca' }}>
                                    ✕
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* הזמנות קבועות */}
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', background: '#f8fafc' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>🔁 הזמנות קבועות ללקוח</span>
              </div>
              {customerRecurring.length === 0 ? (
                <div style={{ padding: 32, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>אין הזמנות קבועות ללקוח זה</div>
              ) : (
                <div>
                  {customerRecurring.map(r => {
                    const days = (r.days_of_week || '').split(',').filter(Boolean)
                      .map(d => RECURRING_DAY_LABELS[parseInt(d, 10)]).join(' ');
                    return (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 20px', borderBottom: '1px solid #f3f4f6', gap: 12, flexWrap: 'wrap',
                      }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e2d3d' }}>{r.site_address} · {r.quantity} ל'</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                            ימים: {days || '—'} · {r.start_date || 'ללא הגבלה'}{r.end_date ? ` → ${r.end_date}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button onClick={() => toggleRecurringActive(r)}
                            style={{
                              padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none',
                              background: r.active ? '#fef3c7' : '#dcfce7', color: r.active ? '#92400e' : '#166534',
                            }}>
                            {r.active ? 'השבת' : 'הפעל'}
                          </button>
                          {deleteRecurringConfirmId === r.id ? (
                            <>
                              <button onClick={() => handleDeleteRecurring(r.id)}
                                style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#dc2626', color: '#fff', border: 'none' }}>מחק</button>
                              <button onClick={() => setDeleteRecurringConfirmId(null)}
                                style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>ביטול</button>
                            </>
                          ) : (
                            <button onClick={() => setDeleteRecurringConfirmId(r.id)}
                              style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca' }}>מחק</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {recurringModalOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) closeRecurringModal(); }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e2d3d', margin: 0 }}>🔁 הפוך להזמנה קבועה</h2>
              <button onClick={closeRecurringModal} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              <strong style={{ color: '#1e2d3d' }}>{recurringModalOrder.customer_name}</strong> — {recurringModalOrder.site_address} ({recurringModalOrder.quantity} ל')
            </p>

            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>ימים בשבוע</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {RECURRING_DAY_LABELS.map((label, i) => (
                <label key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600,
                  background: recurringForm.days_of_week.includes(i) ? '#1e2d3d' : '#f8fafc',
                  color: recurringForm.days_of_week.includes(i) ? '#fff' : '#374151',
                  border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                }}>
                  <input type="checkbox" checked={recurringForm.days_of_week.includes(i)} onChange={() => toggleRecurringDay(i)} style={{ display: 'none' }} />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid-2" style={{ marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>תאריך התחלה</label>
                <input type="date" style={inputStyle} value={recurringForm.start_date}
                  onChange={e => setRecurringForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>תאריך סיום (אופציונלי)</label>
                <input type="date" style={inputStyle} value={recurringForm.end_date}
                  onChange={e => setRecurringForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>

            {recurringActionError && <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{recurringActionError}</p>}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveRecurringOrder}
                style={{ padding: '10px 24px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#1e2d3d', color: '#fff', border: 'none' }}>
                שמור כהזמנה קבועה
              </button>
              <button onClick={closeRecurringModal}
                style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      </>

    </div>
  );
}
