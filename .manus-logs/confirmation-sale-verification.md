# Confirmation and sale verification

- Product page `/product/curves-6172` renders the discounted price **362 QAR**, original price **723 QAR** with strikethrough, and a **50% discount** badge in the mobile viewport.
- Home product cards render discount badges and old/new QAR prices.
- The six verification inputs accept rapid multi-field filling without losing digits.
- Clicking **تأكيد الطلب** enters the explicit loading state **جارٍ تأكيد الطلب** while the order API is processing.
- Direct API idempotency testing returned the same order number `QC-RETRYSAFETEST12345` across three repeated requests using the same client request id.

## Pending confirmation diagnosis

The confirmation button entered its loading state correctly, but the server log showed an abnormal flood of unauthenticated context requests. This indicates the visitor heartbeat is firing continuously instead of at a fixed interval, which can contend with the order mutation. The next correction is to stabilize the heartbeat effect before repeating the full browser confirmation test.

## Final resumed browser test

The verification page loaded from the current preview and a temporary discounted order was seeded using **362 QAR** sale price and **723 QAR** original price. No sensitive payment data was stored; only a test card brand and last four digits were used.
The refreshed verification page displayed all six inputs, and rapid filling produced the complete visible code `123456` with no lost digits.
After submitting the six-digit code, the order completed and the browser navigated to `/checkout/success`. The success page displayed **تمت العملية بنجاح**. This confirms the fixed heartbeat and database retry logic allow the complete checkout flow to finish.
Database verification returned the test order with `totalQar = 362`, Visa, and masked last four digits `4444`. Each generated order number had exactly one row. The server log now shows visitor heartbeat activity at approximately 30-second intervals instead of continuous requests.
