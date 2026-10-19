"""Render the original SVG app icons to the PNG format used by Tizen."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROME_EXECUTABLE') or None)
    page = browser.new_page(viewport={'width': 512, 'height': 512}, device_scale_factor=1)
    for app in ['launcher', 'cinema']:
        svg = (root / app / 'icon.svg').read_text(encoding='utf-8')
        page.set_content('<style>html,body{margin:0;background:transparent}</style>' + svg)
        page.locator('svg').screenshot(path=str(root / app / 'icon.png'), omit_background=True)
        print('Rendered', app + '/icon.png')
    browser.close()
