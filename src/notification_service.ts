import { z } from "zod";
import { infrai } from "./infrai_client.js";

export const NotificationRequest = z.object({
  creatorId: z.string().min(1), productId: z.string().min(1), downloadUrl: z.string().url(),
  subscribers: z.array(z.object({ id: z.string().min(1), email: z.string().email() })).min(1)
});
export type NotificationRequest = z.infer<typeof NotificationRequest>;

export function deliveryPlan(input: NotificationRequest) {
  return input.subscribers.map((subscriber) => ({ eventId: `${input.productId}:${subscriber.id}`, creatorId: input.creatorId, productId: input.productId, subscriberId: subscriber.id, email: subscriber.email, downloadUrl: input.downloadUrl }));
}

export async function fanOut(raw: unknown) {
  const input = NotificationRequest.parse(raw);
  const messages = deliveryPlan(input);
  const published = [];
  for (const payload of messages) published.push(await infrai.queue.publish(payload));
  return { productId: input.productId, subscriberCount: published.length, messageIds: published.map((item) => item.message_id) };
}

export async function processBatch() {
  const result = await infrai.queue.consume(20, 60);
  for (const message of result.messages ?? []) await infrai.queue.ack(message.message_id);
  return result.messages?.length ?? 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sample = { creatorId: "creator_42", productId: "ebook_7", downloadUrl: "https://store.example/download/ebook_7", subscribers: [{ id: "buyer_1", email: "buyer@example.com" }] };
  console.log(await fanOut(sample));
}
