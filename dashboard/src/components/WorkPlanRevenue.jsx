import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList,
  ComposedChart, Area, Line, ReferenceLine,
} from 'recharts';
import { DEFAULT_WORKPLAN, DEFAULT_CLIENTS } from '../defaultWorkPlan';
import MonthSelector from './MonthSelector';

const fmt  = n => '₪' + Number(n).toLocaleString('he-IL');
const fmtL = n => Number(n).toLocaleString('he-IL') + ' ל׳';

const COLORS = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#f97316'];

/* ── Shared UI ──────────────────────────────────────────────── */
const Card = ({ children, style = {} }) => (
  <div className="card card-pad" style={style}>{children}</div>
);

const SectionTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <p className="section-title" style={{ marginBottom: sub ? 3 : 0 }}>{children}</p>
    {sub && <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{sub}</p>}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-md)',
      padding: '8px 14px',
      boxShadow: 'var(--shadow-md)',
      fontSize: 12,
      direction: 'rtl',
    }}>
      <p style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color, fontWeight: 600 }}>
          {p.name}: {p.name === 'ליטרים' || p.name === 'משוערך' || p.name === 'בפועל' ? fmtL(p.value) : fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

const pctLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={800}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CenterLabel = ({ viewBox, value, label }) => {
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 6}  textAnchor="middle" fill="var(--text-1)" fontSize={14} fontWeight={800}>{value}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="var(--text-3)" fontSize={10}>{label}</text>
    </g>
  );
};

const DEFAULT_ADDITIVE_TYPES = ['אוריאה', 'הידראולי 68', 'הידראולי 46', 'מנוע 15W40', 'אוריאה משטח (100 י"ח)', 'הובלת מיכל סולר'];
const EMPTY = { name: '', liters: '', liters2: '', actualLiters: '', actualLiters2: '', profit: '', purchasePrice: '', salePrice: '', salePrice2: '', additives: [] };

/* ── Business logic helpers ─────────────────────────────────── */
const clientProfit = c => {
  if (c.salePrice > 0 && c.purchasePrice > 0 && c.liters > 0)
    return c.liters * (c.salePrice - c.purchasePrice);
  if (c.salePrice > 0 && c.liters > 0) return c.liters * c.salePrice;
  return c.profit;
};

const parseQty = q => {
  if (!q) return 0;
  const n = parseFloat(String(q).replace(/,/g, '').split(/[–\-]/)[0]);
  return isNaN(n) ? 0 : n;
};

