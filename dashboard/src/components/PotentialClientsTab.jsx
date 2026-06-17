import { useState, useEffect, useCallback, useRef } from 'react';

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

const PAGE_SIZE = 50;

function CampaignModal({ onClose }) {
  const [subject,   setSubject]   = useState('');
  const [body,      setBody]      = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [status,    setStatus]    = useState(null); // null | 'sending' | {sent,failed,total,done,errors}
  const [tab,       setTab]       = useState('compose'); // 'compose' | 'progress'
  const pollRef = useRef(null);

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  useEffect(() => () => stopPoll(), []);

  const startPoll = () => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      const res = await fetch(`${API}/api/campaign-status`);
      const data = await res.json();
      setStatus(data);
      if (data.done) stopPoll();
    }, 1500);
  };

  const send = async (isTest) => {
    if (!subject.trim() || !body.trim()) return alert('נושא ותוכן חובה');
    if (isTest && !testEmail.trim()) return alert('הזן כתובת אימייל לבדיקה');
    setTab('progress');
    setStatus({ running: true, sent: 0, failed: 0, total: 0, done: false, errors: [] });
    try {
      const res = await fetch(`${API}/api/send-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, test_email: isTest ? testEmail : '' }),
      });
      const data = await res.json();
      if (!data.ok) { setStatus({ done: true, error: data.error, sent: 0, failed: 0, total: 0 }); return; }
      startPoll();
    } catch (e) { setStatus({ done: true, error: String(e), sent: 0, failed: 0, total: 0 }); }
  };

  const pct = status && status.total > 0 ? Math.round(((status.sent + status.failed) / status.total) * 100) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 28, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', direction: 'rtl' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1e2d3d', margin: 0 }}>✉️ שליחת קמפיין אימייל</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}>✕</button>
        </div>

        {tab === 'compose' ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>נושא האימייל</label>
              <input style={inputStyle} placeholder="הצעה מיוחדת ללקוחות דלק..." value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>
                תוכן ההודעה — ניתן להשתמש ב-HTML וב-{'{name}'} לשם הלקוח
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: 180, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                placeholder={`שלום {name},\n\nאנו שמחים להציע לכם...\n\nבברכה,\nזאת הברכה דלקים`}
                value={body} onChange={e => setBody(e.target.value)} />
            </div>

            {/* בדיקה */}
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e9ecef', marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>🧪 שלח בדיקה לפני שליחה לכולם</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="your@email.com" value={testEmail} onChange={e => setTestEmail(e.target.value)} />
                <button onClick={() => send(true)}
                  style={{ padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none', whiteSpace: 'nowrap' }}>
                  שלח בדיקה
                </button>
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', fontSize: 13, color: '#166534', marginBottom: 18, fontWeight: 600 }}>
              ישלח ל-1,009 לקוחות פוטנציאלים עם כתובת אימייל
            </div>

            <button onClick={() => {
              if (window.confirm('לשלוח קמפיין לכל 1,009 הלקוחות עם אימייל?')) send(false);
            }} style={{
              padding: '12px 32px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', width: '100%',
            }}>
              שלח לכל הלקוחות הפוטנציאלים
            </button>
          </>
        ) : (
          /* Progress tab */
          <div>
            {status?.error ? (
              <div style={{ padding: 20, background: '#fff5f5', borderRadius: 10, border: '1px solid #fecaca', color: '#dc2626', fontWeight: 600, fontSize: 14 }}>
                שגיאה: {status.error}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1e2d3d' }}>
                      {status?.done ? 'הסתיים!' : 'שולח...'}
                    </span>
                    <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{pct}%</span>
                  </div>
                  <div style={{ background: '#f3f4f6', borderRadius: 100, height: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 100, background: 'linear-gradient(90deg, #16a34a, #22c55e)', width: `${pct}%`, transition: 'width 0.4s' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'נשלחו', val: status?.sent || 0, color: '#16a34a' },
                    { label: 'נכשלו', val: status?.failed || 0, color: '#dc2626' },
                    { label: 'סה"כ', val: status?.total || 0, color: '#6366f1' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>{label}</div>
                    </div>
                  ))}
                </div>

                {status?.errors?.length > 0 && (
                  <div style={{ background: '#fff5f5', borderRadius: 8, padding: 12, border: '1px solid #fecaca', maxHeight: 140, overflowY: 'auto' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 6 }}>שגיאות:</div>
                    {status.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>{e}</div>
                    ))}
                  </div>
                )}

                {status?.done && (
                  <button onClick={onClose} style={{ marginTop: 16, padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#16a34a', color: '#fff', border: 'none', width: '100%' }}>
                    סגור
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PotentialClientsTab() {
  const [clients,       setClients]       = useState([]);
  const [total,         setTotal]         = useState(0);
  const [page,          setPage]          = useState(0);
  const [search,        setSearch]        = useState('');
  const [loading,       setLoading]       = useState(true);
  const [showCampaign,  setShowCampaign]  = useState(false);
  const [bizInfoUrl,    setBizInfoUrl]    = useState('');

  const [showForm,      setShowForm]      = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newPhone,      setNewPhone]      = useState('');
  const [newArea,       setNewArea]       = useState('');
  const [newNotes,      setNewNotes]      = useState('');
  const [formError,     setFormError]     = useState('');

  const [editingId,     setEditingId]     = useState(null);
  const [noteDraft,     setNoteDraft]     = useState('');
  const [saving,        setSaving]        = useState(false);

  const fetchClients = useCallback(async (q, p) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/potential-customers?q=${encodeURIComponent(q)}&limit=${PAGE_SIZE}&offset=${p * PAGE_SIZE}`);
      const data = await res.json();
      setClients(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(search, page); }, [search, page, fetchClients]);

  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(s => { if (s.biz_info_url) setBizInfoUrl(s.biz_info_url); })
      .catch(() => {});
  }, []);

  const handleSearch = (val) => { setSearch(val); setPage(0); };

  const handleAdd = async () => {
    if (!newName.trim()) return setFormError('נא להזין שם');
    try {
      await fetch(`${API}/api/potential-customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim(), area: newArea.trim(), notes: newNotes.trim() }),
      });
      setNewName(''); setNewPhone(''); setNewArea(''); setNewNotes(''); setFormError(''); setShowForm(false);
      fetchClients(search, page);
    } catch { setFormError('שגיאה בשמירה'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('למחוק לקוח זה?')) return;
    await fetch(`${API}/api/potential-customers/${id}`, { method: 'DELETE' });
    fetchClients(search, page);
  };

  const saveNote = async (id) => {
    setSaving(true);
    await fetch(`${API}/api/potential-customers/${id}/notes`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: noteDraft }),
    });
    setClients(prev => prev.map(c => c.id === id ? { ...c, notes: noteDraft } : c));
    setEditingId(null); setNoteDraft(''); setSaving(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {showCampaign && <CampaignModal onClose={() => setShowCampaign(false)} />}

      {/* Header bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => { setShowForm(v => !v); setFormError(''); }}
          style={{
            padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', whiteSpace: 'nowrap',
          }}>
          {showForm ? '✕ ביטול' : '+ הוספת לקוח פוטנציאלי'}
        </button>

        <button onClick={() => setShowCampaign(true)}
          style={{
            padding: '10px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none',
            background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color: '#fff', whiteSpace: 'nowrap',
          }}>
          ✉️ שלח קמפיין אימייל
        </button>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
          <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#9ca3af' }}>🔍</span>
          <input
            style={{ ...inputStyle, paddingRight: 32 }}
            placeholder={`חיפוש בין ${total.toLocaleString()} לקוחות...`}
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>

        <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap', fontWeight: 600 }}>
          {total.toLocaleString()} לקוחות פוטנציאלים
        </span>
      </div>

      {/* Add form */}
      {showForm && (
        <Card>
          <h3 style={{ fontSize: 14, fontWeight: 800, color: '#1e2d3d', marginBottom: 16 }}>לקוח פוטנציאלי חדש</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>שם / חברה *</label>
              <input style={inputStyle} placeholder="שם הלקוח" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>טלפון</label>
              <input style={inputStyle} placeholder="05X-XXXXXXX" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>אזור</label>
              <input style={inputStyle} placeholder="ירושלים, תל אביב..." value={newArea} onChange={e => setNewArea(e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', display: 'block', marginBottom: 6 }}>הערות</label>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              placeholder="מידע רלוונטי..."
              value={newNotes} onChange={e => setNewNotes(e.target.value)} />
          </div>
          {formError && <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 10 }}>{formError}</p>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleAdd} style={{ padding: '10px 28px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#7c3aed', color: '#fff', border: 'none' }}>שמור</button>
            <button onClick={() => { setShowForm(false); setFormError(''); }} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>ביטול</button>
          </div>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#9ca3af', fontSize: 15 }}>טוען...</div>
      ) : clients.length === 0 ? (
        <Card style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>{search ? 'לא נמצאו תוצאות לחיפוש' : 'אין עדיין לקוחות פוטנציאלים'}</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map(pc => (
            <Card key={pc.id} style={{ borderRight: '4px solid #7c3aed', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#1e2d3d', marginBottom: 5 }}>{pc.name}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {pc.phone && <span style={{ fontSize: 12, color: '#6b7280' }}>📞 {pc.phone}</span>}
                    {pc.contact_phone && pc.contact_phone !== pc.phone && <span style={{ fontSize: 12, color: '#6b7280' }}>📱 {pc.contact_phone}</span>}
                    {pc.area && <span style={{ fontSize: 12, color: '#9ca3af' }}>📍 {pc.area}</span>}
                    {pc.site_address && <span style={{ fontSize: 12, color: '#9ca3af' }}>{pc.site_address}</span>}
                    {pc.contact_name && <span style={{ fontSize: 12, color: '#9ca3af' }}>👤 {pc.contact_name}</span>}
                    {pc.email && <span style={{ fontSize: 12, color: '#9ca3af' }}>✉ {pc.email}</span>}
                  </div>
                  {pc.phones_extra && (
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>טלפונים נוספים: {pc.phones_extra}</div>
                  )}
                </div>

                {/* Notes + actions */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {bizInfoUrl && (
                    <a href={bizInfoUrl} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fefce8', color: '#92400e', border: '1px solid #fde68a', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      🔍 בדיקת לקוח
                    </a>
                  )}
                  {editingId !== pc.id && (
                    <button onClick={() => { setEditingId(pc.id); setNoteDraft(pc.notes || ''); }}
                      style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#f0f9ff', color: '#0891b2', border: '1px solid #bae6fd', whiteSpace: 'nowrap' }}>
                      ✎ {pc.notes ? 'ערוך הערה' : 'הוסף הערה'}
                    </button>
                  )}
                  <button onClick={() => handleDelete(pc.id)}
                    style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff5f5', color: '#dc2626', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>
                    מחק
                  </button>
                </div>
              </div>

              {/* Notes area */}
              {editingId === pc.id ? (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, marginBottom: 8 }}
                    value={noteDraft} onChange={e => setNoteDraft(e.target.value)} autoFocus />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => saveNote(pc.id)} disabled={saving}
                      style={{ padding: '7px 20px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#16a34a', color: '#fff', border: 'none', opacity: saving ? 0.7 : 1 }}>
                      {saving ? 'שומר...' : 'שמור'}
                    </button>
                    <button onClick={() => { setEditingId(null); setNoteDraft(''); }}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: '#f3f4f6', color: '#374151', border: 'none' }}>
                      ביטול
                    </button>
                  </div>
                </div>
              ) : pc.notes ? (
                <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 8, padding: '10px 14px', border: '1px solid #e9ecef', fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap', cursor: 'pointer' }}
                  onClick={() => { setEditingId(pc.id); setNoteDraft(pc.notes || ''); }}>
                  {pc.notes}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', padding: '8px 0' }}>
          <button onClick={() => setPage(0)} disabled={page === 0}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: page === 0 ? 'default' : 'pointer', background: '#f3f4f6', color: '#374151', border: 'none', opacity: page === 0 ? 0.4 : 1 }}>
            &laquo;
          </button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: page === 0 ? 'default' : 'pointer', background: '#f3f4f6', color: '#374151', border: 'none', opacity: page === 0 ? 0.4 : 1 }}>
            &lsaquo;
          </button>
          <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>
            עמוד {page + 1} מתוך {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: page >= totalPages - 1 ? 'default' : 'pointer', background: '#f3f4f6', color: '#374151', border: 'none', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
            &rsaquo;
          </button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
            style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: page >= totalPages - 1 ? 'default' : 'pointer', background: '#f3f4f6', color: '#374151', border: 'none', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}
