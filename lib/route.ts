import "server-only";
import { NextResponse } from "next/server";
import { ApiError } from "./twitter";

export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message || "خطأ غير معروف" }, { status: status >= 400 && status < 600 ? status : 502 });
  }
}

export function me(): string {
  const u = process.env.X_USERNAME;
  if (!u) throw new ApiError(400, "X_USERNAME غير مضبوط");
  return u.replace(/^@/, "");
}
