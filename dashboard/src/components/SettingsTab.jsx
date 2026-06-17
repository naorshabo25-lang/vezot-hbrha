import { useState, useEffect } from 'react';

const API = (window.location.port === '5173' || window.location.port === '5174') ? `http://${window.location.hostname}:8000` : '';

const inputStyle = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid #e9ecef',
  fontSize: 13, background: '#fff', color: '#1e2d3d', outline: 'none', width: '100%',
};

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(20px)',
    borderRadius: 14, padding: 22, border: '1px solid rgba(255,255,255,0.92)',
    boxShadow: '0 4px 24px rgba(99,102,241,0.07)', ...style,
  }}>{children}</div>
);

export default function SettingsTab() {
  const [settings, setSettings] = useState({
    message_template: '',
    daily_hour: '14',
    daily_minute: '0',
    admin_phone: '',
    admin_schedule_hour: '',
    admin_schedule_minute: '0',
    email_from: '',
    email_password: '',
    biz_info_url: '',
  });
  const [loading, setLoading]   = useState(true);
  const [saved,   setSaved]     = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg,   setTestMsg]   = useState('');
  const [testing,   setTesting]   = useState(false);
  const [showPass,  setShowPass]  = useState(false);

  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(data => { setSettings(s => ({ ...s, ...data })); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const save = async () => {
    await fetch(`${API}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_template:      settings.message_template,
        daily_hour:            settings.daily_hour,
        daily_minute:          settings.daily_minute,
        admin_phone:           settings.admin_phone,
        admin_schedule_hour:   settings.admin_schedule_hour,
        admin_schedule_minute: settings.admin_schedule_minute,
        email_from:            settings.email_from,
        email_password:        settings.email_password,
        biz_info_url:          settings.biz_info_url,
      }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sendTest = async () => {
    if (!testPhone.trim()) return;
    setTesting(true); setTestMsg('');
    try {
      const res = await fetch(`${API}/api/test-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone }),
      });
      const data = await res.json();
      setTestMsg(data.ok ? '✓ הודעה נשלחה בהצלחה!' : 'שגיאה בשליחה');
    } catch { setTestMsg('שגיאת חיבור'); }
    setTesting(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#9ca3af', fontSize: 15 }}>
      טוען הגדרות...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>

      {/* אימייל תפוצה */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d3d', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✉️ הגדרות אימייל (לשליחת תפוצה)
        </h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 18 }}>
          Gmail בלבד. צריך ליצור <strong>App Password</strong> בחשבון Google שלך (הגדרות → אבטחה → אימות דו-שלבי → App Passwords).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>כתובת Gmail</label>
            <input type="email" style={inputStyle} placeholder="yourname@gmail.com"
              value={settings.email_from}
              onChange={e => setSettings(s => ({ ...s, email_from: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>App Password (16 תווים)</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                style={{ ...inputStyle, paddingLeft: 36 }}
                placeholder="xxxx xxxx xxxx xxxx"
                value={settings.email_password}
                onChange={e => setSettings(s => ({ ...s, email_password: e.target.value }))} />
              <button onClick={() => setShowPass(v => !v)}
                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#9ca3af', padding: 2 }}>
                {showPass ? '🙈' : '👁'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '10px 14px', background: '#fef9c3', borderRadius: 8, border: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
          <strong>איך ליצור App Password ב-Gmail:</strong><br />
          1. כנס לחשבון Google → הגדרות → אבטחה<br />
          2. ודא שאימות דו-שלבי פעיל<br />
          3. חפש "App Passwords" → צור → בחר "Mail" + "Other" → תן שם → העתק את הסיסמה
        </div>
      </Card>

      {/* הודעות וואטסאפ יומיות */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d3d', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          💬 הגדרות הודעות וואטסאפ יומיות
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>
            תבנית הודעה (השתמש ב-{'{name}'} לשם הלקוח)
          </label>
          <textarea
            style={{ ...inputStyle, minHeight: 90, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            value={settings.message_template}
            onChange={e => setSettings(s => ({ ...s, message_template: e.target.value }))}
            placeholder="שלום {name}, האם תצטרך הזמנת דלק סולר למחר?" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>שעת שליחה — שעה</label>
            <input type="number" min="0" max="23" style={inputStyle}
              value={settings.daily_hour}
              onChange={e => setSettings(s => ({ ...s, daily_hour: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>שעת שליחה — דקות</label>
            <input type="number" min="0" max="59" style={inputStyle}
              value={settings.daily_minute}
              onChange={e => setSettings(s => ({ ...s, daily_minute: e.target.value }))} />
          </div>
        </div>

        <div style={{ padding: '10px 14px', background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd', marginBottom: 16, fontSize: 13, color: '#0891b2', fontWeight: 600 }}>
          הודעות יישלחו מדי יום בשעה {String(settings.daily_hour).padStart(2,'0')}:{String(settings.daily_minute).padStart(2,'0')}
        </div>
      </Card>

      {/* הגדרות מנהל */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d3d', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          👤 הגדרות מנהל
        </h2>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>טלפון מנהל (לסידור יומי)</label>
          <input type="text" style={inputStyle} placeholder="0506877866"
            value={settings.admin_phone}
            onChange={e => setSettings(s => ({ ...s, admin_phone: e.target.value }))} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>שעת סידור יומי — שעה</label>
            <input type="number" min="0" max="23" style={inputStyle}
              value={settings.admin_schedule_hour}
              onChange={e => setSettings(s => ({ ...s, admin_schedule_hour: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>שעת סידור יומי — דקות</label>
            <input type="number" min="0" max="59" style={inputStyle}
              value={settings.admin_schedule_minute}
              onChange={e => setSettings(s => ({ ...s, admin_schedule_minute: e.target.value }))} />
          </div>
        </div>
      </Card>

      {/* בדיקת שליחה */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d3d', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
          🧪 שליחת הודעת וואטסאפ לבדיקה
        </h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6, letterSpacing: 0.5 }}>מספר טלפון לבדיקה</label>
            <input type="text" style={inputStyle} placeholder="0506877866"
              value={testPhone} onChange={e => setTestPhone(e.target.value)} />
          </div>
          <button onClick={sendTest} disabled={testing}
            style={{ padding: '9px 22px', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none', background: '#1e2d3d', color: '#fff', whiteSpace: 'nowrap', opacity: testing ? 0.7 : 1 }}>
            {testing ? 'שולח...' : 'שלח בדיקה'}
          </button>
        </div>
        {testMsg && (
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: testMsg.includes('✓') ? '#16a34a' : '#dc2626' }}>{testMsg}</div>
        )}
      </Card>

      {/* אתר מידע עסקי */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#1e2d3d', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          🔍 אתר מידע עסקי (לבדיקת לקוחות פוטנציאלים)
        </h2>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
          הכתובת תופיע כקישור "בדיקת לקוח" ליד כל לקוח פוטנציאלי. ניתן להשתמש ב-<code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4 }}>{'{name}'}</code> לשם הלקוח.
        </p>
        <input type="url" style={inputStyle}
          placeholder="https://www.bdind.co.il/search?q={name}"
          value={settings.biz_info_url}
          onChange={e => setSettings(s => ({ ...s, biz_info_url: e.target.value }))} />
      </Card>

      {/* כפתור שמירה */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={save} style={{
          padding: '12px 36px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none',
          background: saved ? '#16a34a' : 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff',
          transition: 'background 0.2s',
        }}>
          {saved ? '✓ נשמר!' : 'שמור הגדרות'}
        </button>
      </div>
    </div>
  );
}
