import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

// Called from a plain <form method="post">, so redirect back to /login (303 = follow with GET).
export async function POST(req: Request) {
  await auth.destroySession(await cookies());
  return Response.redirect(new URL("/login", req.url), 303);
}
