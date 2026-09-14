import { useState, useEffect, useRef } from 'react';

const fmt = n => {
  if (n == null) return '—';
  const abs = Math.abs(n);
  const s = abs >= 1_000_000
    ? (abs / 1_000_000).toFixed(2).replace(/\.?0+$/, '') + 'M'
    : abs >= 1_000
    ? (abs / 1_000).toFixed(1).replace(/\.?0+$/, '') + 'K'
    : abs.toLocaleString('he-IL', { maximumFractionDigits: 0 });
  return (n < 0 ? '-' : '') + '₪' + s;
};
const fmtFull = n =>
  n == null ? '—' : '₪' + Math.abs(n).toLocaleString('he-IL', { maximumFractionDigits: 0 });

const EXPENSE_TYPES = ['opex', 'salary', 'cogs', 'finance'];
const EXPENSE_COLORS = {
  cogs:    { bg: '#fee2e2', text: '#b91c1c', bar: '#ef4444' },
  salary:  { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' },
  opex:    { bg: '#ede9fe', text: '#5b21b6', bar: '#8b5cf6' },
  finance: { bg: '#e0f2fe', text: '#0c4a6e', bar: '#0ea5e9' },
};
const TYPE_LABEL = {
  cogs: 'עלות המכר', salary: 'שכר', opex: 'הוצאות תפעוליות', finance: 'מימון',
};

export default function HashavshevotTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError]     = useState('');
  const [uploadedAt, setUploadedAt] = useState('');
  const [period, setPeriod]   = useState('');
  const [activeSection, setActiveSection] = useState('summary');
  const [debugInfo, setDebugInfo] = useState(null);
  const fileRef = useRef();

  const SERVER = (window.location.port === '5173' || window.location.port === '5174')
    ? `http://${window.location.hostname}:8000` : '';

  const loadLatest = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${SERVER}/api/hashavshevet/latest`);
      const json = await r.json();
      if (json && json.data) {
        setData(json.data.groups || {});
        setPeriod(json.data.period || '');
        setUploadedAt(json.uploaded_at || '');
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadLatest(); }, []);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await fetch(`${SERVER}/api/hashavshevet/upload`, { method: 'POST', body: form });
      const json = await r.json();
      if (json.error) { setError(json.error); setUploading(false); return; }
      if (json._debug) setDebugInfo(json._debug);
      const grps = json.groups || {};
      const hasData = Object.keys(grps).length > 0;
      if (!hasData) {
        setError(`הקובץ עלה אבל לא נמצאו נתונים. שורה ראשונה: ${json._debug?.first_rows?.[0] || '?'}`);
      }
      setData(grps);
      setPeriod(json.period || '');
      setUploadedAt(new Date().toLocaleString('he-IL'));
    } catch (ex) { setError(String(ex)); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ── Derived numbers ──────────────────────────────────────────────────────
  const groups = data || {};

  const sumGroups = (...codes) =>
    codes.reduce((s, c) => s + Math.abs((groups[c] || {}).total_net || 0), 0);

  const revenue   = sumGroups('100');
  const cogs      = sumGroups('304');
  const grossProfit = revenue - cogs;
  const opex      = sumGroups('300', '301', '305', '306', '307', '390');
  const salary    = sumGroups('302', '391');
  const finance   = sumGroups('309');
  const totalExp  = cogs + opex + salary + finance;
  const netProfit = revenue - totalExp;
  const margin    = revenue > 0 ? (netProfit / revenue * 100).toFixed(1) : 0;

  const receivableGroups = ['500', '501', '509'];
  const totalReceivable = receivableGroups.reduce((s, c) => {
    const g = groups[c] || {};
    return s + Math.abs(g.total_net || 0);
  }, 0);

  const totalPayable = Math.abs((groups['600'] || {}).total_net || 0);

  // Cash = banks + registers
  const bankNet = ['700', '701', '702', '720', '750', '760'].reduce((s, c) => {
    const g = groups[c];
    if (!g) return s;
    // credit balance = we owe, debit = we have
    return s + (g.total_net || 0);
  }, 0);

  // ── Expense breakdown for chart ──────────────────────────────────────────
  const expenseItems = [
    { label: 'עלות הדלקים',      amount: cogs,    type: 'cogs'    },
    { label: 'שכר',              amount: salary,  type: 'salary'  },
    { label: 'הוצאות תפעוליות', amount: opex,    type: 'opex'    },
    { label: 'מימון',            amount: finance, type: 'finance' },
  ].filter(x => x.amount > 0).sort((a, b) => b.amount - a.amount);

  // Revenue breakdown
  const revenueAccounts = (groups['100'] || {}).accounts || [];

  // Top customers (positive net = they owe us)
  const allCustomerAccounts = receivableGroups.flatMap(c => (groups[c] || {}).accounts || []);
  const topCustomers = allCustomerAccounts
    .map(a => ({ ...a, balance: a.debit - a.credit }))
    .filter(a => a.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 25);

  // Top suppliers (negative net = we owe them)
  const allSupplierAccounts = (groups['600'] || {}).accounts || [];
  const topSuppliers = allSupplierAccounts
    .map(a => ({ ...a, balance: a.credit - a.debit }))
    .filter(a => a.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 25);

  const kpiColor = (val, positiveGood = true) => {
    if (val > 0) return positiveGood ? '#15803d' : '#b91c1c';
    if (val < 0) return positiveGood ? '#b91c1c' : '#15803d';
    return '#64748b';
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const NAV = [
    { id: 'summary',   label: 'סיכום' },
    { id: 'revenue',   label: 'הכנסות' },
    { id: 'expenses',  label: 'הוצאות' },
    { id: 'customers', label: 'לקוחות — חובות' },
    { id: 'suppliers', label: 'ספקים — חובות' },
  ];

  return (
    <div style={{ direction: 'rtl', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3em', fontWeight: 800 }}>📊 דוחות כספיים — חשבשבת</h2>
          {period && <div style={{ fontSize: '0.8em', color: '#64748b', marginTop: 2 }}>{period}</div>}
          {uploadedAt && <div style={{ fontSize: '0.75em', color: '#94a3b8' }}>עודכן: {uploadedAt}</div>}
        </div>
        <div style={{ marginRight: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <button
            onClick={() => { if (!uploading && fileRef.current) fileRef.current.click(); }}
            disabled={uploading}
            style={{
              cursor: uploading ? 'not-allowed' : 'pointer',
              background: '#1e40af', color: '#fff',
              padding: '9px 20px', borderRadius: 8, fontWeight: 700,
              fontSize: '0.88em', border: 'none',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? '⏳ מעלה...' : '📁 העלה קובץ Excel מחשבשבת'}
          </button>
          <input type="file" accept=".xlsx,.xls,.xlsb,.csv" ref={fileRef}
            onChange={handleUpload} style={{ display: 'none' }} />
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '10px 16px', marginBottom: 8, color: '#b91c1c', fontSize: '0.88em' }}>
          ❌ {error}
        </div>
      )}
      {debugInfo && (
        <details style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8,
          padding: '8px 14px', marginBottom: 16, fontSize: '0.78em', color: '#475569' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>🔍 מידע אבחון הקובץ</summary>
          <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left' }}>
{`שורת כותרת: ${debugInfo.header_row}
עמודות: ${JSON.stringify(debugInfo.cols)}
קבוצות שנמצאו: ${debugInfo.groups_found?.join(', ') || 'אין'}
שורות נתונים: ${debugInfo.total_data_rows}
5 שורות ראשונות:
${debugInfo.first_rows?.slice(0,5).join('\n')}`}
          </pre>
        </details>
      )}

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>טוען...</div>
      )}

      {!loading && !data && (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
          <p>העלה קובץ מאזן בוחן מחשבשבת כדי לראות את התמונה הפיננסית</p>
          <p style={{ fontSize: '0.85em', marginTop: 8 }}>
            בחשבשבת: דוחות ← מאזן בוחן ← יצוא לאקסל
          </p>
        </div>
      )}

      {data && (
        <>
          {/* ── Sub-nav ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setActiveSection(n.id)}
                style={{
                  padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', fontWeight: 600, fontSize: '0.88em',
                  background: activeSection === n.id ? 'var(--accent)' : 'var(--surface-2)',
                  color: activeSection === n.id ? '#fff' : 'var(--text-2)',
                  transition: 'all 0.15s',
                }}>
                {n.label}
              </button>
            ))}
          </div>

          {/* ── Summary ── */}
          {activeSection === 'summary' && (
            <div>
              {/* KPI cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'הכנסות',      val: revenue,     good: true,  color: '#1d4ed8', bg: '#eff6ff' },
                  { label: 'עלות המכר',   val: -cogs,       good: false, color: '#b45309', bg: '#fffbeb' },
                  { label: 'רווח גולמי',  val: grossProfit, good: true,  color: grossProfit > 0 ? '#15803d' : '#b91c1c', bg: grossProfit > 0 ? '#f0fdf4' : '#fef2f2' },
                  { label: 'הוצאות',      val: -totalExp,   good: false, color: '#7c3aed', bg: '#f5f3ff' },
                  { label: 'רווח נקי',   val: netProfit,   good: true,  color: netProfit > 0 ? '#15803d' : '#b91c1c',  bg: netProfit > 0 ? '#f0fdf4' : '#fef2f2' },
                  { label: 'מרווח נקי',  val: null, display: `${margin}%`, color: parseFloat(margin) > 10 ? '#15803d' : '#b91c1c', bg: '#f8fafc' },
                ].map(k => (
                  <div key={k.label} style={{
                    background: k.bg || 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10, padding: '14px 16px',
                  }}>
                    <div style={{ fontSize: '0.75em', color: '#64748b', fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
                    <div style={{ fontSize: '1.3em', fontWeight: 800, color: k.color }}>
                      {k.display ?? fmt(k.val)}
                    </div>
                    {k.val != null && <div style={{ fontSize: '0.78em', color: '#94a3b8', marginTop: 2 }}>{fmtFull(k.val)}</div>}
                  </div>
                ))}
              </div>

              {/* Receivables + Payables */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.8em', color: '#64748b', fontWeight: 600 }}>חובות לקוחות (גביה)</div>
                  <div style={{ fontSize: '1.4em', fontWeight: 800, color: '#15803d', marginTop: 4 }}>{fmt(totalReceivable)}</div>
                  <div style={{ fontSize: '0.78em', color: '#94a3b8' }}>{fmtFull(totalReceivable)}</div>
                </div>
                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ fontSize: '0.8em', color: '#64748b', fontWeight: 600 }}>חובות לספקים (תשלום)</div>
                  <div style={{ fontSize: '1.4em', fontWeight: 800, color: '#b91c1c', marginTop: 4 }}>{fmt(totalPayable)}</div>
                  <div style={{ fontSize: '0.78em', color: '#94a3b8' }}>{fmtFull(totalPayable)}</div>
                </div>
              </div>

              {/* Expense breakdown horizontal bars */}
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '0.95em', fontWeight: 700 }}>פירוט הוצאות</h3>
                {expenseItems.map(item => {
                  const pct = totalExp > 0 ? (item.amount / totalExp * 100) : 0;
                  const c = EXPENSE_COLORS[item.type] || EXPENSE_COLORS.opex;
                  return (
                    <div key={item.label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: '0.85em', fontWeight: 600 }}>{item.label}</span>
                        <span style={{ fontSize: '0.85em', color: c.text, fontWeight: 700 }}>{fmt(item.amount)} ({pct.toFixed(1)}%)</span>
                      </div>
                      <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: c.bar, borderRadius: 4, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Revenue ── */}
          {activeSection === 'revenue' && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.95em', fontWeight: 700 }}>הכנסות לפי קטגוריה</h3>
                <span style={{ fontSize: '0.85em', fontWeight: 700, color: '#1d4ed8' }}>סה"כ: {fmt(revenue)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88em' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-3,#f8fafc)', fontSize: '0.82em', color: '#64748b' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'right' }}>שם חשבון</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left' }}>סכום</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueAccounts.sort((a, b) => Math.abs(b.credit) - Math.abs(a.credit)).map((a, i) => {
                    const amt = Math.abs(a.credit || a.net || 0);
                    const pct = revenue > 0 ? (amt / revenue * 100).toFixed(1) : 0;
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 14px' }}>{a.name}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 700, color: '#1d4ed8' }}>{fmtFull(amt)}</td>
                        <td style={{ padding: '8px 14px', textAlign: 'left', color: '#64748b' }}>{pct}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Expenses ── */}
          {activeSection === 'expenses' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { type: 'cogs',    codes: ['304'],                    label: 'עלות המכר' },
                { type: 'salary',  codes: ['302', '391'],             label: 'שכר' },
                { type: 'opex',    codes: ['300','301','305','306','307','390'], label: 'הוצאות תפעוליות' },
                { type: 'finance', codes: ['309'],                    label: 'הוצאות מימון' },
              ].map(section => {
                const accounts = section.codes.flatMap(c => (groups[c] || {}).accounts || []);
                const total = section.codes.reduce((s, c) => s + Math.abs((groups[c] || {}).total_net || 0), 0);
                const c = EXPENSE_COLORS[section.type];
                return (
                  <div key={section.type} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', background: c.bg, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: c.text, fontSize: '0.92em' }}>{section.label}</span>
                      <span style={{ fontWeight: 800, color: c.text }}>{fmt(total)}</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                      <tbody>
                        {accounts.sort((a, b) => Math.abs(b.debit) - Math.abs(a.debit)).map((a, i) => {
                          const amt = Math.abs(a.debit || a.net || 0);
                          return (
                            <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ padding: '7px 14px' }}>{a.name}</td>
                              <td style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 600 }}>{fmtFull(amt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Customers ── */}
          {activeSection === 'customers' && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '0.95em', fontWeight: 700 }}>חובות לקוחות — גביה פתוחה</h3>
                <span style={{ fontWeight: 700, color: '#15803d' }}>סה"כ: {fmt(totalReceivable)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86em' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-3,#f8fafc)', fontSize: '0.8em', color: '#64748b' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'right' }}>#</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right' }}>שם לקוח</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left' }}>חוב פתוח</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((a, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-3,#f8fafc)' }}>
                      <td style={{ padding: '7px 14px', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '7px 14px', fontWeight: 600 }}>{a.name}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 700, color: '#15803d' }}>{fmtFull(a.balance)}</td>
                    </tr>
                  ))}
                  {topCustomers.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>אין נתונים</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Suppliers ── */}
          {activeSection === 'suppliers' && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: '0.95em', fontWeight: 700 }}>חובות לספקים — לתשלום</h3>
                <span style={{ fontWeight: 700, color: '#b91c1c' }}>סה"כ: {fmt(totalPayable)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86em' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-3,#f8fafc)', fontSize: '0.8em', color: '#64748b' }}>
                    <th style={{ padding: '8px 14px', textAlign: 'right' }}>#</th>
                    <th style={{ padding: '8px 14px', textAlign: 'right' }}>שם ספק</th>
                    <th style={{ padding: '8px 14px', textAlign: 'left' }}>חוב לתשלום</th>
                  </tr>
                </thead>
                <tbody>
                  {topSuppliers.map((a, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-3,#f8fafc)' }}>
                      <td style={{ padding: '7px 14px', color: '#94a3b8' }}>{i + 1}</td>
                      <td style={{ padding: '7px 14px', fontWeight: 600 }}>{a.name}</td>
                      <td style={{ padding: '7px 14px', textAlign: 'left', fontWeight: 700, color: '#b91c1c' }}>{fmtFull(a.balance)}</td>
                    </tr>
                  ))}
                  {topSuppliers.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>אין נתונים</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
