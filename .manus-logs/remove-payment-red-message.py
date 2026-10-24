from pathlib import Path
path = Path('/home/ubuntu/qatar-curves-store/client/src/pages/CheckoutPage.tsx')
text = path.read_text()
needle = '{error && <p className="text-sm text-[#8d2430]">{error}</p>}'
if text.count(needle) != 1:
    raise SystemExit(f'Expected exactly one payment error message, found {text.count(needle)}')
path.write_text(text.replace(needle, '', 1))
