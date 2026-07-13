import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { analyzeSystem } from "../engine/analyze.js";
import { enrichCves, intelligenceSources } from "../engine/intelligence.js";
import { deterministicInterviewReview } from "../interview/review.js";
import {
  analysisRequestSchema,
  cveRequestSchema,
  interviewReviewRequestSchema,
  interviewReviewSchema,
} from "../shared/schemas.js";

export interface AppConfig {
  liveIntelligence: boolean;
  nvdApiKey?: string;
  allowedOrigins: string[];
  requestTimeoutMs: number;
  aiServiceUrl?: string;
  aiServiceToken?: string;
}

const defaultConfig: AppConfig = {
  liveIntelligence: false,
  allowedOrigins: ["http://localhost:5173"],
  requestTimeoutMs: 7000,
};

function errorDetails(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

export function createApp(config: AppConfig = defaultConfig): Hono {
  const app = new Hono();

  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
      strictTransportSecurity: "max-age=31536000; includeSubDomains",
      referrerPolicy: "no-referrer",
    }),
  );
  app.use(
    "/api/*",
    cors({
      origin: (origin) =>
        config.allowedOrigins.includes(origin) ? origin : (config.allowedOrigins[0] ?? ""),
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
      maxAge: 600,
    }),
  );
  app.use("/api/*", bodyLimit({ maxSize: 1_000_000 }));

  app.get("/health", (context) =>
    context.json({ status: "ok", service: "argus", version: "0.2.0" }),
  );
  app.get("/api/meta", (context) =>
    context.json({
      name: "Argus",
      version: "0.2.0",
      liveIntelligence: config.liveIntelligence,
      aiInterviewer: Boolean(config.aiServiceUrl),
      sources: intelligenceSources,
    }),
  );

  app.post("/api/interview/review", async (context) => {
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "Request body must be valid JSON" }, 400);
    }
    const parsed = interviewReviewRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        {
          error: "Interview profile is invalid",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }
    const fallback = deterministicInterviewReview(parsed.data.profile);
    if (!config.aiServiceUrl) return context.json(fallback);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetch(
        `${config.aiServiceUrl.replace(/\/$/, "")}/v1/interview/review`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(config.aiServiceToken ? { "X-Argus-Internal-Token": config.aiServiceToken } : {}),
          },
          body: JSON.stringify(parsed.data),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error(`AI service returned HTTP ${response.status}`);
      const review = interviewReviewSchema.safeParse(await response.json());
      if (!review.success) throw new Error("AI service returned an invalid structured response");
      return context.json(review.data);
    } catch (error: unknown) {
      return context.json({
        ...fallback,
        warnings: [
          ...fallback.warnings,
          `AI review was unavailable; deterministic questions were returned (${errorDetails(error)}).`,
        ],
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  app.post("/api/analyze", async (context) => {
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "Request body must be valid JSON" }, 400);
    }
    const parsed = analysisRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        {
          error: "Architecture model is invalid",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
        400,
      );
    }
    const unreviewedCount =
      parsed.data.model.nodes.filter((node) => node.reviewStatus === "needs-review").length +
      parsed.data.model.flows.filter((flow) => flow.reviewStatus === "needs-review").length;
    if (unreviewedCount > 0) {
      return context.json(
        {
          error: "Architecture evidence requires human confirmation",
          detail: `${unreviewedCount} generated components or flows remain marked needs-review.`,
        },
        409,
      );
    }
    return context.json(analyzeSystem(parsed.data.model));
  });

  app.post("/api/intelligence/cves", async (context) => {
    if (!config.liveIntelligence) {
      return context.json(
        {
          error: "Live intelligence is disabled",
          help: "Set ARGUS_LIVE_INTELLIGENCE=true after reviewing outbound data and egress requirements.",
        },
        503,
      );
    }
    let payload: unknown;
    try {
      payload = await context.req.json();
    } catch {
      return context.json({ error: "Request body must be valid JSON" }, 400);
    }
    const parsed = cveRequestSchema.safeParse(payload);
    if (!parsed.success) {
      return context.json(
        { error: "Provide 1–25 valid CVE identifiers", issues: parsed.error.issues },
        400,
      );
    }
    try {
      const records = await enrichCves(parsed.data.cveIds, {
        ...(config.nvdApiKey ? { nvdApiKey: config.nvdApiKey } : {}),
        timeoutMs: config.requestTimeoutMs,
      });
      return context.json({ records });
    } catch (error: unknown) {
      return context.json(
        { error: "Intelligence enrichment failed", detail: errorDetails(error) },
        502,
      );
    }
  });

  app.notFound((context) => context.json({ error: "Not found", path: context.req.path }, 404));
  app.onError((error, context) => {
    console.error("Unhandled request error", error);
    return context.json({ error: "Internal server error" }, 500);
  });
  return app;
}
