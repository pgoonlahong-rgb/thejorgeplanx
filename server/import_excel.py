import os
import pandas as pd
import mysql.connector
from urllib.parse import urlparse

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    print("Error: DATABASE_URL not found in environment variables.")
    exit(1)

parsed = urlparse(database_url)
conn = mysql.connector.connect(
    host=parsed.hostname,
    port=parsed.port or 3306,
    user=parsed.username,
    password=parsed.password,
    database=parsed.path.lstrip('/')
)
cursor = conn.cursor()

excel_path = '/home/ubuntu/upload/แผนพัฒนาท้องถิ่น_ตรวจสอบงบประมาณ-1.xlsx'
xls = pd.ExcelFile(excel_path)

def clean_val(val, default=""):
    if pd.isna(val):
        return None
    if isinstance(val, str):
        val = val.strip()
        return val if val != "" else None
    return val

def clean_num(val):
    if pd.isna(val):
        return 0.0
    try:
        # ถ้ารูปแบบมีคอมมา ให้ลบออก
        if isinstance(val, str):
            val = val.replace(',', '').strip()
            if val == '' or val == '-':
                return 0.0
        return float(val)
    except:
        return 0.0

print("Clearing existing data...")
cursor.execute("DELETE FROM projects;")
cursor.execute("DELETE FROM equipment;")
conn.commit()

# 1. บัญชีโครงการ
df_proj = pd.read_excel(xls, 'บัญชีโครงการ')
print(f"Importing บัญชีโครงการ: {len(df_proj)} rows")
for idx, row in df_proj.iterrows():
    b66 = clean_num(row.get(2566, 0))
    b67 = clean_num(row.get(2567, 0))
    b68 = clean_num(row.get(2568, 0))
    b69 = clean_num(row.get(2569, 0))
    b70 = clean_num(row.get(2570, 0))
    tot = b66 + b67 + b68 + b69 + b70
    
    act_bud = clean_num(row.get('งบที่ได้รับจริง (บาท)', 0))
    
    sql = """
    INSERT INTO projects (
        row_no, code_id, strategy, plan_name, project_name, target,
        budget_2566, budget_2567, budget_2568, budget_2569, budget_2570, total_budget,
        department, work_type, village_no, plan_book, page_no, item_no,
        recheck, source_info, old_code_id, budget_status, budget_year_received,
        actual_budget_received, action_plan_count, action_plan_name, check_pdf, is_exceeded
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 0)
    """
    vals = (
        clean_val(row.get('ลำดับที่')),
        clean_val(row.get('รหัส ID')),
        clean_val(row.get('ยุทธศาสตร์')),
        clean_val(row.get('แผนงาน')),
        str(row.get('ชื่อโครงการ', 'ไม่ระบุชื่อโครงการ')),
        clean_val(row.get('เป้าหมาย (ผลผลิตของโครงการ)')),
        b66, b67, b68, b69, b70, tot,
        clean_val(row.get('หน่วยงานรับผิดชอบ')),
        clean_val(row.get('ประเภทงาน (ยศ.5)')),
        clean_val(row.get('หมู่ที่ (ยศ.5)')),
        clean_val(row.get('เล่มแผนพัฒนาฯ')),
        str(row.get('หน้า')) if not pd.isna(row.get('หน้า')) else None,
        str(row.get('ข้อ')) if not pd.isna(row.get('ข้อ')) else None,
        clean_val(row.get('ตรวจซ้ำ')),
        clean_val(row.get('แหล่งข้อมูล')),
        clean_val(row.get('รหัส ID เดิม')),
        clean_val(row.get('สถานะงบประมาณ')),
        str(row.get('ปีงบประมาณที่ได้รับ')) if not pd.isna(row.get('ปีงบประมาณที่ได้รับ')) else None,
        act_bud,
        int(clean_num(row.get('จำนวนครั้งที่ปรากฏในแผนดำเนินงาน', 0))),
        clean_val(row.get('ชื่อโครงการในแผนดำเนินงาน')),
        clean_val(row.get('ตรวจกับ PDF'))
    )
    cursor.execute(sql, vals)

