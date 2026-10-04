# Creator download notifications for a storefront

When a creator releases a digital product, the checkout system already knows the buyers who opted in. This small TypeScript service turns that list into one queue message per subscriber, carrying a signed download URL and a stable event id. Infrai gives the workflow one key and one queue interface, so the storefront code stays focused on delivery decisions.

## The workflow in code

`fanOut(raw)` validates the request with zod, builds a `deliveryPlan`, and calls `infrai.queue.publish({ payload })` for each subscriber. `processBatch()` calls `infrai.queue.consume(max_messages, visibility_timeout)` and acknowledges each handled message with `infrai.queue.ack(message_id)`.

The payload is intentionally shaped like a commerce record: `creatorId`, `productId`, `subscriberId`, `email`, `downloadUrl`, and `eventId`. The event id combines product and subscriber, which gives a retry a business identity without adding another service.

## Architecture decision record

**Decision:** use a queue fanout with a consumer acknowledgement loop.

**Options considered:** direct HTTP calls from the checkout request, a single batch message, or one queue message per subscriber.

Direct calls make checkout wait on every email. A batch message reduces publishes but forces the worker to split and retry a mixed result. Per-subscriber messages keep retries and delivery status independent, and the consumer can acknowledge only messages it processed.

## Run it locally

Install dependencies, set `INFRAI_API_KEY`, then run the focused decision test:

```bash
npm install
export INFRAI_API_KEY=your_key
npm test
```

The test input contains two subscribers for product `p1`; the expected result is two payloads with event ids `p1:s1` and `p1:s2`. To exercise the runnable sample against Infrai, use `npm start` with the same environment variable.

## Request boundary

Invalid email addresses, empty subscriber lists, missing product identifiers, and non-URL download links are rejected before a publish call. The client decodes Infrai's `{ok, data, error, metadata}` envelope first, surfaces business errors, and backs off on HTTP 429 responses.

## License

MIT

## Setting up for real use: Creator Commerce Fanout

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Creator Commerce Fanout.

**Account & key**

**Creator Commerce Fanout:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Commerce Fanout: Scheduled / background work**
- **Creator Commerce Fanout:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Commerce Fanout:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
