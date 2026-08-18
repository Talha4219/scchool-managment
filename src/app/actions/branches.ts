"use server";

// Branch management + cross-branch aggregates for the OWNER dashboard.
// Mirrors the auth/error conventions used across the other actions files
// (requireRole from the shared auth-scope helper, try/catch swallow-to-empty
// on reads, nanoid-prefixed IDs on writes).

import { query, checkDbConnection } from "@/lib/db";
import { requireRole } from "@/lib/auth-scope";
import { nanoid } from "nanoid";

export interface BranchRecord {
  id: string; name: string; code: string | null; address: string | null; phone: string | null;
  email: string | null; logoUrl: string | null; establishedDate: string | null;
  capacity: number | null; gradeLevels: string | null; shift: string | null;
  principalUserId: number | null; principalName: string | null; isActive: boolean;
}

export interface BranchSummary extends BranchRecord {
  studentCount: number;
  staffCount: number;
  feeCollectedThisTerm: number;
  attendanceRatePct: number | null;
}

function mapBranch(r: any): BranchRecord {
  return {
    id: r.id, name: r.name, code: r.code, address: r.address, phone: r.phone,
    email: r.email || null, logoUrl: r.logo_url || null, establishedDate: r.established_date || null,
    capacity: r.capacity ?? null, gradeLevels: r.grade_levels || null, shift: r.shift || null,
    principalUserId: r.principal_user_id, principalName: r.principal_name || null,
    isActive: r.is_active,
  };
}

async function computeBranches(): Promise<BranchRecord[]> {
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const res = await query(
      `SELECT b.*, u.name as principal_name FROM branches b
       LEFT JOIN users u ON u.id = b.principal_user_id
       ORDER BY b.created_at ASC`
    );
    return res.rows.map(mapBranch);
  } catch { return []; }
}

export async function fetchBranchesDB(): Promise<BranchRecord[]> {
  const auth = await requireRole('OWNER', 'ADMIN');
  if ('error' in auth) return [];
  return computeBranches();
}

// One row per branch with the headline metrics the Owner Dashboard cards
// show: enrolled students, staff headcount, fees collected this term, and
// overall attendance rate. Each metric is its own query so a failure in one
// (e.g. no active academic term yet) doesn't blank out the others.
async function computeBranchSummaries(): Promise<BranchSummary[]> {
  const isOnline = await checkDbConnection();
  if (!isOnline) return [];
  try {
    const branches = await computeBranches();

    const [studentCounts, staffCounts, feeSums, attendanceRates] = await Promise.all([
      query(`SELECT branch_id, COUNT(*) as c FROM students WHERE status='Active' AND branch_id IS NOT NULL GROUP BY branch_id`),
      query(`SELECT branch_id, COUNT(*) as c FROM employees WHERE status='Active' AND branch_id IS NOT NULL GROUP BY branch_id`),
      query(`
        SELECT s.branch_id, COALESCE(SUM(fr.amount_paid),0) as total
        FROM fee_records fr JOIN students s ON s.id = fr.student_id
        WHERE s.branch_id IS NOT NULL
        GROUP BY s.branch_id
      `),
      query(`
        SELECT s.branch_id,
               ROUND(100.0 * COUNT(*) FILTER (WHERE ar.status='Present') / NULLIF(COUNT(*),0), 1) as rate
        FROM attendance_records ar
        JOIN attendance_sessions ases ON ases.id = ar.session_id
        JOIN students s ON s.id = ar.student_id
        WHERE s.branch_id IS NOT NULL
        GROUP BY s.branch_id
      `),
    ]);

    const studentMap = new Map(studentCounts.rows.map((r: any) => [r.branch_id, parseInt(r.c)]));
    const staffMap = new Map(staffCounts.rows.map((r: any) => [r.branch_id, parseInt(r.c)]));
    const feeMap = new Map(feeSums.rows.map((r: any) => [r.branch_id, parseFloat(r.total)]));
    const attMap = new Map(attendanceRates.rows.map((r: any) => [r.branch_id, r.rate !== null ? parseFloat(r.rate) : null]));

    return branches.map(b => ({
      ...b,
      studentCount: studentMap.get(b.id) ?? 0,
      staffCount: staffMap.get(b.id) ?? 0,
      feeCollectedThisTerm: feeMap.get(b.id) ?? 0,
      attendanceRatePct: attMap.get(b.id) ?? null,
    }));
  } catch { return []; }
}

