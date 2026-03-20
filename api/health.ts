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
  const userId = (req.headers["x-user-id"] as string) || "";

  // Supabase diagnostic
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";
  let supabaseStatus = "not configured";
  let usageWriteTest = "skipped";

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Test basic connectivity
      const testId = "00000000-0000-0000-0000-000000000000";
      const today = new Date().toISOString().split("T")[0];
      const { error: insertErr } = await supabase.from("usage").insert({
        user_id: testId,
        date: today,
        text_generations: 0,
        image_generations: 0,
      });

      if (insertErr) {
        // Might be duplicate — try upsert approach
        if (insertErr.message.includes("duplicate")) {
          supabaseStatus = "connected (test row exists)";
        } else {
          supabaseStatus = `insert error: ${insertErr.message} | code: ${insertErr.code}`;
        }
      } else {
        supabaseStatus = "connected + write ok";
        await supabase.from("usage").delete().eq("user_id", testId);
      }

      // If a real user ID was sent, test writing for that user
      if (userId) {
        const { data: existing } = await supabase
          .from("usage")
          .select("*")
          .eq("user_id", userId)
          .eq("date", today)
          .maybeSingle();

        if (existing) {
          usageWriteTest = `existing row found: text=${existing.text_generations}, image=${existing.image_generations}`;
        } else {
          const { error: userInsertErr } = await supabase
            .from("usage")
            .insert({ user_id: userId, date: today, text_generations: 1 });
          usageWriteTest = userInsertErr
            ? `user insert failed: ${userInsertErr.message} | code: ${userInsertErr.code}`
            : "user row created successfully";
        }
      } else {
        usageWriteTest = "no x-user-id header sent";
      }
    } catch (e: any) {
      supabaseStatus = `exception: ${e.message}`;
    }
  }

  // Gemini check
  let geminiStatus = "no key";
  if (apiKey) {
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
      geminiStatus = data.candidates
        ? "ok"
        : data.error?.message || "no response";
    } catch (error: any) {
      geminiStatus = error.message;
    }
  }

  return res.status(200).json({
    gemini: geminiStatus,
    supabase: supabaseStatus,
    usageWriteTest,
    userId: userId || "none",
  });
}
