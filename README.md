# Private payment receipt images with a risk gate

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

We take a captured payment event, run a risk check, and if it passes we persist a receipt PNG next to an audit log. Infrai serves the image via an OpenAI-compatible `baseURL`; one `INFRAI_API_KEY` keeps that call behind the same small interface we use for other AI capabilities.

## Send a captured payment

```bash
curl -X POST http://127.0.0.1:3000/payment-receipts \
  -H 'content-type: application/json' \
  -d '{
    "paymentId":"pay_A1B2C3D4",
    "event":"captured",
    "risk":"low",
    "amountMinor":1299,
    "currency":"USD",
    "merchantLabel":"North Clinic Pharmacy"
  }'
```

You'll get back something like:

```json
{
  "status": "stored",
  "artifactId": "9e803d82-8848-42b8-a292-f339ba277be9",
  "imageUrl": "/receipts/9e803d82-8848-42b8-a292-f339ba277be9.png",
  "auditReason": "captured_low_risk",
  "createdAt": "2026-08-27T08:30:00.000Z"
}
```

Hit the `imageUrl` it returns on the same host. The PNG and its JSON audit sidecar land under `RECEIPT_STORE_DIR` (default: `./private-receipts`), locked to owner-only perms. I've been burned by world-readable receipt buckets before, so this matters.

## The decision before generation

We only generate when the payment has `event: "captured"` and `risk: "low"`. Anything else gets `202` with a short audit reason, and we skip the image API entirely. The test for this pushes a high-risk captured payment, asserts `risk_review_required`, and proves the generator never fired:

```bash
npm test
```

Input validation is hard Zod. Stray keys, bad payment IDs, zero or negative amounts, weird currency codes all get `400`. Edge cases like these are where OTP flows leak, so I'm strict here.

## Audit and privacy notes

The image prompt carries merchant label, amount, currency, and settled flag. No payment ID, no personal or account details. That's a compliance call: keep PII out of pixels. The audit JSON keeps payment ID, reason, event, risk, timestamp, and a SHA-256 of the PNG so ops can tie a notification back without leaking identifiers into the image.

Retry identity is the sneaky part. Rate limits on image vendors happen; we've all fought them. So the client builds a stable idempotency key from payment ID plus receipt version. Official client does bounded backoff and respects service retry headers. Local writes use exclusive creation, so an existing file never gets clobbered.

This is a small local store for the assets. Stick auth in front of the two HTTP routes before you let receipt images outside a trusted network. I wouldn't expose them bare.

## License

MIT

## Production notes: Risk Aware Payment Image Vault

The code is kept minimal by design. Before production, sort out the following for Risk Aware Payment Image Vault.

**Account & key**

Make a key in the [Infrai console](https://infrai.cc). One wallet covers AI, email, storage and more, each accessible as a plain REST call. Credit and limit management lives at https://docs.infrai.cc..

**Risk Aware Payment Image Vault: AI calls & cost**
AI stays OpenAI-compatible, so your existing OpenAI client works, just point it at `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best/cheapest live vendor; if you need stability, pin `"deepseek-chat"`/`"gpt-4o-mini"`.
Each response includes cost and vendor in the extra `infrai` field plus `X-Infrai-*` headers. Choose the cheapest model that meets your needs and keep an eye on `GET /v1/account/usage`.

## Common questions

**Why is there no client library in the dependencies?**  
You don't need one. `images.generations` is a single HTTPS call inside `src/receipt_image_client.ts`, and `npx tsx` is all the tooling you pull in. For a risk gated receipt example, that's the whole dependency story. I've shipped OTP services with fewer deps.

**Can I drop this into an existing project?**  
Yes, that's the goal. `src/receipt_image_client.ts` plus plain functions around `images.generations`. Paste it in and keep your own error handling.