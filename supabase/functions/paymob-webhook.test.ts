import {
  asString,
  calculateHmac,
  extractReference,
  findTransactionObject,
  secureEqual,
  valueAt,
} from "./paymob-webhook/index.ts";

Deno.test("asString renders booleans as lowercase true/false (Paymob requirement)", () => {
  if (asString(true) !== "true") throw new Error("expected 'true'");
  if (asString(false) !== "false") throw new Error("expected 'false'");
  if (asString(null) !== "") throw new Error("expected empty string for null");
  if (asString(2556706) !== "2556706") throw new Error("expected numeric string");
});

Deno.test("valueAt resolves nested paths", () => {
  const obj = { order: { id: 42, merchant_order_id: "mailcraft_x" }, source_data: { pan: "1234" } } as Record<string, unknown>;
  if (valueAt(obj, "order.id") !== 42) throw new Error("order.id");
  if (valueAt(obj, "source_data.pan") !== "1234") throw new Error("source_data.pan");
  if (valueAt(obj, "order.missing") !== undefined) throw new Error("missing should be undefined");
});

Deno.test("calculateHmac is deterministic and sensitive to field changes", async () => {
  const secret = "test_hmac_secret";
  const transaction = {
    amount_cents: 19900,
    created_at: "2020-03-25T18:39:44.719228",
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    id: 2556706,
    integration_id: 5212384,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: { id: 4778239, merchant_order_id: "mailcraft_user_uuid" },
    owner: 4705,
    pending: false,
    source_data: { pan: "2346", sub_type: "MasterCard", type: "card" },
    success: true,
  } as Record<string, unknown>;

  const a = await calculateHmac(transaction, secret);
  const b = await calculateHmac(transaction, secret);
  if (a !== b) throw new Error("HMAC should be deterministic");
  if (a.length !== 128) throw new Error("SHA-512 hex should be 128 chars");

  const tampered = { ...transaction, success: false } as Record<string, unknown>;
  const c = await calculateHmac(tampered, secret);
  if (await secureEqual(a, c)) throw new Error("HMAC should change when a field changes");

  if (!(await secureEqual(a, a))) throw new Error("secureEqual should match identical digests");
  if (await secureEqual(a, "deadbeef")) throw new Error("secureEqual should reject mismatch");
});

Deno.test("findTransactionObject prefers obj then transaction", () => {
  const withObj = { obj: { id: 1 }, transaction: { id: 2 } } as Record<string, unknown>;
  if (findTransactionObject(withObj).id !== 1) throw new Error("should pick obj first");
  const withTxn = { transaction: { id: 2 } } as Record<string, unknown>;
  if (findTransactionObject(withTxn).id !== 2) throw new Error("should pick transaction");
  const bare = { id: 3 } as Record<string, unknown>;
  if (findTransactionObject(bare).id !== 3) throw new Error("should fall back to body");
});

Deno.test("extractReference finds mailcraft_ reference across payload shapes", () => {
  const topLevel = { merchant_order_id: "mailcraft_abc" } as Record<string, unknown>;
  if (extractReference(topLevel) !== "mailcraft_abc") throw new Error("top-level merchant_order_id");

  const underOrder = { order: { merchant_order_id: "mailcraft_def" } } as Record<string, unknown>;
  if (extractReference(underOrder) !== "mailcraft_def") throw new Error("order.merchant_order_id");

  const special = { special_reference: "mailcraft_ghi" } as Record<string, unknown>;
  if (extractReference(special) !== "mailcraft_ghi") throw new Error("special_reference");

  const none = { merchant_order_id: "other_123" } as Record<string, unknown>;
  if (extractReference(none) !== undefined) throw new Error("non-mailcraft should be undefined");
});
