import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const applicants = [
  { firstName: "Usman", lastName: "Iqbal", parentName: "Mr. Iqbal Ahmed", parentEmail: "iqbal.ahmed12@email.com", phone: "0311-1002001", city: "Lahore" },
  { firstName: "Rabia", lastName: "Saleem", parentName: "Mr. Saleem Akhtar", parentEmail: "saleem.akhtar12@email.com", phone: "0311-1002002", city: "Karachi" },
  { firstName: "Hamza", lastName: "Malik", parentName: "Mr. Malik Naveed", parentEmail: "malik.naveed12@email.com", phone: "0311-1002003", city: "Islamabad" },
  { firstName: "Komal", lastName: "Riaz", parentName: "Mr. Riaz Hussain", parentEmail: "riaz.hussain12@email.com", phone: "0311-1002004", city: "Faisalabad" },
  { firstName: "Saad", lastName: "Khan", parentName: "Mr. Nadeem Khan", parentEmail: "nadeem.khan12@email.com", phone: "0311-1002005", city: "Rawalpindi" },
  { firstName: "Mahnoor", lastName: "Javed", parentName: "Mr. Javed Iqbal", parentEmail: "javed.iqbal12@email.com", phone: "0311-1002006", city: "Multan" },
  { firstName: "Tahir", lastName: "Butt", parentName: "Mr. Butt Saeed", parentEmail: "butt.saeed12@email.com", phone: "0311-1002007", city: "Peshawar" },
  { firstName: "Saba", lastName: "Yousaf", parentName: "Mr. Yousaf Ali", parentEmail: "yousaf.ali12@email.com", phone: "0311-1002008", city: "Hyderabad" },
  { firstName: "Zubair", lastName: "Ahmed", parentName: "Mr. Ahmed Khan", parentEmail: "ahmed.khan12@email.com", phone: "0311-1002009", city: "Quetta" },
  { firstName: "Iqra", lastName: "Naz", parentName: "Mr. Nazir Ahmad", parentEmail: "nazir.ahmad12@email.com", phone: "0311-1002010", city: "Sialkot" },
];

async function main() {
  const passwordHash = await bcrypt.hash("portal123", 12);
  const className = "Grade 12";

  for (const a of applicants) {
    const id = `app_seed12_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const year = new Date().getFullYear();
    const serial = String(Math.floor(Math.random() * 9000) + 1000);
    const applicationId = `APP-${year}-${serial}`;
    const submittedAt = new Date().toISOString().split("T")[0];
    const dateOfBirth = `${2005}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`;
    const genders = ["Male", "Female"];
    const relations = ["Father", "Mother", "Guardian"];
    const bloodGroups = ["A+", "B+", "O+", "AB+", "A-"];

    const existing = await pool.query("SELECT id FROM admission_applications WHERE parent_email = $1", [a.parentEmail]);
    if (existing.rows.length > 0) {
      console.log(`Skipping ${a.firstName} ${a.lastName} (${a.parentEmail}) — already exists`);
      continue;
    }

    await pool.query(
      `INSERT INTO admission_applications
       (id, application_id, submitted_at, status, first_name, last_name, date_of_birth,
        gender, nationality, blood_group, applying_for_class, previous_school, previous_grade,
        parent_name, parent_relation, parent_phone, parent_email, parent_cnic, address, city,
        parent_portal_password_hash)
       VALUES ($1,$2,$3,'Pending',$4,$5,$6,$7,'Pakistani',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        id, applicationId, submittedAt,
        a.firstName, a.lastName, dateOfBirth,
        genders[Math.floor(Math.random() * genders.length)],
        bloodGroups[Math.floor(Math.random() * bloodGroups.length)],
        className, `City Public School - ${a.city}`, `Grade 11`,
        a.parentName, relations[Math.floor(Math.random() * relations.length)],
        a.phone, a.parentEmail,
        `${a.phone.replace(/\D/g, "")}-${Math.floor(Math.random() * 10000000)}`,
        `${Math.floor(Math.random() * 999) + 1}, ${a.city}`, a.city,
        passwordHash,
      ]
    );
    console.log(`Created application ${applicationId} for ${a.firstName} ${a.lastName} — ${className}`);
  }

  await pool.end();
  console.log("\nDone! 10 Grade 12 admission applications seeded with 'Pending' status.");
}

main().catch(err => { console.error(err); process.exit(1); });
