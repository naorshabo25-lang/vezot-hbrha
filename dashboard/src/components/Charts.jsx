import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from 'recharts';

const REDS = ['#cc0000','#e62020','#ff5555','#990000','#ff7070','#b30000','#ff3333','#ff8080','#8b0000'];
const MONTH_NAMES = ['ינו׳','פבר׳','מרץ','אפר׳','מאי','יונ׳','יול׳','אוג׳','ספט׳','אוק׳','נוב׳','דצמ׳'];

const Card = ({ title, children }) => (
  <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 20 }}>{title}</h3>
    {children}
  </div>
);

const Tip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }}>
      <p style={{ fontWeight: 700, color: '#cc0000' }}>₪{Number(payload[0].value).toLocaleString('he-IL')}</p>
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

  const h = large ? 300 : 240;

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
                <stop offset="5%"  stopColor="#cc0000" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#cc0000" stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-40} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={v => `₪${(v/1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <Tooltip content={<Tip />} />
            <Area type="monotone" dataKey="value" stroke="#cc0000" strokeWidth={2.5} fill="url(#redArea)"
              dot={{ fill: '#cc0000', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#8b0000' }} name="סכום" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
