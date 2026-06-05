const NAV = [
  { id: 'workplan',  label: 'תמונת מצב',          icon: '⛽' },
  { id: 'expenses',  label: 'הוצאות',             icon: '📋' },
  { id: 'revenue',   label: 'הכנסות',             icon: '📈' },
  { id: 'customers', label: 'לקוחות והזמנות',     icon: '👥' },
  { id: 'obligo',    label: 'אובליגו',            icon: '💳' },
  { id: 'orders',    label: 'מערכת הזמנות',       icon: '🚛' },
  { id: 'import',    label: 'ייבוא/ייצוא',        icon: '⇅'  },
  { id: 'settings',  label: 'הגדרות',             icon: '⚙'  },
];

const DIVIDER_AFTER = new Set(['revenue', 'obligo']);

export default function Sidebar({ tab, onTab }) {
  return (
    <aside style={{
      width: 'var(--sidebar-w)',
      background: 'var(--sidebar-bg)',
      position: 'fixed', top: 0, right: 0, bottom: 0,
      zIndex: 30,
      display: 'flex', flexDirection: 'column',
      boxShadow: '-3px 0 16px rgba(0,0,0,0.18)',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 14px 14px',
        borderBottom: '1px solid var(--sidebar-divider)',
      }}>
        <div style={{
          borderRadius: 'var(--r-md)',
          overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.07)',
          padding: '8px 10px',
          minHeight: 58,
        }}>
          <img
            src="/לוגו חברה.jpeg"
            alt="זאת הברכה"
            style={{ maxHeight: 50, maxWidth: '100%', objectFit: 'contain' }}
          />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = tab === item.id;
          return (
            <div key={item.id}>
              <button
                className={`nav-item${active ? ' active' : ''}`}
                onClick={() => onTab(item.id)}
              >
                {active && (
                  <span style={{
                    position: 'absolute',
                    right: 0, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3, height: '55%',
                    background: 'var(--red)',
                    borderRadius: '3px 0 0 3px',
                  }} />
                )}
                <span style={{ fontSize: 15, width: 20, textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
              {DIVIDER_AFTER.has(item.id) && (
                <hr style={{ border: 'none', borderTop: '1px solid var(--sidebar-divider)', margin: '6px 4px' }} />
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid var(--sidebar-divider)',
        fontSize: 11,
        color: 'rgba(255,255,255,0.28)',
        letterSpacing: 0.4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 7,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
            boxShadow: '0 0 0 2px rgba(34,197,94,0.2)',
          }} />
          <span>זאת הברכה דלקים</span>
        </div>
        <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>v2.0</span>
      </div>
    </aside>
  );
}
