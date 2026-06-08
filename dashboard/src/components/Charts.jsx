import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts';

const REDS = ['#cc0000','#e62020','#ff5555','#990000','#ff7070','#b30000','#ff3333','#ff8080','#8b0000'];
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
    <h3 style={{ fontSize: 10.5, fontWeight: 800, color: '#8b98c2', letterSpacing: '0.9px', textTransform: 'uppercase', marginBottom: 14 }}>{title}</h3>
    {children}
  </div>
);

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(255,255,255,0.95)',
      borderRadius: 10,
      padding: '8px 14px',
      boxShadow: '0 8px 24px rgba(14,22,40,0.14)',
      fontSize: 13,
      backdropFilter: 'blur(12px)',
    }}>
      <p style={{ fontWeight: 700, color: '#e53935' }}>₪{Number(payload[0].value).toLocaleString('he-IL')}</p>
    </div>
  );
};

const pctLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null;
  const R = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text x={cx + r * Math.cos(-midAngle * R)} y={cy + r * Math.sin(-midAngle * R)}
      fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export default function Charts({ expenses, large }) {
  if (!expenses.length) return null;

  const byCategory = {};
  expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
  const pieData = Object.entries(byCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const monthlyMap = {};
  expenses.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    monthlyMap[key] = (monthlyMap[key] || 0) + Number(e.amount);
  });
  const areaData = Object.entries(monthlyMap).sort(([a],[b]) => a.localeCompare(b)).slice(-12)
    .map(([key, value]) => ({ name: `${MONTH_NAMES[Number(key.split('-')[1])-1]} ${key.slice(2,4)}`, value }));

  const h = large ? 220 : 180;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <Card title="הוצאות לפי קטגוריה">
        <ResponsiveContainer width="100%" height={h}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={95} dataKey="value" paddingAngle={3} labelLine={false} label={pctLabel}>
              {pieData.map((_, i) => <Cell key={i} fill={REDS[i % REDS.length]} />)}
            </Pie>
            <Tooltip content={<Tip />} />
            <Legend iconType="circle" iconSize={8} formatter={v => <span style={{ fontSize: 12, color: '#6b7280' }}>{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      </Card>

      <Card title="מגמת הוצאות חודשית">
        <ResponsiveContainer width="100%" height={h}>
          <AreaChart data={areaData} margin={{ top: 5, right: 5, left: 10, bottom: 45 }}>
            <defs>
              <linearGradient id="redArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#e53935" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#e53935" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(160,174,220,0.15)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8b98c2' }} angle={-40} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#8b98c2' }} tickFormatter={v => `₪${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="value" stroke="#e53935" strokeWidth={2.5} fill="url(#redArea)"
              dot={{ fill: '#e53935', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#b71c1c' }} name="סכום" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
