"use server";

import { query } from '@/lib/db';
import { getSession } from '@/app/actions/auth';
import { logServerError } from '@/lib/error-log';
import { scopeBranch } from '@/lib/auth-scope';
import type { SessionPayload } from '@/lib/auth';

export interface MessagingContact {
  userId: number;
  name: string;
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'EMPLOYEE';
}

// Every allowed contact is derived from real relational data (Enrollment /
// TeacherClassSubject) — never an open directory. This same query backs both
// the contact picker AND sendMessageDB's server-side authorization check, so
// the UI list and the enforcement can never drift apart.
async function resolveContacts(userId: number, role: string, session: SessionPayload): Promise<MessagingContact[]> {
  const contacts = new Map<number, MessagingContact>();
  // Admins/Principals are only ever a branch's own — cross-branch admin
  // directories aren't a real contact list for anyone but OWNER.
  const branchId = scopeBranch(session);
  const adminParams: (number | string)[] = [userId];
  let adminSql = `SELECT id, name FROM users WHERE role='ADMIN' AND id != $1`;
  if (branchId) { adminParams.push(branchId); adminSql += ` AND branch_id=$${adminParams.length}`; }
  const admins = await query(adminSql, adminParams);
  for (const r of admins.rows) contacts.set(r.id, { userId: r.id, name: r.name, role: 'ADMIN' });

  if (role === 'ADMIN' || role === 'PRINCIPAL' || role === 'OWNER') {
    const params: (number | string)[] = [userId];
    let sql = `SELECT id, name, role FROM users WHERE id != $1`;
    if (branchId) { params.push(branchId); sql += ` AND branch_id=$${params.length}`; }
    const all = await query(sql, params);
    for (const r of all.rows) contacts.set(r.id, { userId: r.id, name: r.name, role: r.role });
    return Array.from(contacts.values());
  }

  if (role === 'TEACHER') {
    const res = await query(
      `SELECT DISTINCT u.id, u.name, u.role
       FROM teacher_class_subjects tcs
       JOIN enrollments e ON e.class_id = tcs.class_id AND (tcs.section_id IS NULL OR e.section_id = tcs.section_id)
       JOIN students s ON s.id = e.student_id
       JOIN users u ON u.email = s.email OR u.email = s.parent_email
       WHERE tcs.teacher_id = $1 AND e.status = 'Active'`,
      [userId]
    );
    for (const r of res.rows) contacts.set(r.id, { userId: r.id, name: r.name, role: r.role });
    return Array.from(contacts.values());
  }

  if (role === 'STUDENT' || role === 'PARENT') {
    const studentFilter = role === 'STUDENT'
      ? `s.email = (SELECT email FROM users WHERE id = $1)`
      : `s.parent_email = (SELECT email FROM users WHERE id = $1)`;
    const res = await query(
      `SELECT DISTINCT u.id, u.name, u.role
       FROM students s
       JOIN enrollments e ON e.student_id = s.id AND e.status = 'Active'
       JOIN teacher_class_subjects tcs ON tcs.class_id = e.class_id AND (tcs.section_id IS NULL OR tcs.section_id = e.section_id)
       JOIN users u ON u.id = tcs.teacher_id
       WHERE ${studentFilter}`,
      [userId]
    );
    for (const r of res.rows) contacts.set(r.id, { userId: r.id, name: r.name, role: r.role });
    return Array.from(contacts.values());
  }

  return Array.from(contacts.values());
}

export async function fetchMessagingContactsDB(): Promise<MessagingContact[]> {
  const session = await getSession();
  if (!session) return [];
  try { return await resolveContacts(session.userId, session.role, session); }
  catch { return []; }
}

export interface ConversationSummary {
  conversationId: string;
  otherUserId: number;
  otherUserName: string;
  otherUserRole: string;
  lastMessage: string | null;
  lastMessageAt: string;
  unreadCount: number;
}

