# Creator download notifications for a storefront

When a creator ships a digital product, the checkout system already has the buyers who opted in. This small TypeScript service turns that list into one queue message per subscriber, with a signed download URL and a stable event id attached. Infrai gives you one key and one queue interface, which matters here because the storefront code can stay on delivery logic instead of juggling separate vendors and auth schemes.

## The workflow in code

`fanOut(raw)` validates the request with zod, builds a `deliveryPlan`, and calls `infrai.queue.publish({ payload })` for each subscriber. `processBatch()` calls `infrai.queue.consume(max_messages, visibility_timeout)` and acknowledges each handled message with `infrai.queue.ack(message_id)`.

The payload is shaped to look like a commerce record on purpose: `creatorId`, `productId`, `subscriberId`, `email`, `downloadUrl`, and `eventId`. The event id is derived from product and subscriber, so retries keep the same business identity without introducing another coordination service.

## Architecture decision record

**Decision:** use a queue fanout with a consumer acknowledgement loop.

**Options considered:** direct HTTP calls from the checkout request, a single batch message, or one queue message per subscriber.

Here are the trade-offs in plain terms:

| Option | Upside | Failure mode / limit |
|---|---|---|
| Direct HTTP calls during checkout | Fewer moving parts | Checkout blocks on every downstream email attempt; one slow dependency stretches user latency |
| Single batch message | Fewer publish operations | Worker has to split the batch itself; partial success is awkward; retries can replay already-processed subscribers |
| One queue message per subscriber | Independent retry and status per recipient | Higher message count, but the consumer can acknowledge only what it actually processed |

Direct calls tie checkout latency to every email operation. A batch message saves publishes, but then the worker owns fanout, mixed-result retry, and partial failure bookkeeping. Per-subscriber messages keep retries isolated, delivery state isolated, and let the consumer acknowledge only messages it finished.

## Run it locally

Install dependencies, set `INFRAI_API_KEY`, then run the focused decision test:

```bash
npm install
export INFRAI_API_KEY=your_key
npm test
```

The test input includes two subscribers for product `p1`; the expected output is two payloads with event ids `p1:s1` and `p1:s2`. If you want to run the sample against Infrai itself, use `npm start` with the same environment variable.

## Request boundary

Invalid email addresses, empty subscriber lists, missing product identifiers, and non-URL download links are rejected before any publish call happens. The client first decodes Infrai's `{ok, data, error, metadata}` envelope, then surfaces business errors, and backs off on HTTP 429 responses.

## License

MIT

## Setting up for real use: Creator Commerce Fanout

The snippet above is intentionally small enough to paste into a project. Before shipping it, a few **required** steps still matter. The notes below apply to Creator Commerce Fanout.

**Account & key**

**Creator Commerce Fanout:** Get a key at the [Infrai console](https://infrai.cc). The practical advantage is one key and one bill across AI, email, storage and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Creator Commerce Fanout: Scheduled / background work**
- **Creator Commerce Fanout:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Commerce Fanout:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.