import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ReferenceLine,
} from 'recharts';

const fmt    = n => '₪' + Number(n).toLocaleString('he-IL');
const fmtL   = n => Number(n).toLocaleString('he-IL') + ' ל׳';
const fmtPct = n => n.toFixed(1) + '%';

const DEFAULT_DATA = {
  fuelPurchases: [
    { name: 'קניות דלקים',              amount: 1803069, note: '304001' },
    { name: 'כרטיסי תדלוק',             amount: 99444,   note: '304003' },
    { name: 'קניות שמנים ותוספים',      amount: 83580,   note: '304000' },
    { name: 'קניות מוצרים משלימים',     amount: 1640,    note: '304005' },
    { name: 'קניות שירותים משלימים',    amount: 1189,    note: '304006' },
    { name: 'כרטיס תדלוק ישראל מזרחי', amount: 755,     note: '304009' },
  ],
  operationalExpenses: [
    { name: 'הובלות דלקים',                   amount: 17434, note: '300066' },
    { name: 'שכירות מגרש עטרות (אולימפיה)',   amount: 18875, note: '305015' },
    { name: 'דמי ניהול',                       amount: 35000, note: '300053' },
    { name: 'פרסום',                           amount: 17637, note: '300022' },
    { name: 'הוצאות משאיות',                   amount: 26506, note: '301' },
    { name: 'הוצאות רכב',                      amount: 11304, note: '306' },
    { name: 'ביטוחי רכב ורישיונות',            amount: 10910, note: '307' },
    { name: 'הוצאות מימון',                    amount: 17563, note: '309' },
    { name: 'הוצאות ביובית',                   amount: 15925, note: '390' },
  ],
  salaries: [
    { name: 'נאור',  amount: 25000 },
    { name: 'ישראל', amount: 16000 },
    { name: 'אסף',   amount: 15000 },
    { name: 'רוסטי', amount: 15000 },
    { name: 'אפרת',  amount: 8000  },
    { name: 'נעמי',  amount: 7500  },
  ],
  clients: [
    { name: 'הכנסות סולר תחבורה',         liters: 0, profit: 2058044 },
    { name: 'הכנסות כרטיסי תדלוק',        liters: 0, profit: 115693  },
    { name: 'הכנסות ביובית',              liters: 0, profit: 109585  },
    { name: 'הכנסות נוזל גנרטורים',       liters: 0, profit: 106928  },
    { name: 'הכנסות מהובלות',             liters: 0, profit: 66755   },
  ],
};

/* ── Shared UI ──────────────────────────────────────────────── */
const Card = ({ children, style = {} }) => (
  <div className="card card-pad" style={style}>{children}</div>
);

