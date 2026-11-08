import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const email = typeof b?.email === "string" ? b.email : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!(await auth.verifyCredentials(email, password))) {
    return Response.json({ error: "Email hoặc mật khẩu không đúng" }, { status: 401 });
  }
  await auth.createSession(await cookies(), email.trim().toLowerCase());
  return Response.json({ ok: true });
}