export async function fetchBranchSummariesDB(): Promise<BranchSummary[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  return computeBranchSummaries();
}

// Single-branch fetch for the branch profile page — OWNER sees any branch,
// PRINCIPAL only their own (matches the scoping every other branch query uses).
export async function fetchBranchByIdDB(id: string): Promise<BranchRecord | null> {
  const auth = await requireRole('OWNER', 'ADMIN');
  if ('error' in auth) return null;
  if (auth.session.role === 'PRINCIPAL' && auth.session.branchId !== id) return null;
  try {
    const res = await query(
      `SELECT b.*, u.name as principal_name FROM branches b
       LEFT JOIN users u ON u.id = b.principal_user_id
       WHERE b.id = $1`,
      [id]
    );
    return res.rows.length > 0 ? mapBranch(res.rows[0]) : null;
  } catch { return null; }
}

export async function createBranchDB(data: { name: string; code?: string; address?: string; phone?: string }): Promise<{ error?: string; id?: string }> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return { error: auth.error };
  try {
    const id = `branch-${nanoid(8)}`;
    await query(
      `INSERT INTO branches (id, name, code, address, phone, is_active) VALUES ($1,$2,$3,$4,$5,true)`,
      [id, data.name, data.code || null, data.address || null, data.phone || null]
    );
    return { id };
  } catch (e: any) { return { error: e.message || 'Failed to create branch.' }; }
}

export async function updateBranchDB(id: string, data: {
  name?: string; code?: string; address?: string; phone?: string; email?: string;
  logoUrl?: string; establishedDate?: string; capacity?: number | null; gradeLevels?: string; shift?: string;
  isActive?: boolean;
}): Promise<{ error?: string }> {
  const auth = await requireRole('OWNER', 'ADMIN');
  if ('error' in auth) return { error: auth.error };
  if (auth.session.role === 'PRINCIPAL') {
    if (auth.session.branchId !== id) return { error: 'You are not authorized to perform this action.' };
    // A Principal manages their own campus's contact/identity details but
    // not activation state or reassigning themselves — that stays OWNER-only.
    if (data.isActive !== undefined) return { error: 'Only the Owner can activate or deactivate a branch.' };
  }
  try {
    const fields: string[] = []; const vals: any[] = []; let i = 1;
    const colMap: Record<string, string> = {
      name: 'name', code: 'code', address: 'address', phone: 'phone', email: 'email',
      logoUrl: 'logo_url', establishedDate: 'established_date', capacity: 'capacity',
      gradeLevels: 'grade_levels', shift: 'shift', isActive: 'is_active',
    };
    for (const [key, col] of Object.entries(colMap)) {
      const v = (data as any)[key];
      if (v !== undefined) { fields.push(`${col}=$${i++}`); vals.push(v); }
    }
    if (!fields.length) return {};
    vals.push(id);
    await query(`UPDATE branches SET ${fields.join(',')} WHERE id=$${i}`, vals);
    return {};
  } catch (e: any) { return { error: e.message || 'Failed to update branch.' }; }
}

// Assigns a PRINCIPAL-role user to a branch: sets both users.branch_id
// (their own scoping) and branches.principal_user_id (so the branch card
// shows who runs it). OWNER-only.
export async function assignPrincipalDB(branchId: string, userId: number): Promise<{ error?: string }> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return { error: auth.error };
  try {
    const userRes = await query('SELECT role FROM users WHERE id=$1', [userId]);
    if (userRes.rows.length === 0) return { error: 'User not found.' };
    if (userRes.rows[0].role !== 'PRINCIPAL') return { error: 'User must have the PRINCIPAL role first.' };
    await query('UPDATE users SET branch_id=$1 WHERE id=$2', [branchId, userId]);
    await query('UPDATE branches SET principal_user_id=$1 WHERE id=$2', [userId, branchId]);
    return {};
  } catch (e: any) { return { error: e.message || 'Failed to assign principal.' }; }
}

