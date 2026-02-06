/**
 * Cookie Refresh Trigger Worker
 *
 * Cron: every 6 hours, wakes the Fly.io Sprite to refresh Gemini cookies
 * On-demand: POST /refresh with Authorization header
 * Status: GET /status returns last refresh info from KV
 */

interface Env {
  GEMINI_COOKIES: KVNamespace;
  SPRITES_TOKEN: string;
  REFRESH_SECRET: string;
}

const SPRITE_NAME = "gemini-cookie-refresher";
const SPRITES_API = "https://api.sprites.dev/v1";

async function triggerSpriteRefresh(env: Env): Promise<{ ok: boolean; output?: string; error?: string }> {
  const url = `${SPRITES_API}/sprites/${SPRITE_NAME}/exec`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.SPRITES_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        command: ["node", "/opt/cookie-refresh/refresh.js"],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Sprites API ${res.status}: ${text}` };
    }

    const output = await res.text();
    return { ok: true, output };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const result = await triggerSpriteRefresh(env);

    // Store last run status in KV
    await env.GEMINI_COOKIES.put(
      "last_refresh",
      JSON.stringify({
        triggered_at: new Date().toISOString(),
        trigger: "cron",
        cron: event.cron,
        ...result,
      })
    );

    if (!result.ok) {
      console.error(`Cron refresh failed: ${result.error}`);
    } else {
      console.log(`Cron refresh triggered successfully`);
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // GET /status — check last refresh
    if (url.pathname === "/status" && request.method === "GET") {
      const lastRefresh = await env.GEMINI_COOKIES.get("last_refresh");
      const cookies = await env.GEMINI_COOKIES.get("gemini");

      let cookieInfo = null;
      if (cookies) {
        try {
          const parsed = JSON.parse(cookies);
          cookieInfo = {
            updated_at: parsed.updated_at,
            has_psid: !!parsed.Secure_1PSID,
            has_psidts: !!parsed.Secure_1PSIDTS,
          };
        } catch {}
      }

      return Response.json({
        status: "ok",
        last_refresh: lastRefresh ? JSON.parse(lastRefresh) : null,
        cookies: cookieInfo,
      });
    }

    // POST /refresh — on-demand trigger
    if (url.pathname === "/refresh" && request.method === "POST") {
      const auth = request.headers.get("Authorization");
      if (!auth || auth !== `Bearer ${env.REFRESH_SECRET}`) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const result = await triggerSpriteRefresh(env);

      // Store last run status
      await env.GEMINI_COOKIES.put(
        "last_refresh",
        JSON.stringify({
          triggered_at: new Date().toISOString(),
          trigger: "manual",
          ...result,
        })
      );

      if (!result.ok) {
        return Response.json({ status: "error", error: result.error }, { status: 502 });
      }

      return Response.json({ status: "ok", output: result.output });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
};
