import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

let _userId: string | null = null;

/** Get or create an anonymous user ID. Cached after first call. */
export async function getUserId(): Promise<string> {
  if (_userId) return _userId;
  if (!supabase) return "";

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      _userId = session.user.id;
      return _userId;
    }

    const { data } = await supabase.auth.signInAnonymously();
    _userId = data?.user?.id || "";
    return _userId;
  } catch {
    return "";
  }
}

/** Fetch today's usage for the current user */
export async function getUsageToday(): Promise<{
  text: number;
  image: number;
} | null> {
  if (!supabase) return null;
  const userId = await getUserId();
  if (!userId) return null;

  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("usage")
    .select("text_generations, image_generations")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle();

  if (!data) return { text: 0, image: 0 };
  return {
    text: data.text_generations || 0,
    image: data.image_generations || 0,
  };
}
