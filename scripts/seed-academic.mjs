// Seeds: 2 more classes (Grade 9, Grade 10, each with section A), teacher
// profiles/competencies for existing TEACHER accounts, a period grid for the
// active academic year, and a real published (active) weekly timetable for
// every section — class 9-A, 10-A, 11-A, 12-A, 12-B.
// Usage: node scripts/seed-academic.mjs

import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function main() {
  console.log(`Seeding academic data into: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")}`);
  const client = await pool.connect();
  try {
    const yearRes = await client.query("SELECT id FROM academic_years WHERE is_active=true LIMIT 1");
    const academicYearId = yearRes.rows[0]?.id;
    if (!academicYearId) { console.error("No active academic year found."); return; }

    // ── 1. Classes (add Grade 9 / Grade 10 alongside existing class 11/12) ──
    const classDefs = [
      { name: "Grade 9", grade: "Grade 9" },
      { name: "Grade 10", grade: "Grade 10" },
    ];
    const classes = {};
    for (const c of classDefs) {
      const existing = await client.query("SELECT id FROM classes WHERE name=$1 AND academic_year_id=$2", [c.name, academicYearId]);
      let classId = existing.rows[0]?.id;
      if (!classId) {
        classId = id("cls");
        await client.query("INSERT INTO classes (id, name, grade_level, academic_year_id) VALUES ($1,$2,$3,$4)", [classId, c.name, c.grade, academicYearId]);
        console.log(`  + class ${c.name}`);
      }
      classes[c.name] = classId;
      const secExisting = await client.query("SELECT id FROM sections WHERE class_id=$1 AND name='A'", [classId]);
      let sectionId = secExisting.rows[0]?.id;
      if (!sectionId) {
        sectionId = id("sec");
        await client.query("INSERT INTO sections (id, name, capacity, class_id) VALUES ($1,'A',35,$2)", [sectionId, classId]);
        console.log(`  + section A for ${c.name}`);
      }
      classes[c.name + "_A"] = sectionId;
    }

    // Existing classes/sections created earlier by the admin.
    const existingClasses = await client.query("SELECT id, name FROM classes WHERE academic_year_id=$1", [academicYearId]);
    const classByName = Object.fromEntries(existingClasses.rows.map(r => [r.name, r.id]));
    const existingSections = await client.query("SELECT id, name, class_id FROM sections");
    const sectionsByClass = {};
    for (const s of existingSections.rows) (sectionsByClass[s.class_id] ||= []).push(s);

    // ── 2. Teacher profiles + competencies ──
    const teachersRes = await client.query("SELECT id, name FROM users WHERE role='TEACHER'");
    const teachers = teachersRes.rows;
    if (teachers.length === 0) { console.log("No teacher accounts found — skipping profiles/competencies/timetable."); return; }

    const subjectsRes = await client.query("SELECT id, name FROM subjects");
    const subjects = subjectsRes.rows;
    const subjectByName = Object.fromEntries(subjects.map(s => [s.name, s.id]));

    const designations = ["Senior Teacher", "Subject Coordinator", "Teacher", "Lecturer"];
    for (let i = 0; i < teachers.length; i++) {
      const t = teachers[i];
      const existingProfile = await client.query("SELECT id FROM teacher_profiles WHERE user_id=$1", [t.id]);
      if (existingProfile.rows.length === 0) {
        await client.query(
          `INSERT INTO teacher_profiles (id, user_id, employee_id, employment_type, status, designation, experience_years, joining_date)
           VALUES ($1,$2,$3,'fulltime','active',$4,$5,$6)`,
          [id("tp"), t.id, `EMP-${1000 + t.id}`, designations[i % designations.length], 3 + i, "2024-08-01"]
        );
        console.log(`  + teacher_profile for ${t.name}`);
      }
    }

    // Give each teacher competency across all 5 classes for a couple of subjects
    // (rotated so no two teachers claim the exact same subject everywhere).
    const allClassIds = [classes["Grade 9"], classes["Grade 10"], classByName["class 11"], classByName["class 12"]].filter(Boolean);
    const subjectRotation = ["English", "Mathematics", "General Science", "Urdu", "Islamiat", "Social Studies"];
    let compCount = 0;
    for (let i = 0; i < teachers.length; i++) {
      const t = teachers[i];
      const mySubjects = [subjectRotation[i % subjectRotation.length], subjectRotation[(i + 3) % subjectRotation.length]];
      for (const subjName of mySubjects) {
        const subjectId = subjectByName[subjName];
        if (!subjectId) continue;
        for (const classId of allClassIds) {
          const res = await client.query(
            `INSERT INTO teacher_subject_competencies (id, teacher_id, subject_id, class_id) VALUES ($1,$2,$3,$4)
             ON CONFLICT (teacher_id, subject_id, class_id) DO NOTHING RETURNING id`,
            [id("tsc"), t.id, subjectId, classId]
          );
          if (res.rows.length) compCount++;
        }
      }
    }
    console.log(`  + ${compCount} teacher subject competencies`);

    // ── 3. Period grid for the active year ──
    const periodDefs = [
      { num: 1, label: "Period 1", start: "08:00", end: "08:45", isBreak: false },
      { num: 2, label: "Period 2", start: "08:45", end: "09:30", isBreak: false },
      { num: 3, label: "Period 3", start: "09:30", end: "10:15", isBreak: false },
      { num: 4, label: "Break", start: "10:15", end: "10:30", isBreak: true },
      { num: 5, label: "Period 4", start: "10:30", end: "11:15", isBreak: false },
      { num: 6, label: "Period 5", start: "11:15", end: "12:00", isBreak: false },
    ];
    const existingPeriods = await client.query("SELECT id FROM period_slots WHERE academic_year_id=$1", [academicYearId]);
    let periods;
    if (existingPeriods.rows.length === 0) {
      for (const p of periodDefs) {
        await client.query(
          `INSERT INTO period_slots (id, academic_year_id, period_number, label, start_time, end_time, is_break) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [id("ps"), academicYearId, p.num, p.label, p.start, p.end, p.isBreak]
        );
      }
      console.log(`  + ${periodDefs.length} period slots (incl. 1 break)`);
      periods = periodDefs;
    } else {
      const res = await client.query("SELECT period_number as num, label, start_time as start, end_time as end, is_break as \"isBreak\" FROM period_slots WHERE academic_year_id=$1 ORDER BY period_number", [academicYearId]);
      periods = res.rows;
      console.log(`  = period grid already exists (${periods.length} periods), reusing it`);
    }
    const teachingPeriods = periods.filter(p => !p.isBreak);

    // ── 4. Timetable: publish (status='active') 3 periods/day across Mon-Fri for every section ──
    const sectionsToFill = [
      { classId: classes["Grade 9"], sectionId: classes["Grade 9_A"], className: "Grade 9" },
      { classId: classes["Grade 10"], sectionId: classes["Grade 10_A"], className: "Grade 10" },
    ];
    if (classByName["class 11"]) for (const s of sectionsByClass[classByName["class 11"]] || []) sectionsToFill.push({ classId: classByName["class 11"], sectionId: s.id, className: "class 11" });
    if (classByName["class 12"]) for (const s of sectionsByClass[classByName["class 12"]] || []) sectionsToFill.push({ classId: classByName["class 12"], sectionId: s.id, className: "class 12" });

    let entryCount = 0;
    for (const sec of sectionsToFill) {
      const existingEntries = await client.query("SELECT COUNT(*)::int as c FROM timetable_entries WHERE class_id=$1 AND section_id=$2 AND academic_year_id=$3", [sec.classId, sec.sectionId, academicYearId]);
      if (existingEntries.rows[0].c > 0) { console.log(`  = ${sec.className} (${sec.sectionId}) already has a timetable, skipping`); continue; }

      let rotation = 0;
      for (const day of DAYS) {
        for (const period of teachingPeriods.slice(0, 3)) {
          const teacher = teachers[rotation % teachers.length];
          const subjName = subjectRotation[rotation % subjectRotation.length];
          const subjectId = subjectByName[subjName];
          rotation++;
          if (!subjectId) continue;
          await client.query(
            `INSERT INTO timetable_entries
              (id, class_name, subject_name, teacher_name, day_of_week, start_time, end_time, room,
               class_id, section_id, subject_id, teacher_id, academic_year_id, status, assigned_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',NOW())`,
            [id("tt"), sec.className, subjName, teacher.name, day, period.start, period.end, null,
             sec.classId, sec.sectionId, subjectId, teacher.id, academicYearId]
          );
          entryCount++;
        }
      }
      console.log(`  + timetable for ${sec.className} (${sec.sectionId})`);
    }
    console.log(`  + ${entryCount} timetable entries (published)`);

    console.log("\nDone.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
