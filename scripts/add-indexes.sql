-- Indexes for hot WHERE / JOIN filters used by server actions.
-- Idempotent — safe to re-run. Most indexes already exist; these are the
-- missing ones on the columns the app filters by most (fetchDBState scoping,
-- messaging reads, teacher teaching-summary joins, branch-scoped applications).
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (date);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_sections_class ON sections (class_id);
CREATE INDEX IF NOT EXISTS idx_sections_class_teacher ON sections (class_teacher_id);
CREATE INDEX IF NOT EXISTS idx_admission_apps_branch ON admission_applications (branch_id);
CREATE INDEX IF NOT EXISTS idx_tcs_teacher ON teacher_class_subjects (teacher_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_role);