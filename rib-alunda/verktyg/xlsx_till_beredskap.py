# Konverterar beredskapsschemat (Excel) till data/beredskap.js.
# Användning: python3 verktyg/xlsx_till_beredskap.py "Beredskap Alunda 2026.xlsx" > data/beredskap.js
# Kräver: pip install openpyxl. Förutsätter samma layout som 2026 års fil.
import sys, re, json, openpyxl
ws = openpyxl.load_workbook(sys.argv[1]).active
clean = lambda s: re.sub(r'\s+', ' ', str(s).replace('\xa0', ' ')).strip()
groups, cur = [], None
for r in range(1, 44):
    a, b, c = (ws.cell(r, i).value for i in (1, 2, 3))
    if a and str(a).startswith('Grupp') or a == 'D':
        weeks = [ws.cell(r, i).value for i in range(3, 25) if isinstance(ws.cell(r, i).value, int)]
        cur = {'namn': clean(a) if a != 'D' else 'Grupp D', 'veckor': weeks, 'personal': []}
        groups.append(cur)
    elif a and b:
        cur['personal'].append({'roll': '/'.join(clean(a).split()), 'namn': clean(b), 'tel': clean(c)})
nummer = [{'namn': clean(ws.cell(r, 1).value), 'tel': clean(ws.cell(r, 3).value)} for r in range(46, 52)]
helger = [{'vecka': ws.cell(r, 10).value, 'namn': clean(ws.cell(r, 11).value).replace('(2025/2026', '(2025/2026)')} for r in range(46, 51)]
data = {'ar': 2026, 'grupper': groups, 'viktigaNummer': nummer, 'storhelger': helger}
print('// Beredskapsschema – genererad från "Beredskap Alunda 2026.xlsx". Innehåller personuppgifter: committa inte.')
print('window.BEREDSKAP = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';')
