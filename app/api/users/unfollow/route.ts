import { NextRequest } from "next/server";
import { unfollow } from "@/lib/twitter";
import { handle } from "@/lib/route";

export const maxDuration = 60;

export const POST = (req: NextRequest) =>
  handle(async () => {
    const { userId } = await req.json();
    if (!userId) throw new Error("userId مطلوب");
    return unfollow(String(userId));
  });