// PRINCIPAL-role users not yet tied to a branch — for the "Assign as
// Principal" picker on the Owner Dashboard.
export async function fetchUnassignedPrincipalsDB(): Promise<{ id: number; name: string; email: string }[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const res = await query(`SELECT id, name, email FROM users WHERE role='PRINCIPAL' AND branch_id IS NULL ORDER BY name`);
    return res.rows;
  } catch { return []; }
}

// ── Executive Control Center: comparison table ──────────────────────────────

export interface BranchComparisonRow extends BranchSummary {
  teacherAttendanceRatePct: number | null;
  feeCollectionPct: number | null;
  outstandingAmount: number;
  newAdmissionsThisMonth: number;
  openIncidents: number;
}

// Unauthenticated helper factored out so a single branch's row can be
// computed for a PRINCIPAL (who is scoped to their own branch) without
// running the OWNER-only gate that fetchBranchComparisonDB enforces — the
// cross-branch query still runs, but only the caller's own row ever leaves
// the two exported wrappers below.
async function computeBranchComparison(): Promise<BranchComparisonRow[]> {
  try {
    const base = await computeBranchSummaries();

    const [teacherAtt, feeTotals, admissions, incidents] = await Promise.all([
      query(`
        SELECT u.branch_id,
               ROUND(100.0 * COUNT(*) FILTER (WHERE sa.status='Present') / NULLIF(COUNT(*),0), 1) as rate
        FROM staff_attendance sa JOIN users u ON u.id = sa.user_id
        WHERE u.role='TEACHER' AND u.branch_id IS NOT NULL
          AND sa.date >= to_char(NOW() - INTERVAL '30 days', 'YYYY-MM-DD')
        GROUP BY u.branch_id
      `),
      query(`
        SELECT s.branch_id,
               COALESCE(SUM(fr.amount_paid),0) as collected,
               COALESCE(SUM(fr.amount - fr.amount_paid),0) as outstanding
        FROM fee_records fr JOIN students s ON s.id = fr.student_id
        WHERE s.branch_id IS NOT NULL
        GROUP BY s.branch_id
      `),
      query(`
        SELECT branch_id, COUNT(*) as c FROM admission_applications
        WHERE status='Approved' AND branch_id IS NOT NULL
          AND submitted_at >= to_char(date_trunc('month', NOW()), 'YYYY-MM-DD')
        GROUP BY branch_id
      `),
      query(`
        SELECT s.branch_id, COUNT(*) as c
        FROM incident_reports ir JOIN students s ON s.id = ir.student_id
        WHERE ir.status='Open' AND s.branch_id IS NOT NULL
        GROUP BY s.branch_id
      `),
    ]);

    const teacherAttMap = new Map(teacherAtt.rows.map((r: any) => [r.branch_id, r.rate !== null ? parseFloat(r.rate) : null]));
    const feeMap = new Map(feeTotals.rows.map((r: any) => [r.branch_id, { collected: parseFloat(r.collected), outstanding: parseFloat(r.outstanding) }]));
    const admissionsMap = new Map(admissions.rows.map((r: any) => [r.branch_id, parseInt(r.c)]));
    const incidentsMap = new Map(incidents.rows.map((r: any) => [r.branch_id, parseInt(r.c)]));

    return base.map(b => {
      const fees = feeMap.get(b.id) as { collected: number; outstanding: number } | undefined;
      const total = (fees?.collected ?? 0) + (fees?.outstanding ?? 0);
      return {
        ...b,
        teacherAttendanceRatePct: (teacherAttMap.get(b.id) as number | null | undefined) ?? null,
        feeCollectionPct: total > 0 ? Math.round((100 * (fees!.collected)) / total) : null,
        outstandingAmount: fees?.outstanding ?? 0,
        newAdmissionsThisMonth: admissionsMap.get(b.id) ?? 0,
        openIncidents: incidentsMap.get(b.id) ?? 0,
      };
    });
  } catch { return []; }
}

export async function fetchBranchComparisonDB(): Promise<BranchComparisonRow[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  return computeBranchComparison();
}

