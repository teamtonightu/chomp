// Vercel serverless function: POST /api/claude
import { handleClaude } from "./_core.js";

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "invalid_request", message: "POST only" });
  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = null; } }
  const [status, json] = await handleClaude(body, req.headers.origin);
  res.status(status).json(json);
}
