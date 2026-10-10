import { useState, useEffect, useRef } from 'react';

const DEFAULT_PASSWORD = '1234';

function getStoredPassword() {
  return localStorage.getItem('app_lock_password') || DEFAULT_PASSWORD;
}

export function setLockPassword(pw) {
  localStorage.setItem('app_lock_password', pw);
}

export default function LockScreen({ onUnlock }) {
  const [input, setInput]     = useState('');
  const [error, setError]     = useState(false);
  const [shake, setShake]     = useState(false);
  const [show,  setShow]      = useState(false); // show password as text
  const inputRef              = useRef();

  useEffect(() => { inputRef.current?.focus(); }, []);

  const attempt = () => {
    if (input === getStoredPassword()) {
      sessionStorage.setItem('app_unlocked', '1');
      onUnlock();
    } else {
      setError(true);
      setShake(true);
      setInput('');
      setTimeout(() => setShake(false), 500);
      setTimeout(() => { setError(false); inputRef.current?.focus(); }, 2000);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter') attempt(); };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, gap: 32,
    }}>
      {/* Logo */}
      <img
        src="/לוגו חברה.jpeg"
        alt="זאת הברכה"
        style={{ width: 160, height: 160, objectFit: 'contain', borderRadius: 24,
          boxShadow: '0 0 60px rgba(229,57,53,0.3)' }}
      />

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#e53935', fontSize: '1.4em', fontWeight: 800, letterSpacing: 1 }}>
          מערכת ניהול וזאת הברכה דלקים ושמנים בע"מ
        </div>
        <div style={{ color: '#475569', fontSize: '0.85em', marginTop: 4 }}>
          הזן סיסמא להמשך
        </div>
      </div>

      {/* Password input */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        animation: shake ? 'shake 0.4s ease' : 'none',
      }}>
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            20%{transform:translateX(-10px)}
            40%{transform:translateX(10px)}
            60%{transform:translateX(-8px)}
            80%{transform:translateX(8px)}
          }
        `}</style>

        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            type={show ? 'text' : 'password'}
            value={input}
            onChange={e => { setInput(e.target.value); setError(false); }}
            onKeyDown={onKey}
            placeholder="סיסמא"
            dir="ltr"
            style={{
              width: 220, padding: '12px 44px 12px 16px',
              background: '#111', border: `2px solid ${error ? '#ef4444' : '#334155'}`,
              borderRadius: 10, color: '#f1f5f9', fontSize: '1.1em',
              outline: 'none', textAlign: 'center', letterSpacing: 4,
              fontFamily: 'monospace', transition: 'border-color 0.2s',
            }}
          />
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#64748b', fontSize: '1em', padding: 4,
            }}
          >
            {show ? '🙈' : '👁'}
          </button>
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.82em', fontWeight: 600 }}>
            סיסמא שגויה
          </div>
        )}

        <button
          onClick={attempt}
          style={{
            width: 220, padding: '12px 0',
            background: '#e53935', color: '#fff',
            border: 'none', borderRadius: 10, fontWeight: 800,
            fontSize: '1em', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#c62828'}
          onMouseLeave={e => e.currentTarget.style.background = '#e53935'}
        >
          כניסה
        </button>
      </div>
    </div>
  );
}
