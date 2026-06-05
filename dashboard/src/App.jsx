import { useState } from 'react';
import { DEFAULT_WORKPLAN } from './defaultWorkPlan';
import { useExpenses } from './hooks/useExpenses';
import Sidebar from './components/Sidebar';
import LiveClock from './components/LiveClock';
import ImportExport from './components/ImportExport';
import WorkPlanDashboard from './components/WorkPlanDashboard';
import WorkPlanExpenses from './components/WorkPlanExpenses';
import WorkPlanRevenue from './components/WorkPlanRevenue';
import WorkPlanObligo from './components/WorkPlanObligo';
import CustomerOrdersTab from './components/CustomerOrdersTab';

const MIGRATION_V = 'workPlanMigration_v4';
if (!localStorage.getItem(MIGRATION_V)) {
  try {
    const saved = localStorage.getItem('workPlanData');
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.operationalExpenses = DEFAULT_WORKPLAN.operationalExpenses;
      parsed.fuelPurchases       = DEFAULT_WORKPLAN.fuelPurchases;
      parsed.clients             = DEFAULT_WORKPLAN.clients;
      localStorage.setItem('workPlanData', JSON.stringify(parsed));
    }
  } catch {}
  localStorage.setItem(MIGRATION_V, '1');
}

const PAGE_TITLES = {
  workplan:  'תמונת מצב',
  expenses:  'הוצאות',
  revenue:   'הכנסות',
  customers: 'לקוחות והזמנות',
  obligo:    'אובליגו ותנאי תשלום',
  orders:    'מערכת הזמנות',
  import:    'ייבוא / ייצוא',
  settings:  'הגדרות',
};

const repairMonth = (parsed, defaults) => ({
  operationalExpenses: parsed.operationalExpenses?.length > 0 ? parsed.operationalExpenses : defaults.operationalExpenses,
  salaries:            parsed.salaries?.length > 0            ? parsed.salaries            : defaults.salaries,
  fuelPurchases:       Array.isArray(parsed.fuelPurchases)    ? parsed.fuelPurchases       : defaults.fuelPurchases,
  clients:             Array.isArray(parsed.clients)          ? parsed.clients             : defaults.clients,
});

const getAllMonths = (data) => {
  if (!data) return [{ id: '2026-05', label: 'מאי 2026' }];
  const current  = { id: data.currentMonthId || '2026-05', label: data.currentMonthLabel || 'מאי 2026' };
  const historic = Object.entries(data.monthHistory || {})
    .filter(([id]) => id !== current.id)
    .map(([id, d]) => ({ id, label: d.label }));
  return [...historic, current].sort((a, b) => a.id.localeCompare(b.id));
};

