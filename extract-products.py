from bs4 import BeautifulSoup
from pathlib import Path
import json

html = Path('/home/ubuntu/browser_html/kwcurves_com_page_1786823624994.html').read_text(encoding='utf-8', errors='ignore')
soup = BeautifulSoup(html, 'html.parser')
items = []
for card in soup.select('li.product, .rey-productInner'):
    title = card.select_one('.woocommerce-loop-product__title')
    link = card.select_one('a.woocommerce-LoopProduct-link')
    price = card.select_one('.woocommerce-Price-amount')
    image = card.select_one('img.rey-thumbImg') or card.select_one('img')
    if not title or not link or not image:
        continue
    name = title.get_text(' ', strip=True)
    href = link.get('href', '')
    src = image.get('src', '')
    price_text = price.get_text(' ', strip=True) if price else ''
    if name and href and src and not any(item['href'] == href for item in items):
        items.append({'name': name, 'href': href, 'image': src, 'price': price_text})
Path('/home/ubuntu/qatar-curves-store/best-sellers.json').write_text(json.dumps(items[:24], ensure_ascii=False, indent=2), encoding='utf-8')
for item in items[:24]:
    print(item['name'], '|', item['price'], '|', item['image'])
