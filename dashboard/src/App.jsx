import { useState, useEffect, useCallback } from 'react';
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
import PotentialClientsTab from './components/PotentialClientsTab';
import SettingsTab from './components/SettingsTab';

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
  potential: 'לקוחות פוטנציאלים',
  obligo:    'אובליגו ותנאי תשלום',
  orders:    'מערכת הזמנות',
  import:    'ייבוא / ייצוא',
  settings:  'הגדרות',
};

const dedupClients = arr =>
  arr.filter((c, i, a) => a.findIndex(x => (x.name || '').trim() === (c.name || '').trim()) === i);

const repairMonth = (parsed, defaults) => ({
  operationalExpenses: parsed.operationalExpenses?.length > 0 ? parsed.operationalExpenses : defaults.operationalExpenses,
  salaries:            parsed.salaries?.length > 0            ? parsed.salaries            : defaults.salaries,
  fuelPurchases:       Array.isArray(parsed.fuelPurchases)    ? parsed.fuelPurchases       : defaults.fuelPurchases,
  clients:             Array.isArray(parsed.clients)          ? dedupClients(parsed.clients) : defaults.clients,
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
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handle = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setSidebarOpen(false);
    };
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, []);

  const [workPlanData, setWorkPlanData] = useState(() => {
    try {
      const s = localStorage.getItem('workPlanData');
      if (!s) return null;
      const parsed = JSON.parse(s);
      const base   = repairMonth(parsed, DEFAULT_WORKPLAN);
      return {
        ...base,
        obligo:            parsed.obligo           || {},
        additiveTypes:     parsed.additiveTypes    || {},
        fuelCardCustomers: Array.isArray(parsed.fuelCardCustomers) ? parsed.fuelCardCustomers : [],
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

  const SERVER = (window.location.port === '5173' || window.location.port === '5174')
    ? `http://${window.location.hostname}:8000`
    : '';

  const saveToStorage = (data) => {
    const stamped = { ...data, lastModified: Date.now() };
    try { localStorage.setItem('workPlanData', JSON.stringify(stamped)); } catch {}
    fetch(`${SERVER}/api/workplan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stamped),
    }).catch(() => {});
  };

  // בטעינה: סנכרן עם שרת — אך רק אם נתוני השרת חדשים יותר מה-localStorage המקומי
  useEffect(() => {
    fetch(`${SERVER}/api/workplan`)
      .then(r => r.json())
      .then(data => {
        if (!data) {
          // שרת ריק — דחוף את ה-localStorage לשרת
          try {
            const ls = localStorage.getItem('workPlanData');
            if (ls) {
              fetch(`${SERVER}/api/workplan`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ls,
              }).catch(() => {});
            }
          } catch {}
          return;
        }
        setWorkPlanData(prev => {
          // אם יש נתונים מקומיים חדשים יותר — אל תדרוס אותם
          if (prev?.lastModified && data.lastModified && prev.lastModified > data.lastModified) {
            // הנתונים המקומיים חדשים יותר — דחוף אותם לשרת
            fetch(`${SERVER}/api/workplan`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(prev),
            }).catch(() => {});
            return prev;
          }
          const base = repairMonth(data, DEFAULT_WORKPLAN);
          const next = {
            ...base,
            obligo:            data.obligo            || {},
            additiveTypes:     (data.additiveTypes && Object.keys(data.additiveTypes).length > 0)
              ? data.additiveTypes  : (prev?.additiveTypes     || {}),
            fuelCardCustomers: (Array.isArray(data.fuelCardCustomers) && data.fuelCardCustomers.length > 0)
              ? data.fuelCardCustomers : (prev?.fuelCardCustomers || []),
            currentMonthId:    data.currentMonthId    || '2026-05',
            currentMonthLabel: data.currentMonthLabel || 'מאי 2026',
            monthHistory:      data.monthHistory      || {},
            lastModified:      data.lastModified,
          };
          try { localStorage.setItem('workPlanData', JSON.stringify(next)); } catch {}
          return next;
        });
      })
      .catch(() => {});
  }, []);

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
          ? dedupClients(next.clients)
          : base.clients,
        obligo:             next.obligo             != null ? next.obligo             : (base.obligo || {}),
        additiveTypes:      next.additiveTypes      != null ? next.additiveTypes      : (base.additiveTypes || {}),
        fuelCardCustomers:  Array.isArray(next.fuelCardCustomers) ? next.fuelCardCustomers : (base.fuelCardCustomers || []),
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
        clients:             Array.isArray(target.clients) ? dedupClients(target.clients) : [],
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

      {!isOrders && (
        <Sidebar
          tab={tab}
          onTab={t => setTab(t)}
          isMobile={isMobile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div style={{
        marginRight: isOrders || isMobile ? 0 : 'var(--sidebar-w)',
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
            background: 'rgba(255,255,255,0.80)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(160,174,220,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 28px',
            height: 56,
            position: 'sticky',
            top: 0,
            zIndex: 20,
            boxShadow: '0 1px 12px rgba(14,22,40,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isMobile && (
                <button
                  className="hamburger-btn"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="פתח תפריט"
                >☰</button>
              )}
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
          padding: isOrders ? 0 : isMobile ? '14px 12px' : '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: isOrders ? 0 : 18,
        }}>
          {tab === 'orders' && (() => {
            const ordersUrl = `${(window.location.port === '5173' || window.location.port === '5174') ? `http://${window.location.hostname}:8000` : ''}/dashboard`;
            if (isMobile) return (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', flex: 1, gap: 20, padding: 32,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 48 }}>📋</div>
                <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  מערכת ההזמנות מותאמת לחלון מלא.<br />לחץ כדי לפתוח אותה.
                </p>
                <a
                  href={ordersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ fontSize: 16, padding: '14px 32px', textDecoration: 'none' }}
                >
                  פתח מערכת הזמנות ↗
                </a>
              </div>
            );
            return (
              <iframe
                src={`${ordersUrl}?v=${Date.now()}`}
                style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
                title="מערכת ניהול — זאת הברכה דלקים"
              />
            );
          })()}
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
          {tab === 'potential' && (
            <PotentialClientsTab />
          )}
          {tab === 'settings' && (
            <SettingsTab />
          )}
        </main>
      </div>
    </div>
  );
}
