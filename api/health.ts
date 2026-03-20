import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const apiKey =
    (req.headers["x-api-key"] as string) || process.env.GEMINI_API_KEY || "";

  // Supabase diagnostic
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
  let supabaseStatus = "not configured";

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false } });
      const { error } = await supabase.from("usage").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        date: new Date().toISOString().split("T")[0],
        text_generations: 0,
        image_generations: 0,
      });
      if (error) {
        supabaseStatus = `insert error: ${error.message}`;
      } else {
        supabaseStatus = "connected + write ok";
        // Clean up test row
        await supabase
          .from("usage")
          .delete()
          .eq("user_id", "00000000-0000-0000-0000-000000000000");
      }
    } catch (e: any) {
      supabaseStatus = `exception: ${e.message}`;
    }
  }

  if (!apiKey) {
    return res.status(200).json({
      gemini: "no key",
      supabase: supabaseStatus,
      envCheck: {
        hasSupabaseUrl: !!supabaseUrl,
        hasSupabaseKey: !!supabaseKey,
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
      },
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Say OK" }] }],
        }),
      },
    );
    const data = await response.json();
    return res.status(200).json({
      gemini: data.candidates ? "ok" : data.error?.message || "no response",
      supabase: supabaseStatus,
    });
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: error.message || "Failed", supabase: supabaseStatus });
  }
}