const SectionTitle = ({ children }) => (
  <p className="section-title">{children}</p>
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
        <p key={i} style={{ color: p.color || p.fill, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const pctLbl = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const R = Math.PI / 180;
  return (
    <text
      x={cx + r * Math.cos(-midAngle * R)}
      y={cy + r * Math.sin(-midAngle * R)}
      fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={10} fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const GaugeBar = ({ value, max, color }) => (
  <div className="progress-track" style={{ height: 5 }}>
    <div
      className="progress-fill"
      style={{ width: `${Math.min((value / max) * 100, 100)}%`, background: color, height: '100%' }}
    />
  </div>
);

/* ── Computed helpers ───────────────────────────────────────── */
const clientProfit = c => {
  const sell1 = c.salePrice    || 0;
  const sell2 = c.salePrice2   || 0;
  const buy   = c.purchasePrice || 0;
  if (sell1 > 0) {
    const liters1  = (c.actualLiters  != null ? c.actualLiters  : c.liters)  || 0;
    const liters2  = (c.actualLiters2 != null ? c.actualLiters2 : (c.liters2 || 0));
    const margin1  = buy > 0 ? sell1 - buy : sell1;
    const margin2  = sell2 > 0 ? (buy > 0 ? sell2 - buy : sell2) : 0;
    return liters1 * margin1 + (sell2 > 0 && liters2 > 0 ? liters2 * margin2 : 0);
  }
  return c.profit || 0;
};

const clientActualLiters = c =>
  (c.actualLiters != null ? c.actualLiters : c.liters) || 0;

const clientInvoice = c => {
  const sell1   = c.salePrice  || 0;
  const sell2   = c.salePrice2 || 0;
  const liters1 = (c.actualLiters  != null ? c.actualLiters  : c.liters)       || 0;
  const liters2 = (c.actualLiters2 != null ? c.actualLiters2 : (c.liters2 || 0));
  if (sell1 > 0) return liters1 * sell1 + (sell2 > 0 && liters2 > 0 ? liters2 * sell2 : 0);
  return c.profit || 0;
};

const CLIENT_COLORS = ['#d32f2f','#2563eb','#0891b2','#16a34a','#7c3aed','#ea580c','#0f766e'];
const EXP_COLORS    = ['#d32f2f','#ea580c','#1e2d3d'];

/* ── P&L Row ────────────────────────────────────────────────── */
const PLRow = ({ label, value, pct, indent = false, bold = false, subtotal = false, total = false, negative = false, color }) => {
  const textColor = color || (negative ? 'var(--red)' : 'var(--text-1)');
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: `${total ? 10 : subtotal ? 7 : 5}px ${indent ? 24 : 0}px`,
      borderBottom: subtotal || total ? `${total ? 2 : 1}px solid ${total ? 'var(--border-2)' : 'var(--border)'}` : 'none',
      borderRadius: subtotal || total ? 'var(--r-sm)' : 0,
      background: total ? (value >= 0 ? 'var(--green-soft)' : 'var(--red-soft)') : subtotal ? 'var(--surface-2)' : 'transparent',
      marginBottom: subtotal ? 2 : 0,
    }}>
      <span style={{
        fontSize: total ? 13.5 : 12.5,
        color: indent ? 'var(--text-2)' : 'var(--text-1)',
        fontWeight: total ? 800 : bold || subtotal ? 700 : 400,
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 28, minWidth: 170, justifyContent: 'flex-end' }}>
        <span style={{
          fontSize: total ? 15 : 12.5,
          fontWeight: total ? 800 : bold || subtotal ? 700 : 500,
          color: textColor,
          minWidth: 100,
          textAlign: 'left',
        }}>
          {negative ? `(${fmt(Math.abs(value))})` : fmt(value)}
        </span>
        <span style={{
          fontSize: 11,
          color: negative ? 'var(--red)' : 'var(--text-3)',
          fontWeight: subtotal || total ? 600 : 400,
          minWidth: 50,
          textAlign: 'left',
        }}>
          {pct !== undefined ? `${negative ? '(' : ''}${Math.abs(pct).toFixed(1)}%${negative ? ')' : ''}` : ''}
        </span>
      </div>
    </div>
  );
};

const GroupLabel = ({ children }) => (
  <p style={{
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-3)',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  }}>
    {children}
  </p>
);

/* ════════════════════════════════════════════════════════════ */
export default function WorkPlanDashboard({ data: ext, monthLabel }) {
  const d = ext || DEFAULT_DATA;

  const totalOpEx   = d.operationalExpenses.reduce((s, e) => s + e.amount, 0);
  const totalSal    = d.salaries.reduce((s, e) => s + e.amount, 0);
  const totalFuel   = (d.fuelPurchases || []).reduce((s, e) => s + e.amount, 0);
  const totalEx     = totalOpEx + totalSal + totalFuel;

  // כרטיסי תדלוק לפי לקוח
  const additiveTypes  = d.additiveTypes  || {};
  const fcRows         = d.fuelCardCustomers || [];
  const fcRevenue      = Math.round(fcRows.reduce((s, r) => s + (r.liters || 0) * (r.salePrice || 0), 0));
  const fcProfitTotal  = Math.round(fcRows.reduce((s, r) => s + (r.liters || 0) * ((r.salePrice || 0) - (r.purchasePrice || 0)), 0));

  // תוספים ושירותים משלימים
  const addRevenue     = Math.round(d.clients.reduce((s, c) =>
    s + (c.additives || []).reduce((cs, a) => cs + (a.qty || 0) * (additiveTypes[a.type]?.salePrice || 0), 0), 0));
  const addProfitTotal = Math.round(d.clients.reduce((s, c) =>
    s + (c.additives || []).reduce((cs, a) => {
      const sell = additiveTypes[a.type]?.salePrice || 0;
      const buy  = additiveTypes[a.type]?.purchasePrice || 0;
      return cs + (a.qty || 0) * (sell - buy);
    }, 0), 0));

  const totalRev     = d.clients.reduce((s, c) => s + clientProfit(c), 0) + fcProfitTotal + addProfitTotal;
  const totalInvoice = d.clients.reduce((s, c) => s + clientInvoice(c), 0) + fcRevenue + addRevenue;
  const totalLiters  = d.clients.reduce((s, c) => s + clientActualLiters(c), 0);
  const netProfit   = totalInvoice - totalEx;
  const base        = totalInvoice > 0 ? totalInvoice : 1;
  const margin      = (netProfit / base) * 100;
  const costRatio   = (totalEx    / base) * 100;
  const salPct      = (totalSal   / base) * 100;
  const opPct       = (totalOpEx  / base) * 100;
  const fuelPct     = (totalFuel  / base) * 100;

  const revPerLiter  = totalLiters > 0 ? totalRev / totalLiters : 0;
  const costPerLiter = totalLiters > 0 ? totalEx / totalLiters : 0;

  const _litersWithBoth = d.clients.reduce((s, c) =>
    (c.salePrice > 0 && c.purchasePrice > 0) ? s + clientActualLiters(c) : s, 0);
  const _totalSaleVal   = d.clients.reduce((s, c) =>
    (c.salePrice > 0 && c.purchasePrice > 0) ? s + c.salePrice * clientActualLiters(c) : s, 0);
  const _totalBuyVal    = d.clients.reduce((s, c) =>
    (c.salePrice > 0 && c.purchasePrice > 0) ? s + c.purchasePrice * clientActualLiters(c) : s, 0);
  const avgWeightedSale = _litersWithBoth > 0 ? _totalSaleVal / _litersWithBoth : revPerLiter;
  const avgWeightedBuy  = _litersWithBoth > 0 ? _totalBuyVal / _litersWithBoth : (totalLiters > 0 ? totalFuel / totalLiters : 0);
  const marketingMargin = avgWeightedSale - avgWeightedBuy;

  const topClient  = [...d.clients].sort((a, b) => clientProfit(b) - clientProfit(a))[0];
  const topExpense = [...d.operationalExpenses].sort((a, b) => b.amount - a.amount)[0];
  const top5op     = [...d.operationalExpenses].sort((a, b) => b.amount - a.amount).slice(0, 5);

  const expTypePie = [
    { name: 'הוצ׳ תפעול',  value: totalOpEx  },
    { name: 'רכישת דלקים', value: totalFuel  },
    { name: 'משכורות',     value: totalSal   },
  ];

  const months     = ['יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const projection = months.map((m, i) => ({
    month: m,
    הכנסות: Math.round(totalInvoice * (1 + i * 0.02)),
    הוצאות: Math.round(totalEx  * (1 + i * 0.01)),
    רווח:   Math.round(netProfit * (1 + i * 0.05)),
  }));

  const ALL_MONTHS    = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  const CURRENT_IDX   = 4;
  const monthlyGrowth = ALL_MONTHS.map((month, i) => {
    if (i < CURRENT_IDX)    return { month, רווח: null,    type: 'past' };
    if (i === CURRENT_IDX)  return { month, רווח: netProfit, type: 'current' };
    return { month, רווח: Math.round(netProfit * (1 + (i - CURRENT_IDX) * 0.025)), type: 'future' };
  });

  const grossProfit = totalInvoice - totalFuel;
  const grossMargin = totalInvoice > 0 ? (grossProfit / totalInvoice) * 100 : 0;
  const opProfit    = grossProfit - totalOpEx;
  const opMargin    = totalInvoice > 0 ? (opProfit / totalInvoice) * 100 : 0;

  /* ── KPI cards ──────────────────────────────────────────── */
  const kpis = [
    {
      label: 'סה"כ הכנסות לפני מע"מ',
      value: fmt(Math.round(totalInvoice)),
      sub: 'סכום כל החשבוניות ללא מע"מ',
      bg: 'linear-gradient(135deg, #0891b2 0%, #0369a1 100%)',
    },
    {
      label: 'סה"כ הכנסות אחרי מע"מ',
      value: fmt(Math.round(totalInvoice * 1.18)),
      sub: 'כולל מע"מ 18%',
      bg: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
    },
    {
      label: 'הוצאות כוללות',
      value: fmt(totalEx),
      sub: `תפעול + דלקים + שכר`,
      bg: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    },
    {
      label: 'רווח נקי חודשי לפני מס',
      value: fmt(netProfit),
      sub: netProfit >= 0 ? 'פרופיטבילי ✓' : 'גירעון ⚠',
      bg: netProfit >= 0
        ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
        : 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
    },
    {
      label: 'שיעור רווחיות',
      value: fmtPct(margin),
      sub: `יחס עלויות ${fmtPct(costRatio)}`,
      bg: margin >= 10
        ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
        : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    },
    {
      label: 'תחזית שנתית',
      value: fmt(netProfit * 12),
      sub: 'בהנחת ביצועים קבועים',
      bg: 'linear-gradient(135deg, #4338ca 0%, #3730a3 100%)',
    },
    {
      label: 'מרווח שיווק',
      value: `₪${marketingMargin.toFixed(3)}`,
      sub: 'ממוצע מכירה פחות קניה לליטר',
      bg: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
    },
  ];

  /* ── Axis formatters ────────────────────────────────────── */
  const tickK = v => v === 0 ? '0' : `₪${(v / 1000).toFixed(0)}k`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{
            background: k.bg,
            borderRadius: 'var(--r-lg)',
            padding: '12px 14px 10px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.3 }}>
              {k.label}
            </p>
            <p style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: -0.3,
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {k.value}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.3 }}>
              {k.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>

        {/* הכנסות לפי מקור */}
        <Card style={{ padding: '14px 16px' }}>
          <p className="section-title" style={{ marginBottom: 10 }}>הכנסות לפי מקור</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={d.clients.map(c => ({ name: c.name.replace('הכנסות ', ''), value: clientProfit(c) })).filter(c => c.value > 0)}
                cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                dataKey="value" paddingAngle={3} labelLine={false} label={pctLbl}
              >
                {d.clients.map((_, i) => <Cell key={i} fill={CLIENT_COLORS[i % CLIENT_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* הרכב הוצאות */}
        <Card style={{ padding: '14px 16px' }}>
          <p className="section-title" style={{ marginBottom: 10 }}>הרכב הוצאות</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={expTypePie} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                dataKey="value" paddingAngle={3} labelLine={false} label={pctLbl}
              >
                {expTypePie.map((_, i) => <Cell key={i} fill={EXP_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* מדדים מהירים */}
        <Card style={{ padding: '14px 16px' }}>
          <p className="section-title" style={{ marginBottom: 10 }}>מדדים מהירים</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'רווח גולמי', value: fmtPct(grossMargin), color: grossMargin >= 0 ? 'var(--green)' : 'var(--red)', pct: Math.abs(grossMargin) },
              { label: 'שכר מהכנסות', value: fmtPct(salPct), color: 'var(--purple)', pct: salPct },
              { label: 'עלות סחורה', value: fmtPct(fuelPct), color: 'var(--orange)', pct: fuelPct },
              { label: 'תפעול', value: fmtPct(opPct), color: 'var(--red)', pct: opPct },
              { label: 'מרווח נקי', value: fmtPct(Math.abs(margin)), color: margin >= 0 ? 'var(--green)' : 'var(--red)', pct: Math.abs(margin) },
            ].map((r, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.value}</span>
                </div>
                <div className="progress-track" style={{ height: 4 }}>
                  <div className="progress-fill" style={{ width: `${Math.min(r.pct, 100)}%`, background: r.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '2px solid var(--text-1)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>
            דוח רווח והפסד — חודשי
          </span>
          <div style={{ display: 'flex', gap: 24 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>סכום</span>
            <span className="section-title" style={{ marginBottom: 0 }}>% מהכנסות</span>
          </div>
        </div>

        <GroupLabel>הכנסות ממכירות</GroupLabel>
        {[...d.clients].sort((a, b) => clientInvoice(b) - clientInvoice(a)).map((c, i) => (
          <PLRow key={i} label={c.name} value={clientInvoice(c)} pct={totalInvoice > 0 ? (clientInvoice(c) / totalInvoice) * 100 : 0} indent />
        ))}
        {fcRevenue > 0 && (
          <PLRow label="כרטיסי תדלוק לפי לקוח" value={fcRevenue} pct={totalInvoice > 0 ? (fcRevenue / totalInvoice) * 100 : 0} indent />
        )}
        {addRevenue > 0 && (
          <PLRow label="תוספים ושירותים משלימים" value={addRevenue} pct={totalInvoice > 0 ? (addRevenue / totalInvoice) * 100 : 0} indent />
        )}
        <PLRow label='סה"כ הכנסות' value={totalInvoice} pct={100} bold subtotal color="var(--green)" />

        {(d.fuelPurchases || []).length > 0 && <>
          <GroupLabel>עלות המכר — רכישת דלקים</GroupLabel>
          {[...(d.fuelPurchases || [])].sort((a, b) => b.amount - a.amount).map((e, i) => (
            <PLRow key={i} label={e.name} value={e.amount} pct={totalInvoice > 0 ? (e.amount / totalInvoice) * 100 : 0} indent negative />
          ))}
          <PLRow label="עלות המכר" value={totalFuel} pct={fuelPct} bold subtotal negative color="var(--orange)" />
        </>}

        <PLRow
          label="רווח גולמי" value={grossProfit} pct={grossMargin} bold subtotal
          color={grossProfit >= 0 ? 'var(--green)' : 'var(--red)'}
        />

        <GroupLabel>הוצאות תפעוליות</GroupLabel>
        {[...d.operationalExpenses].sort((a, b) => b.amount - a.amount).map((e, i) => (
          <PLRow key={i} label={e.name} value={e.amount} pct={totalInvoice > 0 ? (e.amount / totalInvoice) * 100 : 0} indent negative />
        ))}
        <PLRow label="הוצאות תפעוליות" value={totalOpEx} pct={opPct} bold subtotal negative color="var(--red)" />

        <PLRow
          label="רווח תפעולי" value={opProfit} pct={opMargin} bold subtotal
          color={opProfit >= 0 ? 'var(--green)' : 'var(--red)'}
        />

        <GroupLabel>הוצאות הנהלה — שכר</GroupLabel>
        {d.salaries.map((s, i) => (
          <PLRow key={i} label={s.name} value={s.amount} pct={totalInvoice > 0 ? (s.amount / totalInvoice) * 100 : 0} indent negative />
        ))}
        <PLRow label="הוצאות שכר" value={totalSal} pct={salPct} bold subtotal negative color="var(--purple)" />

        <div style={{ marginTop: 8 }}>
          <PLRow
            label="רווח נקי" value={netProfit} pct={margin} bold total
            color={netProfit >= 0 ? 'var(--green)' : 'var(--red)'}
          />
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
          תחזית שנתית: {fmt(netProfit * 12)} · {fmtL(totalLiters)} חודשי
        </p>
      </Card>

      {/* 2-column: Revenue by client + Expense split */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Card>
          <SectionTitle>הכנסות לפי לקוח</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={d.clients.map(c => ({ ...c, profit: clientProfit(c) }))} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-3)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={tickK} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="profit" name="הכנסות ₪" radius={[5, 5, 0, 0]}>
                {d.clients.map((_, i) => <Cell key={i} fill={CLIENT_COLORS[i % CLIENT_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle>הרכב הוצאות</SectionTitle>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie
                data={expTypePie} cx="50%" cy="50%"
                innerRadius={40} outerRadius={65}
                dataKey="value" paddingAngle={4}
                labelLine={false} label={pctLbl}
              >
                {expTypePie.map((_, i) => <Cell key={i} fill={EXP_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} />
              <Legend iconType="circle" iconSize={7} formatter={v => <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            {expTypePie.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{r.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: EXP_COLORS[i] }}>{fmt(r.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 2-column: Top expenses + Key ratios */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionTitle>5 הוצאות הגדולות ביותר</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {top5op.map((item, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>{item.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? 'var(--red)' : 'var(--text-2)' }}>{fmt(item.amount)}</span>
                </div>
                <GaugeBar value={item.amount} max={top5op[0].amount} color={i === 0 ? 'var(--red)' : 'var(--border-2)'} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>מדדים פיננסיים מרכזיים</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { label: 'שיעור רווח גולמי',         value: fmtPct(margin),                  color: margin >= 10 ? 'var(--green)' : '#f59e0b' },
              { label: 'יחס עלויות להכנסות',        value: fmtPct(costRatio),               color: costRatio < 90 ? 'var(--green)' : 'var(--red)' },
              { label: 'שכר כ-% מהכנסות',           value: fmtPct(salPct),                  color: 'var(--text-2)' },
              { label: 'הוצאות תפעול כ-%',          value: fmtPct(opPct),                   color: 'var(--text-2)' },
              { label: 'רכישת דלקים כ-%',           value: fmtPct(fuelPct),                 color: 'var(--orange)' },
              { label: 'מחיר מכירה ממוצע לליטר',   value: avgWeightedSale > 0 ? `₪${avgWeightedSale.toFixed(3)}` : '—', color: '#0891b2' },
              { label: 'מחיר קניה ממוצע לליטר',    value: avgWeightedBuy  > 0 ? `₪${avgWeightedBuy.toFixed(3)}`  : '—', color: 'var(--red)' },
              { label: 'מרווח שיווק (מכירה−קניה)', value: avgWeightedSale > 0 ? `₪${marketingMargin.toFixed(3)}` : '—', color: '#0891b2' },
              { label: 'לקוח מוביל',               value: topClient?.name || '—',           color: 'var(--text-1)' },
              { label: 'הוצאה גדולה ביותר',         value: topExpense?.name || '—',          color: 'var(--red)' },
              { label: 'שכר ממוצע לעובד',           value: fmt(Math.round(totalSal / (d.salaries.length || 1))), color: 'var(--text-2)' },
              { label: 'רווח שנתי (תחזית)',          value: fmt(netProfit * 12),              color: netProfit >= 0 ? 'var(--green)' : 'var(--red)' },
            ].map((r, i, arr) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '7px 2px',
                borderBottom: i < arr.length - 1 ? '1px solid var(--surface-2)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 6-month projection */}
      <Card>
        <SectionTitle>תחזית 6 חודשים (יולי–דצמבר 2026)</SectionTitle>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={projection} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={tickK} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={v => <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{v}</span>} />
            <ReferenceLine y={0} stroke="var(--border)" />
            <Line type="monotone" dataKey="הכנסות" stroke="var(--green)"  strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="הוצאות" stroke="var(--red)"    strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="רווח"    stroke="#0891b2"       strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Monthly growth/deficit */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <SectionTitle style={{ marginBottom: 0 }}>קצב גידול / גירעון — 2026</SectionTitle>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--text-3)' }}>
            {[
              { color: 'var(--green)', label: 'רווח בפועל' },
              { color: '#86efac',      label: 'תחזית' },
              { color: '#fca5a5',      label: 'גירעון' },
              { color: 'var(--surface-3)', label: 'אין נתונים' },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={monthlyGrowth} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-3)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickFormatter={tickK} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v, name) => v == null ? ['אין נתונים', name] : [fmt(v), 'רווח / גירעון']}
              labelFormatter={l => l}
              contentStyle={{ direction: 'rtl', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
            />
            <ReferenceLine y={0} stroke="var(--border-2)" strokeWidth={1.5} />
            <Bar dataKey="רווח" radius={[4, 4, 0, 0]}>
              {monthlyGrowth.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.רווח == null ? 'var(--surface-3)' :
                    entry.type === 'current' ? (entry.רווח >= 0 ? 'var(--green)' : 'var(--red)') :
                    entry.רווח >= 0 ? '#86efac' : '#fca5a5'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
          ינואר–אפריל: אין נתונים · מאי: בפועל · יוני–דצמבר: תחזית (2.5% צמיחה חודשית)
        </p>
      </Card>

    </div>
  );
}
