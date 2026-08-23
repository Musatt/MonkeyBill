// DEV ONLY — intercepts the Supabase REST calls so local testing never touches
// the real production database. Data is kept in localStorage.
const KEY = "__dev_mock_supabase__";
const FAIL_GET = "__dev_mock_fail_get__";

export function installMockSupabase() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    if (!url.includes("supabase.co")) return realFetch(input, init);
    const method = (init.method || "GET").toUpperCase();
    await new Promise((r) => setTimeout(r, 80));
    if (method === "GET") {
      if (localStorage.getItem(FAIL_GET)) {
        console.warn("[dev] simulating GET failure (500)");
        return new Response("server error", { status: 500 });
      }
      const raw = localStorage.getItem(KEY);
      const rows = raw ? [{ data: JSON.parse(raw) }] : [];
      return new Response(JSON.stringify(rows), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (method === "POST") {
      const body = JSON.parse(init.body);
      console.warn("[dev] POST overwriting stored data");
      localStorage.setItem(KEY, JSON.stringify(body.data));
      return new Response("", { status: 201 });
    }
    return new Response("", { status: 204 });
  };
  console.log("[dev] Supabase mock installed — production data untouched");
}