export default function WorkPlanRevenue({ data: externalData, onChange, monthId, monthLabel, allMonths = [], onMonthSwitch, onNewMonth }) {
  const isMobile = window.innerWidth < 768;
  const clients            = externalData?.clients || DEFAULT_CLIENTS;
  const additiveTypes      = externalData?.additiveTypes || {};
  const [showForm,          setShowForm]          = useState(false);
  const [showAdditiveForm,  setShowAdditiveForm]  = useState(false);
  const [additiveName,      setAdditiveName]      = useState('');
  const [additiveQtys,      setAdditiveQtys]      = useState({});
  const [additiveError,     setAdditiveError]     = useState('');
  const [actualLitersMap,   setActualLitersMap]   = useState({});
  const [editingAddPrices,  setEditingAddPrices]  = useState(false);
  const [draftPrices,       setDraftPrices]       = useState({});
  const [form,              setForm]              = useState(EMPTY);
  const [error,             setError]             = useState('');
  const [editing,          setEditing]          = useState(null);
  const [editingFuelCard,  setEditingFuelCard]  = useState(false);
  const [fuelCardDraft,    setFuelCardDraft]    = useState({ diesel: {}, benzin: {}, tanDiesel: {}, tanBenzin: {}, transport: {}, generator: {} });
  const [bulkPriceInput,   setBulkPriceInput]   = useState('');
  const [bulkPriceOpen,    setBulkPriceOpen]    = useState(false);

  const CARD_TYPES = ['סולר', 'בנזין', 'סולר טן', 'בנזין טן'];
  const fuelCardCustomers = externalData?.fuelCardCustomers || [];
  const [fcForm, setFcForm] = useState({ name: '', type: 'סולר', liters: '', purchasePrice: '', salePrice: '' });
  const [fcEditing, setFcEditing] = useState(null);
  const [fcDraft, setFcDraft] = useState({});
  const [showFcForm, setShowFcForm] = useState(false);
  const [fcNameInput, setFcNameInput] = useState('');
  const [fcShowSuggestions, setFcShowSuggestions] = useState(false);

  // רשימת לקוחות קיימים לאוטוקמפליט
  const existingClientNames = clients.map(c => c.name).filter(Boolean);

  const fcProfit = row => {
    const l = +row.liters || 0, buy = +row.purchasePrice || 0, sell = +row.salePrice || 0;
    return l > 0 && sell > 0 ? Math.round(l * (sell - buy)) : 0;
  };

  const saveFcRow = () => {
    const name = fcForm.name.trim() || fcNameInput.trim();
    if (!name || !fcForm.liters) return;
    const entry = { id: Date.now().toString(), name, type: fcForm.type, liters: +fcForm.liters, purchasePrice: +fcForm.purchasePrice || 0, salePrice: +fcForm.salePrice || 0 };
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      return { ...base, fuelCardCustomers: [...(base.fuelCardCustomers || []), entry] };
    });
    setFcForm({ name: '', type: 'סולר', liters: '', purchasePrice: '', salePrice: '' });
    setFcNameInput('');
    setShowFcForm(false);
    // הרשימה תיפתח אוטומטית — הגלול אליה
    setTimeout(() => {
      document.getElementById('fc-table')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const saveFcEdit = idx => {
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      const list = [...(base.fuelCardCustomers || [])];
      list[idx] = { ...list[idx], ...fcDraft, liters: +fcDraft.liters || 0, purchasePrice: +fcDraft.purchasePrice || 0, salePrice: +fcDraft.salePrice || 0 };
      return { ...base, fuelCardCustomers: list };
    });
    setFcEditing(null);
  };

  const deleteFcRow = idx => {
    if (!window.confirm('למחוק שורה זו?')) return;
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      return { ...base, fuelCardCustomers: (base.fuelCardCustomers || []).filter((_, i) => i !== idx) };
    });
  };

  const fuelCardIdx        = clients.findIndex(c => c.name === 'הכנסות כרטיסי תדלוק');
  const fuelCardClient     = fuelCardIdx >= 0 ? clients[fuelCardIdx] : null;
  const fuelCardBenzIdx    = clients.findIndex(c => c.name === 'הכנסות כרטיסי תדלוק בנזין');
  const fuelCardBenzClient = fuelCardBenzIdx >= 0 ? clients[fuelCardBenzIdx] : null;
  const fuelCardTanDIdx    = clients.findIndex(c => c.name === 'הכנסות כרטיסי תדלוק סולר טן');
  const fuelCardTanDClient = fuelCardTanDIdx >= 0 ? clients[fuelCardTanDIdx] : null;
  const fuelCardTanBIdx      = clients.findIndex(c => c.name === 'הכנסות כרטיסי תדלוק טן בנזין');
  const fuelCardTanBClient   = fuelCardTanBIdx >= 0 ? clients[fuelCardTanBIdx] : null;
  const fuelCardTransIdx     = clients.findIndex(c => c.name === 'הובלות סולר תחבורה');
  const fuelCardTransClient  = fuelCardTransIdx >= 0 ? clients[fuelCardTransIdx] : null;
  const fuelCardGenIdx       = clients.findIndex(c => c.name === 'נוזל גנרטורים');
  const fuelCardGenClient    = fuelCardGenIdx >= 0 ? clients[fuelCardGenIdx] : null;

  const openFuelCardEdit = () => {
    setFuelCardDraft({
      diesel: {
        quantity:      String(fuelCardClient?.liters        || ''),
        purchasePrice: String(fuelCardClient?.purchasePrice || ''),
        salePrice:     String(fuelCardClient?.salePrice     || ''),
      },
      benzin: {
        quantity:      String(fuelCardBenzClient?.liters        || ''),
        purchasePrice: String(fuelCardBenzClient?.purchasePrice || ''),
        salePrice:     String(fuelCardBenzClient?.salePrice     || ''),
      },
      tanDiesel: {
        quantity:      String(fuelCardTanDClient?.liters        || ''),
        purchasePrice: String(fuelCardTanDClient?.purchasePrice || ''),
        salePrice:     String(fuelCardTanDClient?.salePrice     || ''),
      },
      tanBenzin: {
        quantity:      String(fuelCardTanBClient?.liters        || ''),
        purchasePrice: String(fuelCardTanBClient?.purchasePrice || ''),
        salePrice:     String(fuelCardTanBClient?.salePrice     || ''),
      },
      transport: {
        quantity:      String(fuelCardTransClient?.liters        || ''),
        purchasePrice: String(fuelCardTransClient?.purchasePrice || ''),
        salePrice:     String(fuelCardTransClient?.salePrice     || ''),
      },
      generator: {
        quantity:      String(fuelCardGenClient?.liters        || ''),
        purchasePrice: String(fuelCardGenClient?.purchasePrice || ''),
        salePrice:     String(fuelCardGenClient?.salePrice     || ''),
      },
    });
    setEditingFuelCard(true);
  };

  const saveFuelCard = () => {
    const makeEntry = (name, draft, existing) => {
      const qty    = +draft.quantity      || 0;
      const buy    = +draft.purchasePrice || 0;
      const sell   = +draft.salePrice     || 0;
      const profit = qty > 0 && sell > 0 ? Math.round(qty * (sell - buy)) : (existing?.profit || 0);
      return { name, liters: qty, purchasePrice: buy > 0 ? buy : undefined, salePrice: sell > 0 ? sell : undefined, profit };
    };
    const dieselEntry    = makeEntry('הכנסות כרטיסי תדלוק',           fuelCardDraft.diesel,    fuelCardClient);
    const benzinEntry    = makeEntry('הכנסות כרטיסי תדלוק בנזין',     fuelCardDraft.benzin,    fuelCardBenzClient);
    const tanDieselEntry = makeEntry('הכנסות כרטיסי תדלוק סולר טן',   fuelCardDraft.tanDiesel, fuelCardTanDClient);
    const tanBenzinEntry = makeEntry('הכנסות כרטיסי תדלוק טן בנזין',  fuelCardDraft.tanBenzin, fuelCardTanBClient);
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      const list = [...(base.clients || [])];
      const upsert = (name, entry) => {
        const i = list.findIndex(c => c.name === name);
        if (i >= 0) list[i] = entry; else list.push(entry);
      };
      const transportEntry = makeEntry('הובלות סולר תחבורה', fuelCardDraft.transport, fuelCardTransClient);
      upsert('הכנסות כרטיסי תדלוק',          dieselEntry);
      upsert('הכנסות כרטיסי תדלוק בנזין',    benzinEntry);
      upsert('הכנסות כרטיסי תדלוק סולר טן',  tanDieselEntry);
      upsert('הכנסות כרטיסי תדלוק טן בנזין', tanBenzinEntry);
      upsert('הובלות סולר תחבורה',            transportEntry);
      const generatorEntry = makeEntry('נוזל גנרטורים', fuelCardDraft.generator, fuelCardGenClient);
      upsert('נוזל גנרטורים',                generatorEntry);
      return { ...base, clients: list };
    });
    setEditingFuelCard(false);
  };

  const openAdditiveEdit = () => {
    setDraftPrices(Object.fromEntries(DEFAULT_ADDITIVE_TYPES.map(n => [n, {
      purchasePrice: String(additiveTypes[n]?.purchasePrice ?? ''),
      salePrice:     String(additiveTypes[n]?.salePrice     ?? ''),
    }])));
    setEditingAddPrices(true);
  };

  const saveAllAdditivePrices = () => {
    onChange(prev => {
      const base  = prev || {};
      const types = { ...(base.additiveTypes || {}) };
      DEFAULT_ADDITIVE_TYPES.forEach(name => {
        const d = draftPrices[name] || {};
        types[name] = { purchasePrice: +d.purchasePrice || 0, salePrice: +d.salePrice || 0 };
      });
      return { ...base, additiveTypes: types };
    });
    setEditingAddPrices(false);
  };

  const additiveDefs = DEFAULT_ADDITIVE_TYPES.map(name => ({ name }));

  useEffect(() => {
    fetch('/api/orders')
      .then(r => r.json())
      .then(orders => {
        const map = {};
        orders.forEach(o => {
          if (!o.customer_name) return;
          map[o.customer_name] = (map[o.customer_name] || 0) + parseQty(o.quantity);
        });
        setActualLitersMap(map);
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => {
    const upd = { ...f, [k]: v };
    if (['salePrice', 'purchasePrice', 'liters'].includes(k) && +upd.salePrice > 0 && +upd.liters > 0) {
      const margin = +upd.purchasePrice > 0 ? (+upd.salePrice - +upd.purchasePrice) : +upd.salePrice;
      upd.profit = String(Math.round(margin * +upd.liters));
    }
    return upd;
  });

  const setEf = (k, v) => setEditing(ed => {
    const f = { ...ed.form, [k]: v };
    const liters = +f.liters;
    if (['salePrice', 'purchasePrice', 'liters'].includes(k) && +f.salePrice > 0 && liters > 0) {
      const margin = +f.purchasePrice > 0 ? (+f.salePrice - +f.purchasePrice) : +f.salePrice;
      f.profit = String(Math.round(margin * liters));
    }
    return { ...ed, form: f };
  });

  const handleSubmit = () => {
    if (!form.name.trim())                                     return setError('נא להזין שם לקוח');
    if (!form.liters || isNaN(+form.liters) || +form.liters <= 0) return setError('נא להזין כמות ליטרים');
    if (!form.profit || isNaN(+form.profit) || +form.profit <= 0) return setError('נא להזין רווח תקין');
    const entry = {
      name: form.name.trim(), liters: +form.liters, profit: +form.profit,
      purchasePrice: form.purchasePrice ? +form.purchasePrice : undefined,
      salePrice:     form.salePrice     ? +form.salePrice     : undefined,
    };
    onChange(prev => ({ ...(prev || DEFAULT_WORKPLAN), clients: [...((prev || DEFAULT_WORKPLAN).clients || DEFAULT_CLIENTS), entry] }));
    setForm(EMPTY); setError(''); setShowForm(false);
  };

  const handleAdditiveOnlySubmit = () => {
    if (!additiveName.trim()) return setAdditiveError('נא להזין שם לקוח');
    const additivesArr = DEFAULT_ADDITIVE_TYPES
      .filter(t => +additiveQtys[t] > 0)
      .map(t => ({ type: t, qty: +additiveQtys[t] }));
    if (!additivesArr.length) return setAdditiveError('נא להזין כמות לפחות לתוסף אחד');
    const totalProfit = additivesArr.reduce((s, a) => {
      const buy = additiveTypes[a.type]?.purchasePrice || 0;
      const sell = additiveTypes[a.type]?.salePrice || 0;
      return s + a.qty * (sell - buy);
    }, 0);
    const entry = { name: additiveName.trim(), liters: 0, profit: Math.round(totalProfit), additives: additivesArr };
    onChange(prev => ({ ...(prev || DEFAULT_WORKPLAN), clients: [...((prev || DEFAULT_WORKPLAN).clients || DEFAULT_CLIENTS), entry] }));
    setAdditiveName(''); setAdditiveQtys({}); setAdditiveError(''); setShowAdditiveForm(false);
  };

  const startEdit = (idx, client) => {
    const cp = clientProfit(client);
    const autoActual = actualLitersMap[client.name] || 0;
    setEditing({ idx, form: {
      name: client.name,
      liters:        String(client.liters),
      liters2:       client.liters2       != null ? String(client.liters2)       : '',
      actualLiters:  client.actualLiters  != null ? String(client.actualLiters)  : (autoActual > 0 ? String(autoActual) : ''),
      actualLiters2: client.actualLiters2 != null ? String(client.actualLiters2) : '',
      profit:        String(cp),
      purchasePrice: client.purchasePrice != null ? String(client.purchasePrice) : '',
      salePrice:     client.salePrice     != null ? String(client.salePrice)     : '',
      salePrice2:    client.salePrice2    != null ? String(client.salePrice2)    : '',
      additives:     Array.isArray(client.additives) ? client.additives : [],
    }});
    setShowForm(false);
  };

  const handleSaveEdit = () => {
    const { idx, form: ef } = editing;
    if (!ef.name.trim() || !ef.liters || isNaN(+ef.liters) || +ef.liters <= 0) return;
    const liters        = +ef.liters;
    const salePrice     = ef.salePrice     ? +ef.salePrice     : undefined;
    const purchasePrice = ef.purchasePrice ? +ef.purchasePrice : undefined;
    const savedProfit   = (salePrice > 0 && purchasePrice > 0)
      ? Math.round((salePrice - purchasePrice) * liters)
      : salePrice > 0 ? Math.round(salePrice * liters) : +ef.profit || 0;
    const updated = {
      name: ef.name.trim(), liters, profit: savedProfit, purchasePrice, salePrice,
      salePrice2:   ef.salePrice2   ? +ef.salePrice2   : undefined,
      liters2:      ef.liters2      ? +ef.liters2      : undefined,
      actualLiters:  ef.actualLiters  !== '' ? +ef.actualLiters  : undefined,
      actualLiters2: ef.actualLiters2 !== '' ? +ef.actualLiters2 : undefined,
      additives: ef.additives || [],
    };
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      const updated_clients = [...(base.clients || DEFAULT_CLIENTS)];
      updated_clients[idx] = updated;
      return { ...base, clients: updated_clients };
    });
    setEditing(null);
  };

  const handleDelete = idx => {
    if (!window.confirm('למחוק את הלקוח?')) return;
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      return { ...base, clients: (base.clients || DEFAULT_CLIENTS).filter((_, i) => i !== idx) };
    });
    if (editing) setEditing(null);
  };

  const effectiveLiters  = c => c.actualLiters  != null ? c.actualLiters  : (actualLitersMap[c.name] || 0) > 0 ? (actualLitersMap[c.name] || 0) : c.liters;
  const effectiveLiters2 = c => c.actualLiters2 != null ? c.actualLiters2 : (c.liters2 || 0);

  const grossProfit = c => {
    const buy = c.purchasePrice || 0, sell1 = c.salePrice || 0;
    if (sell1 > 0 && buy > 0) {
      const liters2 = effectiveLiters2(c), sell2 = c.salePrice2 || 0;
      return effectiveLiters(c) * (sell1 - buy) + (sell2 > 0 && liters2 > 0 ? liters2 * (sell2 - buy) : 0);
    }
    return c.profit;
  };

  const invoiceTotal = c => {
    const sell1 = c.salePrice || 0, sell2 = c.salePrice2 || 0;
    if (sell1 > 0) return effectiveLiters(c) * sell1 + (sell2 > 0 ? effectiveLiters2(c) * sell2 : 0);
    return c.profit || 0;
  };

  const fcRevenueTotal    = fuelCardCustomers.reduce((s, r) => s + (+r.liters || 0) * (+r.salePrice || 0), 0);
  const fcGrossTotal      = fuelCardCustomers.reduce((s, r) => s + fcProfit(r), 0);
  const addRevenueTotal   = clients.reduce((s, c) => s + (c.additives || []).reduce((cs, a) => cs + (a.qty || 0) * (additiveTypes[a.type]?.salePrice || 0), 0), 0);
  const addGrossTotal     = clients.reduce((s, c) => s + (c.additives || []).reduce((cs, a) => {
    const sell = additiveTypes[a.type]?.salePrice || 0;
    const buy  = additiveTypes[a.type]?.purchasePrice || 0;
    return cs + (a.qty || 0) * (sell - buy);
  }, 0), 0);

  const totalRev          = clients.reduce((s, c) => s + grossProfit(c), 0) + fcGrossTotal + addGrossTotal;
  const totalInvoice      = clients.reduce((s, c) => s + invoiceTotal(c), 0) + fcRevenueTotal + addRevenueTotal;
  const totalLiters       = clients.reduce((s, c) => s + c.liters, 0);
  const totalActualLiters = clients.reduce((s, c) => s + effectiveLiters(c), 0);

  const litersWithPrices  = clients.reduce((s, c) => (c.salePrice > 0 && c.purchasePrice > 0) ? s + effectiveLiters(c) : s, 0);
  const totalMargin       = clients.reduce((s, c) => (c.salePrice > 0 && c.purchasePrice > 0) ? s + (c.salePrice - c.purchasePrice) * effectiveLiters(c) : s, 0);
  const totalPurchaseCost = clients.reduce((s, c) => (c.purchasePrice > 0) ? s + c.purchasePrice * effectiveLiters(c) : s, 0);
  const litersWithPurchase= clients.reduce((s, c) => (c.purchasePrice > 0) ? s + effectiveLiters(c) : s, 0);
  const avgProfitPerLiter = litersWithPrices  > 0 ? totalMargin / litersWithPrices  : 0;
  const avgPurchasePrice  = litersWithPurchase > 0 ? totalPurchaseCost / litersWithPurchase : 0;

  const litersWithSale = clients.reduce((s, c) => {
    let l = 0;
    if (c.salePrice  > 0) l += effectiveLiters(c);
    if (c.salePrice2 > 0) l += effectiveLiters2(c);
    return s + l;
  }, 0);
  const avgSalePrice = litersWithSale > 0 ? totalInvoice / litersWithSale : 0;

  const profitPie = clients.map(c => ({ name: c.name, value: grossProfit(c) }));
  const litersPie = clients.map(c => ({ name: c.name, value: c.liters }));
  const sortedClients = [...clients].map((c, i) => ({ ...c, _profit: grossProfit(c), _idx: i })).sort((a, b) => b._profit - a._profit);

  const actionBtn = color => ({ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 14, padding: '2px 5px', borderRadius: 4, lineHeight: 1 });
  const editRowStyle = { background: '#fffbeb', borderBottom: '1px solid #fcd34d' };
  const tickK = v => `₪${(v / 1000).toFixed(0)}k`;

  const applyBulkPurchasePrice = () => {
    const price = parseFloat(bulkPriceInput);
    if (!price || price <= 0) return;
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      return { ...base, clients: (base.clients || []).map(c => ({ ...c, purchasePrice: price })) };
    });
    setBulkPriceOpen(false);
    setBulkPriceInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <MonthSelector monthId={monthId} allMonths={allMonths} onMonthSwitch={onMonthSwitch} onNewMonth={onNewMonth} />

      {/* Bulk purchase price */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>
          מחיר קניה סולר חודשי:
          {avgPurchasePrice > 0 && <span style={{ color: 'var(--red)', marginRight: 6 }}>₪{avgPurchasePrice.toFixed(3)}</span>}
        </span>
        {bulkPriceOpen ? (
          <>
            <input
              className="input" type="number" step="0.001" min="0"
              placeholder="₪/ל׳ לכולם..."
              value={bulkPriceInput}
              onChange={e => setBulkPriceInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyBulkPurchasePrice()}
              style={{ width: 130, fontSize: 13 }}
              autoFocus
            />
            <button className="btn btn-sm" style={{ background: 'var(--green)', color: '#fff', border: 'none' }}
              onClick={applyBulkPurchasePrice}>
              ✓ עדכן לכולם ({clients.length})
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setBulkPriceOpen(false); setBulkPriceInput(''); }}>ביטול</button>
          </>
        ) : (
          <button className="btn btn-sm" style={{ background: 'var(--red)', color: '#fff', border: 'none' }}
            onClick={() => setBulkPriceOpen(true)}>
            ✎ הגדר מחיר קניה לכולם
          </button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid-6">
        {[
          {
            label: 'סה"כ הכנסות', value: fmt(Math.round(totalInvoice)), sub: `${clients.length} לקוחות`,
            bg: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          },
          {
            label: 'סה"כ ליטרים', value: fmtL(totalActualLiters), sub: `משוערך: ${fmtL(totalLiters)}`,
            bg: 'linear-gradient(135deg, #475569 0%, #334155 100%)',
          },
          {
            label: 'ממוצע מחיר קניה', value: avgPurchasePrice > 0 ? `₪${avgPurchasePrice.toFixed(3)}` : '—', sub: 'ממוצע משוקלל לליטר',
            bg: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
          },
          {
            label: 'ממוצע מחיר מכירה', value: `₪${avgSalePrice.toFixed(3)}`, sub: 'מחיר מכירה ממוצע לליטר',
            bg: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
          },
          {
            label: 'ממוצע רווח לליטר', value: avgProfitPerLiter > 0 ? `₪${avgProfitPerLiter.toFixed(3)}` : '—', sub: 'מכירה פחות קניה',
            bg: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
          },
          {
            label: 'ממוצע ללקוח', value: fmt(Math.round(totalInvoice / (clients.length || 1))), sub: 'הכנסה ברוטו ממוצעת',
            bg: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
          },
        ].map((k, i) => (
          <div key={i} style={{
            background: k.bg,
            borderRadius: 'var(--r-lg)',
            padding: '18px 20px 16px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.3 }}>{k.label}</p>
            <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.5, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{k.value}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Row 1: profit bar + pie */}
      <div className="grid-3-2">
        <Card>
          <SectionTitle sub="ממוין מהגבוה לנמוך">רווח גולמי לפי לקוח</SectionTitle>
          <ResponsiveContainer width="100%" height={Math.max(200, sortedClients.length * 34)}>
            <BarChart data={sortedClients.map(c => ({ name: c.name, value: c._profit }))} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-3)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={tickK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={isMobile ? 130 : 280} orientation="right" tick={{ fontSize: isMobile ? 9 : 11, fill: 'var(--text-2)', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
              <Bar dataKey="value" name="רווח גולמי" radius={[0, 5, 5, 0]} maxBarSize={22}>
                {sortedClients.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                <LabelList dataKey="value" position="insideRight" style={{ fontSize: 10, fill: 'var(--text-3)', fontWeight: 700 }} formatter={v => v > 0 ? `${Math.round(v / 1000)}k` : ''} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle sub="העבר עכבר לצפייה">חלוקת רווח גולמי</SectionTitle>
          {profitPie.filter(p => p.value > 0).length === 0 ? (
            <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-3)' }}>
              <span style={{ fontSize: 28 }}>📊</span>
              <span style={{ fontSize: 12 }}>הזן מחיר קניה ומכירה</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={profitPie.filter(p => p.value > 0)} cx="50%" cy="48%" innerRadius={52} outerRadius={80}
                  dataKey="value" paddingAngle={3} labelLine={false} label={pctLabel}>
                  {profitPie.filter(p => p.value > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  <LabelList content={<CenterLabel value={fmt(totalRev)} label="סה״כ" />} />
                </Pie>
                <Tooltip formatter={(v, name) => [fmt(v), name]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, direction: 'rtl' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Row 2: liters bar + pie */}
      <div className="grid-3-2">
        <Card>
          <SectionTitle sub="בהיר = משוערך · כהה = בפועל">ליטרים לפי לקוח</SectionTitle>
          <ResponsiveContainer width="100%" height={Math.max(200, clients.length * 40)}>
            <BarChart
              data={clients.map(c => ({
                name:    c.name,
                משוערך: c.liters || 0,
                בפועל:  (c.actualLiters != null ? c.actualLiters : (actualLitersMap[c.name] || 0)) || undefined,
              }))}
              layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-3)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={isMobile ? 130 : 280} orientation="right" tick={{ fontSize: isMobile ? 9 : 11, fill: 'var(--text-2)', fontWeight: 600 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14,165,233,0.06)' }} />
              <Legend iconSize={9} formatter={v => <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>{v}</span>} />
              <Bar dataKey="משוערך" fill="#bae6fd" radius={[0, 3, 3, 0]} maxBarSize={10} />
              <Bar dataKey="בפועל"  fill="#0284c7" radius={[0, 3, 3, 0]} maxBarSize={10} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle sub="העבר עכבר לצפייה">חלוקת ליטרים</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={litersPie.filter(p => p.value > 0)} cx="50%" cy="48%" innerRadius={50} outerRadius={78}
                dataKey="value" paddingAngle={3} labelLine={false} label={pctLabel}>
                {litersPie.filter(p => p.value > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                <LabelList content={<CenterLabel value={fmtL(totalLiters)} label="סה״כ" />} />
              </Pie>
              <Tooltip formatter={(v, name) => [fmtL(v), name]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, direction: 'rtl' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Margin Analysis Charts */}
      {clients.some(c => c.salePrice > 0 && c.purchasePrice > 0) && (
        <div className="grid-3-2">
          <Card>
            <SectionTitle sub="קניה · מכירה · מרווח לליטר">ניתוח מרווח שיווקי לפי לקוח</SectionTitle>
            <ResponsiveContainer width="100%" height={Math.max(200, clients.filter(c => c.salePrice > 0).length * 44)}>
              <ComposedChart
                layout="vertical"
                data={clients
                  .filter(c => c.salePrice > 0 && c.purchasePrice > 0)
                  .map(c => ({
                    name:    c.name,
                    קניה:    +(c.purchasePrice || 0).toFixed(3),
                    מכירה:   +(c.salePrice     || 0).toFixed(3),
                    מרווח:   +((c.salePrice - c.purchasePrice) || 0).toFixed(3),
                  }))
                  .sort((a, b) => b.מרווח - a.מרווח)
                }
                margin={{ top: 4, right: 50, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-3)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={v => `₪${v.toFixed(2)}`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={260} orientation="right" tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v, name) => [`₪${Number(v).toFixed(3)}`, name]}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                />
                <Legend iconSize={9} formatter={v => <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>{v}</span>} />
                <Bar dataKey="קניה"  fill="#fca5a5" radius={[0, 2, 2, 0]} maxBarSize={10} />
                <Bar dataKey="מכירה" fill="#6ee7b7" radius={[0, 2, 2, 0]} maxBarSize={10} />
                <Line dataKey="מרווח" stroke="#2563eb" strokeWidth={2} dot={{ r: 3, fill: '#2563eb' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <SectionTitle sub="לפי לקוח">מרווח ₪ לליטר</SectionTitle>
            <ResponsiveContainer width="100%" height={Math.max(200, clients.filter(c => c.salePrice > 0 && c.purchasePrice > 0).length * 44)}>
              <BarChart
                layout="vertical"
                data={clients
                  .filter(c => c.salePrice > 0 && c.purchasePrice > 0)
                  .map(c => ({
                    name:   c.name.replace('הכנסות ', ''),
                    מרווח: +((c.salePrice - c.purchasePrice)).toFixed(3),
                  }))
                  .sort((a, b) => b.מרווח - a.מרווח)
                }
                margin={{ top: 4, right: 50, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-3)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={v => `₪${v.toFixed(2)}`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={140} orientation="right" tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={v => [`₪${Number(v).toFixed(3)} לליטר`, 'מרווח']}
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, direction: 'rtl' }}
                />
                <ReferenceLine x={0} stroke="var(--border-2)" />
                <Bar dataKey="מרווח" radius={[0, 5, 5, 0]} maxBarSize={18}>
                  {clients.filter(c => c.salePrice > 0 && c.purchasePrice > 0).map((c, i) => (
                    <Cell key={i} fill={(c.salePrice - c.purchasePrice) >= 0 ? COLORS[i % COLORS.length] : '#ef4444'} />
                  ))}
                  <LabelList dataKey="מרווח" position="right" style={{ fontSize: 10, fill: 'var(--text-2)', fontWeight: 700 }} formatter={v => `₪${Number(v).toFixed(3)}`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* Fuel Card per customer */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p className="section-title" style={{ marginBottom: 2 }}>כרטיסי תדלוק לפי לקוח</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>פירוט לקוחות · סוג כרטיס · כמות · מחירים · רווח</p>
          </div>
          <button className="btn btn-sm" style={{ background: 'var(--green)', color: '#fff', border: 'none' }}
            onClick={() => { setShowFcForm(v => !v); setFcEditing(null); }}>
            {showFcForm ? '✕ ביטול' : '+ הוספת לקוח'}
          </button>
        </div>

        {/* Add form */}
        {showFcForm && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 14, border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>שם לקוח</label>
                <input className="input" placeholder="הקלד לחיפוש לקוח..."
                  value={fcNameInput}
                  onChange={e => { setFcNameInput(e.target.value); setFcForm(f => ({ ...f, name: e.target.value })); setFcShowSuggestions(true); }}
                  onFocus={() => setFcShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setFcShowSuggestions(false), 150)}
                  autoComplete="off" />
                {fcShowSuggestions && fcNameInput && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, left: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)', zIndex: 100, maxHeight: 200, overflowY: 'auto' }}>
                    {existingClientNames
                      .filter(n => n.includes(fcNameInput))
                      .map(n => (
                        <div key={n} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-1)' }}
                          onMouseDown={() => { setFcNameInput(n); setFcForm(f => ({ ...f, name: n })); setFcShowSuggestions(false); }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          {n}
                        </div>
                      ))
                    }
                    {existingClientNames.filter(n => n.includes(fcNameInput)).length === 0 && (
                      <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-3)' }}>לקוח חדש: "{fcNameInput}"</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>סוג כרטיס</label>
                <select className="input" value={fcForm.type} onChange={e => setFcForm(f => ({ ...f, type: e.target.value }))}>
                  {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>ליטרים</label>
                <input className="input" type="number" min="0" placeholder="0" value={fcForm.liters} onChange={e => setFcForm(f => ({ ...f, liters: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>מחיר קניה לפני מע"מ (₪/ל׳)</label>
                <input className="input" type="number" step="0.001" min="0" placeholder="₪/ל׳" value={fcForm.purchasePrice}
                  onChange={e => setFcForm(f => ({ ...f, purchasePrice: e.target.value }))}
                  style={{ borderColor: '#fca5a5', background: '#fff5f5', color: 'var(--red)' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 5 }}>מחיר מכירה לפני מע"מ (₪/ל׳)</label>
                <input className="input" type="number" step="0.001" min="0" placeholder="₪/ל׳" value={fcForm.salePrice}
                  onChange={e => setFcForm(f => ({ ...f, salePrice: e.target.value }))}
                  style={{ borderColor: '#6ee7b7', background: '#f0fdf4', color: 'var(--green)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
              <button className="btn btn-sm" style={{ background: 'var(--green)', color: '#fff', border: 'none' }} onClick={saveFcRow}>✓ שמור</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setShowFcForm(false)}>ביטול</button>
              {fcForm.liters && fcForm.salePrice && (
                <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginRight: 8 }}>
                  רווח משוער: {fmt(Math.round((+fcForm.liters) * ((+fcForm.salePrice) - (+fcForm.purchasePrice || 0))))}
                </span>
              )}
            </div>
          </div>
        )}

        {fuelCardCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-3)', fontSize: 13 }}>
            לחץ "+ הוספת לקוח" להתחיל
          </div>
        ) : (
          <table className="data-table" id="fc-table">
            <thead>
              <tr>{['לקוח', 'סוג כרטיס', 'ליטרים', 'מחיר קניה (לפני מע"מ)', 'מחיר מכירה (לפני מע"מ)', 'הכנסה (לפני מע"מ)', 'רווח גולמי', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(() => {
                // Group by customer name, preserving insertion order
                const groups = [];
                const seen = {};
                fuelCardCustomers.forEach((row, idx) => {
                  if (!seen[row.name]) { seen[row.name] = []; groups.push(row.name); }
                  seen[row.name].push({ row, idx });
                });
                const btn = (color, style) => ({ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 14, padding: '2px 5px', ...style });
                return groups.map(name => {
                  const entries = seen[name];
                  const rowSpan = entries.length;
                  return entries.map(({ row, idx }, ei) => (
                    fcEditing === idx ? (
                      <tr key={idx} style={{ background: '#fffbeb' }}>
                        {ei === 0 && (
                          <td rowSpan={rowSpan} style={{ fontWeight: 800, verticalAlign: 'middle', borderLeft: '3px solid #6366f1' }}>
                            <input className="input-sm" value={fcDraft.name} onChange={e => setFcDraft(d => ({ ...d, name: e.target.value }))} />
                          </td>
                        )}
                        <td>
                          <select className="input-sm" value={fcDraft.type} onChange={e => setFcDraft(d => ({ ...d, type: e.target.value }))}>
                            {CARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td><input className="input-sm" type="number" value={fcDraft.liters} onChange={e => setFcDraft(d => ({ ...d, liters: e.target.value }))} /></td>
                        <td><input className="input-sm" type="number" step="0.001" value={fcDraft.purchasePrice} onChange={e => setFcDraft(d => ({ ...d, purchasePrice: e.target.value }))} style={{ borderColor: '#fca5a5', color: 'var(--red)' }} /></td>
                        <td><input className="input-sm" type="number" step="0.001" value={fcDraft.salePrice} onChange={e => setFcDraft(d => ({ ...d, salePrice: e.target.value }))} style={{ borderColor: '#6ee7b7', color: 'var(--green)' }} /></td>
                        <td style={{ color: 'var(--text-2)', fontWeight: 700 }}>{(+fcDraft.liters > 0 && +fcDraft.salePrice > 0) ? fmt(Math.round(+fcDraft.liters * +fcDraft.salePrice)) : '—'}</td>
                        <td style={{ color: 'var(--green)', fontWeight: 800 }}>{(+fcDraft.liters > 0 && +fcDraft.salePrice > 0) ? fmt(Math.round(+fcDraft.liters * ((+fcDraft.salePrice) - (+fcDraft.purchasePrice || 0)))) : '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button onClick={() => saveFcEdit(idx)} style={btn('var(--green)')}>✓</button>
                          <button onClick={() => setFcEditing(null)} style={btn('var(--text-3)')}>✕</button>
                        </td>
                      </tr>
                    ) : (
                      <tr key={idx} style={{ borderBottom: ei === rowSpan - 1 ? '2px solid var(--border)' : undefined }}>
                        {ei === 0 && (
                          <td rowSpan={rowSpan} style={{ fontWeight: 800, verticalAlign: 'middle', borderLeft: '3px solid #6366f1', paddingRight: 10 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span>{row.name}</span>
                              <button
                                onClick={() => { setFcNameInput(row.name); setFcForm(f => ({ ...f, name: row.name, type: 'בנזין' })); setShowFcForm(true); setTimeout(() => document.querySelector('#fc-add-form input')?.focus(), 50); }}
                                style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                title="הוסף כרטיס שני לאותו לקוח">
                                + כרטיס שני
                              </button>
                            </div>
                          </td>
                        )}
                        <td><span className="badge" style={{ background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd', fontSize: 11, borderRadius: 6, padding: '2px 8px' }}>{row.type}</span></td>
                        <td style={{ color: '#0891b2', fontWeight: 600 }}>{fmtL(row.liters)}</td>
                        <td style={{ color: 'var(--red)', fontWeight: 600 }}>{row.purchasePrice > 0 ? `₪${Number(row.purchasePrice).toFixed(3)}` : '—'}</td>
                        <td style={{ color: 'var(--green)', fontWeight: 600 }}>{row.salePrice > 0 ? `₪${Number(row.salePrice).toFixed(3)}` : '—'}</td>
                        <td style={{ fontWeight: 700 }}>{row.liters > 0 && row.salePrice > 0 ? fmt(Math.round(row.liters * row.salePrice)) : '—'}</td>
                        <td style={{ color: 'var(--green)', fontWeight: 800 }}>{fcProfit(row) > 0 ? fmt(fcProfit(row)) : '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button onClick={() => { setFcEditing(idx); setFcDraft({ ...row }); }} style={btn('var(--blue)')}>✎</button>
                          <button onClick={() => deleteFcRow(idx)} style={btn('var(--red)')}>🗑</button>
                        </td>
                      </tr>
                    )
                  ));
                });
              })()}

              {/* Summary rows per card type */}
              {CARD_TYPES.filter(t => fuelCardCustomers.some(r => r.type === t)).map(t => {
                const rows = fuelCardCustomers.filter(r => r.type === t);
                const totalL = rows.reduce((s, r) => s + (+r.liters || 0), 0);
                const totalRev2 = rows.reduce((s, r) => s + (+r.liters > 0 && +r.salePrice > 0 ? +r.liters * +r.salePrice : 0), 0);
                const totalP = rows.reduce((s, r) => s + fcProfit(r), 0);
                return (
                  <tr key={t} style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
                    <td colSpan={2} style={{ fontWeight: 800, fontSize: 12, color: '#0891b2' }}>סה"כ {t}</td>
                    <td style={{ fontWeight: 800, color: '#0891b2' }}>{fmtL(totalL)}</td>
                    <td colSpan={2} />
                    <td style={{ fontWeight: 800 }}>{totalRev2 > 0 ? fmt(Math.round(totalRev2)) : '—'}</td>
                    <td style={{ fontWeight: 800, color: 'var(--green)' }}>{totalP > 0 ? fmt(totalP) : '—'}</td>
                    <td />
                  </tr>
                );
              })}

              {/* Grand total */}
              {fuelCardCustomers.length > 0 && (
                <tr style={{ background: 'var(--green-soft)', borderTop: '2px solid var(--green-border)', fontWeight: 800 }}>
                  <td colSpan={2} style={{ fontSize: 13 }}>סה"כ כולל</td>
                  <td style={{ color: '#0891b2' }}>{fmtL(fuelCardCustomers.reduce((s, r) => s + (+r.liters || 0), 0))}</td>
                  <td colSpan={2} />
                  <td>{fmt(Math.round(fuelCardCustomers.reduce((s, r) => s + (+r.liters > 0 && +r.salePrice > 0 ? +r.liters * +r.salePrice : 0), 0)))}</td>
                  <td style={{ color: 'var(--green)' }}>{fmt(fuelCardCustomers.reduce((s, r) => s + fcProfit(r), 0))}</td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {/* Additives prices */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p className="section-title" style={{ marginBottom: 2 }}>מחירי תוספים ושירותים משלימים</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>מחיר קניה ומכירה לכל סוג תוסף</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editingAddPrices ? (
              <>
                <button className="btn btn-sm" style={{ background: 'var(--green)', color: '#fff', border: 'none' }} onClick={saveAllAdditivePrices}>✓ שמור מחירים</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditingAddPrices(false)}>ביטול</button>
              </>
            ) : (
              <button className="btn btn-sm" style={{ background: 'var(--purple)', color: '#fff', border: 'none' }} onClick={openAdditiveEdit}>✎ עריכת מחירים</button>
            )}
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              {['סוג תוסף','מחיר קניה (₪/יח׳)','מחיר מכירה (₪/יח׳)','רווח ליח׳','סה"כ נמכר','סה"כ הכנסה','סה"כ רווח'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {additiveDefs.map((def, i) => {
              const buy  = additiveTypes[def.name]?.purchasePrice || 0;
              const sell = additiveTypes[def.name]?.salePrice     || 0;
              const totalQty    = clients.reduce((s, c) => s + ((c.additives || []).find(a => a.type === def.name)?.qty || 0), 0);
              const totalRevRow = totalQty * sell;
              const totalProfRow = totalQty * (sell - buy);
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{def.name}</td>
                  <td>
                    {editingAddPrices ? (
                      <input className="input-sm" type="number" step="0.01" min="0"
                        value={draftPrices[def.name]?.purchasePrice ?? ''} placeholder="₪/יח׳"
                        onChange={e => setDraftPrices(p => ({ ...p, [def.name]: { ...p[def.name], purchasePrice: e.target.value } }))}
                        style={{ width: 90, border: '1.5px solid #d8b4fe', background: 'var(--purple-soft)', color: 'var(--purple)' }} />
                    ) : <span style={{ color: buy > 0 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500 }}>{buy > 0 ? `₪${buy.toFixed(2)}` : '—'}</span>}
                  </td>
                  <td>
                    {editingAddPrices ? (
                      <input className="input-sm" type="number" step="0.01" min="0"
                        value={draftPrices[def.name]?.salePrice ?? ''} placeholder="₪/יח׳"
                        onChange={e => setDraftPrices(p => ({ ...p, [def.name]: { ...p[def.name], salePrice: e.target.value } }))}
                        style={{ width: 90, border: '1.5px solid #d8b4fe', background: 'var(--purple-soft)', color: 'var(--purple)' }} />
                    ) : <span style={{ color: sell > 0 ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 500 }}>{sell > 0 ? `₪${sell.toFixed(2)}` : '—'}</span>}
                  </td>
                  <td style={{ fontWeight: 700, color: sell > buy && buy > 0 ? 'var(--green)' : 'var(--text-3)' }}>{sell > 0 && buy > 0 ? `₪${(sell - buy).toFixed(2)}` : '—'}</td>
                  <td style={{ fontWeight: 700, color: totalQty > 0 ? '#0891b2' : 'var(--text-3)' }}>{totalQty > 0 ? `${totalQty} יח׳` : '—'}</td>
                  <td style={{ fontWeight: 700, color: totalRevRow > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>{totalRevRow > 0 ? fmt(Math.round(totalRevRow)) : '—'}</td>
                  <td style={{ fontWeight: 700, color: totalProfRow > 0 ? 'var(--green)' : totalProfRow < 0 ? 'var(--red)' : 'var(--text-3)' }}>{totalQty > 0 && sell > 0 && buy > 0 ? fmt(Math.round(totalProfRow)) : '—'}</td>
                </tr>
              );
            })}
            <tr style={{ background: 'var(--purple-soft)', borderTop: '2px solid #e9d5ff' }}>
              <td style={{ fontWeight: 800 }}>סה"כ</td>
              <td colSpan={3} />
              <td style={{ fontWeight: 800, color: '#0891b2' }}>
                {DEFAULT_ADDITIVE_TYPES.reduce((s, type) => s + clients.reduce((cs, c) => cs + ((c.additives || []).find(a => a.type === type)?.qty || 0), 0), 0)} יח׳
              </td>
              <td style={{ fontWeight: 800 }}>
                {fmt(Math.round(DEFAULT_ADDITIVE_TYPES.reduce((s, type) => {
                  const sell = additiveTypes[type]?.salePrice || 0;
                  const qty  = clients.reduce((cs, c) => cs + ((c.additives || []).find(a => a.type === type)?.qty || 0), 0);
                  return s + qty * sell;
                }, 0)))}
              </td>
              <td style={{ fontWeight: 800, color: 'var(--green)' }}>
                {fmt(Math.round(DEFAULT_ADDITIVE_TYPES.reduce((s, type) => {
                  const buy  = additiveTypes[type]?.purchasePrice || 0;
                  const sell = additiveTypes[type]?.salePrice     || 0;
                  const qty  = clients.reduce((cs, c) => cs + ((c.additives || []).find(a => a.type === type)?.qty || 0), 0);
                  return s + qty * (sell - buy);
                }, 0)))}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

      {/* Detailed table */}
      <Card style={{ padding: '18px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p className="section-title" style={{ marginBottom: 0 }}>טבלת לקוחות מפורטת</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${showForm ? 'btn-soft' : ''}`}
              style={showForm ? {} : { background: 'var(--green)', color: '#fff', border: 'none' }}
              onClick={() => { setShowForm(v => !v); setShowAdditiveForm(false); setError(''); setEditing(null); }}>
              {showForm ? '✕ ביטול' : '+ לקוח חדש'}
            </button>
            <button className={`btn btn-sm ${showAdditiveForm ? 'btn-soft' : ''}`}
              style={showAdditiveForm ? {} : { background: 'var(--purple)', color: '#fff', border: 'none' }}
              onClick={() => { setShowAdditiveForm(v => !v); setShowForm(false); setAdditiveError(''); }}>
              {showAdditiveForm ? '✕ ביטול' : '+ תוספים'}
            </button>
          </div>
        </div>

        {showAdditiveForm && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 14, border: '1px solid #e9d5ff' }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--purple)' }}>הכנסת תוספים — לקוח חדש</p>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>שם לקוח</label>
              <input className="input" style={{ maxWidth: 280 }} value={additiveName} onChange={e => setAdditiveName(e.target.value)} placeholder="שם לקוח..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
              {DEFAULT_ADDITIVE_TYPES.map(type => {
                const buy  = additiveTypes[type]?.purchasePrice || 0;
                const sell = additiveTypes[type]?.salePrice     || 0;
                const qty  = +additiveQtys[type] || 0;
                const rowProfit = qty > 0 && sell > 0 ? qty * (sell - buy) : null;
                return (
                  <div key={type} style={{ background: 'var(--purple-soft)', borderRadius: 'var(--r-md)', padding: '10px 12px', border: '1px solid #e9d5ff' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--purple)', marginBottom: 6 }}>{type}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 6 }}>
                      {sell > 0 ? `₪${sell.toFixed(2)} / יח׳` : 'מחיר לא הוגדר'}
                    </p>
                    <input className="input" type="number" min="0" placeholder="כמות יח׳"
                      value={additiveQtys[type] || ''}
                      onChange={e => setAdditiveQtys(q => ({ ...q, [type]: e.target.value }))} />
                    {rowProfit != null && (
                      <p style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, marginTop: 5 }}>רווח: {fmt(Math.round(rowProfit))}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {additiveError && <p style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{additiveError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ background: 'var(--purple)', color: '#fff', border: 'none' }} onClick={handleAdditiveOnlySubmit}>שמור</button>
              <button className="btn btn-ghost" onClick={() => { setShowAdditiveForm(false); setAdditiveError(''); }}>ביטול</button>
            </div>
          </div>
        )}

        {showForm && (
          <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: 14, border: '1px solid var(--green-border)' }}>
            <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>לקוח חדש</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'שם לקוח', key: 'name', type: 'text', placeholder: 'שם...' },
                { label: 'ליטרים', key: 'liters', type: 'number', placeholder: '0' },
                { label: 'מחיר קניה', key: 'purchasePrice', type: 'number', step: '0.001', placeholder: '₪/ל׳' },
                { label: 'מחיר מכירה', key: 'salePrice', type: 'number', step: '0.001', placeholder: '₪/ל׳' },
              ].map(({ label, key, ...rest }) => (
                <div key={key}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>{label}</label>
                  <input className="input" value={form[key]} onChange={e => set(key, e.target.value)} {...rest} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>רווח (מחושב)</label>
                <input className="input" value={form.profit ? fmt(+form.profit) : '—'} readOnly style={{ background: 'var(--surface-2)', color: 'var(--green)', fontWeight: 700 }} />
              </div>
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ background: 'var(--green)', color: '#fff', border: 'none' }} onClick={handleSubmit}>שמור</button>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setError(''); }}>ביטול</button>
            </div>
          </div>
        )}

        <table className="data-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '3%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '6%' }} />
          </colgroup>
          <thead>
            <tr>
              {['#','לקוח','ליטרים (משוערך / בפועל)','תוספים','רווח גולמי','חשבונית לפני מע"מ','מחיר ק׳ | מ׳ | רווח/ל','%',''].map(h => <th key={h} style={{ fontSize: 10 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {sortedClients.map((c, i) => {
              const isEd = editing?.idx === c._idx;
              const cp   = c._profit;
              const profitPerLiter = (c.salePrice > 0 && c.purchasePrice > 0) ? c.salePrice - c.purchasePrice : null;
              const P = { padding: '7px 8px' };

              return isEd ? (
                <tr key={i} style={{ ...editRowStyle, verticalAlign: 'top' }}>
                  <td style={{ ...P, color: 'var(--text-3)', fontSize: 11 }}>{i + 1}</td>
                  <td style={P}><input className="input-sm" value={editing.form.name} onChange={e => setEf('name', e.target.value)} /></td>
                  <td style={P}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>משוערך</span>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <input className="input-sm" type="number" value={editing.form.liters} onChange={e => setEf('liters', e.target.value)} style={{ width: 65 }} placeholder="מ1" />
                        <input className="input-sm" type="number" value={editing.form.liters2} onChange={e => setEf('liters2', e.target.value)} style={{ width: 65, borderColor: '#6ee7b7', background: '#f0fdf4', color: '#059669' }} placeholder="מ2" />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--text-3)' }}>בפועל</span>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <input className="input-sm" type="number" value={editing.form.actualLiters} onChange={e => setEf('actualLiters', e.target.value)} style={{ width: 65, borderColor: '#bae6fd', background: '#f0f9ff', color: '#0891b2' }} placeholder="מ1" />
                        <input className="input-sm" type="number" value={editing.form.actualLiters2} onChange={e => setEf('actualLiters2', e.target.value)} style={{ width: 65, borderColor: '#6ee7b7', background: '#f0fdf4', color: '#059669' }} placeholder="מ2" />
                      </div>
                    </div>
                  </td>
                  <td style={{ ...P, verticalAlign: 'top' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {DEFAULT_ADDITIVE_TYPES.map(typeName => {
                        const existing = (editing.form.additives || []).find(a => a.type === typeName);
                        return (
                          <div key={typeName} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 9, color: 'var(--text-3)', flexShrink: 0, width: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeName}</span>
                            <input className="input-sm" type="number" min="0" step="0.1" value={existing?.qty ?? ''} placeholder="יח׳"
                              onChange={e => {
                                const qty = e.target.value;
                                setEditing(ed => {
                                  const cur  = (ed.form.additives || []).filter(a => a.type !== typeName);
                                  const next = qty !== '' ? [...cur, { type: typeName, qty: +qty }] : cur;
                                  return { ...ed, form: { ...ed.form, additives: next } };
                                });
                              }}
                              style={{ width: 48, borderColor: '#d8b4fe', background: 'var(--purple-soft)', color: 'var(--purple)' }} />
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td style={P}>
                    <input className="input-sm" type="number" value={editing.form.profit} onChange={e => setEf('profit', e.target.value)}
                      style={{ width: '100%', color: 'var(--green)', fontWeight: 700, background: (editing.form.salePrice || editing.form.purchasePrice) ? '#f0fdf4' : '#fffbeb' }} placeholder="מחושב" />
                  </td>
                  <td style={{ ...P, color: 'var(--text-2)', fontSize: 12 }}>
                    {editing.form.salePrice ? fmt(Math.round((+editing.form.actualLiters || +editing.form.liters || 0) * +editing.form.salePrice)) : '—'}
                  </td>
                  <td style={P}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-3)', width: 24 }}>קניה</span>
                        <input className="input-sm" type="number" step="0.001" value={editing.form.purchasePrice} onChange={e => setEf('purchasePrice', e.target.value)} style={{ width: 68 }} placeholder="₪/ל'" />
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-3)', width: 24 }}>מכירה</span>
                        <input className="input-sm" type="number" step="0.001" value={editing.form.salePrice} onChange={e => setEf('salePrice', e.target.value)} style={{ width: 68 }} placeholder="מ1" />
                        <input className="input-sm" type="number" step="0.001" value={editing.form.salePrice2} onChange={e => setEf('salePrice2', e.target.value)} style={{ width: 68, borderColor: '#6ee7b7', background: '#f0fdf4', color: '#059669' }} placeholder="מ2" />
                      </div>
                    </div>
                  </td>
                  <td />
                  <td style={{ ...P, whiteSpace: 'nowrap' }}>
                    <button onClick={handleSaveEdit} style={actionBtn('var(--green)')}>✓</button>
                    <button onClick={() => setEditing(null)} style={actionBtn('var(--text-3)')}>✕</button>
                  </td>
                </tr>
              ) : (
                <tr key={i}>
                  <td style={{ ...P, color: 'var(--text-3)', fontSize: 10 }}>{i + 1}</td>
                  <td style={{ ...P, fontWeight: 700, color: 'var(--text-1)', fontSize: 12 }}>{c.name}</td>
                  <td style={P}>
                    {(() => {
                      const actual  = effectiveLiters(c);
                      const actual2 = effectiveLiters2(c);
                      const est     = c.liters || 0;
                      const pct     = est > 0 ? Math.round((actual / est) * 100) : null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{fmtL(est)}{c.liters2 > 0 ? ` + ${fmtL(c.liters2)}` : ''}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontWeight: 700, color: actual >= est ? 'var(--green)' : '#0891b2', fontSize: 12 }}>{fmtL(actual)}</span>
                            {pct !== null && (
                              <span style={{ fontSize: 9, fontWeight: 700, borderRadius: 20, padding: '1px 5px', background: actual >= est ? '#f0fdf4' : '#f0f9ff', color: actual >= est ? 'var(--green)' : '#0891b2', border: `1px solid ${actual >= est ? '#bbf7d0' : '#bae6fd'}` }}>{pct}%</span>
                            )}
                          </div>
                          {actual2 > 0 && <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>+{fmtL(actual2)}</span>}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={P}>
                    {Array.isArray(c.additives) && c.additives.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {c.additives.map((a, ai) => (
                          <span key={ai} className="badge badge-purple" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4 }}>{a.type}: {a.qty}</span>
                        ))}
                      </div>
                    ) : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>}
                  </td>
                  <td style={P}>
                    {(() => {
                      const sell1 = c.salePrice || 0;
                      const sell2 = c.salePrice2 || 0;
                      const buy   = c.purchasePrice || 0;
                      const l1    = effectiveLiters(c);
                      const l2    = effectiveLiters2(c);
                      const p1    = sell1 > 0 ? l1 * (buy > 0 ? sell1 - buy : sell1) : (c.profit || 0);
                      const p2    = sell2 > 0 && l2 > 0 ? l2 * (buy > 0 ? sell2 - buy : sell2) : null;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontWeight: 700, color: 'var(--green)', fontSize: 12 }}>
                            {fmt(Math.round(p1))}
                            {sell1 > 0 && <span style={{ fontSize: 9, color: 'var(--text-3)', marginRight: 3 }}>מ1</span>}
                          </span>
                          {p2 !== null && (
                            <span style={{ fontWeight: 700, color: '#059669', fontSize: 12 }}>
                              {fmt(Math.round(p2))}
                              <span style={{ fontSize: 9, color: 'var(--text-3)', marginRight: 3 }}>מ2</span>
                            </span>
                          )}
                          {p2 !== null && (
                            <span style={{ fontSize: 10, color: 'var(--text-3)', borderTop: '1px solid var(--border)', paddingTop: 2 }}>
                              סה״כ: {fmt(Math.round(p1 + p2))}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={P}>
                    {c.salePrice > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 12 }}>{fmt(Math.round(invoiceTotal(c)))}</span>
                        <span style={{ fontSize: 10, color: 'var(--purple)' }}>+מע"מ: {fmt(Math.round(invoiceTotal(c) * 1.18))}</span>
                      </div>
                    ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                  </td>
                  <td style={P}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                        <span style={{ color: 'var(--text-3)' }}>ק:</span>
                        <span style={{ color: 'var(--red)', fontWeight: 600 }}>{c.purchasePrice > 0 ? `₪${Number(c.purchasePrice).toFixed(3)}` : '—'}</span>
                        <span style={{ color: 'var(--text-3)', marginRight: 4 }}>מ:</span>
                        <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{c.salePrice > 0 ? `₪${Number(c.salePrice).toFixed(3)}` : '—'}</span>
                      </div>
                      {c.salePrice2 > 0 && <span style={{ fontSize: 10, color: '#059669' }}>מ2: ₪{Number(c.salePrice2).toFixed(3)}</span>}
                      <div style={{ fontSize: 11, color: '#0891b2', fontWeight: 700 }}>
                        {profitPerLiter != null ? `₪${profitPerLiter.toFixed(3)}/ל׳` : '—'}
                      </div>
                    </div>
                  </td>
                  <td style={P}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 700 }}>{((cp / totalRev) * 100).toFixed(1)}%</span>
                      <div className="progress-track" style={{ height: 4 }}>
                        <div className="progress-fill" style={{ width: `${(cp / totalRev) * 100}%`, background: COLORS[i % COLORS.length], height: '100%' }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ ...P, whiteSpace: 'nowrap' }}>
                    <button onClick={() => startEdit(c._idx, c)} style={actionBtn('var(--blue)')}>✎</button>
                    <button onClick={() => handleDelete(c._idx)} style={actionBtn('var(--red)')}>🗑</button>
                  </td>
                </tr>
              );
            })}

            {/* Total row */}
            <tr style={{ background: 'var(--green-soft)', borderTop: '2px solid var(--green-border)', fontWeight: 700 }}>
              <td colSpan={2} style={{ padding: '9px 8px', fontWeight: 800, fontSize: 12 }}>סה"כ</td>
              <td style={{ padding: '9px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{fmtL(totalLiters)}</div>
                <div style={{ color: '#0891b2', fontWeight: 800 }}>{fmtL(totalActualLiters)}</div>
              </td>
              <td />
              <td style={{ padding: '9px 8px', color: 'var(--green)', fontSize: 13 }}>{fmt(totalRev)}</td>
              <td style={{ padding: '9px 8px' }}>
                <div style={{ fontWeight: 800 }}>{totalInvoice > 0 ? fmt(Math.round(totalInvoice)) : '—'}</div>
                <div style={{ fontSize: 10, color: 'var(--purple)' }}>{totalInvoice > 0 ? `+מע"מ: ${fmt(Math.round(totalInvoice * 1.18))}` : ''}</div>
              </td>
              <td style={{ padding: '9px 8px', color: '#0891b2', fontSize: 11 }}>
                {avgProfitPerLiter > 0 ? `₪${avgProfitPerLiter.toFixed(3)}/ל׳` : '—'}
              </td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </Card>

    </div>
  );
}
