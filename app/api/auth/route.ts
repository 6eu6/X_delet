import { NextRequest, NextResponse } from "next/server";
import { COOKIE, makeToken, passwordOk } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (!process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "APP_PASSWORD غير مضبوط في متغيرات البيئة" }, { status: 500 });
  }
  if (!passwordOk(password ?? "")) {
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "كلمة المرور خاطئة" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await makeToken(), { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 14 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}
