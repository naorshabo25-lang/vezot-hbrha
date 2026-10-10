import { useState, useEffect, useRef } from 'react';

const SERVER = (window.location.port === '5173' || window.location.port === '5174')
  ? `http://${window.location.hostname}:8000`
  : '';

const CATS = [
  { id: 'טיפול',         icon: '🔧', label: 'טיפול / שירות',  hasExpiry: false, hasCost: true  },
  { id: 'טסט',           icon: '📋', label: 'טסט שנתי',       hasExpiry: true,  hasCost: false },
  { id: 'ביקורת_חורף',  icon: '❄️', label: 'ביקורת חורף',    hasExpiry: true,  hasCost: false },
  { id: 'רישיון_חומס',  icon: '📄', label: 'רישיון חומס',     hasExpiry: true,  hasCost: false },
  { id: 'ביטוח',        icon: '🛡️', label: 'ביטוח',           hasExpiry: true,  hasCost: true  },
];
const CAT_MAP = Object.fromEntries(CATS.map(c => [c.id, c]));

function daysLeft(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr); const now = new Date();
  d.setHours(0,0,0,0); now.setHours(0,0,0,0);
  return Math.round((d - now) / 86400000);
}

function fmtDate(s) {
  if (!s) return '—';
  const [y,m,d] = s.split('-');
  return `${d}/${m}/${y}`;
}

function StatusChip({ days }) {
  if (days === null) return <span style={chip('#f3f4f6','#9ca3af')}>לא הוזן</span>;
  if (days < 0)  return <span style={chip('#fee2e2','#dc2626')}>פג תוקף</span>;
  if (days <= 30) return <span style={chip('#fef9c3','#a16207')}>עוד {days} י׳</span>;
  return <span style={chip('#dcfce7','#16a34a')}>בתוקף</span>;
}
function chip(bg, color) {
  return { background: bg, color, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700 };
}