// Single branch's own metrics row — OWNER can view any branch, PRINCIPAL only
// their own. The full cross-branch computation still runs internally, but
// only the caller's own row is ever returned to the client.
export async function fetchBranchMetricsDB(branchId: string): Promise<BranchComparisonRow | null> {
  const auth = await requireRole('OWNER', 'ADMIN');
  if ('error' in auth) return null;
  if (auth.session.role === 'PRINCIPAL' && auth.session.branchId !== branchId) return null;
  const rows = await computeBranchComparison();
  return rows.find(r => r.id === branchId) || null;
}

// ── Attention Required panel ─────────────────────────────────────────────────

export interface OwnerAlert {
  severity: 'critical' | 'warning' | 'positive';
  branchName: string;
  message: string;
}

export async function fetchOwnerAlertsDB(): Promise<OwnerAlert[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const [comparison, coverage] = await Promise.all([
      fetchBranchComparisonDB(),
      fetchStaffCoverageTodayDB(),
    ]);
    const coverageMap = new Map(coverage.map(c => [c.branchId, c]));
    const alerts: OwnerAlert[] = [];

    for (const b of comparison) {
      const cov = coverageMap.get(b.id);
      if (b.attendanceRatePct !== null) {
        if (b.attendanceRatePct < 80) alerts.push({ severity: 'critical', branchName: b.name, message: `Student attendance at ${b.attendanceRatePct}% — well below normal.` });
        else if (b.attendanceRatePct < 90) alerts.push({ severity: 'warning', branchName: b.name, message: `Student attendance at ${b.attendanceRatePct}%, trending low.` });
        else if (b.attendanceRatePct >= 97) alerts.push({ severity: 'positive', branchName: b.name, message: `Student attendance strong at ${b.attendanceRatePct}%.` });
      }
      if (b.outstandingAmount > 500000) alerts.push({ severity: 'critical', branchName: b.name, message: `Rs ${b.outstandingAmount.toLocaleString()} in outstanding fees.` });
      if (b.feeCollectionPct !== null && b.feeCollectionPct >= 98) alerts.push({ severity: 'positive', branchName: b.name, message: `Fee collection at ${b.feeCollectionPct}% this term.` });
      if (b.openIncidents > 0) alerts.push({ severity: b.openIncidents >= 3 ? 'critical' : 'warning', branchName: b.name, message: `${b.openIncidents} open discipline incident${b.openIncidents === 1 ? '' : 's'}.` });
      if (cov) {
        if (cov.teachersAbsentToday > 0) alerts.push({ severity: cov.teachersAbsentToday >= 3 ? 'critical' : 'warning', branchName: b.name, message: `${cov.teachersAbsentToday} teacher${cov.teachersAbsentToday === 1 ? '' : 's'} absent today.` });
        if (cov.unfilledSubstitutionsToday > 0) alerts.push({ severity: 'critical', branchName: b.name, message: `${cov.unfilledSubstitutionsToday} class period${cov.unfilledSubstitutionsToday === 1 ? '' : 's'} uncovered today.` });
      }
      if (b.newAdmissionsThisMonth >= 10) alerts.push({ severity: 'positive', branchName: b.name, message: `${b.newAdmissionsThisMonth} new admissions this month.` });
    }
    return alerts;
  } catch { return []; }
}

// ── Attendance trend (school-wide, last 8 days) ──────────────────────────────

export interface AttendanceTrendPoint { date: string; ratePct: number | null }

export async function fetchAttendanceTrendDB(branchId?: string): Promise<AttendanceTrendPoint[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const params: string[] = [];
    let branchFilter = '';
    if (branchId) { params.push(branchId); branchFilter = ` AND s.branch_id=$${params.length}`; }
    const res = await query(`
      SELECT ases.date,
             ROUND(100.0 * COUNT(*) FILTER (WHERE ar.status='Present') / NULLIF(COUNT(*),0), 1) as rate
      FROM attendance_records ar
      JOIN attendance_sessions ases ON ases.id = ar.session_id
      JOIN students s ON s.id = ar.student_id
      WHERE ases.date >= to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')${branchFilter}
      GROUP BY ases.date ORDER BY ases.date ASC
    `, params);
    return res.rows.map((r: any) => ({ date: r.date, ratePct: r.rate !== null ? parseFloat(r.rate) : null }));
  } catch { return []; }
}

