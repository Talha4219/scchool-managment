import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const applicants = [
  { firstName: "Ahmed", lastName: "Khan", class: "Grade 1", parentName: "Mr. Tariq Khan", parentEmail: "tariq.khan@email.com", phone: "0300-1112233", city: "Karachi" },
  { firstName: "Fatima", lastName: "Ali", class: "Grade 3", parentName: "Mr. Hassan Ali", parentEmail: "hassan.ali@email.com", phone: "0300-2223344", city: "Lahore" },
  { firstName: "Muhammad", lastName: "Usman", class: "Grade 5", parentName: "Mr. Bilal Usman", parentEmail: "bilal.usman@email.com", phone: "0300-3334455", city: "Islamabad" },
  { firstName: "Ayesha", lastName: "Siddiqui", class: "Grade 6", parentName: "Mrs. Rabia Siddiqui", parentEmail: "rabia.siddiqui@email.com", phone: "0300-4445566", city: "Rawalpindi" },
  { firstName: "Hassan", lastName: "Shah", class: "Grade 8", parentName: "Mr. Naveed Shah", parentEmail: "naveed.shah@email.com", phone: "0300-5556677", city: "Faisalabad" },
  { firstName: "Zainab", lastName: "Ahmed", class: "Grade 9", parentName: "Mr. Javed Ahmed", parentEmail: "javed.ahmed@email.com", phone: "0300-6667788", city: "Multan" },
  { firstName: "Ali", lastName: "Raza", class: "Grade 10 (Matric)", parentName: "Mr. Asif Raza", parentEmail: "asif.raza@email.com", phone: "0300-7778899", city: "Peshawar" },
  { firstName: "Sana", lastName: "Tariq", class: "Grade 2", parentName: "Mrs. Saima Tariq", parentEmail: "saima.tariq@email.com", phone: "0300-8889900", city: "Quetta" },
  { firstName: "Bilal", lastName: "Hussain", class: "Grade 4", parentName: "Mr. Khalid Hussain", parentEmail: "khalid.hussain@email.com", phone: "0300-9990011", city: "Hyderabad" },
  { firstName: "Hira", lastName: "Batool", class: "Grade 7", parentName: "Mr. Imran Batool", parentEmail: "imran.batool@email.com", phone: "0301-1112233", city: "Sialkot" },
];

async function main() {
  const passwordHash = await bcrypt.hash("portal123", 12);

  for (const a of applicants) {
    const id = `app_seed_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const year = new Date().getFullYear();
    const serial = String(Math.floor(Math.random() * 9000) + 1000);
    const applicationId = `APP-${year}-${serial}`;
    const submittedAt = new Date().toISOString().split("T")[0];
    const dateOfBirth = `${1980 + Math.floor(Math.random() * 14)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`;
    const genders = ["Male", "Female"];
    const relations = ["Father", "Mother", "Guardian"];
    const bloodGroups = ["A+", "B+", "O+", "AB+"];

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
        a.class, `Previous School - ${a.city}`, `Grade ${Math.floor(Math.random() * 5) + 1}`,
        a.parentName, relations[Math.floor(Math.random() * relations.length)],
        a.phone, a.parentEmail,
        `${a.phone.replace(/\D/g, "")}-${Math.floor(Math.random() * 10000000)}`,
        `${Math.floor(Math.random() * 999) + 1}, ${a.city}`, a.city,
        passwordHash,
      ]
    );
    console.log(`Created application ${applicationId} for ${a.firstName} ${a.lastName} (${a.class})`);
  }

  await pool.end();
  console.log("\nDone! 10 admission applications seeded.");
}

main().catch(err => { console.error(err); process.exit(1); });