export async function fetchConversationsDB(): Promise<ConversationSummary[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await query(
      `SELECT c.id as conversation_id,
              CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END as other_id,
              u.name as other_name, u.role as other_role,
              c.last_message_at,
              (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message,
              (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id AND sender_id != $1 AND read_at IS NULL)::int as unread_count
       FROM conversations c
       JOIN users u ON u.id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
       WHERE c.user_a_id = $1 OR c.user_b_id = $1
       ORDER BY c.last_message_at DESC`,
      [session.userId]
    );
    return res.rows.map(r => ({
      conversationId: r.conversation_id, otherUserId: r.other_id, otherUserName: r.other_name,
      otherUserRole: r.other_role, lastMessage: r.last_message, lastMessageAt: r.last_message_at,
      unreadCount: r.unread_count,
    }));
  } catch { return []; }
}

export interface MessageItem {
  id: string; senderId: number; body: string; sentAt: string; mine: boolean;
}

export async function fetchMessagesDB(conversationId: string): Promise<{ error?: string; messages?: MessageItem[] }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  try {
    const convo = await query(`SELECT user_a_id, user_b_id FROM conversations WHERE id=$1`, [conversationId]);
    if (convo.rows.length === 0) return { error: 'Conversation not found.' };
    const { user_a_id, user_b_id } = convo.rows[0];
    if (session.userId !== user_a_id && session.userId !== user_b_id) return { error: 'Not authorized.' };

    await query(
      `UPDATE messages SET read_at=NOW() WHERE conversation_id=$1 AND sender_id != $2 AND read_at IS NULL`,
      [conversationId, session.userId]
    );
    const res = await query(`SELECT * FROM messages WHERE conversation_id=$1 ORDER BY sent_at ASC`, [conversationId]);
    return {
      messages: res.rows.map(r => ({
        id: r.id, senderId: r.sender_id, body: r.body, sentAt: r.sent_at, mine: r.sender_id === session.userId,
      })),
    };
  } catch (err) { logServerError("messaging", err); return { error: 'Failed to load messages.' }; }
}

export async function sendMessageDB(recipientUserId: number, body: string): Promise<{ error?: string; conversationId?: string }> {
  const session = await getSession();
  if (!session) return { error: 'Not authenticated.' };
  if (!body.trim()) return { error: 'Message cannot be empty.' };
  if (recipientUserId === session.userId) return { error: "You can't message yourself." };

  try {
    // Real server-side enforcement of "restrict to real relationships" — the
    // contact picker only ever shows this same list, but a crafted request
    // could try to target anyone, so this is re-checked here, not trusted from the client.
    const allowed = await resolveContacts(session.userId, session.role, session);
    if (!allowed.some(c => c.userId === recipientUserId)) {
      return { error: "You don't have a messaging relationship with this person." };
    }

    const userAId = Math.min(session.userId, recipientUserId);
    const userBId = Math.max(session.userId, recipientUserId);
    let convoRes = await query(`SELECT id FROM conversations WHERE user_a_id=$1 AND user_b_id=$2`, [userAId, userBId]);
    let conversationId: string;
    if (convoRes.rows.length === 0) {
      conversationId = `conv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      await query(`INSERT INTO conversations (id, user_a_id, user_b_id) VALUES ($1,$2,$3)`, [conversationId, userAId, userBId]);
    } else {
      conversationId = convoRes.rows[0].id;
      await query(`UPDATE conversations SET last_message_at=NOW() WHERE id=$1`, [conversationId]);
    }

    const messageId = `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    await query(
      `INSERT INTO messages (id, conversation_id, sender_id, body) VALUES ($1,$2,$3,$4)`,
      [messageId, conversationId, session.userId, body.trim()]
    );
    return { conversationId };
  } catch (err) { logServerError("messaging", err); return { error: 'Failed to send message.' }; }
}

export async function fetchUnreadMessageCountDB(): Promise<number> {
  const session = await getSession();
  if (!session) return 0;
  try {
    const res = await query(
      `SELECT COUNT(*)::int as count FROM messages m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE (c.user_a_id = $1 OR c.user_b_id = $1) AND m.sender_id != $1 AND m.read_at IS NULL`,
      [session.userId]
    );
    return res.rows[0]?.count ?? 0;
  } catch { return 0; }
}