function TruckModal({ truck, drivers, onClose, onSave }) {
  const parseCompartments = (raw) => {
    try { return JSON.parse(raw || '[]'); } catch { return []; }
  };

  const [form, setForm] = useState({
    name: truck?.name || '',
    plate_number: truck?.plate_number || '',
    driver_id: truck?.driver_id || '',
    tanker_volume: truck?.tanker_volume || '',
    notes: truck?.notes || '',
  });
  const [compartments, setCompartments] = useState(() => parseCompartments(truck?.compartments));

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const setNumCompartments = (n) => {
    const num = Math.max(0, Math.min(12, parseInt(n) || 0));
    setCompartments(prev => {
      const arr = [...prev];
      while (arr.length < num) arr.push(0);
      return arr.slice(0, num);
    });
  };

  const setCompartmentVal = (i, v) => {
    setCompartments(prev => {
      const arr = [...prev];
      arr[i] = parseInt(v) || 0;
      return arr;
    });
  };

  const totalFromCompartments = compartments.reduce((s, v) => s + (parseInt(v) || 0), 0);

  async function save() {
    if (!form.name.trim()) { alert('יש להזין שם משאית'); return; }
    const body = {
      ...form,
      driver_id: form.driver_id || null,
      compartments,
      tanker_volume: form.tanker_volume || (totalFromCompartments > 0 ? String(totalFromCompartments) : ''),
    };
    const url = truck ? `${SERVER}/api/fleet/trucks/${truck.id}` : `${SERVER}/api/fleet/trucks`;
    await fetch(url, { method: truck ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    onSave();
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={overlay}>
      <div style={{ ...modal, maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={closeBtn}>✕</button>
        <h3 style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--text-1)' }}>{truck ? '✏️ עריכת משאית' : '🚛 הוסף משאית'}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="שם משאית *" style={inp} />
          <input value={form.plate_number} onChange={e => set('plate_number', e.target.value)} placeholder="מספר רישוי" style={inp} />
          <select value={form.driver_id} onChange={e => set('driver_id', e.target.value)} style={inp}>
            <option value="">-- ללא נהג קבוע --</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input value={form.tanker_volume} onChange={e => set('tanker_volume', e.target.value)} placeholder="נפח מכלית כולל (ליטר)" style={inp} />

          {/* Compartments */}
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 14, border: '1px solid #e9ecef' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: compartments.length > 0 ? 12 : 0 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', whiteSpace: 'nowrap' }}>מספר תאים:</label>
              <input
                type="number" min="0" max="12"
                value={compartments.length || ''}
                onChange={e => setNumCompartments(e.target.value)}
                placeholder="0"
                style={{ ...inp, width: 70, textAlign: 'center' }}
              />
              {totalFromCompartments > 0 && (
                <span style={{ fontSize: 12, color: '#059669', fontWeight: 700 }}>
                  סה"כ: {totalFromCompartments.toLocaleString()} ל׳
                </span>
              )}
            </div>
            {compartments.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
                {compartments.map((val, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <label style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>תא {i + 1}</label>
                    <input
                      type="number" min="0"
                      value={val || ''}
                      onChange={e => setCompartmentVal(i, e.target.value)}
                      placeholder="ליטר"
                      style={{ ...inp, textAlign: 'center' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="הערות" rows={2} style={{ ...inp, resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} className="btn btn-soft">ביטול</button>
          <button onClick={save} className="btn btn-primary">שמור</button>
        </div>
      </div>
    </div>
  );
}

// categories that can only have ONE record (no duplicate adds)
const SINGLE_CATS = new Set(['טסט', 'ביקורת_חורף', 'רישיון_חומס', 'ביטוח']);

function RecordModal({ truckId, preCategory, existingRecord, onClose, onSave }) {
  const isEdit = !!existingRecord;
  const [cat, setCat] = useState(existingRecord?.category || preCategory || 'טיפול');
  const cfg = CAT_MAP[cat] || CATS[0];
  const [form, setForm] = useState({
    title:      existingRecord?.title       || '',
    event_date: existingRecord?.event_date  || '',
    expiry_date:existingRecord?.expiry_date || '',
    cost:       existingRecord?.cost        != null ? String(existingRecord.cost) : '',
    notes:      existingRecord?.notes       || '',
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const showImageUpload = cat === 'טסט' || cat === 'ביקורת_חורף' || cat === 'רישיון_חומס' || cat === 'הוצאת_מוסך' || cat === 'ביטוח';
  const existingImage = existingRecord?.image_path;

  async function save() {
    setSaving(true);
    let recordId = existingRecord?.id;
    const body = { truck_id: truckId, category: cat, ...form, cost: parseFloat(form.cost) || 0 };

    if (isEdit) {
      await fetch(`${SERVER}/api/fleet/records/${recordId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
    } else {
      const res = await fetch(`${SERVER}/api/fleet/records`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      recordId = data.id;
    }

    if (imageFile && recordId) {
      await fetch(`${SERVER}/api/fleet/records/${recordId}/upload-image`, {
        method: 'POST',
        headers: { 'Content-Type': imageFile.type || 'image/jpeg' },
        body: imageFile,
      });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={overlay}>
      <div style={modal}>
        <button onClick={onClose} style={closeBtn}>✕</button>
        <h3 style={{ margin: '0 0 18px', fontSize: 15, color: 'var(--text-1)' }}>
          {isEdit ? '✏️ עריכת רשומה' : '➕ הוסף רשומה'}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!isEdit && (
            <select value={cat} onChange={e => setCat(e.target.value)} style={inp}>
              {CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              <option value="הוצאת_מוסך">🔧 הוצאת מוסך</option>
            </select>
          )}
          {isEdit && (
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', paddingBottom: 4 }}>
              {CAT_MAP[cat]?.icon} {CAT_MAP[cat]?.label || cat}
            </div>
          )}
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="כותרת / תיאור" style={inp} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={lbl}>תאריך ביצוע</label>
            <input type="date" value={form.event_date} onChange={e => set('event_date', e.target.value)} style={inp} />
          </div>
          {cfg.hasExpiry && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>תוקף עד</label>
              <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} style={inp} />
            </div>
          )}
          {(cfg.hasCost || cat === 'הוצאת_מוסך') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={lbl}>עלות (₪)</label>
              <input type="number" min="0" value={form.cost} onChange={e => set('cost', e.target.value)} placeholder="0" style={inp} />
            </div>
          )}
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="הערות" rows={2} style={{ ...inp, resize: 'vertical' }} />

          {/* Image upload */}
          {showImageUpload && (
            <div style={{ border: '1.5px dashed var(--border, #e5e7eb)', borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
                {cat === 'הוצאת_מוסך' ? '📎 צילום חשבונית' : '📎 צילום רישיון / מסמך'}
              </div>

              {/* Show existing image */}
              {existingImage && !imageFile && (
                <div style={{ marginBottom: 10 }}>
                  {existingImage.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img src={`${SERVER}${existingImage}`} alt="מסמך קיים"
                      style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)', display: 'block', marginBottom: 6 }} />
                  ) : (
                    <a href={`${SERVER}${existingImage}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginBottom: 6 }}>
                      📄 פתח מסמך קיים
                    </a>
                  )}
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>לחץ להחלפה:</div>
                </div>
              )}

              <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={onFileChange} />
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-2,#f3f4f6)', border: '1px solid var(--border,#e5e7eb)', color: 'var(--text-1)' }}>
                {existingImage || imageFile ? '🔄 החלף קובץ' : '📷 בחר תמונה / PDF'}
              </button>
              {imageFile && (
                <span style={{ fontSize: 12, color: '#059669', marginRight: 10, fontWeight: 600 }}>✓ {imageFile.name}</span>
              )}
              {imagePreview && imageFile?.type?.startsWith('image/') && (
                <div style={{ marginTop: 10 }}>
                  <img src={imagePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, objectFit: 'contain', border: '1px solid var(--border)' }} />
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <button onClick={onClose} className="btn btn-soft">ביטול</button>
          <button onClick={save} disabled={saving} className="btn btn-primary">{saving ? 'שומר...' : 'שמור'}</button>
        </div>
      </div>
    </div>
  );
}

function TruckCard({ truck, onEdit, onDelete, onAddRecord }) {
  const [records, setRecords] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);

  useEffect(() => { loadRecs(); }, [truck.id]);

  async function loadRecs() {
    const r = await fetch(`${SERVER}/api/fleet/records/${truck.id}`);
    setRecords(await r.json());
  }

  async function delRecord(rid) {
    if (!confirm('למחוק רשומה זו?')) return;
    await fetch(`${SERVER}/api/fleet/records/${rid}`, { method: 'DELETE' });
    loadRecs();
  }

  const byCategory = {};
  const expenses = [];
  (records || []).forEach(r => {
    if (r.category === 'הוצאת_מוסך') { expenses.push(r); return; }
    if (!byCategory[r.category]) byCategory[r.category] = r;
  });

  const expTotal = expenses.reduce((s, r) => s + (r.cost || 0), 0);

  // worst status for header badge
  let worstDays = null;
  CATS.filter(c => c.hasExpiry).forEach(c => {
    const rec = byCategory[c.id];
    if (rec?.expiry_date) {
      const d = daysLeft(rec.expiry_date);
      if (worstDays === null || d < worstDays) worstDays = d;
    }
  });

  return (
    <div style={{ border: '1.5px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 16, background: 'var(--card-bg)' }}>
      {editingRecord && (
        <RecordModal
          truckId={truck.id}
          existingRecord={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSave={() => { setEditingRecord(null); loadRecs(); }}
        />
      )}
      {/* Header */}
      <div style={{ background: 'var(--bg-2, #f8fafc)', padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 26 }}>🚛</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{truck.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              {truck.plate_number && <span>רישוי: {truck.plate_number}</span>}
              {truck.driver_name && <span> · נהג: {truck.driver_name}</span>}
              {truck.tanker_volume && <span> · {truck.tanker_volume} ל׳</span>}
            </div>
            {(() => {
              try {
                const cmps = JSON.parse(truck.compartments || '[]');
                if (!cmps.length) return null;
                return (
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {cmps.map((v, i) => (
                      <span key={i} style={{ background: 'var(--bg-2,#f3f4f6)', borderRadius: 4, padding: '2px 6px', fontWeight: 600 }}>
                        ת{i+1}: {Number(v).toLocaleString()}
                      </span>
                    ))}
                  </div>
                );
              } catch { return null; }
            })()}
          </div>
          {worstDays !== null && <StatusChip days={worstDays} />}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => onAddRecord(truck.id)} className="btn btn-primary btn-sm">+ רשומה</button>
          <button onClick={() => onEdit(truck)} className="btn btn-soft btn-sm">✏️</button>
          <button onClick={() => onDelete(truck.id)} className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}>🗑️</button>
        </div>
      </div>

      {/* Category grid */}
      <div style={{ padding: '14px 18px 6px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {CATS.map(c => {
          const rec = byCategory[c.id];
          const days = rec?.expiry_date ? daysLeft(rec.expiry_date) : null;
          return (
            <div key={c.id}
              onClick={() => {
                if (rec && SINGLE_CATS.has(c.id)) { setEditingRecord(rec); }
                else { onAddRecord(truck.id, c.id); }
              }}
              style={{ border: '1.5px solid var(--border)', borderRadius: 10, padding: '9px 13px', minWidth: 130, flex: 1, cursor: 'pointer', transition: 'border-color .15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--red)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)', marginBottom: 4 }}>{c.icon} {c.label}</div>
              {rec ? (
                <>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    {c.hasExpiry && rec.expiry_date ? `עד ${fmtDate(rec.expiry_date)}` : rec.event_date ? `ביצוע: ${fmtDate(rec.event_date)}` : '—'}
                  </div>
                  <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <StatusChip days={days} />
                    {rec.image_path && (
                      <a href={`${SERVER}${rec.image_path}`} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()} title="פתח מסמך" style={{ fontSize: 14, textDecoration: 'none' }}>📎</a>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ marginTop: 4 }}><StatusChip days={null} /></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Garage expenses */}
      <div style={{ padding: '6px 18px 14px' }}>
        {expenses.length > 0 ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6 }}>
              🔧 הוצאות מוסך — סה״כ: ₪{expTotal.toLocaleString()}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-2)' }}>
                  <th style={th}>תאריך</th><th style={th}>תיאור</th><th style={th}>עלות</th><th style={th}>מסמך</th><th style={{ width: 30 }}></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(r => (
                  <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}>{fmtDate(r.event_date)}</td>
                    <td style={td}>{r.title || r.notes || '—'}</td>
                    <td style={td}>₪{(r.cost || 0).toLocaleString()}</td>
                    <td style={td}>
                      {r.image_path
                        ? <a href={`${SERVER}${r.image_path}`} target="_blank" rel="noopener noreferrer" title="פתח מסמך" style={{ fontSize: 16, textDecoration: 'none' }}>📎</a>
                        : <span style={{ color: 'var(--text-2)', fontSize: 11 }}>—</span>}
                    </td>
                    <td style={td}><button onClick={() => delRecord(r.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
            אין הוצאות מוסך —{' '}
            <button onClick={() => onAddRecord(truck.id, 'הוצאת_מוסך')} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12, padding: 0 }}>
              הוסף
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Styles
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' };
const modal = { background: 'var(--card-bg, white)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', position: 'relative', maxHeight: '90vh', overflowY: 'auto' };
const closeBtn = { position: 'absolute', top: 14, left: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', lineHeight: 1 };
const inp = { padding: '9px 13px', border: '1.5px solid var(--border, #e5e7eb)', borderRadius: 8, fontFamily: 'inherit', fontSize: 14, width: '100%', boxSizing: 'border-box', background: 'var(--bg, #fafafa)', color: 'var(--text-1, #1f2937)' };
const lbl = { fontSize: 12, fontWeight: 600, color: 'var(--text-2, #6b7280)' };
const th = { textAlign: 'right', padding: '3px 6px', fontWeight: 600 };
const td = { padding: '5px 6px', color: 'var(--text-1)' };

export default function FleetTab() {
  const [trucks, setTrucks] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [truckModal, setTruckModal] = useState(null); // null | { truck } | {}
  const [recordModal, setRecordModal] = useState(null); // null | { truckId, preCategory }

  useEffect(() => { load(); }, []);

  async function load() {
    const [tr, dr] = await Promise.all([
      fetch(`${SERVER}/api/fleet/trucks`).then(r => r.json()),
      fetch(`${SERVER}/api/drivers`).then(r => r.json()),
    ]);
    setTrucks(tr);
    setDrivers(dr);
  }

  async function deleteTruck(id) {
    if (!confirm('למחוק את המשאית וכל הרשומות שלה?')) return;
    await fetch(`${SERVER}/api/fleet/trucks/${id}`, { method: 'DELETE' });
    load();
  }

  // Alerts: expiring within 30 days
  const alerts = [];
  trucks.forEach(t => {
    // Will be populated from record data — for now just show count via TruckCard badges
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: 'var(--text-1)' }}>🚛 ניהול צי מכליות</h2>
        <button className="btn btn-primary" onClick={() => setTruckModal({})}>+ הוסף משאית</button>
      </div>

      {trucks.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
          <div>אין משאיות. לחץ "הוסף משאית" להתחלה.</div>
        </div>
      )}

      {trucks.map(t => (
        <TruckCard
          key={t.id}
          truck={t}
          onEdit={truck => setTruckModal({ truck })}
          onDelete={deleteTruck}
          onAddRecord={(truckId, preCategory) => setRecordModal({ truckId, preCategory })}
        />
      ))}

      {truckModal !== null && (
        <TruckModal
          truck={truckModal.truck}
          drivers={drivers}
          onClose={() => setTruckModal(null)}
          onSave={() => { setTruckModal(null); load(); }}
        />
      )}

      {recordModal !== null && (
        <RecordModal
          truckId={recordModal.truckId}
          preCategory={recordModal.preCategory}
          onClose={() => setRecordModal(null)}
          onSave={() => { setRecordModal(null); load(); }}
        />
      )}
    </div>
  );
}
