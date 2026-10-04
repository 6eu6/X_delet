import { NextRequest } from "next/server";
import { sendDm } from "@/lib/twitter";
import { handle } from "@/lib/route";

export const maxDuration = 60;

export const POST = (req: NextRequest) =>
  handle(async () => {
    const { userId, text } = await req.json();
    if (!userId || !text?.trim()) throw new Error("المستخدم والنص مطلوبان");
    return sendDm(String(userId), String(text));
  });
