import { NextRequest } from "next/server";
import { network } from "@/lib/twitter";
import { handle, me } from "@/lib/route";

export const maxDuration = 60;

export const GET = (req: NextRequest) =>
  handle(async () => {
    const p = req.nextUrl.searchParams;
    const kind = p.get("kind") === "followers" ? "followers" : "followings";
    return network(kind, me(), p.get("cursor") ?? "");
  });
