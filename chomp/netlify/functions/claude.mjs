// Netlify function: POST /api/claude  (same logic as the Vercel one)
import { handleClaude } from "../../api/_core.js";

export default async (req) => {
  if (req.method !== "POST") return Response.json({ code: "invalid_request", message: "POST only" }, { status: 405 });
  let body = null;
  try { body = await req.json(); } catch {}
  const [status, json] = await handleClaude(body, req.headers.get("origin"));
  return Response.json(json, { status });
};

export const config = { path: "/api/claude" };
