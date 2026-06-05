import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell, LabelList,
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

const DEFAULT_ADDITIVE_TYPES = ['אוריאה', 'הידראולי 68', 'הידראולי 46', 'מנוע 15W40'];
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
  const clients            = externalData?.clients || DEFAULT_CLIENTS;
  const additiveTypes      = externalData?.additiveTypes || {};
  const [showForm,         setShowForm]         = useState(false);
  const [actualLitersMap,  setActualLitersMap]  = useState({});
  const [editingAddPrices, setEditingAddPrices] = useState(false);
  const [draftPrices,      setDraftPrices]      = useState({});
  const [form,             setForm]             = useState(EMPTY);
  const [error,            setError]            = useState('');
  const [editing,          setEditing]          = useState(null);
  const [editingFuelCard,  setEditingFuelCard]  = useState(false);
  const [fuelCardDraft,    setFuelCardDraft]    = useState({ diesel: {}, benzin: {} });

  const fuelCardIdx      = clients.findIndex(c => c.name === 'הכנסות כרטיסי תדלוק');
  const fuelCardClient   = fuelCardIdx >= 0 ? clients[fuelCardIdx] : null;
  const fuelCardBenzIdx  = clients.findIndex(c => c.name === 'הכנסות כרטיסי תדלוק בנזין');
  const fuelCardBenzClient = fuelCardBenzIdx >= 0 ? clients[fuelCardBenzIdx] : null;

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
    const dieselEntry = makeEntry('הכנסות כרטיסי תדלוק',       fuelCardDraft.diesel, fuelCardClient);
    const benzinEntry = makeEntry('הכנסות כרטיסי תדלוק בנזין', fuelCardDraft.benzin, fuelCardBenzClient);
    onChange(prev => {
      const base = prev || DEFAULT_WORKPLAN;
      const list = [...(base.clients || [])];
      const dIdx = list.findIndex(c => c.name === 'הכנסות כרטיסי תדלוק');
      if (dIdx >= 0) list[dIdx] = dieselEntry; else list.push(dieselEntry);
      const bIdx = list.findIndex(c => c.name === 'הכנסות כרטיסי תדלוק בנזין');
      if (bIdx >= 0) list[bIdx] = benzinEntry; else list.push(benzinEntry);
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
    fetch('http://localhost:8000/api/orders')
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
    return effectiveLiters(c) * sell1 + (sell2 > 0 ? effectiveLiters2(c) * sell2 : 0);
  };

  const totalRev          = clients.reduce((s, c) => s + grossProfit(c), 0);
  const totalInvoice      = clients.reduce((s, c) => s + invoiceTotal(c), 0);
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      <MonthSelector monthId={monthId} allMonths={allMonths} onMonthSwitch={onMonthSwitch} onNewMonth={onNewMonth} />

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {[
          {
            label: 'סה"כ הכנסות', value: fmt(totalRev), sub: `${clients.length} לקוחות`,
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
            label: 'ממוצע ללקוח', value: fmt(Math.round(totalRev / (clients.length || 1))), sub: 'הכנסה ברוטו ממוצעת',
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
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>
        <Card>
          <SectionTitle sub="ממוין מהגבוה לנמוך">רווח גולמי לפי לקוח</SectionTitle>
          <ResponsiveContainer width="100%" height={Math.max(200, sortedClients.length * 34)}>
            <BarChart data={sortedClients.map(c => ({ name: c.name, value: c._profit }))} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-3)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={tickK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={280} orientation="right" tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 600 }} axisLine={false} tickLine={false} />
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
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>
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
              <YAxis type="category" dataKey="name" width={280} orientation="right" tick={{ fontSize: 11, fill: 'var(--text-2)', fontWeight: 600 }} axisLine={false} tickLine={false} />
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

      {/* Fuel Card Revenue */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p className="section-title" style={{ marginBottom: 2 }}>הכנסות כרטיסי תדלוק</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>מחיר קניה ומכירה לליטר · רווח מחושב אוטומטית</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {editingFuelCard ? (
              <>
                <button className="btn btn-sm" style={{ background: 'var(--green)', color: '#fff', border: 'none' }} onClick={saveFuelCard}>✓ שמור</button>
                <button className="btn btn-sm btn-ghost" onClick={() => setEditingFuelCard(false)}>ביטול</button>
              </>
            ) : (
              <button className="btn btn-sm" style={{ background: '#0891b2', color: '#fff', border: 'none' }} onClick={openFuelCardEdit}>✎ עריכה</button>
            )}
          </div>
        </div>

        {editingFuelCard ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { key: 'diesel', label: 'כרטיסי תדלוק סולר' },
              { key: 'benzin', label: 'כרטיסי תדלוק בנזין' },
            ].map(({ key, label }) => {
              const d = fuelCardDraft[key] || {};
              const calcProfit = () => {
                const qty = +d.quantity || 0, buy = +d.purchasePrice || 0, sell = +d.salePrice || 0;
                return qty > 0 && sell > 0 ? fmt(Math.round(qty * (sell - buy))) : '—';
              };
              return (
                <div key={key}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>{label}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>כמות ליטרים</label>
                      <input className="input" type="number" min="0" placeholder="0"
                        value={d.quantity || ''}
                        onChange={e => setFuelCardDraft(fd => ({ ...fd, [key]: { ...fd[key], quantity: e.target.value } }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>מחיר קניה (₪/ל׳)</label>
                      <input className="input" type="number" step="0.001" min="0" placeholder="₪/ל׳"
                        value={d.purchasePrice || ''}
                        onChange={e => setFuelCardDraft(fd => ({ ...fd, [key]: { ...fd[key], purchasePrice: e.target.value } }))}
                        style={{ borderColor: '#fca5a5', background: '#fff5f5', color: 'var(--red)' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>מחיר מכירה (₪/ל׳)</label>
                      <input className="input" type="number" step="0.001" min="0" placeholder="₪/ל׳"
                        value={d.salePrice || ''}
                        onChange={e => setFuelCardDraft(fd => ({ ...fd, [key]: { ...fd[key], salePrice: e.target.value } }))}
                        style={{ borderColor: '#6ee7b7', background: '#f0fdf4', color: 'var(--green)' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6 }}>רווח מחושב</label>
                      <div style={{ padding: '8px 11px', borderRadius: 'var(--r-md)', background: 'var(--green-soft)', border: '1px solid var(--green-border)', color: 'var(--green)', fontWeight: 800, fontSize: 14, minHeight: 38, display: 'flex', alignItems: 'center' }}>
                        {calcProfit()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {['סוג', 'ליטרים', 'מחיר קניה (₪/ל׳)', 'מחיר מכירה (₪/ל׳)', 'הכנסה כוללת', 'רווח גולמי'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'כרטיסי תדלוק סולר', client: fuelCardClient },
                { label: 'כרטיסי תדלוק בנזין', client: fuelCardBenzClient },
              ].map(({ label, client }, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{label}</td>
                  <td style={{ color: '#0891b2', fontWeight: 600 }}>{client?.liters > 0 ? fmtL(client.liters) : '—'}</td>
                  <td style={{ color: 'var(--red)', fontWeight: 600 }}>{client?.purchasePrice > 0 ? `₪${Number(client.purchasePrice).toFixed(3)}` : '—'}</td>
                  <td style={{ color: 'var(--green)', fontWeight: 600 }}>{client?.salePrice > 0 ? `₪${Number(client.salePrice).toFixed(3)}` : '—'}</td>
                  <td style={{ fontWeight: 700 }}>{client?.salePrice > 0 && client?.liters > 0 ? fmt(Math.round(client.liters * client.salePrice)) : '—'}</td>
                  <td style={{ fontWeight: 700, color: 'var(--green)' }}>{client ? fmt(Math.round(grossProfit(client))) : '—'}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--surface-2)', borderTop: '2px solid var(--border)' }}>
                <td style={{ fontWeight: 800 }}>סה"כ</td>
                <td style={{ fontWeight: 800, color: '#0891b2' }}>
                  {fmtL((fuelCardClient?.liters || 0) + (fuelCardBenzClient?.liters || 0))}
                </td>
                <td colSpan={2} />
                <td style={{ fontWeight: 800 }}>
                  {fmt(Math.round(
                    (fuelCardClient?.salePrice > 0 && fuelCardClient?.liters > 0 ? fuelCardClient.liters * fuelCardClient.salePrice : 0) +
                    (fuelCardBenzClient?.salePrice > 0 && fuelCardBenzClient?.liters > 0 ? fuelCardBenzClient.liters * fuelCardBenzClient.salePrice : 0)
                  ))}
                </td>
                <td style={{ fontWeight: 800, color: 'var(--green)' }}>
                  {fmt(Math.round((fuelCardClient ? grossProfit(fuelCardClient) : 0) + (fuelCardBenzClient ? grossProfit(fuelCardBenzClient) : 0)))}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>

      {/* Additives prices */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p className="section-title" style={{ marginBottom: 2 }}>מחירי תוספים</p>
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

      {/* Add client button */}
      <div>
        <button className={`btn ${showForm ? 'btn-soft' : 'btn-primary'}`} style={showForm ? {} : { background: 'var(--green)', borderColor: 'var(--green)' }} onClick={() => { setShowForm(v => !v); setError(''); setEditing(null); }}>
          {showForm ? '✕ ביטול' : '+ הוספת לקוח'}
        </button>

        {showForm && (
          <div className="card card-pad" style={{ marginTop: 12 }}>
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
      </div>

      {/* Detailed table */}
      <Card style={{ padding: '18px 14px' }}>
        <p className="section-title">טבלת לקוחות מפורטת</p>
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
                  <td style={{ ...P, fontWeight: 700, color: 'var(--green)', fontSize: 13 }}>{fmt(cp)}</td>
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
