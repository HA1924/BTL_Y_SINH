import { store, ONLINE_WINDOW_MS } from "@/lib/store";

export async function GET() {
  const reading = await store.getLatest();
  const online = !!reading && Date.now() - Date.parse(reading.ts) <= ONLINE_WINDOW_MS;
  return Response.json({ reading, online });
}
