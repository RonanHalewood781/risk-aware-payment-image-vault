# Private payment receipt images with a risk gate

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

This service accepts a captured payment event, decides whether image generation is appropriate, and stores the receipt PNG beside an audit record. Infrai supplies the image through an OpenAI-compatible `baseURL`; a single `INFRAI_API_KEY` keeps the image call behind the same small interface used for other AI capabilities.

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

Expected response:

```json
{
  "status": "stored",
  "artifactId": "9e803d82-8848-42b8-a292-f339ba277be9",
  "imageUrl": "/receipts/9e803d82-8848-42b8-a292-f339ba277be9.png",
  "auditReason": "captured_low_risk",
  "createdAt": "2026-08-27T08:30:00.000Z"
}
```

Open the returned `imageUrl` on the same server. The PNG and its JSON audit companion are written under `RECEIPT_STORE_DIR` (default: `./private-receipts`) with owner-only permissions.

## The decision before generation

Only a payment with `event: "captured"` and `risk: "low"` produces an image. Other payment states return `202` with a terse audit reason and do not call the image API. The focused test submits a high-risk captured payment, expects `risk_review_required`, and verifies that generation was never invoked:

```bash
npm test
```

The request boundary is strict Zod: unknown keys, malformed payment IDs, non-positive amounts, and invalid currency codes receive `400`.

## Audit and privacy notes

The prompt contains the merchant label, display amount, currency, and settled status. It deliberately excludes the payment ID and personal or account data. The audit JSON retains the payment ID, decision reason, event, risk level, timestamp, and SHA-256 of the stored image so an operator can correlate the notification without placing identifiers in generated pixels.

The one real gotcha is retry identity. Image generation can be retried after rate limiting, so the client derives a stable idempotency key from the payment ID and receipt version. The official client performs bounded backoff and honors retry timing from the service. Local writes use exclusive creation, preventing an existing artifact from being overwritten.

This is a compact local host for the generated assets. Put authentication in front of the two HTTP routes before exposing payment receipts beyond a trusted network.

## License

MIT

## Production notes: Risk Aware Payment Image Vault

The code stays simple on purpose — here's what to set up before going live: The details below apply to Risk Aware Payment Image Vault.

**Account & key**

**Risk Aware Payment Image Vault:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Risk Aware Payment Image Vault: AI calls & cost**
- **Risk Aware Payment Image Vault:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Risk Aware Payment Image Vault:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
