import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from 'recharts';

const PALETTE = [
  '#6366f1','#10b981','#f59e0b','#e53935',
  '#8b5cf6','#06b6d4','#ef4444','#84cc16',
];

const MONTH_NAMES = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יונ׳','יול׳','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

const Card = ({ title, children }) => (
  <div style={{
    background: 'rgba(255,255,255,0.78)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 18,
    padding: '20px 22px',
    border: '1px solid rgba(255,255,255,0.92)',
    boxShadow: '0 1px 4px rgba(14,22,40,0.05), 0 4px 18px rgba(99,102,241,0.07)',
  }}>
    <h3 style={{
      fontSize: 11, fontWeight: 800, color: '#8b98c2',
      letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 18,
    }}>{title}</h3>
    {children}
  </div>
);

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid rgba(160,174,220,0.3)',
      borderRadius: 10,
      padding: '10px 16px',
      boxShadow: '0 8px 24px rgba(14,22,40,0.12)',
      fontSize: 13,
      direction: 'rtl',
    }}>
      <p style={{ color: '#3b4a72', fontWeight: 600, marginBottom: 4 }}>{label}</p>
      <p style={{ color: '#6366f1', fontWeight: 800, fontSize: 15 }}>
        ₪{Number(payload[0].value).toLocaleString('he-IL')}
      </p>
    </div>
  );
};

export default function Charts({ expenses, large }) {
  if (!expenses.length) return null;

  // Category chart data
  const byCategory = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });
  const categoryData = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Monthly chart data
  const monthlyMap = {};
  expenses.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap[key] = (monthlyMap[key] || 0) + Number(e.amount);
  });
  const monthlyData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([key, value]) => ({
      name: MONTH_NAMES[Number(key.split('-')[1]) - 1],
      value,
    }));

  const maxVal = Math.max(...categoryData.map(d => d.value));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

      {/* Horizontal bar — categories */}
      <Card title="הוצאות לפי קטגוריה">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {categoryData.map((item, i) => (
            <div key={item.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#3b4a72', fontWeight: 600 }}>{item.name}</span>
                <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 700 }}>
                  ₪{item.value.toLocaleString('he-IL')}
                </span>
              </div>
              <div style={{
                height: 8, background: 'rgba(160,174,220,0.15)',
                borderRadius: 99, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${(item.value / maxVal) * 100}%`,
                  background: PALETTE[i % PALETTE.length],
                  borderRadius: 99,
                  transition: 'width 0.6s cubic-bezier(.4,0,.2,1)',
                }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Monthly bar chart */}
      <Card title="הוצאות לפי חודש">
        <ResponsiveContainer width="100%" height={large ? 220 : 185}>
          <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,174,220,0.2)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#8b98c2', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#8b98c2' }}
              tickFormatter={v => `₪${(v / 1000).toFixed(0)}k`}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 6 }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {monthlyData.map((_, i) => (
                <Cell
                  key={i}
                  fill={i === monthlyData.length - 1 ? '#6366f1' : 'rgba(99,102,241,0.3)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

    </div>
  );
}
