#!/usr/bin/env python3
"""
Generates Brandresan.msapp – Power Apps Canvas App for Brandresan.

NOTE: SQL-anslutningen konfigureras efter import i Power Apps.
      Lägg till datakällorna Lessons och LessonEquipment.
"""

import json
import zipfile
import uuid
import io
import os

def uid():
    return str(uuid.uuid4())

# ── Stabila kontroll-ID:n ──────────────────────────────────────────────────
IDS = {k: uid() for k in [
    'screen',
    'lblTitle', 'lblToday', 'lblCount',
    'galLessons', 'galLessonTime', 'galLessonTitle', 'galLessonMeta',
    'cntEmpty', 'lblEmptyMsg',
    'cntDetail',
    'lblDetailTime', 'lblDetailType', 'lblDetailTitle',
    'lblDetailLocation', 'lblDetailInstructor', 'lblDetailFocus',
    'lblEquipHeader', 'galEquipment', 'galEquipItem',
]}

# ── Varumärkesfärger ───────────────────────────────────────────────────────
C = {
    'dark':     'RGBA(15, 27, 45, 1)',
    'accent':   'RGBA(214, 63, 43, 1)',
    'blue':     'RGBA(15, 54, 89, 1)',
    'bg':       'RGBA(238, 242, 246, 1)',
    'white':    'RGBA(255, 255, 255, 1)',
    'trans':    'RGBA(0, 0, 0, 0)',
    'gray':     'RGBA(107, 114, 128, 1)',
    'selected': 'RGBA(255, 242, 238, 1)',
    'current':  'RGBA(232, 247, 240, 1)',
}

# ── Hjälpfunktioner ────────────────────────────────────────────────────────
def R(prop, script, cat='Data'):
    return {
        'Property': prop,
        'Category': cat,
        'Value': script,
        'InvariantScript': script,
        'RuleProviderType': 'Unknown',
    }

def lbl(name, cid, x, y, w, h, text, *,
        size=14, bold=False, color=None, fill=None,
        align='Left', wrap=False, visible='true',
        pt=8, pb=8, pl=12, pr=12):
    color = color or C['dark']
    fill  = fill  or C['trans']
    rules = [
        R('Text',          text),
        R('X',             str(x),                        'Design'),
        R('Y',             str(y),                        'Design'),
        R('Width',         str(w),                        'Design'),
        R('Height',        str(h),                        'Design'),
        R('Size',          str(size),                     'Design'),
        R('Bold',          'true' if bold else 'false',   'Design'),
        R('Color',         color,                         'Design'),
        R('Fill',          fill,                          'Design'),
        R('Align',         f'Align.{align}',              'Design'),
        R('Visible',       visible),
        R('PaddingTop',    str(pt),                       'Design'),
        R('PaddingBottom', str(pb),                       'Design'),
        R('PaddingLeft',   str(pl),                       'Design'),
        R('PaddingRight',  str(pr),                       'Design'),
    ]
    if wrap:
        rules.append(R('Wrap', 'true', 'Design'))
    return {
        'ControlName':          name,
        'ControlId':            cid,
        'PublishedControlType': 'Label',
        'VariantName':          'Label',
        'Rules':                rules,
        'Children':             [],
    }

def container(name, cid, x, y, w, h, visible, fill=None, children=None, radius=12):
    fill = fill or C['white']
    return {
        'ControlName':          name,
        'ControlId':            cid,
        'PublishedControlType': 'GroupContainer',
        'VariantName':          'ManualLayout',
        'Rules': [
            R('X',                  str(x),    'Design'),
            R('Y',                  str(y),    'Design'),
            R('Width',              str(w),    'Design'),
            R('Height',             str(h),    'Design'),
            R('Visible',            visible),
            R('Fill',               fill,      'Design'),
            R('RadiusTopLeft',      str(radius), 'Design'),
            R('RadiusTopRight',     str(radius), 'Design'),
            R('RadiusBottomLeft',   str(radius), 'Design'),
            R('RadiusBottomRight',  str(radius), 'Design'),
            R('DropShadow',         'DropShadow.Light', 'Design'),
        ],
        'Children': children or [],
    }

# ── TemplateFill-formel för lektionsgalleri ────────────────────────────────
_sel  = C['selected']
_cur  = C['current']
_wht  = C['white']
_now  = 'TimeValue(Text(Now(), "[$-sv-SE]hh:mm"))'

GAL_TEMPLATE_FILL = (
    f'If(!IsBlank(varSelectedLesson) && ThisItem.Id = varSelectedLesson.Id, {_sel}, '
    f'If({_now} >= ThisItem.StartTime && {_now} <= ThisItem.EndTime, {_cur}, {_wht}))'
)

