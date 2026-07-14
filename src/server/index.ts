import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const app = createApp({
  liveIntelligence: process.env.ARGUS_LIVE_INTELLIGENCE === "true",
  ...(process.env.NVD_API_KEY ? { nvdApiKey: process.env.NVD_API_KEY } : {}),
  allowedOrigins,
  requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 7000),
  ...(process.env.ARGUS_AI_SERVICE_URL ? { aiServiceUrl: process.env.ARGUS_AI_SERVICE_URL } : {}),
  ...(process.env.ARGUS_AI_SERVICE_TOKEN
    ? { aiServiceToken: process.env.ARGUS_AI_SERVICE_TOKEN }
    : {}),
});

app.use("/*", serveStatic({ root: "./dist/client" }));
app.get("*", serveStatic({ path: "./dist/client/index.html" }));

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Argus listening on http://localhost:${info.port}`);
});
