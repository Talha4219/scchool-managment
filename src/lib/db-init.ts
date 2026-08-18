import { query, checkDbConnection } from './db';
import {
  defaultSchoolInfo,
  defaultSections,
  defaultSubjects,
  defaultFeeCategories,
  defaultFeeStructures,
  defaultAcademicTerms,
  defaultStudents,
  defaultFeeRecords,
  defaultAttendance,
  defaultExams,
  defaultNotifications
} from './default-data';

export const initializeDatabase = async () => {
  const isOnline = await checkDbConnection();
  if (!isOnline) {
    console.log('Database is offline, skipping initialization.');
    return;
  }

  try {
    // 1. Create Tables
    await query(`
      -- Multi-branch/multi-campus support. "classes" is the scoping anchor for
      -- most academic data (enrollments/timetable/attendance/exams all cascade
      -- from class_id), so most modules scope via a JOIN back to
      -- classes.branch_id rather than needing their own branch_id column.
      -- users/employees/students/admission_applications get their own column
      -- since they don't always cascade through an active class.
      CREATE TABLE IF NOT EXISTS branches (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(20) UNIQUE,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        logo_url TEXT,
        established_date VARCHAR(20),
        capacity INTEGER,
        grade_levels TEXT,
        shift VARCHAR(50),
        principal_user_id INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- Branch profile fields added after the original table — defensive for
      -- installs that already had a branches table before this column set existed.
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS email VARCHAR(255);
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS established_date VARCHAR(20);
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS capacity INTEGER;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS grade_levels TEXT;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS shift VARCHAR(50);

      CREATE TABLE IF NOT EXISTS school_info (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        registration_number VARCHAR(100),
        address TEXT,
        contact_email VARCHAR(255),
        academic_year VARCHAR(50),
        phone VARCHAR(50),
        website VARCHAR(255),
        principal VARCHAR(255),
        logo_url TEXT,
        founding_year VARCHAR(10),
        currency VARCHAR(10),
        timezone VARCHAR(50)
      );
      -- Org-profile fields added after the original table — defensive for
      -- installs that already had a school_info table before this column set existed.
      ALTER TABLE school_info ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE school_info ADD COLUMN IF NOT EXISTS website VARCHAR(255);
      ALTER TABLE school_info ADD COLUMN IF NOT EXISTS principal VARCHAR(255);
      ALTER TABLE school_info ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE school_info ADD COLUMN IF NOT EXISTS founding_year VARCHAR(10);
      ALTER TABLE school_info ADD COLUMN IF NOT EXISTS currency VARCHAR(10);
      ALTER TABLE school_info ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

      CREATE TABLE IF NOT EXISTS subjects (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        code VARCHAR(50),
        grade_level VARCHAR(100),
        teacher_name VARCHAR(255),
        is_elective BOOLEAN
      );
      -- Additive, nullable link to a real class — grade_level stays as the
      -- free-text field existing UI already filters by; class_id lets new
      -- subject-to-exam/timetable assignments validate against a real class
      -- going forward instead of relying on string-matching convention alone.
      ALTER TABLE subjects ADD COLUMN IF NOT EXISTS class_id VARCHAR(50);

      CREATE TABLE IF NOT EXISTS fee_categories (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100),
        description TEXT,
        default_amount INT,
        frequency VARCHAR(50),
        is_active BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS fee_structures (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        assigned_class VARCHAR(100) DEFAULT 'ALL',
        line_items JSONB DEFAULT '[]',
        total_amount INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true
      );

      CREATE TABLE IF NOT EXISTS academic_terms (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        start_date VARCHAR(50),
        end_date VARCHAR(50),
        is_active BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS students (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        admission_number VARCHAR(100),
        class VARCHAR(100),
        section VARCHAR(50),
        parent_name VARCHAR(255),
        status VARCHAR(50),
        parent_email VARCHAR(255),
        email VARCHAR(255)
      );

      -- Fixed 4-slot document checklist per student (Birth Certificate,
      -- CNIC/B-Form, Leaving Certificate, Photograph), upserted by
      -- (student_id, document_type) so re-uploading a type replaces it.
      CREATE TABLE IF NOT EXISTS student_documents (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        file_name VARCHAR(255),
        file_data TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        uploaded_by VARCHAR(255)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_student_documents_unique ON student_documents(student_id, document_type);

      CREATE TABLE IF NOT EXISTS fee_records (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50),
        student_name VARCHAR(255),
        amount INT,
        due_date VARCHAR(50),
        status VARCHAR(50),
        voucher_id VARCHAR(100),
        payment_method VARCHAR(100),
        payment_date VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50),
        student_name VARCHAR(255),
        class VARCHAR(100),
        section VARCHAR(50),
        date VARCHAR(50),
        status VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS exams (
        id VARCHAR(50) PRIMARY KEY,
        exam_name VARCHAR(255),
        subject VARCHAR(100),
        class_name VARCHAR(100),
        date VARCHAR(50),
        common_strengths TEXT,
        common_weaknesses TEXT,
        student_results JSONB
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR(50) PRIMARY KEY,
        actor_user_id INTEGER,
        actor_name VARCHAR(255),
        actor_role VARCHAR(20),
        action VARCHAR(20) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50),
        summary TEXT,
        before_data JSONB,
        after_data JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

      CREATE TABLE IF NOT EXISTS error_log (
        id VARCHAR(50) PRIMARY KEY,
        source VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        context JSONB,
        actor_user_id INTEGER,
        actor_name VARCHAR(255),
        actor_role VARCHAR(20),
        resolved BOOLEAN NOT NULL DEFAULT false,
        resolved_at TIMESTAMPTZ,
        resolved_by VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_error_log_created ON error_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_error_log_unresolved ON error_log(resolved) WHERE resolved = false;

      -- WhatsApp / notification-service tables. Named whatsapp_notifications
      -- (not "notifications" — that name is already taken by the legacy
      -- in-app bell-notification table above) to hold one channel-agnostic
      -- row per notification, with whatsapp_messages holding the
      -- WhatsApp-specific delivery record the webhook updates.
      CREATE TABLE IF NOT EXISTS whatsapp_notifications (
        id VARCHAR(50) PRIMARY KEY,
        recipient_type VARCHAR(20) NOT NULL,
        recipient_id VARCHAR(50) NOT NULL,
        channel VARCHAR(20) NOT NULL DEFAULT 'WHATSAPP',
        notification_type VARCHAR(50) NOT NULL,
        template_id VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
        scheduled_at TIMESTAMPTZ,
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        read_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        error_code VARCHAR(50),
        error_message TEXT,
        created_by_user_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_wa_notif_recipient ON whatsapp_notifications(recipient_type, recipient_id);
      CREATE INDEX IF NOT EXISTS idx_wa_notif_status ON whatsapp_notifications(status);
      CREATE INDEX IF NOT EXISTS idx_wa_notif_created ON whatsapp_notifications(created_at DESC);

      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id VARCHAR(50) PRIMARY KEY,
        notification_id VARCHAR(50) NOT NULL REFERENCES whatsapp_notifications(id) ON DELETE CASCADE,
        meta_message_id VARCHAR(100),
        phone_number VARCHAR(30) NOT NULL,
        template_name VARCHAR(100) NOT NULL,
        template_language VARCHAR(20) NOT NULL DEFAULT 'en_US',
        body TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
        error_code VARCHAR(50),
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- Free-form (non-template) WhatsApp messages have real text but no
      -- template — body holds that text; template_name stays 'freeform' for
      -- them since the column is NOT NULL for the template-message rows.
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS body TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_meta_id ON whatsapp_messages(meta_message_id) WHERE meta_message_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_wa_messages_notification ON whatsapp_messages(notification_id);

      -- Postgres-backed queue (no Redis/BullMQ in this deployment — see the
      -- WhatsApp integration plan). A worker (src/app/api/cron/whatsapp-queue,
      -- or the admin "Process Queue Now" button) claims PENDING rows due at or
      -- before now with SELECT ... FOR UPDATE SKIP LOCKED, which is what makes
      -- concurrent workers/duplicate cron triggers safe — two workers can never
      -- claim the same job, so a message is never sent twice for one job row.
      CREATE TABLE IF NOT EXISTS notification_jobs (
        id VARCHAR(50) PRIMARY KEY,
        notification_id VARCHAR(50) NOT NULL REFERENCES whatsapp_notifications(id) ON DELETE CASCADE,
        message_id VARCHAR(50) NOT NULL REFERENCES whatsapp_messages(id) ON DELETE CASCADE,
        phone_number VARCHAR(30) NOT NULL,
        template_name VARCHAR(100) NOT NULL,
        template_language VARCHAR(20) NOT NULL DEFAULT 'en_US',
        components JSONB,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notification_jobs_claim ON notification_jobs(next_attempt_at) WHERE status = 'PENDING';
      CREATE INDEX IF NOT EXISTS idx_notification_jobs_notification ON notification_jobs(notification_id);

      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255),
        message TEXT,
        date VARCHAR(50),
        recipient_role VARCHAR(50),
        recipient_email VARCHAR(255),
        read BOOLEAN
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255),
        content TEXT,
        date VARCHAR(50),
        author_id VARCHAR(100),
        author_name VARCHAR(255),
        target_role VARCHAR(50),
        target_class VARCHAR(100),
        priority VARCHAR(20) DEFAULT 'normal'
      );

      CREATE TABLE IF NOT EXISTS assignments (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255),
        description TEXT,
        due_date VARCHAR(50),
        class_name VARCHAR(100),
        subject VARCHAR(100),
        teacher_name VARCHAR(255),
        created_at VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id VARCHAR(50) PRIMARY KEY,
        assignment_id VARCHAR(50),
        student_id VARCHAR(50),
        student_name VARCHAR(255),
        submitted_at VARCHAR(50),
        notes TEXT,
        grade VARCHAR(20),
        feedback TEXT
      );

      CREATE TABLE IF NOT EXISTS timetable_entries (
        id VARCHAR(50) PRIMARY KEY,
        class_name VARCHAR(100),
        subject_name VARCHAR(100),
        teacher_name VARCHAR(255),
        day_of_week VARCHAR(20),
        start_time VARCHAR(10),
        end_time VARCHAR(10),
        room VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS parents (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        student_ids TEXT DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'Active'
      );

      CREATE TABLE IF NOT EXISTS admission_applications (
        id VARCHAR(50) PRIMARY KEY,
        application_id VARCHAR(50),
        submitted_at VARCHAR(50),
        status VARCHAR(50) DEFAULT 'Pending',
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        date_of_birth VARCHAR(50),
        gender VARCHAR(20),
        nationality VARCHAR(100),
        blood_group VARCHAR(20),
        applying_for_class VARCHAR(100),
        previous_school VARCHAR(255),
        previous_grade VARCHAR(50),
        parent_name VARCHAR(255),
        parent_relation VARCHAR(50),
        parent_phone VARCHAR(50),
        parent_email VARCHAR(255),
        parent_cnic VARCHAR(50),
        address TEXT,
        city VARCHAR(100),
        admin_notes TEXT
      );

      -- Same fixed-checklist pattern as student_documents, but keyed by
      -- admission application (no FK to students — the applicant isn't a
      -- student yet).
      CREATE TABLE IF NOT EXISTS admission_documents (
        id VARCHAR(50) PRIMARY KEY,
        application_id VARCHAR(50) NOT NULL REFERENCES admission_applications(id) ON DELETE CASCADE,
        document_type VARCHAR(50) NOT NULL,
        file_name VARCHAR(255),
        file_data TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        uploaded_by VARCHAR(255)
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_admission_documents_unique ON admission_documents(application_id, document_type);

      -- DEPRECATED (retired from all UI as of the Academics/Examinations
      -- consolidation): class_compilations, exam_sessions, exam_marks,
      -- teacher_subject_assignments, result_positions, and the bare exams
      -- table above were a second, string-keyed (not FK'd) exam/results
      -- pipeline that ran in parallel with the real one (term_exams /
      -- exam_subjects / marks_entries / results / report_cards in
      -- academic-core.ts). No page calls these anymore — kept only so
      -- historical rows aren't destroyed. Do not build new UI on them.
      CREATE TABLE IF NOT EXISTS class_compilations (
        id VARCHAR(50) PRIMARY KEY,
        session_id VARCHAR(50) NOT NULL,
        class_name VARCHAR(100),
        teacher_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        submitted_at VARCHAR(50),
        admin_notes TEXT
      );

      CREATE TABLE IF NOT EXISTS exam_sessions (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        term VARCHAR(100),
        deadline VARCHAR(50),
        status VARCHAR(50) DEFAULT 'active',
        classes JSONB DEFAULT '[]',
        subjects JSONB DEFAULT '[]',
        total_marks INTEGER DEFAULT 100,
        created_at VARCHAR(50),
        created_by VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS exam_marks (
        id VARCHAR(50) PRIMARY KEY,
        session_id VARCHAR(50) NOT NULL,
        subject_name VARCHAR(100),
        class_name VARCHAR(100),
        teacher_id INTEGER,
        teacher_name VARCHAR(255),
        student_results JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'pending',
        submitted_at VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS teacher_subject_assignments (
        id VARCHAR(50) PRIMARY KEY,
        teacher_id INTEGER NOT NULL,
        teacher_name VARCHAR(255),
        subject_name VARCHAR(100),
        class_name VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS result_positions (
        id VARCHAR(50) PRIMARY KEY,
        session_id VARCHAR(50) NOT NULL,
        class_name VARCHAR(100),
        grade_name VARCHAR(100),
        student_id VARCHAR(50),
        student_name VARCHAR(255),
        total_marks INTEGER DEFAULT 0,
        max_possible INTEGER DEFAULT 0,
        percentage NUMERIC(5,2) DEFAULT 0,
        section_position INTEGER,
        section_total INTEGER,
        grade_position INTEGER,
        grade_total INTEGER,
        subject_scores JSONB DEFAULT '[]',
        calculated_at VARCHAR(50)
      );

      CREATE TABLE IF NOT EXISTS teacher_profiles (
        id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        phone VARCHAR(30),
        cnic VARCHAR(20),
        specialization VARCHAR(255),
        qualification VARCHAR(255),
        experience_years INTEGER DEFAULT 0,
        joining_date VARCHAR(20),
        address TEXT,
        profile_photo TEXT,
        degree_photo TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Academic Core relational tables
      CREATE TABLE IF NOT EXISTS academic_years (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), start_date VARCHAR(50), end_date VARCHAR(50), is_active BOOLEAN DEFAULT false);
      CREATE TABLE IF NOT EXISTS classes (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), grade_level VARCHAR(50), academic_year_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS sections (id VARCHAR(50) PRIMARY KEY, name VARCHAR(100), capacity INT DEFAULT 30, teacher_name VARCHAR(255), class_id VARCHAR(50), section_group VARCHAR(100), class_teacher_id INT);
      -- The real homeroom-teacher link (teacher_name above was always just a
      -- free-text display label, not a login/permission link). Nullable FK to
      -- users.id — one class teacher per section, admin-assigned.
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS class_teacher_id INT;
      CREATE TABLE IF NOT EXISTS enrollments (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), class_id VARCHAR(50), section_id VARCHAR(50), academic_year_id VARCHAR(50), roll_number INT DEFAULT 0, status VARCHAR(20) DEFAULT 'Active', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS student_promotions (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), from_class_id VARCHAR(50), from_section_id VARCHAR(50), to_class_id VARCHAR(50), to_section_id VARCHAR(50), academic_year_id VARCHAR(50), promoted_by VARCHAR(255), promoted_at TIMESTAMPTZ DEFAULT NOW());
      CREATE TABLE IF NOT EXISTS teacher_class_subjects (id VARCHAR(50) PRIMARY KEY, teacher_id INT, class_id VARCHAR(50), section_id VARCHAR(50), subject_id VARCHAR(50), academic_year_id VARCHAR(50));
      CREATE TABLE IF NOT EXISTS term_exams (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), exam_type VARCHAR(50), class_id VARCHAR(50), section_id VARCHAR(50), academic_year_id VARCHAR(50), start_date VARCHAR(50), end_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Scheduled');
      CREATE TABLE IF NOT EXISTS exam_subjects (id VARCHAR(50) PRIMARY KEY, exam_id VARCHAR(50), subject_id VARCHAR(50), total_marks INT DEFAULT 100, passing_marks INT DEFAULT 33, teacher_id INT);
      CREATE TABLE IF NOT EXISTS marks_entries (id VARCHAR(50) PRIMARY KEY, exam_subject_id VARCHAR(50), student_id VARCHAR(50), marks_obtained INT DEFAULT 0, grade VARCHAR(10), remarks TEXT);
      CREATE TABLE IF NOT EXISTS results (id VARCHAR(50) PRIMARY KEY, exam_id VARCHAR(50), student_id VARCHAR(50), total_marks INT DEFAULT 0, obtained_marks INT DEFAULT 0, percentage NUMERIC(5,2) DEFAULT 0, grade VARCHAR(10), position INT, status VARCHAR(50) DEFAULT 'Pending');
      CREATE TABLE IF NOT EXISTS report_cards (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), academic_year_id VARCHAR(50), exam_results JSONB DEFAULT '[]', generated_at VARCHAR(50), total_percentage NUMERIC(5,2) DEFAULT 0, overall_grade VARCHAR(10), class_position INT, class_total INT, class_name VARCHAR(100), section_name VARCHAR(100), remarks TEXT);
      -- Set true whenever marks change for a student after their report card
      -- was generated, so the UI can show "stale — regenerate" instead of
      -- silently serving an outdated card.
      ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS needs_regeneration BOOLEAN DEFAULT false;

      -- Attendance Module
      CREATE TABLE IF NOT EXISTS attendance_sessions (id VARCHAR(50) PRIMARY KEY, academic_year_id VARCHAR(50), class_id VARCHAR(50), section_id VARCHAR(50), date VARCHAR(20), taken_by VARCHAR(255), status VARCHAR(20) DEFAULT 'Completed');
      CREATE TABLE IF NOT EXISTS attendance_records (id VARCHAR(50) PRIMARY KEY, session_id VARCHAR(50), student_id VARCHAR(50), status VARCHAR(20), remarks TEXT);
      ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
      ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'manual';
      ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ;

      -- Biometric/RFID device integration: one card/badge UID or biometric
      -- template reference per student, and a set of API keys issued to
      -- specific reader devices/kiosks so a device-side agent (ZKTeco, Suprema,
      -- or any USB HID card reader acting as a keyboard) can check students in.
      CREATE TABLE IF NOT EXISTS student_id_cards (
        id VARCHAR(50) PRIMARY KEY,
        student_id VARCHAR(50) NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
        card_uid VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(100),
        issued_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_student_id_cards_uid ON student_id_cards(card_uid);

      CREATE TABLE IF NOT EXISTS attendance_device_keys (
        id VARCHAR(50) PRIMARY KEY,
        device_name VARCHAR(100) NOT NULL,
        api_key_hash VARCHAR(64) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ
      );

      -- Staff (teacher/employee) attendance — one row per person per day, no
      -- class/section grouping needed (that's what the session/record split
      -- above is for on the student side). Same device keys and same
      -- /api/attendance/checkin endpoint are shared with students — a school's
      -- front-gate biometric unit is one physical machine for everyone.
      CREATE TABLE IF NOT EXISTS staff_attendance (
        id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'Present',
        check_in_time TIMESTAMPTZ,
        check_out_time TIMESTAMPTZ,
        source VARCHAR(20) DEFAULT 'manual',
        marked_by VARCHAR(255),
        remarks TEXT,
        UNIQUE(user_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_staff_attendance_user ON staff_attendance(user_id);
      CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date);

      CREATE TABLE IF NOT EXISTS staff_id_cards (
        id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        card_uid VARCHAR(100) NOT NULL UNIQUE,
        label VARCHAR(100),
        issued_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_staff_id_cards_uid ON staff_id_cards(card_uid);

      -- Timetable Module
      CREATE TABLE IF NOT EXISTS time_slots (id VARCHAR(50) PRIMARY KEY, start_time VARCHAR(10), end_time VARCHAR(10), period_name VARCHAR(100));
      CREATE TABLE IF NOT EXISTS timetables (id VARCHAR(50) PRIMARY KEY, academic_year_id VARCHAR(50), class_id VARCHAR(50), section_id VARCHAR(50), subject_id VARCHAR(50), teacher_id INT, room_id VARCHAR(50), day_of_week VARCHAR(20), time_slot_id VARCHAR(50));

      -- Exam Schedules
      CREATE TABLE IF NOT EXISTS exam_schedules (id VARCHAR(50) PRIMARY KEY, exam_id VARCHAR(50), class_id VARCHAR(50), section_id VARCHAR(50), subject_id VARCHAR(50), exam_date VARCHAR(20), start_time VARCHAR(10), end_time VARCHAR(10), room_id VARCHAR(50));

      -- Result Details
      CREATE TABLE IF NOT EXISTS result_details (id VARCHAR(50) PRIMARY KEY, result_id VARCHAR(50), subject_id VARCHAR(50), obtained_marks NUMERIC(8,2) DEFAULT 0, remarks TEXT);

      -- Role Permissions
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role VARCHAR(20) NOT NULL,
        permission VARCHAR(100) NOT NULL,
        enabled BOOLEAN DEFAULT true,
        UNIQUE(role, permission)
      );

      -- Grade Scales (configurable)
      CREATE TABLE IF NOT EXISTS grade_scales (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL DEFAULT 'Standard',
        min_percentage NUMERIC(5,2) NOT NULL,
        max_percentage NUMERIC(5,2) NOT NULL,
        grade VARCHAR(10) NOT NULL,
        points NUMERIC(3,1) DEFAULT 0,
        is_pass BOOLEAN DEFAULT true,
        sort_order INT DEFAULT 0
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_role_id VARCHAR(20);
      -- Multi-branch: NULL for OWNER (sees every branch) and for legacy rows
      -- until backfilled below. Everyone else is scoped to exactly one branch.
      ALTER TABLE users ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      -- Contact for direct-to-user WhatsApp notifications (e.g. substitution
      -- approval requests to a branch principal) — not tied to a specific
      -- role's profile table since any user role may need this.
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at TIMESTAMPTZ;
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE admission_applications ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);

      -- Custom roles: an admin-defined named permission profile layered on top
      -- of one of the four base roles. base_role keeps login/session/middleware
      -- gating exactly as-is; custom_role_id on a user (when set) only changes
      -- which role_permissions row usePermission() reads from.
      CREATE TABLE IF NOT EXISTS custom_roles (
        id VARCHAR(20) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        base_role VARCHAR(20) NOT NULL,
        description TEXT DEFAULT '',
        color VARCHAR(20) DEFAULT 'blue',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      ALTER TABLE exams ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT false;
      ALTER TABLE results ADD COLUMN IF NOT EXISTS class_id VARCHAR(50);
      ALTER TABLE results ADD COLUMN IF NOT EXISTS section_id VARCHAR(50);
      ALTER TABLE results ADD COLUMN IF NOT EXISTS section_position INT;
      ALTER TABLE results ADD COLUMN IF NOT EXISTS section_total INT;
      ALTER TABLE results ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
      ALTER TABLE results ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS discount_reason VARCHAR(255);
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS month VARCHAR(20);
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS fee_type VARCHAR(100);
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS issue_date VARCHAR(50);
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS class_name VARCHAR(100);
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT '[]';
      ALTER TABLE admission_applications ADD COLUMN IF NOT EXISTS parent_portal_password_hash VARCHAR(255);
      ALTER TABLE admission_applications ADD COLUMN IF NOT EXISTS profile_photo TEXT;
      ALTER TABLE admission_applications ADD COLUMN IF NOT EXISTS previous_result_filename VARCHAR(255);

      ALTER TABLE students ADD COLUMN IF NOT EXISTS student_portal_password VARCHAR(255);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_photo TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(50);
      -- WhatsApp opt-in lives on students (not a separate "parents" table) because
      -- parent_phone/contact already lives here and every existing WhatsApp send
      -- path (absence alerts, fee reminders) already keys off studentId — adding
      -- consent here keeps one lookup path instead of a second join.
      -- Students default to opted-in (school policy: WhatsApp alerts are on by
      -- default; parents can opt out from the student record) — both for new
      -- rows (column default) and for rows that existed before this changed.
      ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT true;
      ALTER TABLE students ALTER COLUMN whatsapp_opt_in SET DEFAULT true;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMPTZ;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at TIMESTAMPTZ;
      UPDATE students SET whatsapp_opt_in = true WHERE whatsapp_opt_in = false AND whatsapp_opt_out_at IS NULL;
      -- Profile fields the Edit dialog already collects but that previously
      -- only lived in the client-side legacy students-context store — adding
      -- them here so the new student profile page (and the Edit dialog, once
      -- wired through) can persist real data instead of local-only state.
      ALTER TABLE students ADD COLUMN IF NOT EXISTS dob DATE;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_relation VARCHAR(50);
      ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMPTZ;
      ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        meta_template_name VARCHAR(100) NOT NULL,
        language VARCHAR(20) NOT NULL DEFAULT 'en_US',
        category VARCHAR(50) NOT NULL DEFAULT 'UTILITY',
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        description TEXT,
        variables JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      -- The literal body text to paste into Meta Business Manager when
      -- creating each template there, using Meta's numbered {{1}}, {{2}}...
      -- placeholder syntax (Meta templates don't support named placeholders —
      -- our own variables column above maps names to these positions in
      -- the same order for notificationService.send()).
      ALTER TABLE whatsapp_templates ADD COLUMN IF NOT EXISTS body TEXT;

      -- Seed the 8 template slots from the integration spec. status starts
      -- 'PENDING' — these are NOT auto-approved; an admin must create the
      -- matching template in Meta Business Manager, get it approved, then
      -- flip status to 'APPROVED' (Settings > WhatsApp Templates) before
      -- notificationService.send() will use it. meta_template_name defaults
      -- to the same slug; edit it if the approved Meta template is named differently.
      -- language is 'en' (plain "English"), not 'en_US' ("English (US)") —
      -- Meta treats these as distinct template translations; sending with the
      -- wrong one fails with error 132001 ("Template name does not exist in
      -- the translation") even though the template itself is Active in Meta
      -- Business Manager. Match whatever locale the template was actually
      -- created under there.
      INSERT INTO whatsapp_templates (id, name, meta_template_name, language, category, status, description, variables, body) VALUES
        ('wat_student_absence', 'STUDENT_ABSENCE', 'student_absence', 'en', 'UTILITY', 'PENDING', 'Sent to a parent when their child is marked absent.', '["parentName","studentName","date"]',
          'Dear {{1}}, this is to inform you that {{2}} was marked absent on {{3}}. Please contact the school office if you have any questions.'),
        ('wat_fee_reminder', 'FEE_REMINDER', 'fee_reminder', 'en', 'UTILITY', 'PENDING', 'Sent ahead of a fee due date.', '["parentName","studentName","amount","dueDate"]',
          'Dear {{1}}, a fee payment of {{3}} for {{2}} is due on {{4}}. Please make the payment on time to avoid late charges.'),
        ('wat_fee_overdue', 'FEE_OVERDUE', 'fee_overdue', 'en', 'UTILITY', 'PENDING', 'Sent when a fee voucher is past due.', '["parentName","studentName","amount","dueDate"]',
          'Dear {{1}}, the fee payment of {{3}} for {{2}} was due on {{4}} and is now overdue. Please settle it at your earliest convenience.'),
        ('wat_exam_reminder', 'EXAM_REMINDER', 'exam_reminder', 'en', 'UTILITY', 'PENDING', 'Sent ahead of an exam.', '["studentName","examName","date"]',
          'Hi {{1}}, this is a reminder that your {{2}} exam is scheduled for {{3}}. Please be prepared and arrive on time.'),
        ('wat_ptm_reminder', 'PTM_REMINDER', 'ptm_reminder', 'en', 'UTILITY', 'PENDING', 'Parent-teacher meeting reminder.', '["parentName","studentName","date","time"]',
          'Dear {{1}}, you are invited to a Parent-Teacher Meeting regarding {{2}} on {{3}} at {{4}}. We look forward to seeing you.'),
        ('wat_school_announcement', 'SCHOOL_ANNOUNCEMENT', 'school_announcement', 'en', 'MARKETING', 'PENDING', 'General school announcement broadcast.', '["title","message"]',
          '{{1}}

{{2}}'),
        ('wat_teacher_meeting', 'TEACHER_MEETING', 'teacher_meeting', 'en', 'UTILITY', 'PENDING', 'Staff meeting notification to a teacher.', '["teacherName","date","time"]',
          'Dear {{1}}, you are requested to attend a staff meeting on {{2}} at {{3}}.'),
        ('wat_event_reminder', 'EVENT_REMINDER', 'event_reminder', 'en', 'UTILITY', 'PENDING', 'Sent ahead of a school event.', '["recipientName","eventName","date"]',
          'Hi {{1}}, this is a reminder about the upcoming event: {{2}} on {{3}}. We hope to see you there.'),
        ('wat_substitution_approval', 'SUBSTITUTION_APPROVAL', 'substitution_approval', 'en', 'UTILITY', 'PENDING', 'Fallback for the branch principal/admin substitution-approval alert, used when the free-text message (the default — no template needed) can''t be delivered because the 24h WhatsApp conversation window is closed.', '["teacher_name","date","reason","periods_summary"]',
          '{{1}} is {{3}} on {{2}}. The following periods need a substitute:

{{4}}

Please review and approve in the school management dashboard.')
      ON CONFLICT (name) DO NOTHING;

      -- Backfill body text for rows that already existed before this column
      -- was added (ON CONFLICT DO NOTHING above skips them).
      UPDATE whatsapp_templates SET body = 'Dear {{1}}, this is to inform you that {{2}} was marked absent on {{3}}. Please contact the school office if you have any questions.' WHERE name = 'STUDENT_ABSENCE' AND body IS NULL;
      UPDATE whatsapp_templates SET body = 'Dear {{1}}, a fee payment of {{3}} for {{2}} is due on {{4}}. Please make the payment on time to avoid late charges.' WHERE name = 'FEE_REMINDER' AND body IS NULL;
      UPDATE whatsapp_templates SET body = 'Dear {{1}}, the fee payment of {{3}} for {{2}} was due on {{4}} and is now overdue. Please settle it at your earliest convenience.' WHERE name = 'FEE_OVERDUE' AND body IS NULL;
      UPDATE whatsapp_templates SET body = 'Hi {{1}}, this is a reminder that your {{2}} exam is scheduled for {{3}}. Please be prepared and arrive on time.' WHERE name = 'EXAM_REMINDER' AND body IS NULL;
      UPDATE whatsapp_templates SET body = 'Dear {{1}}, you are invited to a Parent-Teacher Meeting regarding {{2}} on {{3}} at {{4}}. We look forward to seeing you.' WHERE name = 'PTM_REMINDER' AND body IS NULL;
      UPDATE whatsapp_templates SET body = E'{{1}}\n\n{{2}}' WHERE name = 'SCHOOL_ANNOUNCEMENT' AND body IS NULL;
      UPDATE whatsapp_templates SET body = 'Dear {{1}}, you are requested to attend a staff meeting on {{2}} at {{3}}.' WHERE name = 'TEACHER_MEETING' AND body IS NULL;
      UPDATE whatsapp_templates SET body = 'Hi {{1}}, this is a reminder about the upcoming event: {{2}} on {{3}}. We hope to see you there.' WHERE name = 'EVENT_REMINDER' AND body IS NULL;
      UPDATE whatsapp_templates SET body = E'{{1}} is {{3}} on {{2}}. The following periods need a substitute:\n\n{{4}}\n\nPlease review and approve in the school management dashboard.' WHERE name = 'SUBSTITUTION_APPROVAL' AND body IS NULL;

      ALTER TABLE alumni ADD COLUMN IF NOT EXISTS source_student_id VARCHAR(50) REFERENCES students(id);
      CREATE INDEX IF NOT EXISTS idx_alumni_source_student ON alumni(source_student_id);
      -- Best-effort backfill from admission applications, since students created
      -- before this column existed have no phone number recorded anywhere else.
      UPDATE students s SET parent_phone = a.parent_phone
        FROM admission_applications a
        WHERE s.parent_phone IS NULL AND s.parent_email = a.parent_email AND a.parent_phone IS NOT NULL;
      -- Make new schema columns match (name, capacity default to null now)
      ALTER TABLE sections ALTER COLUMN name DROP NOT NULL;
      ALTER TABLE sections ALTER COLUMN capacity DROP NOT NULL;
      -- Relational academic-core columns may be missing if this table was
      -- created by prisma db push (older Section model) instead of this file.
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS class_id VARCHAR(50);
      ALTER TABLE sections ADD COLUMN IF NOT EXISTS section_group VARCHAR(100);

      -- Timetable: relational IDs (for conflict/competency checks) + publish gate.
      -- teacher_name/class_name/subject_name stay as denormalized display fields.
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS class_id VARCHAR(50);
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS section_id VARCHAR(50);
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS subject_id VARCHAR(50);
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS teacher_id INTEGER;
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS academic_year_id VARCHAR(50);
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS competency_override BOOLEAN DEFAULT false;
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS assigned_by_user_id INTEGER;
      ALTER TABLE timetable_entries ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ DEFAULT NOW();

      CREATE TABLE IF NOT EXISTS timetable_publications (
        id VARCHAR(50) PRIMARY KEY,
        class_id VARCHAR(50) NOT NULL,
        section_id VARCHAR(50) NOT NULL,
        academic_year_id VARCHAR(50) NOT NULL,
        published_by_user_id INTEGER,
        published_by_name VARCHAR(255),
        published_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Reusable weekly bell schedule: one grid of periods per academic year,
      -- shared by every class/section's timetable builder.
      CREATE TABLE IF NOT EXISTS period_slots (
        id VARCHAR(50) PRIMARY KEY,
        academic_year_id VARCHAR(50) NOT NULL,
        period_number INT NOT NULL,
        label VARCHAR(50) NOT NULL,
        start_time VARCHAR(10) NOT NULL,
        end_time VARCHAR(10) NOT NULL,
        is_break BOOLEAN DEFAULT false
      );

      -- Substitute-teacher assignments for a specific calendar date (timetable_entries
      -- are recurring weekly templates; an absence only affects one actual date, so
      -- substitutions key off (timetable_entry_id, date) rather than the entry alone).
      CREATE TABLE IF NOT EXISTS timetable_substitutions (
        id VARCHAR(50) PRIMARY KEY,
        timetable_entry_id VARCHAR(50) NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
        date VARCHAR(20) NOT NULL,
        original_teacher_id INTEGER NOT NULL,
        substitute_teacher_id INTEGER,
        reason VARCHAR(20) NOT NULL,
        status VARCHAR(20) DEFAULT 'auto',
        notified BOOLEAN DEFAULT false,
        created_by VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(timetable_entry_id, date)
      );
      -- Auto-assigned substitutions ('auto' status) sit pending until the
      -- branch principal (or an admin) approves them — approved_by/at track
      -- that sign-off, distinct from created_by which is always 'system' for
      -- the auto-engine's own rows.
      ALTER TABLE timetable_substitutions ADD COLUMN IF NOT EXISTS approved_by INTEGER;
      ALTER TABLE timetable_substitutions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
      CREATE INDEX IF NOT EXISTS idx_tt_sub_date ON timetable_substitutions(date);
      CREATE INDEX IF NOT EXISTS idx_tt_sub_substitute ON timetable_substitutions(substitute_teacher_id);

      -- Fee module: relational roster references + a real payment ledger.
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS class_id VARCHAR(50);
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS section_id VARCHAR(50);
      ALTER TABLE fee_records ADD COLUMN IF NOT EXISTS academic_year_id VARCHAR(50);
      ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS assigned_class_id VARCHAR(50);

      CREATE TABLE IF NOT EXISTS fee_payments (
        id VARCHAR(50) PRIMARY KEY,
        fee_record_id VARCHAR(50) NOT NULL,
        amount NUMERIC NOT NULL,
        method VARCHAR(50),
        payment_date VARCHAR(20),
        type VARCHAR(10) DEFAULT 'payment',
        recorded_by_user_id INTEGER,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Online fee payments (JazzCash / EasyPaisa hosted-checkout gateways).
      -- One row per initiated attempt; the gateway's signed callback flips it
      -- to success/failed and, on success, writes the matching fee_payments
      -- ledger row via writeFeePaymentLedgerEntryDB.
      CREATE TABLE IF NOT EXISTS online_payments (
        id VARCHAR(50) PRIMARY KEY,
        fee_record_id VARCHAR(50) NOT NULL REFERENCES fee_records(id) ON DELETE CASCADE,
        gateway VARCHAR(20) NOT NULL,
        txn_ref VARCHAR(100) NOT NULL UNIQUE,
        amount NUMERIC NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'initiated',
        initiated_by_user_id INTEGER,
        gateway_response JSONB,
        fee_payment_id VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_online_payments_txn_ref ON online_payments(txn_ref);
      CREATE INDEX IF NOT EXISTS idx_online_payments_fee_record ON online_payments(fee_record_id);

      -- Messaging: 1:1 conversations between Teacher/Student/Parent/Admin.
      CREATE TABLE IF NOT EXISTS conversations (
        id VARCHAR(50) PRIMARY KEY,
        user_a_id INTEGER NOT NULL,
        user_b_id INTEGER NOT NULL,
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_a_id, user_b_id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(50) PRIMARY KEY,
        conversation_id VARCHAR(50) NOT NULL,
        sender_id INTEGER NOT NULL,
        body TEXT NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        read_at TIMESTAMPTZ
      );

      -- Student promotion: graduating-class flag, promotion outcome, batch audit trail.
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_graduating BOOLEAN DEFAULT false;
      ALTER TABLE student_promotions ADD COLUMN IF NOT EXISTS outcome VARCHAR(20) DEFAULT 'promoted';
      ALTER TABLE student_promotions ADD COLUMN IF NOT EXISTS remarks TEXT;

      CREATE TABLE IF NOT EXISTS promotion_batches (
        id VARCHAR(50) PRIMARY KEY,
        from_class_id VARCHAR(50), from_section_id VARCHAR(50), from_academic_year_id VARCHAR(50),
        to_class_id VARCHAR(50), to_section_id VARCHAR(50), to_academic_year_id VARCHAR(50) NOT NULL,
        is_graduating BOOLEAN DEFAULT false,
        promoted_count INT DEFAULT 0, retained_count INT DEFAULT 0, withdrawn_count INT DEFAULT 0,
        promoted_by_user_id INTEGER, promoted_by_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Assignments: relational scoping (real class/subject/teacher), attachments,
      -- and late/graded tracking on submissions.
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS class_id VARCHAR(50);
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS section_id VARCHAR(50);
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS subject_id VARCHAR(50);
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS teacher_id INTEGER;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_data TEXT;
      ALTER TABLE assignments ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);

      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS is_late BOOLEAN DEFAULT false;
      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS graded_at TIMESTAMPTZ;
      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS attachment_data TEXT;
      ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255);

      -- Fix enrollments that point to academic_terms instead of academic_years
      UPDATE enrollments SET academic_year_id = (SELECT id FROM academic_years WHERE is_active = true LIMIT 1)
      WHERE academic_year_id IS NOT NULL
        AND academic_year_id NOT IN (SELECT id FROM academic_years);

      -- Migrate legacy rooms v1 schema (room_no) to v2 (name, type, floor, etc.)
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_no VARCHAR(50);
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS name VARCHAR(255);
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS type VARCHAR(50);
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor INT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS has_projector BOOLEAN DEFAULT false;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS has_ac BOOLEAN DEFAULT false;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS has_computers BOOLEAN DEFAULT false;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

      ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS class_total INT;
      ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS class_name VARCHAR(100);
      ALTER TABLE report_cards ADD COLUMN IF NOT EXISTS section_name VARCHAR(100);

      -- Teacher Management: HR metadata, qualifications, subject competency
      CREATE TABLE IF NOT EXISTS pay_scales (
        id VARCHAR(50) PRIMARY KEY,
        label VARCHAR(100) NOT NULL UNIQUE,
        sort_order INT DEFAULT 0
      );

      -- Standard government BPS grades (BPS-1 to BPS-22) — seeded once so the
      -- BPS Grade dropdown on a teacher's profile isn't empty with no way to
      -- populate it from the UI.
      INSERT INTO pay_scales (id, label, sort_order)
      SELECT 'bps-' || n, 'BPS-' || n, n FROM generate_series(1, 22) AS n
      ON CONFLICT (label) DO NOTHING;

      CREATE TABLE IF NOT EXISTS teacher_qualifications (
        id VARCHAR(50) PRIMARY KEY,
        teacher_id INTEGER NOT NULL,
        degree_title VARCHAR(255) NOT NULL,
        institution VARCHAR(255),
        year_completed INT,
        specialization VARCHAR(255),
        certificate_file_path TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS teacher_subject_competencies (
        id VARCHAR(50) PRIMARY KEY,
        teacher_id INTEGER NOT NULL,
        subject_id VARCHAR(50) NOT NULL,
        class_id VARCHAR(50) NOT NULL,
        UNIQUE(teacher_id, subject_id, class_id)
      );

      ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;
      ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) DEFAULT 'fulltime';
      ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
      ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS pay_scale_id VARCHAR(50);
      ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS designation VARCHAR(100);

      -- Admin-created teacher accounts didn't always get a teacher_profiles
      -- row (only self-registration did) — backfill so /teachers/[id]
      -- doesn't show "Teacher not found" for those accounts.
      INSERT INTO teacher_profiles (id, user_id, phone, cnic, specialization, qualification, experience_years, joining_date, address)
      SELECT 'tp_backfill_' || u.id, u.id, '', '', '', '', 0, NULL, ''
      FROM users u
      WHERE u.role = 'TEACHER' AND NOT EXISTS (SELECT 1 FROM teacher_profiles tp WHERE tp.user_id = u.id);

      ALTER TABLE teacher_class_subjects ADD COLUMN IF NOT EXISTS competency_override BOOLEAN DEFAULT false;

      -- LMS tables
      CREATE TABLE IF NOT EXISTS courses (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), code VARCHAR(50) UNIQUE, description TEXT, grade_level VARCHAR(100), teacher_name VARCHAR(255), credits INT, learning_outcomes TEXT[] DEFAULT '{}', prerequisites TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS course_materials (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50), title VARCHAR(255), type VARCHAR(50), url TEXT, created_at VARCHAR(50));
      -- Notes (type='document', url = base64 data URI via the app's existing
      -- readAsDataURL upload pattern) and Video Lectures (type='video', url =
      -- a YouTube/Vimeo link, embedded via iframe — no video file upload,
      -- there's no blob storage in this app and base64-in-DB doesn't scale to
      -- video file sizes).
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS file_name VARCHAR(255);
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER;
      ALTER TABLE course_materials ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_course_materials_course ON course_materials(course_id);

      -- Class-wise textbook PDF library — same base64-in-TEXT convention as
      -- course_materials.url above. subject_id is nullable (a book can cover
      -- a whole class, not just one subject). Read from Examinations' Book
      -- Library page, the AI Question Generator, and surfaced in LMS.
      CREATE TABLE IF NOT EXISTS class_books (
        id VARCHAR(50) PRIMARY KEY,
        class_id VARCHAR(50) NOT NULL,
        subject_id VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255),
        file_name VARCHAR(255),
        pdf_data TEXT NOT NULL,
        uploaded_by_user_id INTEGER,
        uploaded_by_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT true
      );
      CREATE INDEX IF NOT EXISTS idx_class_books_class ON class_books(class_id);

      -- AI-assisted (and manually added) question bank generated from a
      -- class_books PDF. Draft items are reviewed/edited before Approve;
      -- approved items can be pushed into an online exam's question bank.
      CREATE TABLE IF NOT EXISTS question_bank (
        id VARCHAR(50) PRIMARY KEY,
        book_id VARCHAR(50) NOT NULL,
        class_id VARCHAR(50) NOT NULL,
        subject_id VARCHAR(50),
        question_type VARCHAR(20) NOT NULL,
        question_text TEXT NOT NULL,
        options JSONB DEFAULT '[]',
        correct_answer TEXT,
        marks INT DEFAULT 1,
        difficulty VARCHAR(20) DEFAULT 'Medium',
        status VARCHAR(20) DEFAULT 'draft',
        generated_by_ai BOOLEAN DEFAULT true,
        created_by_user_id INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_question_bank_book ON question_bank(book_id);

      CREATE TABLE IF NOT EXISTS discussion_forums (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50), topic VARCHAR(255), author_name VARCHAR(255), content TEXT, created_at VARCHAR(50));
      CREATE TABLE IF NOT EXISTS forum_replies (id VARCHAR(50) PRIMARY KEY, forum_id VARCHAR(50), author_name VARCHAR(255), content TEXT, created_at VARCHAR(50));
      CREATE TABLE IF NOT EXISTS online_quizzes (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50), title VARCHAR(255), questions JSONB DEFAULT '[]', total_marks INT, time_limit INT, due_date VARCHAR(50));
      CREATE TABLE IF NOT EXISTS quiz_attempts (id VARCHAR(50) PRIMARY KEY, quiz_id VARCHAR(50), student_id VARCHAR(50), student_name VARCHAR(255), answers JSONB DEFAULT '[]', score INT DEFAULT 0, submitted_at VARCHAR(50));
      CREATE TABLE IF NOT EXISTS student_progress (id VARCHAR(50) PRIMARY KEY, course_id VARCHAR(50), student_id VARCHAR(50), student_name VARCHAR(255), materials_completed INT DEFAULT 0, total_materials INT DEFAULT 0, quiz_score INT DEFAULT 0, last_accessed VARCHAR(50));
      
      -- Library tables
      CREATE TABLE IF NOT EXISTS library_books (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), author VARCHAR(255), isbn VARCHAR(50) UNIQUE, category VARCHAR(100), publisher VARCHAR(255), publish_year INT, total_copies INT, available_copies INT, rack_number VARCHAR(50), barcode VARCHAR(100) UNIQUE, is_digital BOOLEAN DEFAULT false, digital_url TEXT, status VARCHAR(50) DEFAULT 'Available');
      CREATE TABLE IF NOT EXISTS book_issues (id VARCHAR(50) PRIMARY KEY, book_id VARCHAR(50), book_title VARCHAR(255), student_id VARCHAR(50), student_name VARCHAR(255), issued_date VARCHAR(50), due_date VARCHAR(50), returned_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Issued', fine INT DEFAULT 0, fine_paid BOOLEAN DEFAULT false);
      CREATE TABLE IF NOT EXISTS library_reservations (id VARCHAR(50) PRIMARY KEY, book_id VARCHAR(50), student_id VARCHAR(50), student_name VARCHAR(255), reserved_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Pending');
      
      -- Hostel tables
      CREATE TABLE IF NOT EXISTS hostels (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), type VARCHAR(50), warden_name VARCHAR(255), contact_phone VARCHAR(50), total_rooms INT, total_beds INT, address TEXT);
      CREATE TABLE IF NOT EXISTS hostel_rooms (id VARCHAR(50) PRIMARY KEY, hostel_id VARCHAR(50), room_number VARCHAR(50), floor INT, total_beds INT, occupied_beds INT DEFAULT 0, monthly_fee INT, is_active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS hostel_allocations (id VARCHAR(50) PRIMARY KEY, hostel_id VARCHAR(50), hostel_name VARCHAR(255), room_id VARCHAR(50), room_number VARCHAR(50), student_id VARCHAR(50), student_name VARCHAR(255), start_date VARCHAR(50), end_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Active', fee_amount INT, fee_paid BOOLEAN DEFAULT false);
      CREATE TABLE IF NOT EXISTS hostel_attendance (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), date VARCHAR(50), status VARCHAR(50), in_time VARCHAR(20), out_time VARCHAR(20), remarks TEXT);
      CREATE TABLE IF NOT EXISTS visitor_logs (id VARCHAR(50) PRIMARY KEY, hostel_id VARCHAR(50), visitor_name VARCHAR(255), student_name VARCHAR(255), relation VARCHAR(100), phone VARCHAR(50), in_time VARCHAR(20), out_time VARCHAR(20), date VARCHAR(50));
      
      -- Transport tables
      CREATE TABLE IF NOT EXISTS transport_routes (id VARCHAR(50) PRIMARY KEY, route_name VARCHAR(255), start_point VARCHAR(255), end_point VARCHAR(255), stops JSONB DEFAULT '[]', distance FLOAT DEFAULT 0, fee_amount INT DEFAULT 0, is_active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS transport_vehicles (id VARCHAR(50) PRIMARY KEY, vehicle_number VARCHAR(50), type VARCHAR(50), capacity INT, route_id VARCHAR(50), driver_name VARCHAR(255), driver_phone VARCHAR(50), registration_date VARCHAR(50), fitness_expiry VARCHAR(50), insurance_expiry VARCHAR(50), is_active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS transport_allocations (id VARCHAR(50) PRIMARY KEY, route_id VARCHAR(50), vehicle_id VARCHAR(50), student_id VARCHAR(50), student_name VARCHAR(255), pickup_point VARCHAR(255), drop_point VARCHAR(255), fee_amount INT DEFAULT 0, fee_paid BOOLEAN DEFAULT false, status VARCHAR(50) DEFAULT 'Active');
      
      -- HR tables
      CREATE TABLE IF NOT EXISTS employees (id VARCHAR(50) PRIMARY KEY, user_id INT UNIQUE, name VARCHAR(255), email VARCHAR(255) UNIQUE, phone VARCHAR(50), department VARCHAR(100), designation VARCHAR(100), employment_type VARCHAR(50), joining_date VARCHAR(50), cnic VARCHAR(50), address TEXT, emergency_contact VARCHAR(255), emergency_phone VARCHAR(50), qualification VARCHAR(255), experience INT, status VARCHAR(50) DEFAULT 'Active', bank_name VARCHAR(255), bank_account VARCHAR(100), profile_photo TEXT);
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      CREATE TABLE IF NOT EXISTS leave_requests (id VARCHAR(50) PRIMARY KEY, employee_id INT, employee_name VARCHAR(255), leave_type VARCHAR(50), start_date VARCHAR(50), end_date VARCHAR(50), total_days INT, reason TEXT, status VARCHAR(50) DEFAULT 'Pending', approved_by VARCHAR(255), applied_at VARCHAR(50));
      CREATE TABLE IF NOT EXISTS performance_evaluations (id VARCHAR(50) PRIMARY KEY, employee_id INT, employee_name VARCHAR(255), evaluator_name VARCHAR(255), evaluation_date VARCHAR(50), rating INT, feedback TEXT, goals TEXT, overall_score FLOAT DEFAULT 0);
      CREATE TABLE IF NOT EXISTS contract_records (id VARCHAR(50) PRIMARY KEY, employee_id INT, start_date VARCHAR(50), end_date VARCHAR(50), contract_type VARCHAR(100), documents TEXT DEFAULT '', status VARCHAR(50) DEFAULT 'Active');
      
      -- Payroll tables
      CREATE TABLE IF NOT EXISTS salary_structures (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), employee_id INT, employee_name VARCHAR(255), basic_salary INT, allowances JSONB DEFAULT '[]', deductions JSONB DEFAULT '[]', total_salary INT, is_active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS payslips (id VARCHAR(50) PRIMARY KEY, employee_id INT, employee_name VARCHAR(255), month VARCHAR(20), year INT, basic_salary INT, allowances JSONB DEFAULT '[]', deductions JSONB DEFAULT '[]', gross_pay INT, total_deductions INT, net_pay INT, tax_amount INT DEFAULT 0, overtime_pay INT DEFAULT 0, status VARCHAR(50) DEFAULT 'Draft', generated_at VARCHAR(50));
      CREATE TABLE IF NOT EXISTS overtime_records (id VARCHAR(50) PRIMARY KEY, employee_id INT, employee_name VARCHAR(255), date VARCHAR(50), hours FLOAT DEFAULT 0, rate INT DEFAULT 0, amount INT DEFAULT 0, status VARCHAR(50) DEFAULT 'Pending');

      -- Unify staff identity: employees becomes the HR extension record for
      -- EVERY staff member (teachers included), 1:1 with users. Prisma's
      -- migrations already enforce leave_requests/salary_structures/payslips/
      -- performance_evaluations.employee_id -> employees.user_id (verified
      -- live) — that's the real reference target, not users.id directly, so
      -- "staff" here always means "has an employees row."
      ALTER TABLE employees ADD COLUMN IF NOT EXISTS pay_scale_id VARCHAR(50);
      -- user_id is NOT NULL, so the legacy user_id=0 phantom (from HR's old
      -- "Add Employee" flow, which never created a real login) can't be
      -- nulled out — it's deleted instead. It never resolved to a real person.
      DELETE FROM employees WHERE user_id NOT IN (SELECT id FROM users);
      DO $$ BEGIN
        ALTER TABLE employees ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      -- Backfill: every existing teacher gets a linked employees row so they
      -- immediately appear in HR/Payroll/Leave staff pickers.
      INSERT INTO employees (id, user_id, name, email, phone, department, designation, employment_type, joining_date, cnic, address, emergency_contact, emergency_phone, qualification, experience, status, bank_name, bank_account, profile_photo, pay_scale_id)
      SELECT 'emp_tp_' || tp.user_id, tp.user_id, u.name, u.email, COALESCE(tp.phone, ''), 'Teaching', COALESCE(tp.designation, ''), COALESCE(tp.employment_type, 'fulltime'), COALESCE(tp.joining_date, ''), COALESCE(tp.cnic, ''), COALESCE(tp.address, ''), '', '', COALESCE(tp.qualification, ''), COALESCE(tp.experience_years, 0), CASE WHEN tp.status = 'active' THEN 'Active' WHEN tp.status = 'inactive' THEN 'Inactive' ELSE 'Active' END, '', '', '', tp.pay_scale_id
      FROM teacher_profiles tp
      JOIN users u ON u.id = tp.user_id
      WHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.user_id = tp.user_id)
      ON CONFLICT DO NOTHING;

      -- Note: teacher_profiles.employee_id is a separate, admin-typed
      -- human-readable staff code (e.g. "EMP-1004") shown in the Teacher UI —
      -- it is NOT the link to the employees row above. The real link is
      -- teacher_profiles.user_id = employees.user_id (both unique), so no
      -- write to teacher_profiles.employee_id happens here.

      -- employee_id on Payroll/Leave/Performance/Contract/Overtime is
      -- enforced (by Prisma) to reference employees.user_id, not any users.id
      -- — clean up rows from the old hand-typed forms that never matched a
      -- real employees row (employee_id/user_id are NOT NULL, so delete
      -- rather than null).
      DELETE FROM leave_requests WHERE employee_id NOT IN (SELECT user_id FROM employees);
      DELETE FROM salary_structures WHERE employee_id NOT IN (SELECT user_id FROM employees);
      DELETE FROM payslips WHERE employee_id NOT IN (SELECT user_id FROM employees);
      DELETE FROM performance_evaluations WHERE employee_id NOT IN (SELECT user_id FROM employees);
      DELETE FROM contract_records WHERE employee_id NOT IN (SELECT user_id FROM employees);
      DELETE FROM overtime_records WHERE employee_id NOT IN (SELECT user_id FROM employees);

      -- Accounting tables
      CREATE TABLE IF NOT EXISTS account_entries (id VARCHAR(50) PRIMARY KEY, date VARCHAR(50), type VARCHAR(20), category VARCHAR(100), description TEXT, amount INT, payment_method VARCHAR(50), reference VARCHAR(100), created_by VARCHAR(255));
      CREATE TABLE IF NOT EXISTS budget_allocations (id VARCHAR(50) PRIMARY KEY, department VARCHAR(100), category VARCHAR(100), allocated_amount INT, spent_amount INT DEFAULT 0, fiscal_year VARCHAR(20), notes TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS bank_transactions (id VARCHAR(50) PRIMARY KEY, bank_name VARCHAR(255), account_number VARCHAR(100), type VARCHAR(50), amount INT, date VARCHAR(50), reference VARCHAR(100), balance INT DEFAULT 0);
      
      -- Scholarship tables
      CREATE TABLE IF NOT EXISTS scholarships (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), type VARCHAR(50), amount INT, total_slots INT, available_slots INT, eligibility_criteria TEXT, is_active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS scholarship_applications (id VARCHAR(50) PRIMARY KEY, scholarship_id VARCHAR(50), scholarship_name VARCHAR(255), student_id VARCHAR(50), student_name VARCHAR(255), applying_for_class VARCHAR(100), academic_score FLOAT, family_income INT, supporting_docs TEXT, status VARCHAR(50) DEFAULT 'Pending', applied_at VARCHAR(50), approved_by VARCHAR(255));
      CREATE TABLE IF NOT EXISTS financial_aid (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), aid_type VARCHAR(100), amount INT, duration VARCHAR(100), status VARCHAR(50) DEFAULT 'Active', approved_at VARCHAR(50));
      
      -- Discipline tables
      CREATE TABLE IF NOT EXISTS incident_reports (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), class VARCHAR(100), reported_by VARCHAR(255), incident_date VARCHAR(50), incident_type VARCHAR(100), description TEXT, severity VARCHAR(20) DEFAULT 'Medium', location VARCHAR(255), witnesses TEXT DEFAULT '', status VARCHAR(50) DEFAULT 'Open', action_taken TEXT, resolved_at VARCHAR(50));
      CREATE TABLE IF NOT EXISTS disciplinary_actions (id VARCHAR(50) PRIMARY KEY, incident_id VARCHAR(50), student_id VARCHAR(50), action_type VARCHAR(50), description TEXT, start_date VARCHAR(50), end_date VARCHAR(50), issued_by VARCHAR(255), notes TEXT);
      CREATE TABLE IF NOT EXISTS counseling_records (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), counselor_name VARCHAR(255), session_date VARCHAR(50), type VARCHAR(50), notes TEXT, outcome TEXT, follow_up_date VARCHAR(50));
      CREATE TABLE IF NOT EXISTS behavior_history (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), entry_date VARCHAR(50), behavior_type VARCHAR(20), description TEXT, recorded_by VARCHAR(255), points INT DEFAULT 0);
      
      -- Health tables
      CREATE TABLE IF NOT EXISTS medical_records (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50) UNIQUE, student_name VARCHAR(255), blood_group VARCHAR(10), allergies TEXT DEFAULT '', chronic_conditions TEXT DEFAULT '', medications TEXT DEFAULT '', emergency_contact VARCHAR(255), emergency_phone VARCHAR(50), insurance_provider VARCHAR(255), insurance_number VARCHAR(100));
      CREATE TABLE IF NOT EXISTS vaccination_records (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), vaccine_name VARCHAR(255), dose_number INT, date_administered VARCHAR(50), administered_by VARCHAR(255), next_due_date VARCHAR(50), notes TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS health_screenings (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), screening_date VARCHAR(50), height FLOAT DEFAULT 0, weight FLOAT DEFAULT 0, bmi FLOAT DEFAULT 0, vision_test VARCHAR(50), hearing_test VARCHAR(50), dental_check VARCHAR(50), general_health VARCHAR(50), notes TEXT DEFAULT '', screened_by VARCHAR(255));
      
      -- Events tables
      CREATE TABLE IF NOT EXISTS events (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), description TEXT, category VARCHAR(50), start_date VARCHAR(50), end_date VARCHAR(50), start_time VARCHAR(20), end_time VARCHAR(20), venue VARCHAR(255), organizer VARCHAR(255), max_participants INT DEFAULT 0, registration_deadline VARCHAR(50), status VARCHAR(50) DEFAULT 'Upcoming', budget INT DEFAULT 0, banner_url TEXT);
      CREATE TABLE IF NOT EXISTS event_registrations (id VARCHAR(50) PRIMARY KEY, event_id VARCHAR(50), student_id VARCHAR(50), student_name VARCHAR(255), class VARCHAR(100), registered_at VARCHAR(50), attended BOOLEAN DEFAULT false, certificate_issued BOOLEAN DEFAULT false);
      
      -- Alumni tables
      CREATE TABLE IF NOT EXISTS alumni (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), phone VARCHAR(50), graduation_year INT, class VARCHAR(100), current_occupation VARCHAR(255), company VARCHAR(255) DEFAULT '', address TEXT DEFAULT '', linkedin_url TEXT, facebook_url TEXT, is_donor BOOLEAN DEFAULT false, donation_amount INT DEFAULT 0, status VARCHAR(50) DEFAULT 'Active');

      -- Phase 6 multi-branch scoping: these facility/records tables don't
      -- reliably cascade from an existing branch-scoped anchor (alumni's
      -- source_student_id is nullable — most seeded/walk-in alumni have
      -- none — and incident_reports/medical_records's student_id isn't
      -- joined in their current fetch queries), so each gets its own direct
      -- branch_id column rather than relying on an indirect join.
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE library_books ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE hostels ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE transport_routes ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE events ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      ALTER TABLE alumni ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      -- Announcements have no reliable existing FK to a scoped table
      -- (target_class is free text, not a real class_id) — direct column.
      ALTER TABLE announcements ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);
      -- online_exams.class_name is free text (no class_id FK) — direct column.
      ALTER TABLE online_exams ADD COLUMN IF NOT EXISTS branch_id VARCHAR(50) REFERENCES branches(id);

      -- Placement tables
      CREATE TABLE IF NOT EXISTS job_postings (id VARCHAR(50) PRIMARY KEY, company_name VARCHAR(255), company_logo TEXT, title VARCHAR(255), description TEXT, requirements TEXT, location VARCHAR(255), salary_range VARCHAR(100), job_type VARCHAR(50), application_deadline VARCHAR(50), posted_at VARCHAR(50), status VARCHAR(50) DEFAULT 'Active', contact_email VARCHAR(255));
      CREATE TABLE IF NOT EXISTS job_applications (id VARCHAR(50) PRIMARY KEY, job_id VARCHAR(50), student_id VARCHAR(50), student_name VARCHAR(255), class VARCHAR(100), resume TEXT DEFAULT '', cover_letter TEXT, status VARCHAR(50) DEFAULT 'Pending', applied_at VARCHAR(50));
      CREATE TABLE IF NOT EXISTS employers (id VARCHAR(50) PRIMARY KEY, company_name VARCHAR(255), industry VARCHAR(100), website TEXT DEFAULT '', contact_name VARCHAR(255), contact_email VARCHAR(255), contact_phone VARCHAR(50), address TEXT, partnership_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Active');
      CREATE TABLE IF NOT EXISTS internship_records (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), company_name VARCHAR(255), role VARCHAR(255), start_date VARCHAR(50), end_date VARCHAR(50), stipend INT DEFAULT 0, supervisor_name VARCHAR(255), supervisor_email VARCHAR(255), status VARCHAR(50) DEFAULT 'Ongoing');
      
      -- Research tables
      CREATE TABLE IF NOT EXISTS research_projects (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), researcher_name VARCHAR(255), department VARCHAR(100), description TEXT, start_date VARCHAR(50), end_date VARCHAR(50), funding_amount INT DEFAULT 0, funding_source VARCHAR(255), status VARCHAR(50) DEFAULT 'Proposed', outcomes TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS research_grants (id VARCHAR(50) PRIMARY KEY, project_id VARCHAR(50), grant_name VARCHAR(255), amount INT, provider VARCHAR(255), awarded_date VARCHAR(50), expiry_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Active');
      CREATE TABLE IF NOT EXISTS publications (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), authors TEXT, journal VARCHAR(255), doi VARCHAR(100) DEFAULT '', publish_year INT, citations INT DEFAULT 0, project_id VARCHAR(50), url TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS ethics_approvals (id VARCHAR(50) PRIMARY KEY, project_id VARCHAR(50), committee_name VARCHAR(255), approval_date VARCHAR(50), expiry_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Pending', notes TEXT DEFAULT '');
      
      -- Online Exam tables
      CREATE TABLE IF NOT EXISTS online_exams (id VARCHAR(50) PRIMARY KEY, title VARCHAR(255), class_name VARCHAR(100), subject VARCHAR(100), duration INT, total_marks INT, passing_marks INT, start_time VARCHAR(50), end_time VARCHAR(50), instructions TEXT DEFAULT '', proctoring_enabled BOOLEAN DEFAULT false, shuffle_questions BOOLEAN DEFAULT false, status VARCHAR(50) DEFAULT 'Draft');
      -- Nullable link to a real exam_subjects row: when set, a submitted
      -- attempt's score is written into marks_entries so this online exam
      -- counts toward the student's real term result/report card instead of
      -- staying a disconnected practice quiz.
      ALTER TABLE online_exams ADD COLUMN IF NOT EXISTS exam_subject_id VARCHAR(50);
      CREATE TABLE IF NOT EXISTS online_exam_questions (id VARCHAR(50) PRIMARY KEY, exam_id VARCHAR(50), type VARCHAR(50), question TEXT, options JSONB DEFAULT '[]', correct_answer TEXT, marks INT);
      CREATE TABLE IF NOT EXISTS online_exam_attempts (id VARCHAR(50) PRIMARY KEY, exam_id VARCHAR(50), student_id VARCHAR(50), student_name VARCHAR(255), answers JSONB DEFAULT '[]', score INT DEFAULT 0, started_at VARCHAR(50), submitted_at VARCHAR(50), status VARCHAR(50) DEFAULT 'InProgress', proctoring_logs TEXT);
      
      -- Certificate tables
      CREATE TABLE IF NOT EXISTS certificate_templates (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), type VARCHAR(50), content TEXT, is_active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS certificate_records (id VARCHAR(50) PRIMARY KEY, student_id VARCHAR(50), student_name VARCHAR(255), certificate_type VARCHAR(50), certificate_number VARCHAR(100), issued_date VARCHAR(50), issued_by VARCHAR(255), verified BOOLEAN DEFAULT false, verification_code VARCHAR(100), document_url TEXT);
      
      -- Inventory & Asset tables
      CREATE TABLE IF NOT EXISTS assets (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), category VARCHAR(100), asset_tag VARCHAR(100), location VARCHAR(255), purchase_date VARCHAR(50), purchase_cost INT, current_value INT, vendor VARCHAR(255), warranty_expiry VARCHAR(50), status VARCHAR(50) DEFAULT 'Available', assigned_to VARCHAR(255), notes TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS maintenance_records (id VARCHAR(50) PRIMARY KEY, asset_id VARCHAR(50), asset_name VARCHAR(255), maintenance_type VARCHAR(50), description TEXT, cost INT DEFAULT 0, performed_by VARCHAR(255), scheduled_date VARCHAR(50), completed_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Scheduled');
      CREATE TABLE IF NOT EXISTS consumable_items (id VARCHAR(50) PRIMARY KEY, name VARCHAR(255), category VARCHAR(100), unit VARCHAR(50), quantity INT DEFAULT 0, min_stock_level INT DEFAULT 0, unit_price INT DEFAULT 0, supplier VARCHAR(255) DEFAULT '', last_restocked VARCHAR(50));
      
      -- Procurement tables
      CREATE TABLE IF NOT EXISTS purchase_requests (id VARCHAR(50) PRIMARY KEY, requested_by VARCHAR(255), department VARCHAR(100), description TEXT, items JSONB DEFAULT '[]', total_cost INT, priority VARCHAR(20) DEFAULT 'Medium', status VARCHAR(50) DEFAULT 'Pending', created_at VARCHAR(50), approved_by VARCHAR(255));
      CREATE TABLE IF NOT EXISTS supplier_quotations (id VARCHAR(50) PRIMARY KEY, request_id VARCHAR(50), supplier_name VARCHAR(255), contact_person VARCHAR(255), contact_email VARCHAR(255), items JSONB DEFAULT '[]', total_amount INT, valid_until VARCHAR(50), status VARCHAR(50) DEFAULT 'Pending', submitted_at VARCHAR(50));
      CREATE TABLE IF NOT EXISTS purchase_orders (id VARCHAR(50) PRIMARY KEY, po_number VARCHAR(100), request_id VARCHAR(50), supplier_name VARCHAR(255), items JSONB DEFAULT '[]', total_amount INT, order_date VARCHAR(50), delivery_date VARCHAR(50), status VARCHAR(50) DEFAULT 'Ordered', payment_status VARCHAR(50) DEFAULT 'Unpaid', notes TEXT DEFAULT '');
      CREATE TABLE IF NOT EXISTS goods_receipts (id VARCHAR(50) PRIMARY KEY, po_id VARCHAR(50), received_date VARCHAR(50), items JSONB DEFAULT '[]', received_by VARCHAR(255), notes TEXT DEFAULT '');
      
      -- Facility tables
      CREATE TABLE IF NOT EXISTS rooms (id VARCHAR(50) PRIMARY KEY, room_no VARCHAR(50), name VARCHAR(255), type VARCHAR(50), capacity INT DEFAULT 30, floor INT, building VARCHAR(255), has_projector BOOLEAN DEFAULT false, has_ac BOOLEAN DEFAULT false, has_computers BOOLEAN DEFAULT false, is_active BOOLEAN DEFAULT true);
      CREATE TABLE IF NOT EXISTS room_bookings (id VARCHAR(50) PRIMARY KEY, room_id VARCHAR(50), room_name VARCHAR(255), booked_by VARCHAR(255), purpose TEXT, date VARCHAR(50), start_time VARCHAR(20), end_time VARCHAR(20), status VARCHAR(50) DEFAULT 'Pending');
      CREATE TABLE IF NOT EXISTS maintenance_requests (id VARCHAR(50) PRIMARY KEY, room_id VARCHAR(50), location VARCHAR(255), issue_type VARCHAR(100), description TEXT, reported_by VARCHAR(255), reported_date VARCHAR(50), priority VARCHAR(20) DEFAULT 'Medium', status VARCHAR(50) DEFAULT 'Open', assigned_to VARCHAR(255), resolved_date VARCHAR(50), cost INT DEFAULT 0);

      -- Self-service password reset: single-use, hashed, short-lived tokens.
      -- The raw token is only ever sent to the client once (at generation); only
      -- its SHA-256 hash is stored, so a DB read can't be used to reset an account.
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id VARCHAR(50) PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
    `);

    // 2. Seed Data if Empty
    
    // School Info
    const schoolRes = await query('SELECT COUNT(*) FROM school_info');
    if (parseInt(schoolRes.rows[0].count) === 0) {
      await query(`
        INSERT INTO school_info (name, registration_number, address, contact_email, academic_year)
        VALUES ($1, $2, $3, $4, $5)
      `, [defaultSchoolInfo.name, defaultSchoolInfo.registrationNumber, defaultSchoolInfo.address, defaultSchoolInfo.contactEmail, defaultSchoolInfo.academicYear]);
    } else {
      await query(`
        UPDATE school_info SET name=$1, registration_number=$2, address=$3, contact_email=$4, academic_year=$5
        WHERE (name IS NULL OR name = '')
      `, [defaultSchoolInfo.name, defaultSchoolInfo.registrationNumber, defaultSchoolInfo.address, defaultSchoolInfo.contactEmail, defaultSchoolInfo.academicYear]);
    }

    // New Academic Core tables
    const ayRes = await query('SELECT COUNT(*) FROM academic_years');
    if (parseInt(ayRes.rows[0].count) === 0) {
      await query(`INSERT INTO academic_years (id, name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5)`,
        ['ay-2026-27', '2026-2027', '2026-04-01', '2027-03-31', true]);
    }

    // Default role permissions
    const permRes = await query('SELECT COUNT(*) FROM role_permissions');
    if (parseInt(permRes.rows[0].count) === 0) {
      const permissions = [
        'students.view', 'students.create', 'students.edit', 'students.delete',
        'teachers.view', 'teachers.create', 'teachers.edit', 'teachers.delete',
        'admissions.view', 'admissions.approve', 'admissions.reject',
        'classes.view', 'classes.create', 'classes.edit', 'classes.delete',
        'assignments.view', 'assignments.create', 'assignments.grade', 'assignments.delete',
        'attendance.view', 'attendance.mark', 'attendance.staff.manage',
        'exams.view', 'exams.create', 'exams.edit', 'exams.delete', 'exams.online',
        'results.view', 'results.enter', 'results.approve', 'results.publish',
        'fees.view', 'fees.create', 'fees.edit', 'fees.delete',
        'timetable.view', 'timetable.create', 'timetable.edit', 'timetable.delete', 'timetable.substitute',
        'announcements.view', 'announcements.create', 'announcements.delete',
        'library.view', 'library.create', 'library.edit', 'library.delete',
        'messages.view',
        'transport.view', 'transport.create', 'transport.edit',
        'reports.view', 'reports.export',
        'settings.view', 'settings.edit',
        'users.view', 'users.create', 'users.edit', 'users.delete',
      ];
      const roleDefaults: Record<string, string[]> = {
        ADMIN: permissions,
        TEACHER: ['students.view', 'attendance.view', 'attendance.mark', 'exams.view', 'exams.online', 'results.view', 'results.enter', 'timetable.view', 'announcements.view', 'fees.view', 'classes.view', 'assignments.view', 'assignments.create', 'assignments.grade', 'library.view', 'messages.view', 'transport.view'],
        STUDENT: ['students.view', 'exams.view', 'exams.online', 'results.view', 'fees.view', 'timetable.view', 'announcements.view', 'attendance.view', 'assignments.view', 'library.view', 'messages.view', 'transport.view'],
        PARENT: ['students.view', 'results.view', 'fees.view', 'announcements.view', 'attendance.view', 'assignments.view', 'messages.view', 'transport.view'],
        // Generic non-teaching staff (front desk, accounts, admin support). Starts
        // minimal — real access for a given employee comes from a custom role
        // layered on top, configured per hire in the Permissions grid.
        EMPLOYEE: ['timetable.view', 'announcements.view', 'messages.view'],
      };
      for (const [role, perms] of Object.entries(roleDefaults)) {
        for (const perm of permissions) {
          await query(
            `INSERT INTO role_permissions (role, permission, enabled) VALUES ($1, $2, $3) ON CONFLICT (role, permission) DO NOTHING`,
            [role, perm, perms.includes(perm)]
          );
        }
      }
    }

    // Backfill a permission introduced after a DB was already seeded — the
    // count===0 block above only runs once, so a brand-new key like this
    // never reaches an existing install without an explicit grant here.
    for (const [role, enabled] of [['ADMIN', true], ['TEACHER', true], ['STUDENT', true], ['PARENT', false]] as const) {
      await query(
        `INSERT INTO role_permissions (role, permission, enabled) VALUES ($1, 'exams.online', $2) ON CONFLICT (role, permission) DO NOTHING`,
        [role, enabled]
      );
    }

    // Same backfill problem for 'timetable.substitute' (substitution-engine review
    // screen) — ADMIN-only by default, same as the other non-'view' timetable perms.
    for (const [role, enabled] of [['ADMIN', true], ['TEACHER', false], ['STUDENT', false], ['PARENT', false], ['EMPLOYEE', false]] as const) {
      await query(
        `INSERT INTO role_permissions (role, permission, enabled) VALUES ($1, 'timetable.substitute', $2) ON CONFLICT (role, permission) DO NOTHING`,
        [role, enabled]
      );
    }

    // Same backfill problem for the EMPLOYEE role added after go-live: an
    // already-seeded install never re-runs the count===0 block above, so grant
    // its minimal default set (and nothing else) via ON CONFLICT DO NOTHING.
    {
      const employeePerms = ['students.view','teachers.view','admissions.view','classes.view','attendance.view','attendance.mark','exams.view','exams.online','results.view','fees.view','timetable.view','timetable.create','timetable.edit','timetable.delete','announcements.view','announcements.create','announcements.delete','settings.view','users.view'];
      const employeeDefaults = new Set(['timetable.view', 'announcements.view']);
      for (const perm of employeePerms) {
        await query(
          `INSERT INTO role_permissions (role, permission, enabled) VALUES ('EMPLOYEE', $1, $2) ON CONFLICT (role, permission) DO NOTHING`,
          [perm, employeeDefaults.has(perm)]
        );
      }
    }

    // Backfill for Assignments/Messages/Library/Transport/Reports — these five
    // sidebar items had zero permission gating until this pass, so an
    // already-seeded install never got role_permissions rows for them. Without
    // this, every role would see the new gate and lose access outright the
    // moment it goes live, rather than keeping the access they already had.
    {
      const newModulePerms: Record<string, boolean> = {
        'assignments.view': true, 'assignments.create': true, 'assignments.grade': true, 'assignments.delete': true,
        'messages.view': true,
        'library.view': true, 'library.create': true, 'library.edit': true, 'library.delete': true,
        'transport.view': true, 'transport.create': true, 'transport.edit': true,
        'reports.view': true, 'reports.export': true,
      };
      const roleOverrides: Record<string, Record<string, boolean>> = {
        ADMIN: newModulePerms,
        TEACHER: { 'assignments.view': true, 'assignments.create': true, 'assignments.grade': true, 'library.view': true, 'messages.view': true, 'transport.view': true },
        STUDENT: { 'assignments.view': true, 'library.view': true, 'messages.view': true, 'transport.view': true },
        PARENT: { 'assignments.view': true, 'messages.view': true, 'transport.view': true },
        EMPLOYEE: { 'messages.view': true },
      };
      for (const [role, overrides] of Object.entries(roleOverrides)) {
        for (const perm of Object.keys(newModulePerms)) {
          await query(
            `INSERT INTO role_permissions (role, permission, enabled) VALUES ($1, $2, $3) ON CONFLICT (role, permission) DO NOTHING`,
            [role, perm, !!overrides[perm]]
          );
        }
      }
    }

    // Default grade scales
    const gsRes = await query('SELECT COUNT(*) FROM grade_scales');
    if (parseInt(gsRes.rows[0].count) === 0) {
      const defaultGrades = [
        { min: 90, max: 100, grade: 'A*', points: 4.0, pass: true, order: 1 },
        { min: 80, max: 89.99, grade: 'A', points: 3.7, pass: true, order: 2 },
        { min: 70, max: 79.99, grade: 'B', points: 3.3, pass: true, order: 3 },
        { min: 60, max: 69.99, grade: 'C', points: 3.0, pass: true, order: 4 },
        { min: 50, max: 59.99, grade: 'D', points: 2.7, pass: true, order: 5 },
        { min: 40, max: 49.99, grade: 'E', points: 2.0, pass: true, order: 6 },
        { min: 0, max: 39.99, grade: 'F', points: 0.0, pass: false, order: 7 },
      ];
      for (const g of defaultGrades) {
        await query(
          `INSERT INTO grade_scales (name, min_percentage, max_percentage, grade, points, is_pass, sort_order) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          ['Standard', g.min, g.max, g.grade, g.points, g.pass, g.order]
        );
      }
    }

    const fullGrades: { id: string; name: string; gradeLevel: string }[] = [];
    for (const g of fullGrades) {
      await query(`INSERT INTO classes (id, name, grade_level, academic_year_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [g.id, g.name, g.gradeLevel, 'ay-2026-27']);
    }

    // Sections
    for (const s of defaultSections) {
      await query(`INSERT INTO sections (id, name, capacity, teacher_name, class_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.name, s.capacity, s.teacherName, s.classId]);
    }

    // Subjects
    const subjectsRes = await query('SELECT COUNT(*) FROM subjects');
    if (parseInt(subjectsRes.rows[0].count) === 0) {
      for (const s of defaultSubjects) {
        await query(`INSERT INTO subjects (id, name, code, grade_level, teacher_name, is_elective) VALUES ($1, $2, $3, $4, $5, $6)`,
          [s.id, s.name, s.code, s.gradeLevel, s.teacherName || null, s.isElective]);
      }
    }

    // Fee Categories
    const feeCatRes = await query('SELECT COUNT(*) FROM fee_categories');
    if (parseInt(feeCatRes.rows[0].count) === 0) {
      for (const fc of defaultFeeCategories) {
        await query(`INSERT INTO fee_categories (id, name, description, default_amount, frequency, is_active) VALUES ($1, $2, $3, $4, $5, $6)`,
          [fc.id, fc.name, fc.description, fc.defaultAmount, fc.frequency, fc.isActive]);
      }
    }

    // Fee Structures
    const feeStrRes = await query('SELECT COUNT(*) FROM fee_structures');
    if (parseInt(feeStrRes.rows[0].count) === 0) {
      for (const fs of defaultFeeStructures) {
        await query(`INSERT INTO fee_structures (id, name, assigned_class, line_items, total_amount, is_active) VALUES ($1, $2, $3, $4, $5, $6)`,
          [fs.id, fs.name, fs.assignedClass, JSON.stringify(fs.lineItems), fs.totalAmount, fs.isActive]);
      }
    }

    // Academic Terms
    const termsRes = await query('SELECT COUNT(*) FROM academic_terms');
    if (parseInt(termsRes.rows[0].count) === 0) {
      for (const t of defaultAcademicTerms) {
        await query(`INSERT INTO academic_terms (id, name, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5)`,
          [t.id, t.name, t.startDate, t.endDate, t.isActive]);
      }
    }

    // Students
    const studentsRes = await query('SELECT COUNT(*) FROM students');
    if (parseInt(studentsRes.rows[0].count) === 0) {
      for (const st of defaultStudents) {
        await query(`INSERT INTO students (id, name, admission_number, class, section, parent_name, status, parent_email, email) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [st.id, st.name, st.admissionNumber, st.class, st.section, st.parentName, st.status, st.parentEmail, st.email]);
      }
    }

    // ── Enrollment seed for legacy students ──
    const enrRes = await query('SELECT COUNT(*) FROM enrollments');
    if (parseInt(enrRes.rows[0].count) === 0) {
      const ayRes2 = await query("SELECT id FROM academic_years WHERE is_active=true LIMIT 1");
      const yearId = ayRes2.rows[0]?.id;
      if (yearId) {
        const legacyStudents = await query("SELECT * FROM students");
        for (const st of legacyStudents.rows) {
          if (!st.class) continue;
          const clsRes = await query("SELECT id FROM classes WHERE name=$1 LIMIT 1", [st.class]);
          if (clsRes.rows.length === 0) continue;
          const classId = clsRes.rows[0].id;
          const secRes = await query("SELECT id FROM sections WHERE class_id=$1 AND name=$2 LIMIT 1", [classId, st.section || 'A']);
          const sectionId = secRes.rows[0]?.id || null;
          const rollRes = await query("SELECT COALESCE(MAX(roll_number),0)+1 as next FROM enrollments WHERE class_id=$1", [classId]);
          const rollNumber = parseInt(rollRes.rows[0]?.next || '1', 10);
          await query(
            `INSERT INTO enrollments (id, student_id, class_id, section_id, academic_year_id, roll_number, status)
             VALUES ($1,$2,$3,$4,$5,$6,'Active') ON CONFLICT (id) DO NOTHING`,
            [`enr-${st.id}`, st.id, classId, sectionId, yearId, rollNumber]
          );
        }
      }
    }

    // Fee Records
    const feeRecRes = await query('SELECT COUNT(*) FROM fee_records');
    if (parseInt(feeRecRes.rows[0].count) === 0) {
      for (const f of defaultFeeRecords) {
        await query(`INSERT INTO fee_records (id, student_id, student_name, amount, due_date, status, voucher_id, payment_method, payment_date) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [f.id, f.studentId, f.studentName, f.amount, f.dueDate, f.status, f.voucherId, f.paymentMethod || null, f.paymentDate || null]);
      }
    }

    // Attendance
    const attRes = await query('SELECT COUNT(*) FROM attendance');
    if (parseInt(attRes.rows[0].count) === 0) {
      for (const a of defaultAttendance) {
        await query(`INSERT INTO attendance (id, student_id, student_name, class, section, date, status) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [a.id, a.studentId, a.studentName, a.class, a.section, a.date, a.status]);
      }
    }

    // Notifications
    const notifRes = await query('SELECT COUNT(*) FROM notifications');
    if (parseInt(notifRes.rows[0].count) === 0) {
      for (const n of defaultNotifications) {
        await query(`INSERT INTO notifications (id, title, message, date, recipient_role, recipient_email, read) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [n.id, n.title, n.message, n.date, n.recipientRole, n.recipientEmail || null, n.read]);
      }
    }

    // ── Announcements ──
    const annRes = await query('SELECT COUNT(*) FROM announcements');
    if (parseInt(annRes.rows[0].count) === 0) {
      const announcements = [
        { id: 'ann-1', title: 'School Reopening', content: 'School will reopen for the new academic year on April 1st, 2026.', date: '2026-03-25', authorId: '1', authorName: 'Admin User', targetRole: 'ALL', priority: 'high' },
        { id: 'ann-2', title: 'Science Exhibition', content: 'Annual Science Exhibition will be held on May 10th.', date: '2026-04-15', authorId: '1', authorName: 'Admin User', targetRole: 'STUDENT', priority: 'normal' },
        { id: 'ann-3', title: 'Staff Training Workshop', content: 'All teachers must attend the workshop on April 20th.', date: '2026-04-12', authorId: '1', authorName: 'Admin User', targetRole: 'TEACHER', priority: 'high' },
        { id: 'ann-4', title: 'Library New Arrivals', content: 'New books have been added to the library.', date: '2026-04-06', authorId: '1', authorName: 'Admin User', targetRole: 'ALL', priority: 'low' },
      ];
      for (const a of announcements) {
        await query(`INSERT INTO announcements (id, title, content, date, author_id, author_name, target_role, priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [a.id, a.title, a.content, a.date, a.authorId, a.authorName, a.targetRole, a.priority]);
      }
    }

    // ── Assignments ──
    const asgRes = await query('SELECT COUNT(*) FROM assignments');
    if (parseInt(asgRes.rows[0].count) === 0) {
      const assignments = [
        { id: 'asg-1', title: 'Algebra Practice Problems', description: 'Solve 20 problems from Chapter 3: Linear Equations.', dueDate: '2026-04-15', className: 'Grade 6', subject: 'Mathematics', teacherName: 'Mr. Tariq Mehmood', createdAt: '2026-04-10' },
        { id: 'asg-2', title: 'Physics Numericals', description: 'Solve 10 numerical problems from Chapter 2: Kinematics.', dueDate: '2026-04-22', className: 'Grade 10 (Matric)', subject: 'Physics', teacherName: 'Mr. Asif Raza', createdAt: '2026-04-13' },
        { id: 'asg-3', title: 'Computer Programming', description: 'Write Python programs for factorial and fibonacci.', dueDate: '2026-04-19', className: 'Grade 8', subject: 'Computer Science', teacherName: 'Mr. Sohail Ahmed', createdAt: '2026-04-12' },
      ];
      for (const a of assignments) {
        await query(`INSERT INTO assignments (id, title, description, due_date, class_name, subject, teacher_name, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [a.id, a.title, a.description, a.dueDate, a.className, a.subject, a.teacherName, a.createdAt]);
      }
    }

    // ── Timetable Entries ──
    const ttRes = await query('SELECT COUNT(*) FROM timetable_entries');
    if (parseInt(ttRes.rows[0].count) === 0) {
      const ttEntries = [
        { id: 'tt-demo-1', className: 'Grade 6', subjectName: 'English', teacherName: 'Ms. Shazia Iqbal', dayOfWeek: 'Monday', startTime: '08:00', endTime: '08:45', room: 'Room 101' },
        { id: 'tt-demo-2', className: 'Grade 6', subjectName: 'Urdu', teacherName: 'Mr. Tariq Mehmood', dayOfWeek: 'Monday', startTime: '08:45', endTime: '09:30', room: 'Room 102' },
        { id: 'tt-demo-3', className: 'Grade 6', subjectName: 'Mathematics', teacherName: 'Mr. Tariq Mehmood', dayOfWeek: 'Monday', startTime: '09:45', endTime: '10:30', room: 'Room 101' },
        { id: 'tt-demo-4', className: 'Grade 10 (Matric)', subjectName: 'English', teacherName: 'Mr. Asif Raza', dayOfWeek: 'Monday', startTime: '08:00', endTime: '08:45', room: 'Room 301' },
        { id: 'tt-demo-5', className: 'Grade 10 (Matric)', subjectName: 'Physics', teacherName: 'Mr. Asif Raza', dayOfWeek: 'Monday', startTime: '08:45', endTime: '09:30', room: 'Physics Lab' },
        { id: 'tt-demo-6', className: 'Grade 10 (Matric)', subjectName: 'Chemistry', teacherName: 'Ms. Tabassum Jabeen', dayOfWeek: 'Monday', startTime: '09:45', endTime: '10:30', room: 'Chemistry Lab' },
      ];
      for (const t of ttEntries) {
        await query(`INSERT INTO timetable_entries (id, class_name, subject_name, teacher_name, day_of_week, start_time, end_time, room) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [t.id, t.className, t.subjectName, t.teacherName, t.dayOfWeek, t.startTime, t.endTime, t.room]);
      }
    }

    // ── Courses (LMS) ──
    const crsRes = await query('SELECT COUNT(*) FROM courses');
    if (parseInt(crsRes.rows[0].count) === 0) {
      const courses = [
        { id: 'crs-eng-6', title: 'English Language Arts Grade 6', code: 'ENG-6', description: 'Comprehensive English course.', gradeLevel: 'Grade 6', teacherName: 'Mr. Tariq Mehmood', credits: 3, outcomes: ['Master parts of speech', 'Write coherent paragraphs'], isActive: true },
        { id: 'crs-math-6', title: 'Mathematics Grade 6', code: 'MATH-6', description: 'Mathematics covering algebra and geometry.', gradeLevel: 'Grade 6', teacherName: 'Mr. Tariq Mehmood', credits: 4, outcomes: ['Solve linear equations', 'Work with fractions'], isActive: true },
        { id: 'crs-phy-10', title: 'Physics Grade 10 (Matric)', code: 'PHY-10', description: 'Matric-level physics.', gradeLevel: 'Grade 10 (Matric)', teacherName: 'Mr. Asif Raza', credits: 4, outcomes: ['Solve numerical problems', 'Understand laws of motion'], isActive: true },
      ];
      for (const c of courses) {
        await query(`INSERT INTO courses (id, title, code, description, grade_level, teacher_name, credits, learning_outcomes, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [c.id, c.title, c.code, c.description, c.gradeLevel, c.teacherName, c.credits, c.outcomes, c.isActive]);
      }
    }

    // ── Library Books ──
    const libRes = await query('SELECT COUNT(*) FROM library_books');
    if (parseInt(libRes.rows[0].count) === 0) {
      const books = [
        { id: 'book-001', title: 'Pakistan: A Modern History', author: 'Ian Talbot', isbn: '978-0195673731', category: 'History', publisher: 'Oxford University Press', year: 2005, copies: 5, avail: 3, rack: 'H-01', barcode: 'BAR-001' },
        { id: 'book-002', title: 'Mathematics for Class 10', author: 'PTB', isbn: '978-969-1234-01-5', category: 'Textbook', publisher: 'PTB Lahore', year: 2024, copies: 50, avail: 45, rack: 'T-10', barcode: 'BAR-002' },
        { id: 'book-003', title: 'The Alchemist', author: 'Paulo Coelho', isbn: '978-0062315007', category: 'Fiction', publisher: 'HarperCollins', year: 2014, copies: 3, avail: 1, rack: 'F-05', barcode: 'BAR-003' },
        { id: 'book-004', title: 'Oxford English Dictionary', author: 'Oxford Languages', isbn: '978-0199571123', category: 'Reference', publisher: 'Oxford University Press', year: 2010, copies: 2, avail: 2, rack: 'R-01', barcode: 'BAR-004' },
      ];
      for (const b of books) {
        await query(`INSERT INTO library_books (id, title, author, isbn, category, publisher, publish_year, total_copies, available_copies, rack_number, barcode) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [b.id, b.title, b.author, b.isbn, b.category, b.publisher, b.year, b.copies, b.avail, b.rack, b.barcode]);
      }
    }

    // ── Hostels ──
    const hstlRes = await query('SELECT COUNT(*) FROM hostels');
    if (parseInt(hstlRes.rows[0].count) === 0) {
      await query(`INSERT INTO hostels (id, name, type, warden_name, contact_phone, total_rooms, total_beds, address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        ['hostel-boys', 'Iqbal Hostel (Boys)', 'Boys', 'Mr. Rashid Mehmood', '0300-1234567', 20, 80, 'Adjacent to School Campus']);
      await query(`INSERT INTO hostels (id, name, type, warden_name, contact_phone, total_rooms, total_beds, address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        ['hostel-girls', 'Fatima Hostel (Girls)', 'Girls', 'Ms. Nasreen Akhtar', '0301-7654321', 15, 60, 'Street 5, Garden Town']);
    }

    // ── Transport Routes ──
    const trRes = await query('SELECT COUNT(*) FROM transport_routes');
    if (parseInt(trRes.rows[0].count) === 0) {
      const routes = [
        { id: 'route-1', name: 'Gulberg Route', start: 'Gulberg Main Chowk', end: 'School', stops: JSON.stringify(['Gulberg Chowk', 'Liberty Market', 'School']), distance: 8.5, fee: 5000 },
        { id: 'route-2', name: 'Garden Town Route', start: 'Garden Town Gate 2', end: 'School', stops: JSON.stringify(['Garden Town', 'Faisal Town', 'School']), distance: 12.0, fee: 6000 },
        { id: 'route-3', name: 'Model Town Route', start: 'Model Town Link Road', end: 'School', stops: JSON.stringify(['Model Town', 'Canal Bank', 'School']), distance: 10.2, fee: 5500 },
      ];
      for (const r of routes) {
        await query(`INSERT INTO transport_routes (id, route_name, start_point, end_point, stops, distance, fee_amount, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [r.id, r.name, r.start, r.end, r.stops, r.distance, r.fee, true]);
      }
    }

    // ── Events ──
    const evtRes = await query('SELECT COUNT(*) FROM events');
    if (parseInt(evtRes.rows[0].count) === 0) {
      const events = [
        { id: 'evt-001', title: 'Annual Sports Gala 2026', description: 'Annual sports competition.', category: 'Sports', startDate: '2026-04-25', endDate: '2026-04-26', venue: 'Sports Ground', organizer: 'Sports Dept', status: 'Upcoming' },
        { id: 'evt-002', title: 'Science & Technology Exhibition', description: 'Students showcase projects.', category: 'Academic', startDate: '2026-05-10', endDate: '2026-05-10', venue: 'Science Block', organizer: 'Science Dept', status: 'Upcoming' },
        { id: 'evt-003', title: 'Independence Day Celebration', description: 'Flag hoisting and celebrations.', category: 'Cultural', startDate: '2026-08-14', endDate: '2026-08-14', venue: 'Main Ground', organizer: 'Cultural Committee', status: 'Upcoming' },
      ];
      for (const e of events) {
        await query(`INSERT INTO events (id, title, description, category, start_date, end_date, venue, organizer, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [e.id, e.title, e.description, e.category, e.startDate, e.endDate, e.venue, e.organizer, e.status]);
      }
    }

    // ── Alumni ──
    const alumRes = await query('SELECT COUNT(*) FROM alumni');
    if (parseInt(alumRes.rows[0].count) === 0) {
      const alumni = [
        { id: 'alumni-001', name: 'Dr. Arif Alvi', email: 'arif.alvi@gmail.com', phone: '0300-1110001', year: 2000, cls: 'Grade 10 (Matric)', occupation: 'Physician', company: 'Mayo Hospital' },
        { id: 'alumni-002', name: 'Ms. Sana Mirza', email: 'sana.mirza@outlook.com', phone: '0301-2220002', year: 2005, cls: 'Grade 10 (Matric)', occupation: 'Software Engineer', company: 'Systems Limited' },
        { id: 'alumni-003', name: 'Mr. Hassan Iqbal', email: 'hassan.iqbal@yahoo.com', phone: '0302-3330003', year: 2010, cls: 'Grade 10 (Matric)', occupation: 'Chartered Accountant', company: 'Deloitte' },
      ];
      for (const a of alumni) {
        await query(`INSERT INTO alumni (id, name, email, phone, graduation_year, class, current_occupation, company, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [a.id, a.name, a.email, a.phone, a.year, a.cls, a.occupation, a.company, 'Active']);
      }
    }

    // ── Scholarships ──
    const scholRes = await query('SELECT COUNT(*) FROM scholarships');
    if (parseInt(scholRes.rows[0].count) === 0) {
      const schols = [
        { id: 'schol-001', name: 'Merit Scholarship - Top 10%', type: 'Merit', amount: 50000, slots: 10, avail: 8, criteria: '90%+ score. Income < PKR 500K/yr.', active: true },
        { id: 'schol-002', name: 'Need-Based Financial Aid', type: 'Need-based', amount: 35000, slots: 20, avail: 15, criteria: 'Income < PKR 300K/yr. 60%+ score.', active: true },
        { id: 'schol-003', name: 'Sports Excellence Scholarship', type: 'Sports', amount: 25000, slots: 5, avail: 4, criteria: 'District level sports achievers.', active: true },
      ];
      for (const s of schols) {
        await query(`INSERT INTO scholarships (id, name, type, amount, total_slots, available_slots, eligibility_criteria, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [s.id, s.name, s.type, s.amount, s.slots, s.avail, s.criteria, s.active]);
      }
    }

    // ── Job Postings ──
    const jobRes = await query('SELECT COUNT(*) FROM job_postings');
    if (parseInt(jobRes.rows[0].count) === 0) {
      const jobs = [
        { id: 'job-001', company: 'Systems Limited', title: 'Junior Software Developer', desc: 'Fresh graduates for web dev team.', reqs: 'JS, HTML, CSS.', location: 'Lahore', salary: 'PKR 50-70K', type: 'Full-time', email: 'hr@systems.com.pk' },
        { id: 'job-002', company: 'HBL Bank', title: 'Customer Service Officer', desc: 'Entry-level bank teller.', reqs: 'Intermediate+. Good communication.', location: 'Lahore', salary: 'PKR 35-45K', type: 'Full-time', email: 'careers@hbl.com' },
        { id: 'job-003', company: 'The Educators School', title: 'Teaching Assistant', desc: 'Paid internship.', reqs: 'Good academics. 3 months avail.', location: 'Lahore', salary: 'PKR 15K stipend', type: 'Internship', email: 'careers@educators.edu.pk' },
      ];
      for (const j of jobs) {
        await query(`INSERT INTO job_postings (id, company_name, title, description, requirements, location, salary_range, job_type, status, contact_email) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [j.id, j.company, j.title, j.desc, j.reqs, j.location, j.salary, j.type, 'Active', j.email]);
      }
    }

    // ── Rooms (Facilities) ──
    const roomRes = await query('SELECT COUNT(*) FROM rooms');
    if (parseInt(roomRes.rows[0].count) === 0) {
      const rooms = [
        { id: 'room-101', name: 'Grade 6 Classroom', type: 'Classroom', cap: 40, floor: 1, building: 'Academic Block A', proj: true, ac: true },
        { id: 'room-201', name: 'Computer Lab', type: 'Lab', cap: 30, floor: 2, building: 'Science & Tech Block', proj: true, ac: true },
        { id: 'room-202', name: 'Science Lab', type: 'Lab', cap: 30, floor: 2, building: 'Science & Tech Block', proj: false, ac: true },
        { id: 'room-301', name: 'School Auditorium', type: 'Auditorium', cap: 500, floor: 1, building: 'Main Building', proj: true, ac: true },
        { id: 'room-304', name: 'Sports Hall', type: 'Sports Hall', cap: 200, floor: 0, building: 'Sports Complex', proj: false, ac: false },
      ];
      for (const r of rooms) {
        await query(`INSERT INTO rooms (id, room_no, name, type, capacity, floor, building, has_projector, has_ac, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [r.id, null, r.name, r.type, r.cap, r.floor, r.building, r.proj, r.ac, true]);
      }
    }

    // ── Enrollment backfill for existing students ────────────────────────
    const orphanStudents = await query(`
      SELECT s.id, s.name, s.class, s.section
      FROM students s
      LEFT JOIN enrollments e ON s.id = e.student_id
      WHERE e.id IS NULL AND s.status = 'Active'
    `);
    if (orphanStudents.rows.length > 0) {
      console.log(`Backfilling ${orphanStudents.rows.length} orphan student(s)...`);
      const yearResult = await query("SELECT id FROM academic_years WHERE is_active = true LIMIT 1");
      const activeYearId = yearResult.rows[0]?.id || 'ay-2026-27';

      for (const s of orphanStudents.rows) {
        const classRes = await query("SELECT id FROM classes WHERE name = $1", [s.class]);
        const classId = classRes.rows[0]?.id;
        if (!classId) { console.log(`  Skipping ${s.name} – class "${s.class}" not in classes table`); continue; }

        let sectionId = null;
        if (s.section) {
          const secRes = await query("SELECT id FROM sections WHERE class_id = $1 AND name = $2", [classId, s.section]);
          sectionId = secRes.rows[0]?.id;
        }
        if (!sectionId) {
          const secRes = await query("SELECT id FROM sections WHERE class_id = $1 AND name = 'A'", [classId]);
          sectionId = secRes.rows[0]?.id;
        }
        // section_id is NOT NULL on enrollments — a class with no matching
        // section (e.g. seeded without one) must be skipped, not attempted,
        // or this single bad row throws and silently aborts every remaining
        // statement in initializeDatabase() (including unrelated migrations
        // that happen to run after this block).
        if (!sectionId) { console.log(`  Skipping ${s.name} – no section found for class "${s.class}"`); continue; }

        const rollRes = await query("SELECT COALESCE(MAX(roll_number),0)+1 as next FROM enrollments WHERE class_id=$1", [classId]);
        const rollNumber = parseInt(rollRes.rows[0]?.next || '1', 10);

        await query(
          "INSERT INTO enrollments (id, student_id, class_id, section_id, academic_year_id, roll_number, status) VALUES ($1,$2,$3,$4,$5,$6,'Active')",
          [`enr-${s.id}`, s.id, classId, sectionId, activeYearId, rollNumber]
        );
        console.log(`  Backfilled enrollment for ${s.name}: class=${classId}, section=${sectionId}`);
      }
    }

    // ── Fix legacy class name variants (e.g. "Class 11" → "Grade 11") ──
    await query("UPDATE students SET class = 'Grade 11' WHERE class = 'Class 11'");

    // ── Multi-branch backfill ──────────────────────────────────────────
    // The Postgres "UserRole" enum type predates OWNER/PRINCIPAL — add them
    // before anything below (or any future login/create) can use those role
    // values. Must run as its own statement — ALTER TYPE ... ADD VALUE
    // cannot be combined with other statements in the same query.
    try {
      await query(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OWNER'`);
    } catch (e) { console.error('Failed to add OWNER to UserRole enum:', e); }
    try {
      await query(`ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'PRINCIPAL'`);
    } catch (e) { console.error('Failed to add PRINCIPAL to UserRole enum:', e); }

    // Ensure at least one branch exists, then backfill every pre-existing
    // row on the anchor tables so single-branch installs keep working
    // unmodified (everything just belongs to "Main Campus").
    const branchCountRes = await query("SELECT COUNT(*) FROM branches");
    if (parseInt(branchCountRes.rows[0].count) === 0) {
      await query(
        "INSERT INTO branches (id, name, code, is_active) VALUES ($1,$2,$3,true)",
        ['branch-main', 'Main Campus', 'MAIN']
      );
    }
    const mainBranchRes = await query("SELECT id FROM branches ORDER BY created_at ASC LIMIT 1");
    const mainBranchId = mainBranchRes.rows[0]?.id || 'branch-main';
    // OWNER rows are intentionally left NULL (unscoped) — only backfill
    // non-owner users.
    await query("UPDATE users SET branch_id=$1 WHERE branch_id IS NULL AND role != 'OWNER'", [mainBranchId]);
    await query("UPDATE classes SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
    await query("UPDATE employees SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
    await query("UPDATE students SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
    await query("UPDATE admission_applications SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
    // Phase 6 modules (facility/records tables added later than the core set above).
    try {
      await query("UPDATE courses SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
      await query("UPDATE library_books SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
      await query("UPDATE hostels SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
      await query("UPDATE transport_routes SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
      await query("UPDATE incident_reports SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
      await query("UPDATE medical_records SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
      await query("UPDATE events SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
      await query("UPDATE alumni SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
    await query("UPDATE announcements SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
    await query("UPDATE online_exams SET branch_id=$1 WHERE branch_id IS NULL", [mainBranchId]);
    } catch (e) { console.error('Phase 6 branch backfill failed:', e); }

    console.log('Database initialization completed successfully.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
};