# ── Utrustningsgalleri ─────────────────────────────────────────────────────
gal_equip = {
    'ControlName':          'galEquipment',
    'ControlId':            IDS['galEquipment'],
    'PublishedControlType': 'Gallery',
    'VariantName':          'BrowseLayout_Vertical_OneTextVariant',
    'Rules': [
        R('Items',           'Filter(LessonEquipment, LessonId = varSelectedLesson.Id)'),
        R('X',               '20',    'Design'),
        R('Y',               '316',   'Design'),
        R('Width',           '686',   'Design'),
        R('Height',          '236',   'Design'),
        R('TemplatePadding', '2',     'Design'),
        R('TemplateSize',    '36',    'Design'),
        R('ShowScrollbar',   'true',  'Design'),
        R('WrapCount',       '1',     'Design'),
        R('TemplateFill',    C['white'], 'Design'),
    ],
    'Children': [
        lbl('galEquipItem', IDS['galEquipItem'],
            8, 8, 670, 22,
            '"• " & ThisItem.EquipmentName',
            size=13, color=C['dark'],
            pt=0, pb=0, pl=0, pr=0),
    ],
}

# ── Detaljpanel ────────────────────────────────────────────────────────────
cnt_detail = container(
    'cntDetail', IDS['cntDetail'],
    620, 140, 726, 580,
    '!IsBlank(varSelectedLesson)',
    children=[
        lbl('lblDetailTime', IDS['lblDetailTime'],
            20, 20, 686, 32,
            'Text(varSelectedLesson.StartTime, "[$-sv-SE]hh:mm") & " \u2013 " & Text(varSelectedLesson.EndTime, "[$-sv-SE]hh:mm")',
            size=13, color=C['accent'], bold=True,
            pt=0, pb=0, pl=0, pr=0),

        lbl('lblDetailType', IDS['lblDetailType'],
            20, 52, 350, 28,
            'varSelectedLesson.LessonType',
            size=12, color=C['gray'],
            pt=0, pb=0, pl=0, pr=0),

        lbl('lblDetailTitle', IDS['lblDetailTitle'],
            20, 80, 686, 48,
            'varSelectedLesson.Title',
            size=18, bold=True, color=C['dark'],
            pt=0, pb=0, pl=0, pr=0),

        lbl('lblDetailLocation', IDS['lblDetailLocation'],
            20, 136, 686, 28,
            '"Plats: " & varSelectedLesson.Location',
            size=13, color=C['dark'],
            pt=0, pb=0, pl=0, pr=0),

        lbl('lblDetailInstructor', IDS['lblDetailInstructor'],
            20, 164, 686, 28,
            '"Instruktr: " & varSelectedLesson.Instructor',
            size=13, color=C['dark'],
            pt=0, pb=0, pl=0, pr=0),

        lbl('lblDetailFocus', IDS['lblDetailFocus'],
            20, 200, 686, 80,
            'varSelectedLesson.Focus',
            size=13, color=C['dark'], wrap=True,
            pt=0, pb=0, pl=0, pr=0),

        lbl('lblEquipHeader', IDS['lblEquipHeader'],
            20, 288, 686, 28,
            '"Utrustning"',
            size=14, bold=True, color=C['blue'],
            pt=0, pb=0, pl=0, pr=0),

        gal_equip,
    ],
)

# ── Tom vy (inget val) ─────────────────────────────────────────────────────
cnt_empty = container(
    'cntEmptyState', IDS['cntEmpty'],
    620, 140, 726, 580,
    'IsBlank(varSelectedLesson)',
    children=[
        lbl('lblEmptyMsg', IDS['lblEmptyMsg'],
            0, 220, 726, 60,
            '"Vlj ett pass till vnster fr att se detaljer."',
            size=15, color=C['gray'], align='Center', wrap=True,
            pt=0, pb=0, pl=16, pr=16),
    ],
)

# ── Lektionsgalleri ────────────────────────────────────────────────────────
gal_lessons = {
    'ControlName':          'galLessons',
    'ControlId':            IDS['galLessons'],
    'PublishedControlType': 'Gallery',
    'VariantName':          'BrowseLayout_Vertical_TitleSubtitleAndBody3',
    'Rules': [
        R('Items',           'colTodayLessons'),
        R('OnSelect',        'Set(varSelectedLesson, ThisItem)'),
        R('X',               '20',          'Design'),
        R('Y',               '140',         'Design'),
        R('Width',           '580',         'Design'),
        R('Height',          '580',         'Design'),
        R('TemplatePadding', '6',           'Design'),
        R('TemplateSize',    '92',          'Design'),
        R('ShowScrollbar',   'false',       'Design'),
        R('WrapCount',       '1',           'Design'),
        R('TemplateFill',    GAL_TEMPLATE_FILL, 'Design'),
        R('BorderThickness', '0',           'Design'),
        R('Fill',            C['trans'],    'Design'),
    ],
    'Children': [
        lbl('galLessonTime', IDS['galLessonTime'],
            12, 8, 320, 28,
            'Text(ThisItem.StartTime, "[$-sv-SE]hh:mm") & " \u2013 " & Text(ThisItem.EndTime, "[$-sv-SE]hh:mm")',
            size=12, color=C['accent'], bold=True,
            pt=0, pb=0, pl=0, pr=0),

        lbl('galLessonTitle', IDS['galLessonTitle'],
            12, 36, 520, 28,
            'ThisItem.Title',
            size=14, bold=True, color=C['dark'],
            pt=0, pb=0, pl=0, pr=0),

        lbl('galLessonMeta', IDS['galLessonMeta'],
            12, 64, 520, 22,
            'ThisItem.LessonType & " | " & ThisItem.Location',
            size=12, color=C['gray'],
            pt=0, pb=0, pl=0, pr=0),
    ],
}

