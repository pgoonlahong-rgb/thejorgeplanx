import { drizzle } from "drizzle-orm/mysql2";
import { asc, desc, eq } from "drizzle-orm";
import { InsertProjectTimeline, InsertUser, ProjectTimeline, User, equipment, importRuns, projectTimelines, projects, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];

  for (const field of textFields) {
    const value = user[field];
    if (value !== undefined) {
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects);
}

export async function getAllEquipment() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(equipment);
}

export async function getRecentImportRuns(limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importRuns).orderBy(desc(importRuns.createdAt)).limit(limit);
}

export async function getProjectTimeline(projectId: number): Promise<ProjectTimeline[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectTimelines).where(eq(projectTimelines.projectId, projectId)).orderBy(asc(projectTimelines.fiscalYear));
}

export async function getAllProjectTimelines(): Promise<ProjectTimeline[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectTimelines).orderBy(asc(projectTimelines.fiscalYear));
}

export async function upsertProjectTimeline(entry: InsertProjectTimeline): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(projectTimelines).values(entry).onDuplicateKeyUpdate({
    set: {
      plannedBudget: entry.plannedBudget,
      approvedBudget: entry.approvedBudget,
      disbursedBudget: entry.disbursedBudget,
      progressPercent: entry.progressPercent,
      status: entry.status,
      note: entry.note ?? null,
      updatedBy: entry.updatedBy ?? null,
      updatedAt: new Date(),
    },
  });
}
