import { SignJWT, jwtVerify } from "jose";

export type SessionPayload = {
  userId: number;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT" | "EMPLOYEE" | "OWNER" | "PRINCIPAL";
  // null for OWNER (sees all branches) and for legacy sessions issued before
  // multi-branch support — those are treated as unscoped until re-login.
  branchId: string | null;
};

const secretKey = process.env.JWT_SECRET || "scholarly-central-super-secret-jwt-key-2026";
const encodedKey = new TextEncoder().encode(secretKey);

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