export interface ChronicAbsentee { studentId: string; studentName: string; branchName: string; absentDays: number }

// Students with 3+ absences in the trailing 7 days — school-wide, capped to
// the worst 10 so this stays a quick glance, not a full report.
export async function fetchChronicAbsenteesDB(): Promise<ChronicAbsentee[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const res = await query(`
      SELECT s.id as student_id, s.name as student_name, b.name as branch_name, COUNT(*) as absent_days
      FROM attendance_records ar
      JOIN attendance_sessions ases ON ases.id = ar.session_id
      JOIN students s ON s.id = ar.student_id
      LEFT JOIN branches b ON b.id = s.branch_id
      WHERE ar.status='Absent' AND ases.date >= to_char(NOW() - INTERVAL '7 days', 'YYYY-MM-DD')
      GROUP BY s.id, s.name, b.name
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    return res.rows.map((r: any) => ({ studentId: r.student_id, studentName: r.student_name, branchName: r.branch_name || 'Unassigned', absentDays: parseInt(r.absent_days) }));
  } catch { return []; }
}

// ── Fee aging (per branch) ───────────────────────────────────────────────────

export interface FeeAgingRow { branchId: string; branchName: string; bucket0to30: number; bucket31to60: number; bucket61to90: number; bucket90plus: number }

export async function fetchFeeAgingDB(): Promise<FeeAgingRow[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const branches = await fetchBranchesDB();
    const res = await query(`
      SELECT s.branch_id,
        COALESCE(SUM(fr.amount - fr.amount_paid) FILTER (WHERE (NOW()::date - fr.due_date::date) BETWEEN 0 AND 30), 0) as b0_30,
        COALESCE(SUM(fr.amount - fr.amount_paid) FILTER (WHERE (NOW()::date - fr.due_date::date) BETWEEN 31 AND 60), 0) as b31_60,
        COALESCE(SUM(fr.amount - fr.amount_paid) FILTER (WHERE (NOW()::date - fr.due_date::date) BETWEEN 61 AND 90), 0) as b61_90,
        COALESCE(SUM(fr.amount - fr.amount_paid) FILTER (WHERE (NOW()::date - fr.due_date::date) > 90), 0) as b90_plus
      FROM fee_records fr JOIN students s ON s.id = fr.student_id
      WHERE fr.status != 'Paid' AND s.branch_id IS NOT NULL AND fr.due_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
      GROUP BY s.branch_id
    `);
    const map = new Map(res.rows.map((r: any) => [r.branch_id, r]));
    return branches.map(b => {
      const r: any = map.get(b.id);
      return {
        branchId: b.id, branchName: b.name,
        bucket0to30: r ? parseFloat(r.b0_30) : 0,
        bucket31to60: r ? parseFloat(r.b31_60) : 0,
        bucket61to90: r ? parseFloat(r.b61_90) : 0,
        bucket90plus: r ? parseFloat(r.b90_plus) : 0,
      };
    });
  } catch { return []; }
}

// ── Staff coverage today ─────────────────────────────────────────────────────

export interface StaffCoverageRow { branchId: string; branchName: string; teachersAbsentToday: number; unfilledSubstitutionsToday: number }

export async function fetchStaffCoverageTodayDB(): Promise<StaffCoverageRow[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const branches = await fetchBranchesDB();
    const today = new Date().toISOString().split('T')[0];
    const [absent, unfilled] = await Promise.all([
      query(`
        SELECT u.branch_id, COUNT(*) as c FROM staff_attendance sa JOIN users u ON u.id = sa.user_id
        WHERE u.role='TEACHER' AND sa.date=$1 AND sa.status IN ('Absent','Leave') AND u.branch_id IS NOT NULL
        GROUP BY u.branch_id
      `, [today]),
      query(`
        SELECT ot.branch_id, COUNT(*) as c FROM timetable_substitutions ts JOIN users ot ON ot.id = ts.original_teacher_id
        WHERE ts.date=$1 AND ts.status='unfilled' AND ot.branch_id IS NOT NULL
        GROUP BY ot.branch_id
      `, [today]),
    ]);
    const absentMap = new Map(absent.rows.map((r: any) => [r.branch_id, parseInt(r.c)]));
    const unfilledMap = new Map(unfilled.rows.map((r: any) => [r.branch_id, parseInt(r.c)]));
    return branches.map(b => ({
      branchId: b.id, branchName: b.name,
      teachersAbsentToday: absentMap.get(b.id) ?? 0,
      unfilledSubstitutionsToday: unfilledMap.get(b.id) ?? 0,
    }));
  } catch { return []; }
}

// ── Academic at-risk students ─────────────────────────────────────────────────

export interface AtRiskSummaryRow { branchId: string; branchName: string; count: number }
export interface AtRiskStudent { studentId: string; studentName: string; className: string; percentage: number }

export async function fetchAtRiskStudentsSummaryDB(thresholdPct = 40): Promise<AtRiskSummaryRow[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const branches = await fetchBranchesDB();
    const res = await query(`
      SELECT s.branch_id, COUNT(DISTINCT r.student_id) as c
      FROM results r JOIN students s ON s.id = r.student_id
      WHERE r.percentage < $1 AND s.branch_id IS NOT NULL
      GROUP BY s.branch_id
    `, [thresholdPct]);
    const map = new Map(res.rows.map((r: any) => [r.branch_id, parseInt(r.c)]));
    return branches.map(b => ({ branchId: b.id, branchName: b.name, count: map.get(b.id) ?? 0 }));
  } catch { return []; }
}

export async function fetchAtRiskStudentsListDB(branchId: string, thresholdPct = 40): Promise<AtRiskStudent[]> {
  const auth = await requireRole('OWNER', 'ADMIN');
  if ('error' in auth) return [];
  if (auth.session.role === 'PRINCIPAL' && auth.session.branchId !== branchId) return [];
  try {
    const res = await query(`
      SELECT DISTINCT ON (s.id) s.id as student_id, s.name as student_name, s.class as class_name, r.percentage
      FROM results r JOIN students s ON s.id = r.student_id
      WHERE r.percentage < $1 AND s.branch_id = $2
      ORDER BY s.id, r.percentage ASC
    `, [thresholdPct, branchId]);
    return res.rows.map((r: any) => ({ studentId: r.student_id, studentName: r.student_name, className: r.class_name, percentage: parseFloat(r.percentage) }));
  } catch { return []; }
}

// ── Inventory low-stock (school-wide — consumable_items has no branch_id) ────

export interface LowStockItem { id: string; name: string; category: string; quantity: number; minStockLevel: number; unit: string }

export async function fetchLowStockItemsDB(): Promise<LowStockItem[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const res = await query(`SELECT * FROM consumable_items WHERE quantity <= min_stock_level ORDER BY (quantity - min_stock_level) ASC LIMIT 20`);
    return res.rows.map((r: any) => ({ id: r.id, name: r.name, category: r.category, quantity: r.quantity, minStockLevel: r.min_stock_level, unit: r.unit }));
  } catch { return []; }
}

// ── HR: contracts expiring soon ──────────────────────────────────────────────

export interface ExpiringContract { employeeName: string; branchName: string; endDate: string; contractType: string }

export async function fetchExpiringContractsDB(withinDays = 30): Promise<ExpiringContract[]> {
  const auth = await requireRole('OWNER');
  if ('error' in auth) return [];
  try {
    const res = await query(`
      SELECT e.name as employee_name, b.name as branch_name, cr.end_date, cr.contract_type
      FROM contract_records cr
      JOIN employees e ON e.user_id = cr.employee_id
      LEFT JOIN branches b ON b.id = e.branch_id
      WHERE cr.status='Active' AND cr.end_date ~ '^\\d{4}-\\d{2}-\\d{2}$'
        AND cr.end_date::date BETWEEN NOW()::date AND (NOW() + ($1 || ' days')::interval)::date
      ORDER BY cr.end_date ASC
    `, [withinDays]);
    return res.rows.map((r: any) => ({ employeeName: r.employee_name, branchName: r.branch_name || 'Unassigned', endDate: r.end_date, contractType: r.contract_type }));
  } catch { return []; }
}
