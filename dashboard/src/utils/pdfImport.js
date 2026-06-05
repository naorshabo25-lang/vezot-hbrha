import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

const DATE_RE    = /\b(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})\b/;
const DECIMAL_RE = /^\d[\d,]*\.\d{2}$/;
const HEBREW_RE  = /[֐-׿]/;

const CATEGORY_KEYWORDS = {
  'דלק ואנרגיה':       ['דלק','תידלוק','אנרג','נפט','גז','בנזין','סולר'],
  'שכר עובדים':        ['שכר','משכורת','עובד'],
  'שיווק ופרסום':      ['שיווק','פרסום','מדיה','פייסבוק','גוגל'],
  'חומרי גלם וציוד':  ['בטון','ציוד','ברזל','חומרי','אספקת','בניה','עפר'],
  'שכירות':            ['שכירות','שכ"ד'],
  'חשמל ומים':         ['חשמל','מים','ארנונה'],
  'תוכנה ומערכות':    ['תוכנה','רישיון','מנוי','ענן','מערכות','בקרה'],
  'נסיעות ורכב':       ['נסיעה','חניה','רכב','טיסה'],
  'ייעוץ מקצועי':     ['ייעוץ','עורך','רואה חשבון','משפטי','יועץ'],
  'ביטוח ובטיחות':    ['ביטוח','בטיחות','תנועה'],
  'ייבוא ויצוא':      ['ייבוא','ייצוא','יבוא','יצוא'],
  'השקעות ופיננסים':  ['השקעות','קפיטל','פיננס'],
};

function guessCategory(text) {
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return cat;
  }
  return 'אחר';
}

function parseDate(str) {
  const m = str.match(DATE_RE);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = '20' + y;
  const date = new Date(`${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`);
  return isNaN(date) ? null : date.toISOString().slice(0, 10);
}

function parseAmount(str) {
  const clean = str.replace(/[₪\s]/g, '');
  if (!clean.match(/^[\d,]+\.?\d*$/)) return null;
  const val = parseFloat(clean.replace(/,/g, ''));
  return isNaN(val) || val <= 0 ? null : val;
}

// Group items into rows by Y coordinate, keeping pages separate to avoid cross-page merging
function groupIntoRows(items) {
  const rows = [];
  for (const item of items) {
    const y = Math.round(item.y);
    const existing = rows.find(r => r.page === item.page && Math.abs(r.y - y) <= 4);
    if (existing) {
      existing.cells.push(item);
    } else {
      rows.push({ y, page: item.page, cells: [item] });
    }
  }
  rows.sort((a, b) => a.page !== b.page ? a.page - b.page : b.y - a.y);
  rows.forEach(r => r.cells.sort((a, b) => b.x - a.x));
  return rows.map(r => r.cells.map(c => c.text.trim()).filter(Boolean));
}

// Handles Israeli accounting/ERP supplier-payment reports.
// Row layout (RTL, right→left): [acct-code(6d)] [vendor-name] [doc-num] [date] [value-date] [amount] [bank-key] ...
function trySupplierPayments(rows) {
  const ACCT_RE = /^\d{6}$/;
  const dataRows = rows.filter(r =>
    r.length >= 4 &&
    ACCT_RE.test(r[0]) &&
    r.some(c => DECIMAL_RE.test(c)) &&
    r.some(c => HEBREW_RE.test(c))
  );
  if (dataRows.length < 3) return null;

  const expenses = [];
  for (const row of dataRows) {
    // Vendor name = Hebrew cells between account-code and first date
    const firstDateIdx = row.findIndex(c => DATE_RE.test(c));
    const endIdx = firstDateIdx > 0 ? firstDateIdx : row.length;
    const vendor = row
      .slice(1, endIdx)
      .filter(c => HEBREW_RE.test(c) && c.length > 1)
      .join(' ');

    const date   = row.map(c => parseDate(c)).find(Boolean);
    const amount = row.map(c => (DECIMAL_RE.test(c) ? parseAmount(c) : null)).find(Boolean);

    if (!amount) continue;

    expenses.push({
      date:        date || new Date().toISOString().slice(0, 10),
      amount,
      description: vendor,
      vendor,
      category:    guessCategory(vendor),
    });
  }
  return expenses.length >= 2 ? expenses : null;
}

function detectColumns(rows) {
  const scores = { date: {}, amount: {}, desc: {} };
  for (const row of rows.slice(0, 20)) {
    row.forEach((cell, i) => {
      if (DATE_RE.test(cell))
        scores.date[i]   = (scores.date[i]   || 0) + 1;
      if (DECIMAL_RE.test(cell.replace(/₪\s*/, '')))
        scores.amount[i] = (scores.amount[i] || 0) + 1;
      if (cell.length > 4 && !DATE_RE.test(cell) && !/^\d/.test(cell))
        scores.desc[i]   = (scores.desc[i]   || 0) + 1;
    });
  }
  const best = obj => {
    const e = Object.entries(obj);
    return e.length ? Number(e.sort((a, b) => b[1] - a[1])[0][0]) : -1;
  };
  return { dateCol: best(scores.date), amountCol: best(scores.amount), descCol: best(scores.desc) };
}

export async function importFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allItems = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    const vp      = page.getViewport({ scale: 1 });
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const tx = pdfjsLib.Util.transform(vp.transform, item.transform);
      allItems.push({ text: item.str, x: tx[4], y: tx[5], page: p });
    }
  }

  if (!allItems.length) throw new Error('לא נמצא טקסט בקובץ');

  const rows     = groupIntoRows(allItems);
  const dataRows = rows.filter(r => r.length >= 2);
  if (!dataRows.length) throw new Error('לא ניתן לחלץ שורות מהקובץ');

  const supplierResult = trySupplierPayments(dataRows);
  if (supplierResult) return supplierResult;

  // Generic fallback for other PDF formats
  const { dateCol, amountCol, descCol } = detectColumns(dataRows);
  const expenses = [];
  for (const row of dataRows) {
    let date   = dateCol   >= 0 ? parseDate(row[dateCol]   || '') : null;
    let amount = amountCol >= 0 ? parseAmount(row[amountCol] || '') : null;
    let desc   = descCol   >= 0 ? (row[descCol] || '') : '';
    if (!date)   { for (const c of row) { date   = parseDate(c);   if (date)   break; } }
    if (!amount) { for (const c of row) { amount = parseAmount(c); if (amount) break; } }
    if (!desc)     desc = row.find(c => c.length > 3 && !DATE_RE.test(c) && !/^\d/.test(c)) || '';
    if (!amount) continue;
    expenses.push({
      date:        date || new Date().toISOString().slice(0, 10),
      amount,
      description: desc,
      vendor:      '',
      category:    guessCategory(row.join(' ')),
    });
  }
  return expenses;
}
