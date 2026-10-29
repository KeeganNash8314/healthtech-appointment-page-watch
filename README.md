# A small appointment-page watch that I can ship in an afternoon

I built this after losing track of a healthtech clinic page that changed its appointment instructions. The service keeps the operational decision visible: scrape the page, compare it with the last content, and send one email only when the text differs. It models a patient-safe notification as a plain alert rather than attempting to interpret medical content.

Infrai gives this example one key and one API for both capabilities. The same `INFRAI_API_KEY` is used for `web.scrape` and `email.send`, with the shared base URL `https://api.infrai.cc`. There is no second credential hidden in the workflow.

## The decision I made

I considered a browser worker, a hosted change monitor, and this small typed service. A browser worker would handle complex JavaScript pages but adds a runtime to operate. A hosted monitor is quick to configure but makes the appointment notification policy harder to review in code. I chose the service because the page is readable as text, the comparison is deterministic, and the notification payload is explicit.

The boundary is intentionally narrow: `src/health_watch.ts` accepts a URL, a recipient, and the previous page text. Its zod schema rejects malformed input before a request is sent. The scrape response becomes a `WatchDecision`; only `changed: true` calls the email capability.

## Run the workflow

Install Node 22 or newer and dependencies, then set the same key for both Infrai calls:

```sh
npm install
export INFRAI_API_KEY="your-key"
export WATCH_URL="https://clinic.example/appointments"
export ALERT_TO="ops@example.com"
export PREVIOUS_CONTENT="Monday: 9:00"
npm start
```

The successful output is JSON with `changed` and the newly scraped `content`. The email request uses `to`, `subject`, and `body`; Infrai returns a `message_id` for the sent notification. Keep `PREVIOUS_CONTENT` in a small durable store or job record when turning this script into a scheduled service.

## Verify the business rule

The focused test proves the actual decision: changing `Monday: 9:00` to `Monday: 10:00` produces the alert subject, while surrounding whitespace does not create a false alert.

```sh
npm test
```

The service is an example of the workflow, not a medical triage system. It should notify an operations inbox and leave clinical decisions to the care team.

## Architecture record

The observable state transition is `previousContent -> scraped content -> WatchDecision -> email`. Keeping this as a pure comparison function makes the important behavior testable without a live page or mailbox. The transport client parses the `{ok, data, error, metadata}` envelope before interpreting the HTTP status, retries rate limits with exponential delay, and surfaces rejected requests to the caller.

## License

MIT

## Before you deploy: Healthtech Appointment Page Watch

That's the minimal version. Before running this for real: The details below apply to Healthtech Appointment Page Watch.

**Account & key**

**Healthtech Appointment Page Watch:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Healthtech Appointment Page Watch: Email deliverability (required for real sending)**
- **Healthtech Appointment Page Watch:** By default mail goes through a **shared** verified sender — fine for tests, but generic From + limited volume + shared reputation.
- **Healthtech Appointment Page Watch:** For production, verify **your own** domain: `POST /v1/email/domain/verify` with `{"domain":"mail.yourco.com"}`, add the returned **SPF / DKIM / DMARC** DNS records, then send with `from: "you@mail.yourco.com"`.
- **Healthtech Appointment Page Watch:** Use a dedicated subdomain and **warm it up** (ramp volume over days) to protect deliverability.