# 2. โครงการเกินศักยภาพ
df_exc = pd.read_excel(xls, 'โครงการเกินศักยภาพ')
print(f"Importing โครงการเกินศักยภาพ: {len(df_exc)} rows")
for idx, row in df_exc.iterrows():
    b66 = clean_num(row.get(2566, 0))
    b67 = clean_num(row.get(2567, 0))
    b68 = clean_num(row.get(2568, 0))
    b69 = clean_num(row.get(2569, 0))
    b70 = clean_num(row.get(2570, 0))
    tot = b66 + b67 + b68 + b69 + b70
    
    act_bud = clean_num(row.get('งบที่ได้รับจริง (บาท)', 0))
    
    sql = """
    INSERT INTO projects (
        row_no, code_id, strategy, plan_name, project_name, target,
        budget_2566, budget_2567, budget_2568, budget_2569, budget_2570, total_budget,
        department, work_type, village_no, plan_book, page_no, item_no,
        recheck, source_info, old_code_id, budget_status, budget_year_received,
        actual_budget_received, action_plan_count, action_plan_name, check_pdf, is_exceeded
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 1)
    """
    vals = (
        clean_val(row.get('ลำดับที่')),
        clean_val(row.get('รหัส ID')),
        clean_val(row.get('ยุทธศาสตร์')),
        clean_val(row.get('แผนงาน')),
        str(row.get('ชื่อโครงการ', 'ไม่ระบุชื่อโครงการ')),
        clean_val(row.get('เป้าหมาย (ผลผลิตของโครงการ)')),
        b66, b67, b68, b69, b70, tot,
        clean_val(row.get('หน่วยงานรับผิดชอบ')),
        clean_val(row.get('ประเภทงาน (ยศ.5)')),
        clean_val(row.get('หมู่ที่ (ยศ.5)')),
        clean_val(row.get('เล่มแผนพัฒนาฯ')),
        str(row.get('หน้า')) if not pd.isna(row.get('หน้า')) else None,
        str(row.get('ข้อ')) if not pd.isna(row.get('ข้อ')) else None,
        clean_val(row.get('ตรวจซ้ำ')),
        clean_val(row.get('แหล่งข้อมูล')),
        clean_val(row.get('รหัส ID เดิม')),
        clean_val(row.get('สถานะงบประมาณ')),
        str(row.get('ปีงบประมาณที่ได้รับ')) if not pd.isna(row.get('ปีงบประมาณที่ได้รับ')) else None,
        act_bud,
        int(clean_num(row.get('จำนวนครั้งที่ปรากฏในแผนดำเนินงาน', 0))),
        clean_val(row.get('ชื่อโครงการในแผนดำเนินงาน')),
        clean_val(row.get('ตรวจกับ PDF'))
    )
    cursor.execute(sql, vals)

# 3. บัญชีครุภัณฑ์
df_eq = pd.read_excel(xls, 'บัญชีครุภัณฑ์')
print(f"Importing บัญชีครุภัณฑ์: {len(df_eq)} rows")
for idx, row in df_eq.iterrows():
    b66 = clean_num(row.get(2566, 0))
    b67 = clean_num(row.get(2567, 0))
    b68 = clean_num(row.get(2568, 0))
    b69 = clean_num(row.get(2569, 0))
    b70 = clean_num(row.get(2570, 0))
    tot = b66 + b67 + b68 + b69 + b70
    
    act_bud = clean_num(row.get('งบที่ได้รับจริง (บาท)', 0))
    
    sql = """
    INSERT INTO equipment (
        row_no, code_id, plan_name, equipment_type, equipment_name, target,
        budget_2566, budget_2567, budget_2568, budget_2569, budget_2570, total_budget,
        department, plan_book, page_no, item_no,
        recheck, source_info, old_code_id, budget_status, budget_year_received,
        actual_budget_received, action_plan_count, action_plan_name, check_pdf
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    vals = (
        clean_val(row.get('ลำดับที่')),
        clean_val(row.get('รหัส ID')),
        clean_val(row.get('แผนงาน')),
        clean_val(row.get('ประเภทครุภัณฑ์')),
        str(row.get('ชื่อครุภัณฑ์', 'ไม่ระบุชื่อครุภัณฑ์')),
        clean_val(row.get('เป้าหมาย (ผลผลิตของครุภัณฑ์)')),
        b66, b67, b68, b69, b70, tot,
        clean_val(row.get('หน่วยงานรับผิดชอบ')),
        clean_val(row.get('เล่มแผนพัฒนาฯ')),
        str(row.get('หน้า')) if not pd.isna(row.get('หน้า')) else None,
        str(row.get('ข้อ')) if not pd.isna(row.get('ข้อ')) else None,
        clean_val(row.get('ตรวจซ้ำ')),
        clean_val(row.get('แหล่งข้อมูล')),
        clean_val(row.get('รหัส ID เดิม')),
        clean_val(row.get('สถานะงบประมาณ')),
        str(row.get('ปีงบประมาณที่ได้รับ')) if not pd.isna(row.get('ปีงบประมาณที่ได้รับ')) else None,
        act_bud,
        int(clean_num(row.get('จำนวนครั้งที่ปรากฏในแผนดำเนินงาน', 0))),
        clean_val(row.get('ชื่อโครงการในแผนดำเนินงาน')),
        clean_val(row.get('ตรวจกับ PDF'))
    )
    cursor.execute(sql, vals)

conn.commit()
cursor.close()
conn.close()
print("Excel import completed successfully!")
