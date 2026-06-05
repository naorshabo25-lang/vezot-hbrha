export const DEFAULT_OP_EXPENSES = [
  // קבוצה 300 — הוצאות כלליות
  { name: 'הובלות דלקים',              amount: 17434, note: '300066' },
  { name: 'שכירות מגרש עטרות (אולימפיה)', amount: 18875, note: '305015' },
  { name: 'אחזקת מגרש עטרות',          amount: 5454,  note: '300068' },
  { name: 'פרסום',                     amount: 17637, note: '300022' },
  { name: 'דמי ניהול',                 amount: 35000, note: '300053 — בית יאיר' },
  { name: 'שירות תוכנת הנהלת חשבונות', amount: 2273,  note: '300059' },
  { name: 'הנהלת חשבונות',             amount: 1375,  note: '300049' },
  { name: 'שי לעובדים',                amount: 2500,  note: '300031' },
  { name: 'משרדיות',                   amount: 3214,  note: '300014' },
  { name: 'ביטוחים',                   amount: 1555,  note: '300009' },
  { name: 'אחזקה',                     amount: 4490,  note: '300005' },
  { name: 'אחזקת ציוד',               amount: 759,   note: '300004' },
  { name: 'אחזקת מחשבים',             amount: 849,   note: '300043' },
  { name: 'עיבוד שכר חילן',            amount: 1148,  note: '300055' },
  { name: 'קצין בטיחות',               amount: 1102,  note: '300010' },
  { name: 'הדפסות',                    amount: 1050,  note: '300012' },
  { name: 'שירותי מידע',               amount: 1250,  note: '300016' },
  { name: 'הוצ טלפון',                 amount: 813,   note: '300044' },
  { name: 'הוצאות תקשורת למשאיות',    amount: 298,   note: '300061' },
  { name: 'הוצאות איתוראן',            amount: 989,   note: '300062' },
  { name: 'כיבודים',                   amount: 1177,  note: '300045' },
  { name: 'הוצאות משפטיות',            amount: 692,   note: '300013' },
  { name: 'יעוץ עסקי',                amount: 413,   note: '300065' },
  { name: 'קורסים והשתלמות',           amount: 532,   note: '300042' },
  { name: 'ביגוד נהגים',               amount: 380,   note: '300008' },
  { name: 'אגרות',                     amount: 381,   note: '300024' },
  { name: 'בר מים',                    amount: 264,   note: '300027' },
  { name: 'נסיעות',                    amount: 10,    note: '300023' },
  { name: 'שיווק',                     amount: 481,   note: '300032' },
  { name: 'קנסות',                     amount: 456,   note: '300046' },
  { name: 'קבלני משנה (סולר)',          amount: 177,   note: '300071' },
  { name: 'השכרת סילברדו 48166801',    amount: 3500,  note: '301018' },
  { name: 'הוצאות סליקת אשראי',        amount: 45,    note: '300067' },
  { name: 'מיכלים',                    amount: 208,   note: '300069' },
  { name: 'בדיקת פוליגרף',             amount: 939,   note: '300070' },
  // קבוצה 301 — הוצאות משאיות
  { name: 'הוצאות משאיות',             amount: 26506, note: '301 — סה"כ' },
  // קבוצה 305 — מגרש לוגיסטי
  { name: 'שכירות מגרש דוד בניסטי',   amount: 3750,  note: '305011' },
  { name: 'ארנונה עטרות',              amount: 2408,  note: '305017' },
  { name: 'חשמל עטרות',               amount: 226,   note: '305016' },
  { name: 'הוצ חשמל מגרש חדש',        amount: 167,   note: '305010' },
  { name: 'הוצאות סים מגרש עטרות',    amount: 132,   note: '305014' },
  { name: 'מים עטרות',                amount: 135,   note: '305018' },
  { name: 'הוצאות מגרש דוד בניסטי',   amount: 208,   note: '305012' },
  { name: 'אחזקה מגרש דוד בניסטי',    amount: 369,   note: '305013' },
  // קבוצה 306 — הוצאות רכב
  { name: 'הוצאות רכב',               amount: 11304, note: '306 — סה"כ' },
  // קבוצה 307 — ביטוחי רכב ורישיונות
  { name: 'ביטוחי רכב ורישיונות',      amount: 10910, note: '307 — סה"כ' },
  // קבוצה 309 — הוצאות מימון
  { name: 'הוצאות מימון',              amount: 17563, note: '309 — סה"כ' },
  // קבוצה 390 — הוצאות ביובית
  { name: 'הוצאות ביובית',             amount: 15925, note: '390 — סה"כ' },
];

export const DEFAULT_SALARIES = [
  { name: 'נאור',   amount: 25000, note: '' },
  { name: 'ישראל',  amount: 16000, note: '' },
  { name: 'אסף',    amount: 15000, note: '' },
  { name: 'רוסטי',  amount: 15000, note: '' },
  { name: 'אפרת',   amount: 8000,  note: 'לחלק חצי עם ביובית' },
  { name: 'נעמי',   amount: 7500,  note: 'לחלק חצי עם ביובית' },
];

export const DEFAULT_CLIENTS = [
  { name: 'הכנסות סולר תחבורה',         liters: 0, profit: 2058044, note: '100003' },
  { name: 'הכנסות כרטיסי תדלוק',        liters: 0, profit: 115693,  note: '100004' },
  { name: 'הכנסות ביובית',              liters: 0, profit: 109585,  note: '100900' },
  { name: 'הכנסות נוזל גנרטורים והסקה', liters: 0, profit: 106928,  note: '100005' },
  { name: 'הכנסות מהובלות',             liters: 0, profit: 66755,   note: '100009' },
  { name: 'הכנסות אוריאה',              liters: 0, profit: 15124,   note: '100007' },
  { name: 'הכנסות מענק עם כלביא',       liters: 0, profit: 8532,    note: '100023' },
  { name: 'הכנסות מריבית ועמלות',       liters: 0, profit: 5648,    note: '100021' },
  { name: 'הכנסות שמנים ותוספים',       liters: 0, profit: 4598,    note: '100006' },
  { name: 'הכנסות מוצרים משלימים',      liters: 0, profit: 1720,    note: '100008' },
];

export const DEFAULT_FUEL_PURCHASES = [
  { name: 'קניות דלקים',                   amount: 1803069, note: '304001' },
  { name: 'כרטיסי תדלוק',                  amount: 99444,   note: '304003' },
  { name: 'קניות שמנים ותוספים',            amount: 83580,   note: '304000' },
  { name: 'קניות מוצרים משלימים',           amount: 1640,    note: '304005' },
  { name: 'קניות שירותים משלימים',          amount: 1189,    note: '304006' },
  { name: 'כרטיס תדלוק ישראל מזרחי',       amount: 755,     note: '304009' },
];

export const DEFAULT_WORKPLAN = {
  operationalExpenses: DEFAULT_OP_EXPENSES,
  salaries:            DEFAULT_SALARIES,
  fuelPurchases:       DEFAULT_FUEL_PURCHASES,
  clients:             DEFAULT_CLIENTS,
};
