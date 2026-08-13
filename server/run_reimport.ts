import { getDb } from './db';
import { projects, equipment, projectTimelines } from '../drizzle/schema';
import { projectInsert, equipmentInsert } from './routers';
import xlsx from 'xlsx';
import fs from 'fs';

function readSheetWithFill(workbook: xlsx.WorkBook, name: string) {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Sheet ${name} not found`);
  const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet);
  let lastStrategy = '';
  let lastPlan = '';
  let lastEquipmentType = '';
  return rows.map(row => {
    if (row['ยุทธศาสตร์']) {
      lastStrategy = String(row['ยุทธศาสตร์']).trim();
    } else if (lastStrategy) {
      row['ยุทธศาสตร์'] = lastStrategy;
    }
    if (row['แผนงาน']) {
      lastPlan = String(row['แผนงาน']).trim();
    } else if (lastPlan) {
      row['แผนงาน'] = lastPlan;
    }
    if (row['ประเภทครุภัณฑ์']) {
      lastEquipmentType = String(row['ประเภทครุภัณฑ์']).trim();
    } else if (lastEquipmentType) {
      row['ประเภทครุภัณฑ์'] = lastEquipmentType;
    }
    return row;
  });
}

async function run() {
  const db = await getDb();
  if (!db) { console.error('No DB'); process.exit(1); }
  const excelPath = '/home/ubuntu/upload/แผนพัฒนาท้องถิ่น_ตรวจสอบงบประมาณ-1.xlsx';
  const buffer = fs.readFileSync(excelPath);
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  
  const pRows = readSheetWithFill(workbook, 'บัญชีโครงการ');
  const eRows = readSheetWithFill(workbook, 'โครงการเกินศักยภาพ');
  const eqRows = readSheetWithFill(workbook, 'บัญชีครุภัณฑ์');

  await db.delete(projectTimelines);
  await db.delete(projects);
  await db.delete(equipment);

  const pVals = [...pRows.map(r => projectInsert(r, 0)), ...eRows.map(r => projectInsert(r, 1))];
  const eqVals = eqRows.map(r => equipmentInsert(r));

  for (let i = 0; i < pVals.length; i += 100) {
    await db.insert(projects).values(pVals.slice(i, i + 100));
  }
  for (let i = 0; i < eqVals.length; i += 100) {
    await db.insert(equipment).values(eqVals.slice(i, i + 100));
  }

  console.log('Reimported successfully with ffill:', pVals.length, 'projects,', eqVals.length, 'equipment');
  process.exit(0);
}

run().catch(err => {
  console.error('Reimport failed:', err);
  process.exit(1);
});