export default function App() {
  const [tab, setTab] = useState('workplan');

  const [workPlanData, setWorkPlanData] = useState(() => {
    try {
      const s = localStorage.getItem('workPlanData');
      if (!s) return null;
      const parsed = JSON.parse(s);
      const base   = repairMonth(parsed, DEFAULT_WORKPLAN);
      return {
        ...base,
        obligo:            parsed.obligo           || {},
        currentMonthId:    parsed.currentMonthId   || '2026-05',
        currentMonthLabel: parsed.currentMonthLabel || 'מאי 2026',
        monthHistory:      parsed.monthHistory     || {},
      };
    } catch { return null; }
  });

  const [workPlanFileName, setWorkPlanFileName] = useState(() =>
    localStorage.getItem('workPlanFileName') || null
  );

  const { expenses, clearAllExpenses, importExpenses } = useExpenses();

  const saveToStorage = (data) => {
    try { localStorage.setItem('workPlanData', JSON.stringify(data)); } catch {}
  };

  const handleWorkPlanUpload = (data, fileName) => {
    setWorkPlanData(data);
    setWorkPlanFileName(fileName);
    saveToStorage(data);
    try { localStorage.setItem('workPlanFileName', fileName); } catch {}
  };

  const handleWorkPlanChange = (updater) =>
    setWorkPlanData(prev => {
      const base = prev ?? { ...DEFAULT_WORKPLAN, obligo: {}, currentMonthId: '2026-05', currentMonthLabel: 'מאי 2026', monthHistory: {} };
      const next = updater(base);
      const safe = {
        operationalExpenses: next.operationalExpenses?.length > 0 ? next.operationalExpenses : base.operationalExpenses,
        salaries:            next.salaries?.length > 0            ? next.salaries            : base.salaries,
        fuelPurchases:       Array.isArray(next.fuelPurchases)    ? next.fuelPurchases       : base.fuelPurchases,
        clients:             Array.isArray(next.clients)
          ? next.clients.filter((c, i, arr) => arr.findIndex(x => x.name === c.name) === i)
          : base.clients,
        obligo:        next.obligo        != null ? next.obligo        : (base.obligo || {}),
        additiveTypes: next.additiveTypes != null ? next.additiveTypes : (base.additiveTypes || {}),
        currentMonthId:    base.currentMonthId    || '2026-05',
        currentMonthLabel: base.currentMonthLabel || 'מאי 2026',
        monthHistory:      base.monthHistory      || {},
      };
      saveToStorage(safe);
      return safe;
    });

  const handleMonthSwitch = (monthId) => {
    setWorkPlanData(prev => {
      const base = prev || { ...DEFAULT_WORKPLAN, obligo: {}, currentMonthId: '2026-05', currentMonthLabel: 'מאי 2026', monthHistory: {} };
      if (base.currentMonthId === monthId) return base;
      const history = {
        ...(base.monthHistory || {}),
        [base.currentMonthId]: {
          label:               base.currentMonthLabel,
          operationalExpenses: base.operationalExpenses,
          salaries:            base.salaries,
          fuelPurchases:       base.fuelPurchases,
          clients:             base.clients,
        },
      };
      const target = history[monthId];
      if (!target) return base;
      const newState = {
        ...base,
        operationalExpenses: target.operationalExpenses,
        salaries:            target.salaries,
        fuelPurchases:       target.fuelPurchases || [],
        clients:             target.clients,
        currentMonthId:      monthId,
        currentMonthLabel:   target.label,
        monthHistory:        history,
      };
      saveToStorage(newState);
      return newState;
    });
  };

  const handleNewMonth = (monthId, monthLabel, copyExpenses) => {
    setWorkPlanData(prev => {
      const base = prev || { ...DEFAULT_WORKPLAN, obligo: {}, currentMonthId: '2026-05', currentMonthLabel: 'מאי 2026', monthHistory: {} };
      const history = {
        ...(base.monthHistory || {}),
        [base.currentMonthId]: {
          label:               base.currentMonthLabel,
          operationalExpenses: base.operationalExpenses,
          salaries:            base.salaries,
          fuelPurchases:       base.fuelPurchases,
          clients:             base.clients,
        },
      };
      const newState = {
        ...base,
        operationalExpenses: copyExpenses ? base.operationalExpenses : DEFAULT_WORKPLAN.operationalExpenses,
        salaries:            copyExpenses ? base.salaries            : DEFAULT_WORKPLAN.salaries,
        fuelPurchases:       [],
        clients:             [],
        currentMonthId:      monthId,
        currentMonthLabel:   monthLabel,
        monthHistory:        history,
      };
      saveToStorage(newState);
      return newState;
    });
  };

  const monthId    = workPlanData?.currentMonthId    || '2026-05';
  const monthLabel = workPlanData?.currentMonthLabel || 'מאי 2026';
  const allMonths  = getAllMonths(workPlanData);
  const isOrders   = tab === 'orders';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', direction: 'rtl' }}>

      {!isOrders && <Sidebar tab={tab} onTab={t => setTab(t)} />}

      <div style={{
        marginRight: isOrders ? 0 : 'var(--sidebar-w)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Back button for orders iframe */}
        {isOrders && (
          <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 1000 }}>
            <button
              className="btn btn-soft"
              onClick={() => setTab('workplan')}
            >
              ← חזרה
            </button>
          </div>
        )}

        {/* Header */}
        {!isOrders && (
          <header style={{
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            height: 56,
            position: 'sticky',
            top: 0,
            zIndex: 20,
            boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 4, height: 20, background: 'var(--red)',
                borderRadius: 2, flexShrink: 0,
              }} />
              <span style={{ fontWeight: 700, fontSize: 15.5, color: 'var(--text-1)', letterSpacing: -0.2 }}>
                {PAGE_TITLES[tab]}
              </span>
              {tab === 'workplan' && (
                <span style={{
                  background: 'var(--red-soft)',
                  color: 'var(--red)',
                  border: '1px solid var(--red-border)',
                  borderRadius: 'var(--r-sm)',
                  padding: '2px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  {monthLabel}
                </span>
              )}
            </div>
            <LiveClock />
          </header>
        )}

        {/* Main content */}
        <main style={{
          flex: 1,
          padding: isOrders ? 0 : '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: isOrders ? 0 : 18,
        }}>
          {tab === 'orders' && (
            <iframe
              src={`/dashboard?v=${Date.now()}`}
              style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
              title="מערכת ניהול — זאת הברכה דלקים"
            />
          )}
          {tab === 'workplan' && (
            <WorkPlanDashboard data={workPlanData} monthLabel={monthLabel} />
          )}
          {tab === 'expenses' && (
            <WorkPlanExpenses
              data={workPlanData} onChange={handleWorkPlanChange}
              monthId={monthId} monthLabel={monthLabel}
              allMonths={allMonths} onMonthSwitch={handleMonthSwitch} onNewMonth={handleNewMonth}
            />
          )}
          {tab === 'revenue' && (
            <WorkPlanRevenue
              data={workPlanData} onChange={handleWorkPlanChange}
              monthId={monthId} monthLabel={monthLabel}
              allMonths={allMonths} onMonthSwitch={handleMonthSwitch} onNewMonth={handleNewMonth}
            />
          )}
          {tab === 'customers' && (
            <CustomerOrdersTab onChange={handleWorkPlanChange} workPlanData={workPlanData} />
          )}
          {tab === 'obligo' && (
            <WorkPlanObligo data={workPlanData} onChange={handleWorkPlanChange} monthId={monthId} />
          )}
          {tab === 'import' && (
            <ImportExport
              expenses={expenses}
              onImport={importExpenses}
              onClearAll={clearAllExpenses}
              onWorkPlanUpload={handleWorkPlanUpload}
              workPlanFileName={workPlanFileName}
            />
          )}
          {tab === 'settings' && (
            <div className="card card-pad" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚙️</div>
              <p style={{ color: 'var(--text-3)', fontSize: 14 }}>הגדרות בפיתוח</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
