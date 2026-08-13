import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/auth";

const PROTECTED_ROUTES = ["/dashboard", "/parent", "/admissions", "/attendance", "/classes", "/communications", "/exams", "/fees", "/settings", "/students", "/teachers", "/parents", "/results", "/announcements", "/profile", "/users", "/timetable", "/assignments", "/lms", "/library", "/messages", "/hostel", "/hr", "/payroll", "/accounting", "/scholarships", "/discipline", "/events", "/alumni", "/inventory", "/procurement", "/reports"];
const PUBLIC_ROUTES = ["/login", "/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  const token = request.cookies.get("sc_session")?.value;
  const session = token ? await decrypt(token) : null;

  // Redirect logged-in users away from /login
  if (isPublic && session && pathname === "/login") {
    return NextResponse.redirect(new URL(session.role === "PARENT" ? "/parent" : "/dashboard", request.url));
  }

  // Redirect unauthenticated users from protected routes to /login
  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect PARENT away from the main dashboard
  if (session?.role === "PARENT" && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/parent", request.url));
  }

  // Admin-only routes — redirect STUDENT and TEACHER away
  const adminOnlyRoutes = ["/users", "/settings", "/admissions", "/classes", "/teachers", "/parents", "/hr", "/payroll", "/accounting", "/scholarships", "/discipline", "/alumni", "/inventory", "/procurement"];
  const isAdminOnly = adminOnlyRoutes.some(r => pathname.startsWith(r));
  if (isAdminOnly && session?.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)",
  ],
};
