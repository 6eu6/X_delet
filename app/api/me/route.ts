import { credits, userInfo } from "@/lib/twitter";
import { handle, me } from "@/lib/route";

export const maxDuration = 60;

export const GET = () =>
  handle(async () => {
    const [profile, left] = await Promise.all([userInfo(me()), credits().catch(() => null)]);
    return { profile, credits: left, cookieInEnv: !!process.env.X_LOGIN_COOKIE };
  });
