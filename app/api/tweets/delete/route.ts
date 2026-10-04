import { NextRequest } from "next/server";
import { deleteTweet } from "@/lib/twitter";
import { handle } from "@/lib/route";

export const maxDuration = 60;

export const POST = (req: NextRequest) =>
  handle(async () => {
    const { id } = await req.json();
    if (!id) throw new Error("id مطلوب");
    return deleteTweet(String(id));
  });
