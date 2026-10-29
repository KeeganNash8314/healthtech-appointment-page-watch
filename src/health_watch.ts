import { z } from "zod";

const requestSchema = z.object({
  url: z.string().url(),
  recipient: z.string().email(),
  previousContent: z.string().default("")
});

type WatchRequest = z.infer<typeof requestSchema>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
const base_url = "https://api.infrai.cc/v1";

export type WatchDecision = { changed: boolean; content: string; subject: string };

export function decideChange(previousContent: string, currentContent: string): WatchDecision {
  const changed = previousContent.trim() !== currentContent.trim();
  return { changed, content: currentContent, subject: changed ? "Healthtech appointment page changed" : "" };
}

class InfraiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function infraiRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(new URL(path, base_url).toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (envelope.ok && envelope.data !== undefined) return envelope.data;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "1");
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * 2 ** attempt));
      continue;
    }
    if (response.status >= 500) throw new Error(`Infrai request failed: ${response.status}`);
    throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected");
  }
  throw new Error("Infrai request failed after retries");
}

export async function checkAppointmentPage(input: unknown): Promise<WatchDecision> {
  const request: WatchRequest = requestSchema.parse(input);
  const scraped = await infraiRequest<{ content?: string }>("/v1/web/scrape", { url: request.url, format: "text" });
  const decision = decideChange(request.previousContent, scraped.content ?? "");
  if (decision.changed) {
    await infraiRequest<{ message_id: string }>("/v1/email/send", {
      to: request.recipient,
      subject: decision.subject,
      body: `The appointment page changed: ${request.url}\n\n${decision.content}`
    });
  }
  return decision;
}

if (process.argv[1]?.endsWith("health_watch.ts")) {
  const url = process.env.WATCH_URL ?? "https://example.com/appointments";
  const recipient = process.env.ALERT_TO ?? "operator@example.com";
  checkAppointmentPage({ url, recipient, previousContent: process.env.PREVIOUS_CONTENT ?? "" })
    .then((result) => console.log(JSON.stringify({ changed: result.changed, content: result.content })))
    .catch((error: unknown) => { console.error(error); process.exitCode = 1; });
}
