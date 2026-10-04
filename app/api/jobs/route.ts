import { NextRequest } from "next/server";
import { enqueue, listJobs, workerHeartbeat } from "@/lib/queue";
import { handle } from "@/lib/route";

export const GET = () => handle(async () => ({ jobs: await listJobs(), heartbeat: await workerHeartbeat() }));

export const POST = (req: NextRequest) =>
  handle(async () => {
    const { users } = (await req.json()) as { users?: { id: string; userName: string }[] };
    if (!users?.length) throw new Error("لا يوجد مستخدمون");
    if (users.length > 2000) throw new Error("الحد الأقصى 2000 في المهمة الواحدة");
    const clean = users.filter((u) => u.id && /^\w{1,15}$/.test(u.userName)).map((u) => ({ id: String(u.id), userName: u.userName }));
    return enqueue(clean);
  });
