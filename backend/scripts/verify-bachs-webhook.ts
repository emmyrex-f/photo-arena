import assert from "node:assert/strict";
import { BachsPaymentProvider } from "../src/payments/bachs-payment.provider";
import {
  signBachsWebhookForTest,
  verifyBachsWebhookSignature,
} from "../src/payments/bachs-webhook";
import { parseBachsWebhookEvent } from "../src/payments/parse-bachs-webhook";
import { decimalToKobo, providerAmountMatches } from "../src/payments/payment-amount";

async function main() {
  const secret = "whsec_test_photo_arena";
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    id: "evt_test_duplicate_1",
    type: "collection.succeeded",
    created_at: new Date().toISOString(),
    organization_id: "acct_test",
    data: {
      charge_id: "chr_test",
      checkout_id: "chk_test",
      reference: "PA-TEST-001",
      status: "SUCCEEDED",
      amount: "57000.00",
      currency: "NGN",
      metadata: { reference: "PA-TEST-001" },
    },
  });

  const signed = signBachsWebhookForTest(payload, secret, now);

  assert.equal(
    verifyBachsWebhookSignature(
      payload,
      secret,
      { signatureV2: signed.signatureV2 },
      { nowSeconds: now },
    ),
    true,
    "v2 signature should verify",
  );

  assert.equal(
    verifyBachsWebhookSignature(
      payload,
      secret,
      { signature: signed.signature, timestamp: signed.timestamp },
      { nowSeconds: now },
    ),
    true,
    "legacy signature should verify",
  );

  assert.equal(
    verifyBachsWebhookSignature(
      payload,
      secret,
      { signatureV2: signed.signatureV2 },
      { nowSeconds: now + 600 },
    ),
    false,
    "stale timestamp should fail",
  );

  assert.equal(
    verifyBachsWebhookSignature(
      payload,
      "wrong-secret",
      { signatureV2: signed.signatureV2 },
      { nowSeconds: now },
    ),
    false,
    "wrong secret should fail",
  );

  assert.equal(
    verifyBachsWebhookSignature(
      `${payload} `,
      secret,
      { signatureV2: signed.signatureV2 },
      { nowSeconds: now },
    ),
    false,
    "tampered body should fail",
  );

  const provider = new BachsPaymentProvider("sk_sandbox_test", secret);
  const succeeded = await provider.parseWebhook({
    rawBody: payload,
    signatureV2: signed.signatureV2,
  });
  assert.equal(succeeded.success, true);
  assert.equal(succeeded.reference, "PA-TEST-001");
  assert.equal(succeeded.providerSessionId, "chk_test");
  assert.equal(succeeded.amount, "57000.00", "amount extracted from data.amount");
  assert.equal(succeeded.currency, "NGN", "currency extracted from data.currency");
  assert.equal(succeeded.transactionId, "chr_test");

  // checkout.completed only counts as paid when data.payment_status === "paid".
  const completedPaid = JSON.stringify({
    id: "evt_completed_paid",
    type: "checkout.completed",
    data: {
      checkout_id: "chk_cp",
      reference: "PA-CP",
      payment_status: "paid",
      amount: "57000.00",
      currency: "NGN",
      charge: { id: "ch_cp", status: "succeeded" },
    },
  });
  const cp = await provider.parseWebhook({
    rawBody: completedPaid,
    signatureV2: signBachsWebhookForTest(completedPaid, secret, now).signatureV2,
  });
  assert.equal(cp.success, true, "checkout.completed + paid → success");
  assert.equal(cp.transactionId, "ch_cp", "charge.id used as transaction id");

  const completedUnpaid = JSON.stringify({
    id: "evt_completed_unpaid",
    type: "checkout.completed",
    data: { checkout_id: "chk_cu", reference: "PA-CU", payment_status: "no_payment_required", charge: null },
  });
  const cu = await provider.parseWebhook({
    rawBody: completedUnpaid,
    signatureV2: signBachsWebhookForTest(completedUnpaid, secret, now).signatureV2,
  });
  assert.equal(cu.success, false, "checkout.completed without payment must not be success");
  assert.equal(cu.failed, false);

  assert.equal(decimalToKobo("57000.00"), 5_700_000);
  assert.equal(decimalToKobo("57000"), 5_700_000);
  assert.equal(decimalToKobo("57000.5"), 5_700_050);
  assert.equal(decimalToKobo("57,000.00"), null);
  assert.equal(decimalToKobo("57000.005"), null);
  const frozen = { amountKobo: 5_700_000, currency: "NGN" };
  assert.equal(providerAmountMatches(frozen, "57000.00", "NGN").ok, true);
  assert.equal(providerAmountMatches(frozen, undefined, undefined).ok, true, "no amount → cannot judge");
  assert.equal(providerAmountMatches(frozen, "56999.99", "NGN").ok, false);
  assert.equal(providerAmountMatches(frozen, "57000.00", "USD").ok, false);
  assert.equal(providerAmountMatches(frozen, "abc", "NGN").ok, false, "unparseable → fail closed");

  const shared = parseBachsWebhookEvent(
    { rawBody: payload, signatureV2: signed.signatureV2 },
    secret,
  );
  assert.equal(shared.success, true);
  assert.equal(shared.eventId, "evt_test_duplicate_1");

  const failedPayload = JSON.stringify({
    id: "evt_failed",
    type: "collection.failed",
    data: { checkout_id: "chk_fail", reference: "PA-FAIL", status: "FAILED" },
  });
  const failedSigned = signBachsWebhookForTest(failedPayload, secret, now);
  const failed = await provider.parseWebhook({
    rawBody: failedPayload,
    signatureV2: failedSigned.signatureV2,
  });
  assert.equal(failed.failed, true);
  assert.equal(failed.success, false);

  const abandonedPayload = JSON.stringify({
    id: "evt_abandoned",
    type: "collection.abandoned",
    data: { checkout_id: "chk_ab", reference: "PA-AB", status: "ABANDONED" },
  });
  const abandonedSigned = signBachsWebhookForTest(abandonedPayload, secret, now);
  const abandoned = await provider.parseWebhook({
    rawBody: abandonedPayload,
    signatureV2: abandonedSigned.signatureV2,
  });
  assert.equal(abandoned.abandoned, true);

  const expiredPayload = JSON.stringify({
    id: "evt_expired",
    type: "checkout.expired",
    data: { checkout_id: "chk_exp", reference: "PA-EXP" },
  });
  const expiredSigned = signBachsWebhookForTest(expiredPayload, secret, now);
  const expired = await provider.parseWebhook({
    rawBody: expiredPayload,
    signatureV2: expiredSigned.signatureV2,
  });
  assert.equal(expired.abandoned, true);
  assert.equal(expired.success, false);

  try {
    await provider.parseWebhook({
      rawBody: payload,
      signatureV2: "t=1,v1=deadbeef",
    });
    assert.fail("expected invalid signature to throw");
  } catch (error) {
    assert.match(String(error), /signature/i);
  }

  console.log("Bachs webhook signature + event parsing verified.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
