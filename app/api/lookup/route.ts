import { NextRequest } from "next/server";
import { userInfo } from "@/lib/twitter";
import { handle } from "@/lib/route";

export const GET = (req: NextRequest) =>
  handle(() => userInfo((req.nextUrl.searchParams.get("userName") ?? "").replace(/^@/, "")));
