import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const teachers = [
  { name: "Ms. Fatima Ahmed",        email: "fatima.ahmed@school.pk",       specialization: "Mathematics",       qualification: "M.Sc. Mathematics",       phone: "0300-1111111", cnic: "42101-1111111-1", experienceYears: 8,  joiningDate: "2019-08-15", address: "House 12, Block A, Gulshan-e-Iqbal, Karachi" },
  { name: "Mr. Usman Ali",           email: "usman.ali@school.pk",          specialization: "Physics",           qualification: "M.Sc. Physics",           phone: "0300-2222222", cnic: "42101-2222222-1", experienceYears: 10, joiningDate: "2017-03-01", address: "Flat 5, Sector F, Johar Town, Lahore" },
  { name: "Ms. Nadia Javed",         email: "nadia.javed@school.pk",        specialization: "Chemistry",         qualification: "M.Sc. Chemistry",         phone: "0300-3333333", cnic: "42101-3333333-1", experienceYears: 6,  joiningDate: "2020-09-01", address: "Street 3, G-11/1, Islamabad" },
  { name: "Mr. Bilal Hassan",        email: "bilal.hassan@school.pk",       specialization: "English Literature", qualification: "MA English",               phone: "0300-4444444", cnic: "42101-4444444-1", experienceYears: 12, joiningDate: "2015-04-20", address: "House 7, PECHS Block 6, Karachi" },
  { name: "Ms. Ayesha Khan",         email: "ayesha.khan@school.pk",        specialization: "Urdu",              qualification: "MA Urdu",                  phone: "0300-5555555", cnic: "42101-5555555-1", experienceYears: 7,  joiningDate: "2019-08-01", address: "Mohalla Islamia, Peshawar" },
  { name: "Mr. Imran Sheikh",        email: "imran.sheikh@school.pk",       specialization: "Computer Science",  qualification: "BS Computer Science",      phone: "0300-6666666", cnic: "42101-6666666-1", experienceYears: 5,  joiningDate: "2021-01-10", address: "Phase 4, DHA, Lahore" },
  { name: "Ms. Hira Batool",         email: "hira.batool@school.pk",        specialization: "Biology",           qualification: "M.Sc. Biology",           phone: "0300-7777777", cnic: "42101-7777777-1", experienceYears: 9,  joiningDate: "2018-09-15", address: "Gulberg III, Lahore" },
  { name: "Mr. Khalid Mahmood",      email: "khalid.mahmood@school.pk",     specialization: "Pakistan Studies",  qualification: "MA History",              phone: "0300-8888888", cnic: "42101-8888888-1", experienceYears: 15, joiningDate: "2012-03-01", address: "Satellite Town, Rawalpindi" },
  { name: "Ms. Samina Rashid",       email: "samina.rashid@school.pk",      specialization: "Islamic Studies",   qualification: "MA Islamic Studies",      phone: "0300-9999999", cnic: "42101-9999999-1", experienceYears: 11, joiningDate: "2016-08-20", address: "House 3, Block C, North Nazimabad, Karachi" },
  { name: "Mr. Tariq Mehmood",       email: "tariq.mehmood@school.pk",      specialization: "Physical Education",qualification: "B.Sc. Sports Science",     phone: "0301-0000000", cnic: "42101-0000000-1", experienceYears: 6,  joiningDate: "2020-02-01", address: "Wapda Town, Lahore" },
];

async function main() {
  const passwordHash = await bcrypt.hash("teacher123", 12);

  for (const t of teachers) {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [t.email]);
    if (existing.rows.length > 0) {
      console.log(`Skipping ${t.email} — already exists`);
      continue;
    }

    const user = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,'TEACHER') RETURNING id",
      [t.name, t.email, passwordHash]
    );
    const userId = user.rows[0].id;
    const profileId = `tp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    await pool.query(
      `INSERT INTO teacher_profiles (id, user_id, phone, cnic, specialization, qualification, experience_years, joining_date, address, profile_photo, degree_photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [profileId, userId, t.phone, t.cnic, t.specialization, t.qualification, t.experienceYears, t.joiningDate, t.address, null, null]
    );

    console.log(`Created: ${t.name} (${t.specialization})`);
  }

  console.log("\nDone! 10 Pakistani teachers seeded.");
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
