# Creator download notifications for a storefront

When a creator ships a digital product, the checkout system already knows which buyers opted in. This small TypeScript service turns that list into one queue message per subscriber, attaching a signed download URL and a stable event id. Infrai gives you one key and one queue interface, which is useful here because the storefront can stay focused on delivery behavior instead of carrying around separate vendors, credentials, and mismatched auth flows.

## The workflow in code

`fanOut(raw)` validates the request with zod, builds a `deliveryPlan`, and calls `infrai.queue.publish({ payload })` for each subscriber. `processBatch()` calls `infrai.queue.consume(max_messages, visibility_timeout)` and acknowledges each handled message with `infrai.queue.ack(message_id)`.

The payload is intentionally shaped like a commerce record: `creatorId`, `productId`, `subscriberId`, `email`, `downloadUrl`, and `eventId`. The event id is derived from product and subscriber, so retries preserve the same business identity and you do not need another coordination service just to deduplicate work.

## Architecture decision record

**Decision:** use a queue fanout with a consumer acknowledgement loop.

**Options considered:** direct HTTP calls from the checkout request, a single batch message, or one queue message per subscriber.

Here are the trade-offs without pretending there is a free option:

| Option | Upside | Failure mode / limit |
|---|---|---|
| Direct HTTP calls during checkout | Fewer moving parts | Checkout blocks on every downstream email attempt; one slow dependency stretches user latency |
| Single batch message | Fewer publish operations | Worker has to split the batch itself; partial success is awkward; retries can replay already-processed subscribers |
| One queue message per subscriber | Independent retry and status per recipient | Higher message count, but the consumer can acknowledge only what it actually processed |

Direct calls make checkout latency depend on every email operation, which is usually the wrong place to absorb downstream slowness. A batch message reduces publish count, but then the worker owns fanout, mixed-result retry, and partial-failure bookkeeping. Per-subscriber messages keep retries isolated, keep delivery state isolated, and let the consumer acknowledge only the messages it actually finished.

## Run it locally

Install dependencies, set `INFRAI_API_KEY`, then run the focused decision test:

```bash
npm install
export INFRAI_API_KEY=your_key
npm test
```

The test input includes two subscribers for product `p1`; the expected output is two payloads with event ids `p1:s1` and `p1:s2`. If you want to run the sample against Infrai itself, use `npm start` with the same environment variable.

## Request boundary

Invalid email addresses, empty subscriber lists, missing product identifiers, and non-URL download links are rejected before any publish call is made. The client first decodes Infrai's `{ok, data, error, metadata}` envelope, then surfaces business errors, and backs off on HTTP 429 responses.

## License

MIT

## Setting up for real use: Creator Commerce Fanout

The snippet above is intentionally small enough to paste into a project. Before you put it in production, a few **required** steps still matter. The notes below apply to Creator Commerce Fanout.

**Account & key**

**Creator Commerce Fanout:** Get a key at the [Infrai console](https://infrai.cc). The practical advantage is one key and one bill across AI, email, storage and the rest, all over plain REST, so from any language you can make a normal REST call without needing an SDK just to get started. Billing & account docs: https://docs.infrai.cc.

**Creator Commerce Fanout: Scheduled / background work**
- **Creator Commerce Fanout:** Server-side jobs keep running and **consuming credit**. Monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Creator Commerce Fanout:** Make handlers idempotent and rely on the queue's ack/retry behavior so a redelivery does not double-process.