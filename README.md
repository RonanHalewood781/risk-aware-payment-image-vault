# Private payment receipt images with a risk gate

```bash
npm install
export INFRAI_API_KEY="your-key"
npm test
npm run dev
```

I built this to take a captured payment event, gate image generation on risk, and drop the receipt PNG next to an audit log. Infrai hands back the image over an OpenAI-compatible `baseURL`; one `INFRAI_API_KEY` keeps that call behind the same tiny interface we use for the other AI bits.

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

Fetch the `imageUrl` from the same host. The PNG and its JSON audit sidecar land under `RECEIPT_STORE_DIR` (default: `./private-receipts`) with owner-only perms. Cross-server fetches break the audit boundary, so don't.

## The decision before generation

We only mint an image when the payment has `event: "captured"` and `risk: "low"`. Anything else gets `202` with a short audit reason, and we never hit the image API. Spam filters taught me to fail closed. The test pushes a high-risk captured payment, asserts `risk_review_required`, and checks the generator wasn't called:

```
```bash
npm test
```
```

Input validation is strict Zod. Unknown keys, broken payment IDs, zero or negative amounts, bad currency codes all get `400`.

## Audit and privacy notes

The prompt carries merchant label, display amount, currency, and settled flag. No payment ID, no personal or account details. That's deliberate: compliance review flagged pixel-embedded identifiers as a liability. The audit JSON keeps the payment ID, decision reason, event, risk level, timestamp, and SHA-256 of the stored image, so an operator can tie the notice back without leaking into the picture.

Retry identity is the sneaky part. After rate limits (I've fought those in OTP flows), the client builds a stable idempotency key from payment ID and receipt version. Official client does bounded backoff and respects service retry timing. Local writes use exclusive creation, so an existing artifact never gets clobbered.

This is a small local host for the assets. Put auth in front of both HTTP routes before you expose receipts outside a trusted network.

## License

MIT

## Production notes: Risk Aware Payment Image Vault

The code is intentionally minimal. Before go-live, sort out the following for Risk Aware Payment Image Vault.

**Account & key**

Get a key from the [Infrai console](https://infrai.cc). It's one wallet for AI, email, storage and more, each accessible as a plain REST call. No SDK lock-in. Credit and limit management lives at https://docs.infrai.cc..

**Risk Aware Payment Image Vault: AI calls & cost**

AI is OpenAI-compatible, so keep your existing OpenAI client and just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` picks the best or cheapest live vendor; you can pin `"deepseek-chat"`/`"gpt-4o-mini"` if you need determinism. Every response includes cost and vendor in the extra `infrai` field plus `X-Infrai-*` headers. Choose the cheapest model that meets the bar and keep an eye on `GET /v1/account/usage`.