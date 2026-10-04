import { login, resetCookie } from "@/lib/twitter";
import { handle } from "@/lib/route";

export const maxDuration = 60;

// تسجيل دخول جديد لـ X وإرجاع الـ cookie لحفظه في Vercel (X_LOGIN_COOKIE)
export const POST = () =>
  handle(async () => {
    resetCookie();
    return { cookie: await login() };
  });
