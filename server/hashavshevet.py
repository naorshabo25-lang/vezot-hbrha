import openpyxl
import re
import io

def _amount(val) -> float:
    if val is None or val == '':
        return 0.0
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).replace(',', '').replace(' ', '').replace('−', '-').replace('–', '-')
    if s.startswith('(') and s.endswith(')'):
        s = '-' + s[1:-1]
    try:
        return float(s)
    except:
        return 0.0

GROUP_INFO = {
    '100': {'name': 'הכנסות',              'type': 'revenue'},
    '300': {'name': 'הוצאות תפעוליות',     'type': 'opex'},
    '301': {'name': 'הוצאות משאיות',       'type': 'opex'},
    '302': {'name': 'משכורות',             'type': 'salary'},
    '304': {'name': 'עלות דלקים ושמנים',  'type': 'cogs'},
    '305': {'name': 'הוצאות מגרש',        'type': 'opex'},
    '306': {'name': 'הוצאות רכב',         'type': 'opex'},
    '307': {'name': 'ביטוחי רכב ורישיון', 'type': 'opex'},
    '309': {'name': 'הוצאות מימון',       'type': 'finance'},
    '390': {'name': 'הוצאות ביובית',      'type': 'opex'},
    '391': {'name': 'משכורות ביובית',     'type': 'salary'},
    '500': {'name': 'לקוחות',             'type': 'receivable'},
    '501': {'name': 'לקוחות מזדמנים',    'type': 'receivable'},
    '509': {'name': 'לקוחות ביובית',     'type': 'receivable'},
    '600': {'name': 'ספקים',              'type': 'payable'},
    '610': {'name': 'עובדים',             'type': 'other'},
    '700': {'name': 'בנקים',              'type': 'bank'},
    '701': {'name': 'אשראי (חובה)',       'type': 'bank'},
    '702': {'name': 'אשראי (זכות)',       'type': 'bank'},
    '720': {'name': 'בנק מעבר',          'type': 'bank'},
    '750': {'name': 'קופות',             'type': 'cash'},
    '760': {'name': 'קופה קטנה',        'type': 'cash'},
}

def parse_trial_balance(file_bytes: bytes) -> dict:
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    all_rows = []
    for row in ws.iter_rows(values_only=True):
        all_rows.append(['' if c is None else c for c in row])

    # Find column positions from header row
    col_group = col_account = col_name = col_debit = col_credit = col_diff = None
    header_idx = 0
    debug_rows = [' | '.join(str(c) for c in r[:10]) for r in all_rows[:10]]

    for i, row in enumerate(all_rows[:35]):
        row_s = [str(c).strip() for c in row]
        full = ' '.join(row_s)
        if ('חובה' in full or 'Debit' in full) and ('זכות' in full or 'Credit' in full):
            header_idx = i + 1
            for j, s in enumerate(row_s):
                sl = s.lower()
                if s in ('מיון', 'סיווג', 'קבוצה') or sl == 'group': col_group   = j
                elif s in ('חשבון', 'מספר חשבון') or sl in ('account', 'code'): col_account = j
                elif 'שם' in s or sl in ('name', 'description'):     col_name    = j
                elif s in ('חובה', 'Debit'):                          col_debit   = j
                elif s in ('זכות', 'Credit'):                        col_credit  = j
                elif 'הפרש' in s or 'יתרה' in s or sl == 'balance': col_diff    = j
            break

    # Extract period string
    period = ''
    for row in all_rows[:header_idx]:
        for c in row:
            s = str(c)
            if re.search(r'\d{2}/\d{2}/\d{2}', s) and ('עד' in s or 'מ-' in s or 'מ ' in s):
                period = s[:120]
                break
        if period:
            break

    groups: dict = {}

    for row in all_rows[header_idx:]:
        cells = ['' if c is None else c for c in row]
        row_text = ' '.join(str(c) for c in cells)

        if not any(str(c).strip() for c in cells):
            continue

        # Summary row  "סה"כ לקבוצה: 100"
        m = re.search(r'סה.?כ\s+לקבוצה\s*:?\s*\*{0,2}(\d{3})\*{0,2}', row_text)
        if m:
            gc = m.group(1)
            if gc in groups:
                nums = [_amount(c) for c in cells if _amount(c) != 0.0]
                if len(nums) >= 3:
                    groups[gc]['total_debit']  = nums[-3]
                    groups[gc]['total_credit'] = nums[-2]
                    groups[gc]['total_net']    = nums[-1]
                elif len(nums) == 2:
                    groups[gc]['total_debit']  = nums[0]
                    groups[gc]['total_credit'] = nums[1]
                    groups[gc]['total_net']    = nums[1] - nums[0]
                elif len(nums) == 1:
                    groups[gc]['total_net'] = nums[0]
            continue

        # Data row — find 6-digit account code
        account_code = None
        group_code   = None

        if col_account is not None and col_account < len(cells):
            s = str(cells[col_account]).strip()
            if re.match(r'^\d{6}$', s):
                account_code = s
                group_code   = s[:3]

        if col_group is not None and col_group < len(cells):
            s = str(cells[col_group]).strip()
            if re.match(r'^\d{3}$', s):
                group_code = s

        # Fallback scan
        if account_code is None:
            for c in cells:
                s = str(c).strip()
                if re.match(r'^\d{6}$', s):
                    account_code = s
                    group_code   = s[:3]
                    break

        if not account_code:
            continue

        if group_code not in groups:
            info = GROUP_INFO.get(group_code, {})
            groups[group_code] = {
                'name':         info.get('name', f'קבוצה {group_code}'),
                'type':         info.get('type', 'other'),
                'total_debit':  0.0,
                'total_credit': 0.0,
                'total_net':    0.0,
                'accounts':     [],
            }

        # Account name
        name = ''
        if col_name is not None and col_name < len(cells):
            name = str(cells[col_name]).strip()
        if not name:
            for c in cells:
                s = str(c).strip()
                if s and not re.match(r'^[\d,.\-()]+$', s) and len(s) > 2:
                    name = s
                    break

        # Amounts
        debit = credit = diff = 0.0
        if col_debit  is not None and col_debit  < len(cells): debit  = _amount(cells[col_debit])
        if col_credit is not None and col_credit < len(cells): credit = _amount(cells[col_credit])
        if col_diff   is not None and col_diff   < len(cells): diff   = _amount(cells[col_diff])
        if diff == 0.0:
            diff = credit - debit

        if debit == 0.0 and credit == 0.0 and diff == 0.0:
            continue

        groups[group_code]['accounts'].append({
            'code':   account_code,
            'name':   name,
            'debit':  debit,
            'credit': credit,
            'net':    diff,
        })

    # Fill totals from accounts if summary row wasn't found
    for gc, gd in groups.items():
        if gd['total_net'] == 0.0 and gd['accounts']:
            gd['total_debit']  = sum(a['debit']  for a in gd['accounts'])
            gd['total_credit'] = sum(a['credit'] for a in gd['accounts'])
            gd['total_net']    = sum(a['net']    for a in gd['accounts'])

    return {
        'period': period,
        'groups': groups,
        '_debug': {
            'header_row': header_idx,
            'cols': {'group': col_group, 'account': col_account, 'name': col_name,
                     'debit': col_debit, 'credit': col_credit, 'diff': col_diff},
            'total_data_rows': len(all_rows) - header_idx,
            'groups_found': list(groups.keys()),
            'first_rows': debug_rows,
        }
    }
