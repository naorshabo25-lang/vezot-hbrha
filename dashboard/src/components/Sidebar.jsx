import LiveClock from './LiveClock';

const NAV = [
  { id: 'workplan',   label: 'תמונת מצב',          icon: '⛽' },
  { id: 'expenses',   label: 'הוצאות',             icon: '📋' },
  { id: 'revenue',    label: 'הכנסות',             icon: '📈' },
  { id: 'customers',  label: 'לקוחות והזמנות',     icon: '👥' },
  { id: 'potential',  label: 'לקוחות פוטנציאלים',  icon: '🎯' },
  { id: 'obligo',     label: 'אובליגו',            icon: '💳' },
  { id: 'fleet',      label: 'צי מכליות',          icon: '🛢️' },
  { id: 'orders',     label: 'מערכת הזמנות',       icon: '🚛' },
  { id: 'import',     label: 'ייבוא/ייצוא',        icon: '⇅'  },
  { id: 'settings',   label: 'הגדרות',             icon: '⚙'  },
];

export default function Sidebar({ tab, onTab }) {
  return (
    <header style={{
      position: 'fixed',
      top: 0, right: 0, left: 0,
      height: 52,
      background: '#070d1c',
      display: 'flex',
      alignItems: 'center',
      zIndex: 30,
      boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
    }}>
      {/* Logo */}
      <div style={{
        padding: '0 16px',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <img
          src="/לוגו חברה.jpeg"
          alt="זאת הברכה"
          style={{ height: 36, objectFit: 'contain', borderRadius: 6 }}
        />
      </div>

      {/* Nav items */}
      <nav style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        height: '100%',
        padding: '0 6px',
        gap: 2,
        scrollbarWidth: 'none',
      }}>
        {NAV.map(item => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 13px',
                height: 36,
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontSize: 13,
                fontWeight: active ? 700 : 500,
                fontFamily: 'inherit',
                background: active ? 'rgba(229,57,53,0.18)' : 'transparent',
                color: active ? '#ff8a80' : '#556080',
                transition: 'all 0.15s',
                position: 'relative',
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#a8b8d8'; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#556080'; }}}
            >
              {active && (
                <span style={{
                  position: 'absolute',
                  bottom: 0, right: '12%', left: '12%',
                  height: 2.5,
                  background: '#e53935',
                  borderRadius: '3px 3px 0 0',
                }} />
              )}
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Clock + status */}
      <div style={{
        padding: '0 16px',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <LiveClock dark />
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#22c55e',
          boxShadow: '0 0 0 2px rgba(34,197,94,0.2)',
          flexShrink: 0,
        }} />
      </div>
    </header>
  );
}
