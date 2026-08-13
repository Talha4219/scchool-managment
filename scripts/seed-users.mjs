// Standalone login-user seeder for local dev DBs.
// Uses the raw `pg` pool directly (not Prisma) because prisma/seed.ts has
// drifted from the actual runtime schema (tables are created by
// src/lib/db-init.ts via raw SQL, not Prisma migrations) — this script only
// touches the `users` table, which IS kept in sync with prisma/schema.prisma.
//
// Run after the dev server has been started at least once against the
// target DATABASE_URL (so initializeDatabase() has created the `users` and
// `students` tables). Usage: node scripts/seed-users.mjs

import "dotenv/config";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PASSWORD = "password";

const users = [
  { name: "Admin User", email: "admin@educators.edu.pk", role: "ADMIN" },
  { name: "Ms. Fatima Ahmed", email: "fatima@educators.edu.pk", role: "TEACHER" },
  { name: "Mr. Usman Ali", email: "usman.ali@educators.edu.pk", role: "TEACHER" },
  { name: "Ms. Ayesha Khan", email: "ayesha.khan@educators.edu.pk", role: "TEACHER" },
  { name: "Mr. Ali Khan", email: "ali.khan@email.com", role: "PARENT" },
  { name: "Ahmed Ali Khan", email: "ahmed.ali.khan@educators.pk", role: "STUDENT" },
];

async function main() {
  console.log(`Seeding users into: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")}`);

  const client = await pool.connect();
  try {
    const tableCheck = await client.query(
      "SELECT to_regclass('public.users') as t"
    );
    if (!tableCheck.rows[0].t) {
      console.error("`users` table does not exist yet. Start the dev server once (npm run dev) and load any page so initializeDatabase() runs, then re-run this script.");
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    for (const u of users) {
      const res = await client.query(
        `INSERT INTO users (name, email, password_hash, role, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [u.name, u.email, passwordHash, u.role]
      );
      console.log(res.rowCount ? `  + created ${u.role} ${u.email}` : `  = skipped (exists) ${u.email}`);
    }

    // Link the sample student login to a real student record + the sample
    // parent login to that student's parentEmail, so /dashboard, /parent,
    // /results etc. show real linked data for these two accounts.
    const studentsTable = await client.query("SELECT to_regclass('public.students') as t");
    if (studentsTable.rows[0].t) {
      const firstStudent = await client.query(
        "SELECT id FROM students WHERE parent_email = $1 ORDER BY id LIMIT 1",
        ["ali.khan@email.com"]
      );
      if (firstStudent.rows.length) {
        await client.query(
          "UPDATE students SET email = $1 WHERE id = $2",
          ["ahmed.ali.khan@educators.pk", firstStudent.rows[0].id]
        );
        console.log(`  ~ linked student login to students.id=${firstStudent.rows[0].id}`);
      } else {
        console.log("  ! no default student found with parent_email=ali.khan@email.com to link (default-data seed may not have run yet)");
      }
    }

    console.log(`\nDone. All accounts use password: "${PASSWORD}"`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
