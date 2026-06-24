import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, AreaChart, Area, BarChart, Bar,
} from 'recharts';

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#e53935',
  '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16',
  '#ec4899', '#14b8a6',
];

const MONTH_NAMES = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יונ׳','יול׳','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

const Card = ({ title, children }) => (
  <div style={{
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 18,
    padding: '18px 20px',
    border: '1px solid rgba(255,255,255,0.92)',
    boxShadow: '0 1px 4px rgba(14,22,40,0.05), 0 4px 18px rgba(99,102,241,0.07)',
  }}>
    <h3 style={{
      fontSize: 11, fontWeight: 800, color: '#8b98c2',
      letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 16,
    }}>{title}</h3>
    {children}
  </div>
);

const PieTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div style={{
      background: 'rgba(255,255,255,0.97)',
      border: '1px solid rgba(160,174,220,0.25)',
      borderRadius: 10,
      padding: '9px 14px',
      boxShadow: '0 8px 24px rgba(14,22,40,0.12)',
      fontSize: 13,
    }}>
      <p style={{ fontWeight: 700, color: '#0e1628', marginBottom: 2 }}>{name}</p>
      <p style={{ color: '#6366f1', fontWeight: 800 }}>₪{Number(value).toLocaleString('he-IL')}</p>
    </div>
  );
};

const AreaTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.97)',
      border: '1px solid rgba(160,174,220,0.25)',
      borderRadius: 10,
      padding: '9px 14px',
      boxShadow: '0 8px 24px rgba(14,22,40,0.12)',
      fontSize: 13,
    }}>
      <p style={{ color: '#8b98c2', fontSize: 11, marginBottom: 3 }}>{label}</p>
      <p style={{ color: '#6366f1', fontWeight: 800 }}>₪{Number(payload[0].value).toLocaleString('he-IL')}</p>
    </div>
  );
};

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.52;
  return (
    <text
      x={cx + r * Math.cos(-midAngle * R)}
      y={cy + r * Math.sin(-midAngle * R)}
      fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={700}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Charts({ expenses, large }) {
  if (!expenses.length) return null;

  const byCategory = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
  const pieData = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const monthlyMap = {};
  expenses.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = (monthlyMap[key] || 0) + Number(e.amount);
  });
  const areaData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, value]) => ({
      name: `${MONTH_NAMES[Number(key.split('-')[1]) - 1]} ${key.slice(2, 4)}`,
      value,
    }));

  const h = large ? 230 : 190;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

      {/* Pie — diverse colors + cleaner legend */}
      <Card title="הוצאות לפי קטגוריה">
        <ResponsiveContainer width="100%" height={h}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%" cy="50%"
              innerRadius={55} outerRadius={90}
              dataKey="value"
              paddingAngle={3}
              labelLine={false}
              label={renderCustomLabel}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTip />} />
            <Legend
              iconType="circle"
              iconSize={9}
              formatter={v => (
                <span style={{ fontSize: 12, color: '#3b4a72', fontWeight: 500 }}>{v}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      {/* Bar — easier to compare month-to-month than an area */}
      <Card title="הוצאות לפי חודש">
        <ResponsiveContainer width="100%" height={h}>
          <BarChart data={areaData} margin={{ top: 5, right: 5, left: 10, bottom: 42 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,174,220,0.18)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#8b98c2' }}
              angle={-38}
              textAnchor="end"
              interval={0}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#8b98c2' }}
              tickFormatter={v => `₪${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
              width={42}
            />
            <Tooltip content={<AreaTip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
            <Bar dataKey="value" name="סכום" radius={[6, 6, 0, 0]}>
              {areaData.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === areaData.length - 1 ? '#6366f1' : 'rgba(99,102,241,0.35)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

    </div>
  );
}