# ── OnVisible-formel ───────────────────────────────────────────────────────
ON_VISIBLE = (
    'Refresh(Lessons);\n'
    'Refresh(LessonEquipment);\n'
    'ClearCollect(\n'
    '    colTodayLessons,\n'
    '    SortByColumns(\n'
    '        Filter(Lessons, LessonDate = Today()),\n'
    '        "StartTime"\n'
    '    )\n'
    ');'
)

# ── Skärm ──────────────────────────────────────────────────────────────────
screen = {
    'TopParent': {
        'ControlName':          'scrSchedule',
        'ControlId':            IDS['screen'],
        'PublishedControlType': 'CanvasComponent',
        'VariantName':          'Screen',
        'Rules': [
            R('Fill',      C['bg'],     'Design'),
            R('OnVisible', ON_VISIBLE),
        ],
        'Children': [
            lbl('lblTitle', IDS['lblTitle'],
                0, 0, 1366, 72,
                '"Brandresan \u2014 Dagens schema"',
                size=24, bold=True,
                color=C['white'], fill=C['blue'],
                align='Left',
                pt=16, pb=8, pl=32, pr=32),

            lbl('lblToday', IDS['lblToday'],
                0, 72, 900, 48,
                'Upper(Left(Text(Today(), "[$-sv-SE]dddd d mmmm"), 1)) & Mid(Text(Today(), "[$-sv-SE]dddd d mmmm"), 2, 100)',
                size=16, color=C['dark'], fill=C['bg'],
                pt=12, pb=8, pl=32, pr=0),

            lbl('lblCount', IDS['lblCount'],
                900, 72, 466, 48,
                'CountRows(colTodayLessons) & " pass"',
                size=14, color=C['gray'], fill=C['bg'],
                align='Right',
                pt=16, pb=8, pl=0, pr=32),

            gal_lessons,
            cnt_empty,
            cnt_detail,
        ],
    }
}

# ── Manifest-filer ─────────────────────────────────────────────────────────
header = {
    'FormatVersion': '2.1',
    'SaveFormat':    'PublishOnly',
}

properties = {
    'Author':                    '',
    'AppCreationSource':         'AppFromScratch',
    'AppCreationSourceVersion':  '3.23121.18',
    'BackgroundColor':           'rgba(238, 242, 246, 1)',
    'CustomProperties':          [],
    'DefaultConnectedEntities':  [],
    'DesignWidth':               1366,
    'DesignHeight':              768,
    'DocumentAppType':           'CanvasApp',
    'DocumentLayoutOrientation': 'landscape',
    'DocumentLayoutScaleToFit':  False,
    'DocumentLayoutWidth':       1366,
    'DocumentLayoutHeight':      768,
    'EnableInstrumentation':     False,
    'Id':                        uid(),
    'LocalConnectionReferences': {},
    'LocalDatabaseReferences':   {},
    'MinClientVersion':          {'Major': 2, 'Minor': 2},
    'Name':                      'Brandresan',
    'PublishNotificationUrl':    '',
    'ScreenOrder':               ['scrSchedule'],
    'Version':                   1,
    'OriginatingVersion':        1,
}

entropy = {
    'Version':          1,
    'ControlUniqueIds': list(IDS.values()),
}

content_types_xml = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="json" ContentType="application/json"/>'
    '<Default Extension="xml"  ContentType="application/xml"/>'
    '</Types>'
)

# ── Bygg .msapp (ZIP) ──────────────────────────────────────────────────────
output_path = os.path.join(os.path.dirname(__file__), 'Brandresan.msapp')

buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
    zf.writestr('[Content_Types].xml',                 content_types_xml)
    zf.writestr('Header.json',                         json.dumps(header,      indent=2, ensure_ascii=False))
    zf.writestr('Properties.json',                     json.dumps(properties,  indent=2, ensure_ascii=False))
    zf.writestr('Entropy.json',                        json.dumps(entropy,     indent=2, ensure_ascii=False))
    zf.writestr('Controls/Screens/scrSchedule.json',  json.dumps(screen,      indent=2, ensure_ascii=False))
    zf.writestr('DataSources/DataSources.json',        json.dumps([],          indent=2))

buf.seek(0)
with open(output_path, 'wb') as f:
    f.write(buf.read())

size_kb = os.path.getsize(output_path) // 1024
print(f"Skapad: {output_path}  ({size_kb} KB)")
print()
print("VIKTIGT efter import i Power Apps:")
print("  1. Data > Lagg till datakalla > SQL Server")
print("  2. Lagg till tabellen: Lessons")
print("  3. Lagg till tabellen: LessonEquipment")
print("  4. Navigera till scrSchedule (OnVisible laddar data automatiskt)")
