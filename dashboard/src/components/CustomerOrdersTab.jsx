import React, { useState, useEffect } from 'react';

const API = (window.location.port === '5173' || window.location.port === '5174') ? `http://${window.location.hostname}:8000` : '';

const Card = ({ children, style = {} }) => (
  <div style={{
    background: '#fff', borderRadius: 16, padding: 22,
    boxShadow: '0 2px 8px rgba(14,22,40,0.06), 0 1px 2px rgba(14,22,40,0.04)',
    border: '1px solid #f0f2f7', ...style,
  }}>{children}</div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, paddingRight: 8, borderRight: '3px solid #e5e7eb' }}>
    {children}
  </div>
);

const Btn = ({ children, onClick, variant = 'default', disabled, title, style: s = {} }) => {
  const variants = {
    primary:  { background: '#1e2d3d', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(30,45,61,0.25)' },
    blue:     { background: '#2563eb', color: '#fff', border: 'none', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' },
    ghost:    { background: '#f8fafc', color: '#374151', border: '1px solid #e9ecef' },
    danger:   { background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca' },
    success:  { background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' },
    cyan:     { background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd' },
    default:  { background: '#f3f4f6', color: '#374151', border: 'none' },
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '7px 14px', borderRadius: 9, fontSize: 12, fontWeight: 700,
      cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap',
      opacity: disabled ? 0.6 : 1, transition: 'all 0.15s', ...variants[variant], ...s,
    }}>
      {children}
    </button>
  );
};

const inputStyle = {
  padding: '9px 12px', borderRadius: 9, border: '1px solid #e5e7eb',
  fontSize: 13, background: '#fff', color: '#1e2d3d', outline: 'none', width: '100%',
  transition: 'border-color 0.15s, box-shadow 0.15s',
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

const EMPTY_WINTER = {
  ...EMPTY,
  agent_name: '',
  customer_type: 'חורף',
  id_number: '',
  email: '',
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

  const [showWinterForm,   setShowWinterForm]   = useState(false);
  const [winterForm,       setWinterForm]       = useState(EMPTY_WINTER);
  const [winterError,      setWinterError]      = useState('');
  const [winterSuccessMsg, setWinterSuccessMsg] = useState('');
  const [winterAgents,     setWinterAgents]     = useState([]);
  const [customerListTab,  setCustomerListTab]  = useState('regular'); // 'regular' | 'winter'
  const [paymentEditId,    setPaymentEditId]    = useState(null);
  const [paymentForm,      setPaymentForm]      = useState({});

  const safeJson = r => r.ok ? r.json() : [];
  const load = () =>
    Promise.all([
      fetch(`${API}/api/customers`).then(safeJson),
      fetch(`${API}/api/orders`).then(safeJson),
      fetch(`${API}/api/drivers`).then(safeJson),
      fetch(`${API}/api/recurring-orders`).then(safeJson),
    ]).then(([c, o, d, r]) => {
      setCustomers(Array.isArray(c) ? c : []);
      setOrders(Array.isArray(o) ? o : []);
      setDrivers(Array.isArray(d) ? d : []);
      setRecurring(Array.isArray(r) ? r : []);
      setLoading(false);
    }).catch(() => setLoading(false));

  useEffect(() => {
    load();
    fetch(`${API}/api/winter-agents`).then(r => r.ok ? r.json() : [])
      .then(a => setWinterAgents(Array.isArray(a) ? a : [])).catch(() => {});
  }, []);

  const loadSites = (cid) =>
    fetch(`${API}/api/customers/${cid}/sites`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setSites(Array.isArray(data) ? data : []))
      .catch(() => setSites([]));

  useEffect(() => {
    if (selectedId) { loadSites(selectedId); setShowSiteForm(false); setSiteForm({ name: '', city: '', address: '' }); setSiteError(''); }
    else setSites([]);
    setShowOrderForm(false);
    setOrderForm(EMPTY_ORDER);
    setOrderError('');
  }, [selectedId]);

  const regularCustomers = customers.filter(c => c.customer_type !== 'חורף');
  const winterCustomers  = customers.filter(c => c.customer_type === 'חורף');

  const filteredCustomers = (customerListTab === 'winter' ? winterCustomers : regularCustomers).filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.area || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.agent_name || '').toLowerCase().includes(search.toLowerCase())
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

  const handleAddWinter = async () => {
    if (!winterForm.name.trim())  return setWinterError('נא להזין שם לקוח');
    if (!winterForm.phone.trim()) return setWinterError('נא להזין מספר טלפון');
    try {
      const res = await fetch(`${API}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...winterForm, customer_type: 'חורף' }),
      });
      if (!res.ok) throw new Error();
      const addedName = winterForm.name.trim();
      if (onChange) {
        onChange(prev => {
          const base = prev || {};
          const clients = Array.isArray(base.clients) ? base.clients : [];
          const already = clients.some(c => c.name === addedName);
          return {
            ...base,
            clients: already ? clients : [...clients, { name: addedName, liters: 0, dailyLiters: 0, profit: 0 }],
          };
        });
      }
      await load();
      setWinterForm(EMPTY_WINTER);
      setWinterError('');
      setShowWinterForm(false);
      setWinterSuccessMsg(`הלקוח "${addedName}" נוסף כלקוח מזדמן (חורף) ✓`);
      setTimeout(() => setWinterSuccessMsg(''), 5000);
    } catch {
      setWinterError('שגיאה בהוספת לקוח');
    }
  };

  const VAT = 0.18;

  const openPaymentEdit = (order) => {
    setPaymentEditId(order.id);
    setPaymentForm({
      price_per_liter:  order.price_per_liter  || '',
      price_before_vat: order.price_before_vat || '',
      payment_status:   order.payment_status   || 'לא שולם',
      payment_method:   order.payment_method   || '',
      payment_date:     order.payment_date     || '',
      payment_notes:    order.payment_notes    || '',
    });
  };

  const savePayment = async (orderId) => {
    try {
      const order = orders.find(o => o.id === orderId);
      const litersForSave = parseFloat(order?.actual_quantity || order?.quantity) || 0;
      const pplForSave = parseFloat(paymentForm.price_per_liter) || 0;
      const priceToSave = pplForSave > 0 ? litersForSave * pplForSave : (parseFloat(paymentForm.price_before_vat) || 0);
      const payload = { ...paymentForm, price_before_vat: priceToSave };
      const res = await fetch(`${API}/api/orders/${orderId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updated } : o));
      setPaymentEditId(null);
    } catch { alert('שגיאה בשמירת תשלום'); }
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
      await fetch(`${API}/api/recurring-orders/materialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_date: todayISO() }),
      });
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

  const initials = (name = '') => name.trim().slice(0, 2) || '?';
  const avatarColor = (name = '') => {
    const colors = ['#1e2d3d','#2563eb','#7c3aed','#0891b2','#16a34a','#ca8a04','#dc2626','#0f766e'];
    let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return colors[Math.abs(h) % colors.length];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ─── Page Header ──────────────────────────────────── */}
      <div style={{
        background: '#fff', borderRadius: 16, padding: '18px 24px',
        boxShadow: '0 2px 8px rgba(14,22,40,0.06)', border: '1px solid #f0f2f7',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14,
      }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: '#1e2d3d', margin: 0, letterSpacing: -0.3 }}>👥 לקוחות והזמנות</h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 3, margin: 0 }}>
            {regularCustomers.length} לקוחות קבועים · {winterCustomers.length} לקוחות מזדמנים · {orders.length} הזמנות
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Btn variant="primary" onClick={() => { setShowForm(v => !v); setShowWinterForm(false); setError(''); }}
            style={{ padding: '9px 18px', fontSize: 13, borderRadius: 10 }}>
            {showForm ? '✕ ביטול' : '+ לקוח קבוע חדש'}
          </Btn>
          <Btn variant="blue" onClick={() => { setShowWinterForm(v => !v); setShowForm(false); setWinterError(''); }}
            style={{ padding: '9px 18px', fontSize: 13, borderRadius: 10 }}>
            {showWinterForm ? '✕ ביטול' : '❄️ לקוח מזדמן חדש'}
          </Btn>
        </div>
      </div>

      <>

      {/* טופס לקוח מזדמן חורף */}
      {showWinterForm && (
        <div style={{
          marginTop: 14, background: '#fff', borderRadius: 14, padding: 24,
          border: '2px solid #bfdbfe', boxShadow: '0 2px 12px rgba(37,99,235,0.09)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1e40af', marginBottom: 16 }}>
            ❄️ הוספת לקוח מזדמן (חורף)
          </h3>

          {/* שדה סוכן */}
          <div style={{ marginBottom: 18, background: '#eff6ff', borderRadius: 10, padding: '14px 16px', border: '1px solid #bfdbfe' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', letterSpacing: 0.5, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>
              👤 סוכן מכירות
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={winterForm.agent_name}
                onChange={e => setWinterForm(f => ({ ...f, agent_name: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}>
                <option value="">— ללא סוכן —</option>
                {winterAgents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                <option value="__custom__">✏️ הזן ידנית...</option>
              </select>
              {winterForm.agent_name === '__custom__' && (
                <input style={{ ...inputStyle, flex: 1 }} placeholder="שם הסוכן"
                  onChange={e => setWinterForm(f => ({ ...f, agent_name: e.target.value === '__custom__' ? '' : e.target.value }))} />
              )}
            </div>
            {winterAgents.length === 0 && (
              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6, marginBottom: 0 }}>
                להוספת סוכנים: <a href="#" style={{ color: '#2563eb' }}
                  onClick={async e => {
                    e.preventDefault();
                    const name = window.prompt('שם הסוכן החדש:');
                    if (!name?.trim()) return;
                    await fetch(`${API}/api/winter-agents`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: name.trim() }),
                    });
                    fetch(`${API}/api/winter-agents`).then(r => r.json())
                      .then(a => setWinterAgents(Array.isArray(a) ? a : []));
                  }}>הוסף סוכן</a>
              </p>
            )}
          </div>

          {/* פרטי לקוח */}
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.8, marginBottom: 10, textTransform: 'uppercase' }}>פרטי לקוח</p>
          <div className="grid-3-form" style={{ marginBottom: 16 }}>
            {[
              { key: 'name',          label: 'שם לקוח *',          placeholder: 'שם הלקוח',          type: 'text' },
              { key: 'id_number',     label: 'ת.ז / ח.פ',          placeholder: '000000000',          type: 'text' },
              { key: 'phone',         label: 'טלפון *',             placeholder: '05X-XXXXXXX',       type: 'text' },
              { key: 'email',         label: 'מייל',                placeholder: 'name@example.com',  type: 'email' },
              { key: 'site_address',  label: 'כתובת',               placeholder: 'רחוב, מספר, עיר',  type: 'text' },
              { key: 'area',          label: 'אזור',                placeholder: 'ירושלים / מודיעין', type: 'text' },
              { key: 'contact_name',  label: 'איש קשר',             placeholder: 'שם מלא',            type: 'text' },
              { key: 'contact_phone', label: 'טלפון איש קשר',      placeholder: '05X-XXXXXXX',       type: 'text' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{label}</label>
                <input type={type} style={inputStyle} value={winterForm[key] || ''} placeholder={placeholder}
                  onChange={e => setWinterForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>

          {winterError && <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{winterError}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleAddWinter}
              style={{ padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#2563eb', color: '#fff', border: 'none' }}>
              שמור לקוח חורף
            </button>
            <button onClick={() => { setShowWinterForm(false); setWinterError(''); }}
              style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {winterSuccessMsg && (
        <div style={{ padding: '12px 18px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8' }}>{winterSuccessMsg}</span>
        </div>
      )}

      {/* טופס לקוח קבוע */}
      <div>
        <button style={{ display: 'none' }} />

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
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1e2d3d', marginBottom: 16 }}>הוספת לקוח קבוע חדש</h3>

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
          {/* טאבים: קבועים / מזדמנים */}
          <div style={{ padding: '12px 14px 0', background: '#f8fafc', borderBottom: '1px solid #f0f2f7' }}>
            <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
              {[
                { id: 'regular', label: 'קבועים', count: regularCustomers.length },
                { id: 'winter',  label: '❄️ מזדמנים', count: winterCustomers.length },
              ].map(t => {
                const active = customerListTab === t.id;
                return (
                  <button key={t.id}
                    onClick={() => { setCustomerListTab(t.id); setSelectedId(null); setSearch(''); }}
                    style={{
                      flex: 1, padding: '7px 6px', border: 'none', cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: active ? 800 : 600,
                      borderRadius: '8px 8px 0 0',
                      background: active ? '#fff' : 'transparent',
                      color: active ? (t.id === 'winter' ? '#1d4ed8' : '#1e2d3d') : '#9ca3af',
                      boxShadow: active ? '0 -1px 4px rgba(0,0,0,0.05), inset 0 -2px 0 ' + (t.id === 'winter' ? '#2563eb' : '#1e2d3d') : 'none',
                      transition: 'all 0.15s',
                    }}>
                    {t.label} <span style={{ fontSize: 10, background: active ? (t.id === 'winter' ? '#eff6ff' : '#f3f4f6') : 'transparent', borderRadius: 20, padding: '1px 5px', color: active ? (t.id === 'winter' ? '#2563eb' : '#6b7280') : '#c4c9d4' }}>{t.count}</span>
                  </button>
                );
              })}
            </div>
            <input
              style={{ ...inputStyle, border: '1px solid #e9ecef', fontSize: 12, padding: '7px 10px', marginBottom: 10 }}
              placeholder={customerListTab === 'winter' ? '🔍 חיפוש שם / סוכן...' : '🔍 חיפוש לקוח...'}
              value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="customer-list" style={{ maxHeight: 500, overflowY: 'auto' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ padding: 24, color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
                {customerListTab === 'winter' ? '❄️ אין לקוחות מזדמנים עדיין' : 'לא נמצאו לקוחות'}
              </div>
            ) : filteredCustomers.map(c => {
              const count        = orders.filter(o => o.customer_id === c.id).length;
              const isSelected   = selectedId === c.id;
              const isSending    = sendingMsgId === c.id;
              const isSent       = sentMsgId === c.id;
              const bg           = avatarColor(c.name);
              const unpaidOrders = customerListTab === 'winter'
                ? orders.filter(o => o.customer_id === c.id && o.status === 'הושלם' && (!o.payment_status || o.payment_status === 'לא שולם' || o.payment_status === 'חלקי'))
                : [];
              const hasDebt = unpaidOrders.length > 0;
              return (
                <div key={c.id} onClick={() => setSelectedId(isSelected ? null : c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: isSelected ? (customerListTab === 'winter' ? '#1a3a6b' : '#1e2d3d') : hasDebt ? '#fffbeb' : 'transparent',
                  borderBottom: '1px solid #f3f4f6',
                  borderRight: hasDebt && !isSelected ? '3px solid #f59e0b' : '3px solid transparent',
                  cursor: 'pointer', transition: 'background 0.12s',
                }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = hasDebt ? '#fef3c7' : '#f5f7fb'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = hasDebt ? '#fffbeb' : 'transparent'; }}>
                  {/* אווטאר */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, background: isSelected ? 'rgba(255,255,255,0.18)' : bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: -0.5,
                    }}>
                      {initials(c.name)}
                    </div>
                    {hasDebt && !isSelected && (
                      <div style={{
                        position: 'absolute', top: -4, left: -4,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#f59e0b', border: '2px solid #fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#fff', fontWeight: 900, lineHeight: 1,
                      }}>
                        {unpaidOrders.length}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: isSelected ? '#fff' : '#1e2d3d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                      {hasDebt && !isSelected && (
                        <span style={{ fontSize: 10, fontWeight: 800, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          💳 חשבון פתוח
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: isSelected ? 'rgba(200,215,235,0.8)' : '#9ca3af', marginTop: 1 }}>
                      {c.area ? `${c.area} · ` : ''}
                      {customerListTab === 'winter' && c.agent_name ? `${c.agent_name} · ` : ''}
                      {count > 0 ? `${count} הזמנות` : 'אין הזמנות'}
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); sendOrderMessage(c); }}
                    disabled={isSending || isSent}
                    title="שלח הודעת הזמנה"
                    style={{
                      flexShrink: 0, padding: '4px 8px', borderRadius: 7, fontSize: 13,
                      cursor: isSending || isSent ? 'default' : 'pointer', border: 'none', lineHeight: 1,
                      background: isSent ? 'rgba(34,197,94,0.2)' : isSelected ? 'rgba(255,255,255,0.15)' : '#f0f9ff',
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
          <Card style={{ textAlign: 'center', padding: '64px 32px', border: '2px dashed #e9ecef', background: '#fafbfc', boxShadow: 'none' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.4 }}>👥</div>
            <p style={{ color: '#9ca3af', fontSize: 15, fontWeight: 600 }}>בחר לקוח מהרשימה</p>
            <p style={{ color: '#d1d5db', fontSize: 13, marginTop: 6 }}>לצפייה בפרטים, הזמנות ואתרי אספקה</p>
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
                    { key: 'id_number',           label: 'ת.ז / ח.פ',             placeholder: '000000000' },
                    { key: 'phone',               label: 'טלפון',                  placeholder: '05X-XXXXXXX' },
                    { key: 'email',               label: 'מייל',                   placeholder: 'example@mail.com' },
                    { key: 'contact_name',        label: 'איש קשר',               placeholder: 'שם מלא' },
                    { key: 'contact_phone',       label: 'טלפון איש קשר',         placeholder: '05X-XXXXXXX' },
                    { key: 'site_address',        label: 'כתובת',                  placeholder: 'כתובת מלאה' },
                    { key: 'area',                label: 'אזור',                   placeholder: 'ירושלים / מודיעין' },
                    { key: 'agent_name',          label: 'סוכן מכירות',           placeholder: 'שם הסוכן' },
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
              <Card style={{ padding: 0, overflow: 'hidden' }}>
                {/* ─ כותרת לקוח ─ */}
                <div style={{ padding: '18px 22px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    {/* אווטאר גדול */}
                    <div style={{
                      width: 50, height: 50, borderRadius: 14, flexShrink: 0,
                      background: avatarColor(selectedCustomer.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.5,
                    }}>
                      {initials(selectedCustomer.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e2d3d', margin: 0 }}>{selectedCustomer.name}</h2>
                        {selectedCustomer.customer_type === 'חורף' && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 20, padding: '2px 10px' }}>
                            ❄️ {selectedCustomer.agent_name ? `סוכן: ${selectedCustomer.agent_name}` : 'מזדמן'}
                          </span>
                        )}
                      </div>
                      {/* פרטי קשר בשורה */}
                      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
                        {selectedCustomer.phone         && <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>📞 {selectedCustomer.phone}</span>}
                        {selectedCustomer.area          && <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>📍 {selectedCustomer.area}</span>}
                        {selectedCustomer.site_address  && <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>🏠 {selectedCustomer.site_address}</span>}
                        {selectedCustomer.email         && <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>✉️ {selectedCustomer.email}</span>}
                        {selectedCustomer.id_number     && <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>🪪 {selectedCustomer.id_number}</span>}
                        {selectedCustomer.contact_name  && <span style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3 }}>👤 {selectedCustomer.contact_name}{selectedCustomer.contact_phone ? ` · ${selectedCustomer.contact_phone}` : ''}</span>}
                        {selectedCustomer.order_contact_name && (
                          <span style={{ fontSize: 12, color: '#0891b2', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                            🚚 {selectedCustomer.order_contact_name}{selectedCustomer.order_contact_phone ? ` · ${selectedCustomer.order_contact_phone}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* מונים */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <div style={{ background: '#f8fafc', border: '1px solid #e9ecef', borderRadius: 12, padding: '10px 18px', textAlign: 'center', minWidth: 64 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#1e2d3d', lineHeight: 1 }}>{customerOrders.length}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, fontWeight: 600 }}>הזמנות</div>
                      </div>
                      <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 18px', textAlign: 'center', minWidth: 64 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{completedOrders}</div>
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3, fontWeight: 600 }}>הושלמו</div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* ─ שורת פעולות ─ */}
                <div style={{ padding: '12px 22px', background: '#fafbfc', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {/* מחיר מכירה */}
                  {salePriceEdit?.name === selectedCustomer.name ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 9, padding: '6px 12px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#0891b2' }}>₪/ל׳</span>
                      <input type="number" step="0.001" min="0" value={salePriceEdit.value}
                        onChange={e => setSalePriceEdit(p => ({ ...p, value: e.target.value }))}
                        style={{ width: 80, padding: '4px 7px', borderRadius: 6, border: '1px solid #bae6fd', fontSize: 13, fontWeight: 700, color: '#0891b2', outline: 'none' }} autoFocus />
                      <button onClick={saveSalePrice} style={{ background: salePriceSaved ? '#16a34a' : '#0891b2', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        {salePriceSaved ? '✓' : 'שמור'}
                      </button>
                      <button onClick={() => setSalePriceEdit(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 15, lineHeight: 1 }}>✕</button>
                    </div>
                  ) : (
                    <Btn variant="cyan" onClick={() => openSalePrice(selectedCustomer.name)}>
                      💲 {(workPlanData?.clients || []).find(c => c.name === selectedCustomer.name)?.salePrice
                        ? `₪${(workPlanData.clients.find(c => c.name === selectedCustomer.name).salePrice).toFixed(3)}`
                        : 'מחיר מכירה'}
                    </Btn>
                  )}
                  <Btn variant={selectedCustomer.whatsapp_enabled ? 'success' : 'ghost'} onClick={() => toggleWhatsapp(selectedCustomer)}
                    title={selectedCustomer.whatsapp_enabled ? 'כבה וואטסאפ' : 'הפעל וואטסאפ'}>
                    💬 {selectedCustomer.whatsapp_enabled ? 'וואטסאפ פעיל' : 'וואטסאפ כבוי'}
                  </Btn>
                  <Btn variant="ghost"
                    onClick={() => sendOrderMessage(selectedCustomer)}
                    disabled={sendingMsgId === selectedCustomer.id || sentMsgId === selectedCustomer.id}
                    style={{ background: sentMsgId === selectedCustomer.id ? '#f0fdf4' : '#fefce8', color: sentMsgId === selectedCustomer.id ? '#16a34a' : '#ca8a04', border: '1px solid ' + (sentMsgId === selectedCustomer.id ? '#bbf7d0' : '#fde68a') }}>
                    {sentMsgId === selectedCustomer.id ? '✓ נשלח!' : sendingMsgId === selectedCustomer.id ? '⏳...' : '📨 שלח הזמנה'}
                  </Btn>
                  <Btn variant="cyan" onClick={() => startEdit(selectedCustomer)}>✎ עריכה</Btn>
                  {deleteConfirmId === selectedCustomer.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8, padding: '5px 10px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>למחוק?</span>
                      <button onClick={() => handleDeleteCustomer(selectedCustomer.id)} style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#dc2626', color: '#fff', border: 'none' }}>מחק</button>
                      <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>ביטול</button>
                    </div>
                  ) : (
                    <Btn variant="danger" onClick={() => setDeleteConfirmId(selectedCustomer.id)}>🗑 מחיקה</Btn>
                  )}
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
                        const isWinterCustomer = selectedCustomer?.customer_type === 'חורף';
                        const isPaymentOpen = paymentEditId === o.id;
                        const pf = isPaymentOpen ? paymentForm : {};
                        const liters = parseFloat(o.actual_quantity || o.quantity) || 0;
                        const pricePerLiter = parseFloat(pf.price_per_liter) || 0;
                        const priceNum = pricePerLiter > 0
                          ? liters * pricePerLiter
                          : (parseFloat(pf.price_before_vat) || 0);
                        const vatAmt = priceNum * VAT;
                        const totalAmt = priceNum * (1 + VAT);
                        return (
                          <React.Fragment key={o.id}>
                          <tr style={{ borderBottom: isPaymentOpen ? 'none' : '1px solid #f3f4f6' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}>
                            <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 11 }}>{o.id}</td>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(o.order_date)}</td>
                            <td style={{ padding: '10px 14px', color: '#374151', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.site_address || '—'}</td>
                            <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 600 }}>{o.contact_name || '—'}</div>
                              {o.contact_phone && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{o.contact_phone}</div>}
                            </td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 700, color: '#1e2d3d' }}>{o.quantity} ל'</div>
                              {o.actual_quantity && (
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', marginTop: 2 }}>
                                  ✓ בפועל: {o.actual_quantity} ל'
                                </div>
                              )}
                            </td>
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
                                {isWinterCustomer && (
                                  <button
                                    onClick={() => isPaymentOpen ? setPaymentEditId(null) : openPaymentEdit(o)}
                                    title="מעקב תשלום"
                                    style={{
                                      padding: '4px 8px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                                      background: isPaymentOpen ? '#fef3c7' : (o.payment_status === 'שולם' ? '#dcfce7' : '#fdf4ff'),
                                      color: isPaymentOpen ? '#92400e' : (o.payment_status === 'שולם' ? '#166534' : '#7c3aed'),
                                      border: `1px solid ${isPaymentOpen ? '#fde68a' : (o.payment_status === 'שולם' ? '#bbf7d0' : '#e9d5ff')}`,
                                    }}>
                                    💳
                                  </button>
                                )}
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
                          {isPaymentOpen && (
                            <tr style={{ borderBottom: '1px solid #f3f4f6', background: '#fefce8' }}>
                              <td colSpan={9} style={{ padding: '14px 20px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', direction: 'rtl' }}>
                                  {/* ליטרים */}
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>ליטרים</div>
                                    <div style={{ width: 80, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, fontWeight: 700, background: '#f9fafb', color: '#374151', textAlign: 'right' }}>
                                      {o.actual_quantity || o.quantity} ל'
                                    </div>
                                  </div>
                                  {/* מחיר לליטר */}
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>מחיר לליטר (₪)</div>
                                    <input
                                      type="number" min="0" step="0.001"
                                      value={pf.price_per_liter ?? ''}
                                      onChange={e => setPaymentForm(p => ({ ...p, price_per_liter: e.target.value, price_before_vat: (parseFloat(e.target.value) || 0) * liters || '' }))}
                                      style={{ width: 100, padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, fontWeight: 600, textAlign: 'right' }}
                                    />
                                  </div>
                                  {/* סיכום מחירים */}
                                  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#6b7280', minWidth: 160 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                      <span>לפני מע"מ:</span>
                                      <strong>₪{priceNum.toFixed(2)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3 }}>
                                      <span>מע"מ 18%:</span>
                                      <strong>₪{vatAmt.toFixed(2)}</strong>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 5, borderTop: '1px solid #e5e7eb', paddingTop: 5, color: '#1e2d3d', fontWeight: 800, fontSize: 13 }}>
                                      <span>סה"כ:</span>
                                      <span>₪{totalAmt.toFixed(2)}</span>
                                    </div>
                                  </div>
                                  {/* סטטוס תשלום */}
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>סטטוס תשלום</div>
                                    <select
                                      value={pf.payment_status ?? 'לא שולם'}
                                      onChange={e => setPaymentForm(p => ({ ...p, payment_status: e.target.value }))}
                                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                                      {['לא שולם', 'שולם', 'חלקי'].map(s => <option key={s}>{s}</option>)}
                                    </select>
                                  </div>
                                  {/* אמצעי תשלום — תמיד גלוי */}
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>אמצעי תשלום</div>
                                    <select
                                      value={pf.payment_method ?? ''}
                                      onChange={e => setPaymentForm(p => ({ ...p, payment_method: e.target.value }))}
                                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}>
                                      <option value="">בחר...</option>
                                      {['מזומן', 'העברה', "צ'ק", 'אשראי'].map(m => <option key={m}>{m}</option>)}
                                    </select>
                                  </div>
                                  {/* תאריך תשלום */}
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>תאריך תשלום</div>
                                    <input
                                      type="date"
                                      value={pf.payment_date ?? ''}
                                      onChange={e => setPaymentForm(p => ({ ...p, payment_date: e.target.value }))}
                                      style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                                    />
                                  </div>
                                  {/* הערות */}
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>הערות</div>
                                    <input
                                      type="text"
                                      value={pf.payment_notes ?? ''}
                                      onChange={e => setPaymentForm(p => ({ ...p, payment_notes: e.target.value }))}
                                      placeholder="הערות תשלום..."
                                      style={{ width: 160, padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13 }}
                                    />
                                  </div>
                                  <div style={{ display: 'flex', gap: 8, paddingBottom: 2 }}>
                                    <button onClick={() => savePayment(o.id)}
                                      style={{ padding: '7px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#1e2d3d', color: '#fff', border: 'none' }}>
                                      שמור
                                    </button>
                                    <button onClick={() => setPaymentEditId(null)}
                                      style={{ padding: '7px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>
                                      ביטול
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
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
