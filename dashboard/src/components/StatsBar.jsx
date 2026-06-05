const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

function StatCard({ value, label }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      padding: '22px 16px', textAlign: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      border: '1px solid #e9ecef',
    }}>
      <p style={{ fontSize: 34, fontWeight: 300, color: '#cc0000', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginBottom: 8 }}>{value}</p>
      <p style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>{label}</p>
    </div>
  );
}

export default function StatsBar({ expenses, budgets }) {
  const now = new Date();
  const m = now.getMonth(), y = now.getFullYear();

  const total     = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const thisMonth = expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === m && d.getFullYear() === y; }).reduce((s, e) => s + Number(e.amount), 0);
  const pm = m === 0 ? 11 : m - 1, py = m === 0 ? y - 1 : y;
  const prevMonth = expenses.filter(e => { const d = new Date(e.date); return d.getMonth() === pm && d.getFullYear() === py; }).reduce((s, e) => s + Number(e.amount), 0);
  const totalBudget = Object.values(budgets).reduce((s, v) => s + Number(v), 0);
  const budgetPct   = totalBudget ? Math.round(thisMonth / totalBudget * 100) : null;
  const fmt = n => `₪${Math.round(n).toLocaleString('he-IL')}`;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14 }}>
      <StatCard value={expenses.length}                             label="סה״כ רשומות"   />
      <StatCard value={fmt(total)}                                  label="סה״כ הוצאות"   />
      <StatCard value={fmt(thisMonth)}                              label={MONTH_NAMES[m]}  />
      <StatCard value={fmt(prevMonth)}                              label={MONTH_NAMES[pm]} />
      <StatCard value={budgetPct !== null ? `${budgetPct}%` : '—'} label="ניצול תקציב"   />
    </div>
  );
}
