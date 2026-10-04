import assert from "node:assert/strict";
import { deliveryPlan, NotificationRequest } from "./notification_service.js";

const input = NotificationRequest.parse({ creatorId: "c1", productId: "p1", downloadUrl: "https://store.example/p1", subscribers: [{ id: "s1", email: "s1@example.com" }, { id: "s2", email: "s2@example.com" }] });
const plan = deliveryPlan(input);
assert.equal(plan.length, 2);
assert.deepEqual(plan.map((item) => item.eventId), ["p1:s1", "p1:s2"]);
assert.equal(plan[0].downloadUrl, "https://store.example/p1");
console.log("delivery plan test passed");
