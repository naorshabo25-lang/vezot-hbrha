import * as XLSX from 'xlsx';

const COLUMN_MAP = {
  'תאריך': 'date',
  'קטגוריה': 'category',
  'סכום': 'amount',
  'תיאור': 'description',
  'ספק': 'vendor',
};

export function exportToExcel(expenses) {
  const rows = expenses.map(e => ({
    'תאריך': e.date,
    'קטגוריה': e.category,
    'ספק': e.vendor || '',
    'תיאור': e.description || '',
    'סכום': Number(e.amount),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'הוצאות');

  const colWidths = [{ wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 30 }, { wch: 12 }];
  ws['!cols'] = colWidths;

  XLSX.writeFile(wb, `הוצאות_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.xlsx`);
}

export function exportToCSV(expenses) {
  const headers = ['תאריך', 'קטגוריה', 'ספק', 'תיאור', 'סכום'];
  const rows = expenses.map(e =>
    [e.date, e.category, e.vendor || '', e.description || '', e.amount].join(',')
  );
  const csv = '﻿' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `הוצאות_${new Date().toLocaleDateString('he-IL').replace(/\//g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const expenses = raw.map(row => {
          const mapped = {};
          for (const [heKey, enKey] of Object.entries(COLUMN_MAP)) {
            if (row[heKey] !== undefined) mapped[enKey] = row[heKey];
          }
          // also accept English keys directly
          for (const enKey of Object.values(COLUMN_MAP)) {
            if (row[enKey] !== undefined && mapped[enKey] === undefined) {
              mapped[enKey] = row[enKey];
            }
          }
          // Normalize date
          if (mapped.date) {
            const d = new Date(mapped.date);
            if (!isNaN(d)) mapped.date = d.toISOString().slice(0, 10);
          }
          if (!mapped.date) mapped.date = new Date().toISOString().slice(0, 10);
          if (!mapped.category) mapped.category = 'אחר';
          if (!mapped.amount) mapped.amount = 0;
          return mapped;
        }).filter(e => e.amount || e.description || e.vendor);

        resolve(expenses);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}
