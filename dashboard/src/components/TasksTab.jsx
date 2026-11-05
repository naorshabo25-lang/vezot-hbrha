import { useState, useEffect } from 'react';

const SERVER = (window.location.port === '5173' || window.location.port === '5174')
  ? `http://${window.location.hostname}:8000`
  : '';

function fmtDateTime(s) {
  if (!s) return '';
  const [d, t] = s.split(' ');
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}${t ? ' ' + t.slice(0, 5) : ''}`;
}

const card = { background: 'var(--card-bg, #fff)', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 14, padding: 18 };
const reminderChip = { border: 'none', borderRadius: 12, padding: '2px 9px', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: '#eff6ff', color: '#1d4ed8', fontFamily: 'inherit' };
const chipSent = { background: '#f0fdf4', color: '#16a34a' };
const chipFailed = { background: '#fef2f2', color: '#dc2626' };
const inp = { padding: '10px 14px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, background: 'var(--bg, #fafafa)', color: 'var(--text-1, #1f2937)', flex: 1, minWidth: 0 };

export default function TasksTab() {
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editingTime, setEditingTime] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [t, n] = await Promise.all([
      fetch(`${SERVER}/api/personal-tasks`).then(r => r.json()),
      fetch(`${SERVER}/api/personal-notes`).then(r => r.json()),
    ]);
    setTasks(Array.isArray(t) ? t : []);
    setNotes(Array.isArray(n) ? n : []);
  }

  async function add() {
    const description = text.trim();
    if (!description) return;
    setText('');
    setRemindAt('');
    await fetch(`${SERVER}/api/personal-tasks`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description, remind_at: remindAt }),
    });
    load();
  }

  async function patch(id, body) {
    await fetch(`${SERVER}/api/personal-tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    load();
  }

  async function del(id) {
    if (!confirm('למחוק את המשימה?')) return;
    await fetch(`${SERVER}/api/personal-tasks/${id}`, { method: 'DELETE' });
    load();
  }

  async function delNote(id) {
    if (!confirm('למחוק את ההערה?')) return;
    await fetch(`${SERVER}/api/personal-notes/${id}`, { method: 'DELETE' });
    load();
  }

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  const row = (t) => (
    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 4px', borderTop: '1px solid var(--border, #f1f5f9)' }}>
      <input type="checkbox" checked={!!t.completed} onChange={() => patch(t.id, { completed: !t.completed })}
        style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#16a34a', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing?.id === t.id ? (
          <input autoFocus value={editing.description} style={{ ...inp, width: '100%' }}
            onChange={e => setEditing({ ...editing, description: e.target.value })}
            onKeyDown={e => {
              if (e.key === 'Enter') { patch(t.id, { description: editing.description }); setEditing(null); }
              if (e.key === 'Escape') setEditing(null);
            }}
            onBlur={() => { patch(t.id, { description: editing.description }); setEditing(null); }} />
        ) : (
          <div onDoubleClick={() => !t.completed && setEditing({ id: t.id, description: t.description })}
            style={{ fontSize: 14, fontWeight: 600, color: t.completed ? 'var(--text-2, #9ca3af)' : 'var(--text-1, #1f2937)', textDecoration: t.completed ? 'line-through' : 'none', wordBreak: 'break-word' }}>
            {t.description}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-2, #9ca3af)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>#{t.id} · נוצר {fmtDateTime(t.created_at)}{t.completed_at ? ` · בוצע ${fmtDateTime(t.completed_at)}` : ''}</span>
          {!t.completed && (editingTime === t.id ? (
            <input type="datetime-local" autoFocus defaultValue={(t.remind_at || '').replace(' ', 'T')}
              style={{ ...inp, flex: 'none', padding: '3px 8px', fontSize: 12 }}
              onKeyDown={e => e.key === 'Escape' && setEditingTime(null)}
              onBlur={e => { setEditingTime(null); patch(t.id, { remind_at: e.target.value }); }} />
          ) : t.remind_at ? (
            <button onClick={() => setEditingTime(t.id)} title="שנה זמן תזכורת"
              style={{ ...reminderChip, ...(t.reminded === 1 ? chipSent : t.reminded === 2 ? chipFailed : {}) }}>
              ⏰ {fmtDateTime(t.remind_at)}{t.reminded === 1 ? ' · נשלחה' : t.reminded === 2 ? ' · השליחה נכשלה' : ''}
            </button>
          ) : (
            <button onClick={() => setEditingTime(t.id)} style={{ ...reminderChip, background: 'transparent', color: 'var(--text-2, #9ca3af)' }}>
              + תזכורת
            </button>
          ))}
        </div>
      </div>
      <button onClick={() => del(t.id)} title="מחק"
        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 15 }}>🗑️</button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 820, width: '100%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text-1)' }}>✅ המשימות שלי</h2>
        <span style={{ fontSize: 13, color: 'var(--text-2)' }}>{open.length} פתוחות · בוואטסאפ: <b>תזכיר לי מחר ב-9 ...</b></span>
      </div>

      <div style={{ ...card, display: 'flex', gap: 10 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="משימה חדשה... אפשר גם: מחר ב-9 פגישה עם כהן" style={inp} />
        <input type="datetime-local" value={remindAt} onChange={e => setRemindAt(e.target.value)} title="זמן תזכורת (לא חובה)"
          style={{ ...inp, flex: 'none', width: 'auto' }} />
        <button onClick={add} className="btn btn-primary">+ הוסף</button>
      </div>

      <div style={card}>
        {open.length === 0
          ? <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-2)' }}>🎉 אין משימות פתוחות</div>
          : open.map(row)}
      </div>

      {done.length > 0 && (
        <div style={card}>
          <button onClick={() => setShowDone(v => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-2)', padding: 0 }}>
            {showDone ? '▾' : '◂'} בוצעו ({done.length})
          </button>
          {showDone && done.map(row)}
        </div>
      )}

      {notes.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 6 }}>📝 הערות מהוואטסאפ</div>
          {notes.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 4px', borderTop: '1px solid var(--border, #f1f5f9)' }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-1)', wordBreak: 'break-word' }}>
                {n.content}
                <div style={{ fontSize: 11, color: 'var(--text-2, #9ca3af)', marginTop: 2 }}>{fmtDateTime(n.created_at)}</div>
              </div>
              <button onClick={() => delNote(n.id)} title="מחק"
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 14 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
