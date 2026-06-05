import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { exportToExcel, exportToCSV, importFromExcel } from '../utils/exportImport';
import { importFromPDF } from '../utils/pdfImport';

const SKIP_CLIENTS  = new Set(['לקוח','הכנסות תוספים(אוריאה,שמנים)','הכנסות כרטיסי תדלוק','הכנסות-חודשי']);
const SKIP_EXPENSES = new Set(['הוצאות-חודשי','הוצ פחת','משכורות']);

function parseWorkPlan(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const operationalExpenses = [], salaries = [], clients = [];
  let inSalaries = false;
  for (let i = 1; i < rows.length; i++) {
    const row  = rows[i];
    const col0 = String(row[0] || '').trim();
    const col1 = row[1];
    const col2 = String(row[2] || '').trim();
    const col3 = String(row[3] || '').trim();
    const col4 = row[4];
    const col5 = row[5];
    if (col0 === 'משכורות') { inSalaries = true; continue; }
    if (SKIP_EXPENSES.has(col0)) continue;
    if (!col0 && typeof col1 === 'number') continue;
    if (col0 && typeof col1 === 'number' && col1 > 0)
      (inSalaries ? salaries : operationalExpenses).push({ name: col0, amount: col1, note: col2 });
    if (col3 && !SKIP_CLIENTS.has(col3) && typeof col4 === 'number' && col4 > 0)
      clients.push({ name: col3, liters: col4, profit: typeof col5 === 'number' ? col5 : 0 });
  }
  return { operationalExpenses, salaries, clients };
}

export default function ImportExport({ expenses, onImport, onClearAll, onWorkPlanUpload, workPlanFileName }) {
  const xlsxRef    = useRef();
  const pdfRef     = useRef();
  const wpRef      = useRef();
  const [importing,   setImporting]   = useState(false);
  const [wpUploading, setWpUploading] = useState(false);
  const [result,      setResult]      = useState(null);
  const [wpResult,    setWpResult]    = useState(null);

  const handleFile = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true); setResult(null);
    try {
      const imported = type === 'pdf'
        ? await importFromPDF(file)
        : await importFromExcel(file);

      if (!imported.length) {
        setResult({ error: 'לא נמצאו שורות תקינות בקובץ.' });
      } else {
        onImport(imported);
        setResult({ count: imported.length, type });
      }
    } catch (err) {
      setResult({ error: `שגיאה בקריאת הקובץ: ${err.message || ''}` });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleWorkPlanFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setWpUploading(true); setWpResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb     = XLSX.read(ev.target.result, { type: 'array' });
        const parsed = parseWorkPlan(wb);
        if (!parsed.operationalExpenses.length && !parsed.clients.length) {
          setWpResult({ error: 'לא נמצאו נתונים תקינים בקובץ.' });
        } else {
          onWorkPlanUpload(parsed, file.name);
          setWpResult({ name: file.name });
        }
      } catch (err) {
        setWpResult({ error: `שגיאה בקריאת הקובץ: ${err.message}` });
      } finally {
        setWpUploading(false); e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const btn = (label, icon, onClick, disabled, bg = '#cc0000') => (
    <button onClick={onClick} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1, background: bg, color: '#fff', border: 'none', transition: 'opacity 0.15s' }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '0.88'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = disabled ? '0.4' : '1'; }}>
      <span>{icon}</span><span>{label}</span>
    </button>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e9ecef' }}>
      <h2 style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 20 }}>ייבוא / ייצוא נתונים</h2>

      {/* Export */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>ייצוא</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {btn('ייצוא לאקסל', '📥', () => exportToExcel(expenses), !expenses.length, '#16a34a')}
          {btn('ייצוא CSV',   '📄', () => exportToCSV(expenses),   !expenses.length, '#374151')}
        </div>
      </div>

      {/* Import */}
      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 20 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>ייבוא</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {btn(importing ? 'מייבא...' : 'ייבוא מאקסל / CSV', '📤', () => xlsxRef.current.click(), importing, '#cc0000')}
          {btn(importing ? 'מייבא...' : 'ייבוא PDF',         '📑', () => pdfRef.current.click(),  importing, '#1e2d3d')}
        </div>
      </div>

      <input ref={xlsxRef} type="file" accept=".xlsx,.xls,.csv" onChange={e => handleFile(e, 'xlsx')} style={{ display: 'none' }} />
      <input ref={pdfRef}  type="file" accept=".pdf"            onChange={e => handleFile(e, 'pdf')}  style={{ display: 'none' }} />

      {result && (
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 16px', borderRadius: 10, fontSize: 13, background: result.error ? '#fef2f2' : '#f0fdf4', color: result.error ? '#dc2626' : '#16a34a', border: `1px solid ${result.error ? '#fecaca' : '#bbf7d0'}` }}>
          <span style={{ flexShrink: 0 }}>{result.error ? '✗' : '✓'}</span>
          <div>
            {result.error
              ? <p>{result.error}</p>
              : result.cleared
                ? <p>כל הנתונים נמחקו בהצלחה</p>
                : <>
                    <p>יובאו <b>{result.count}</b> הוצאות בהצלחה</p>
                    {result.type === 'pdf' && (
                      <p style={{ marginTop: 4, fontSize: 12, color: '#15803d' }}>
                        הקטגוריות זוהו אוטומטית — ניתן לערוך בטבלת ההוצאות
                      </p>
                    )}
                  </>
            }
          </div>
        </div>
      )}

      {/* Work plan upload */}
      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 20, marginTop: 4 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>תוכנית עבודה — דלקים 2026</p>
        {workPlanFileName && (
          <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 10 }}>✓ קובץ פעיל: {workPlanFileName}</p>
        )}
        {btn(wpUploading ? 'טוען...' : 'העלה קובץ מעודכן', '📂', () => wpRef.current.click(), wpUploading, '#1e2d3d')}
        {wpResult && (
          <p style={{ fontSize: 12, marginTop: 8, fontWeight: 600, color: wpResult.error ? '#dc2626' : '#16a34a' }}>
            {wpResult.error || `✓ נטען בהצלחה: ${wpResult.name}`}
          </p>
        )}
        <input ref={wpRef} type="file" accept=".xlsx,.xls" onChange={handleWorkPlanFile} style={{ display: 'none' }} />
      </div>

      {/* Danger zone */}
      {expenses.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid #fecaca', paddingTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>אזור סכנה</p>
          {btn(`מחק את כל ${expenses.length} ההוצאות`, '🗑️', () => {
            if (window.confirm(`האם אתה בטוח? פעולה זו תמחק את כל ${expenses.length} ההוצאות ולא ניתן לשחזר.`)) {
              onClearAll();
              setResult({ count: 0, cleared: true });
            }
          }, false, '#dc2626')}
        </div>
      )}

      <div style={{ marginTop: 18, borderTop: '1px solid #f3f4f6', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ color: '#9ca3af', fontSize: 12 }}>
          <b>אקסל/CSV:</b> עמודות תאריך, קטגוריה, סכום (ואופציונלי: ספק, תיאור)
        </p>
        <p style={{ color: '#9ca3af', fontSize: 12 }}>
          <b>PDF:</b> הפרסור אוטומטי — מזהה טבלאות, תאריכים וסכומים. הקטגוריות מוקצות לפי מילות מפתח.
        </p>
      </div>
    </div>
  );
}
