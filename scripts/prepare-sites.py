"""Prepare optional upstream clients locally; generated third-party code is not committed.

Requires esbuild (--esbuild or ESBUILD). Downloads the tested public client versions,
retains their normal request/response handling, and targets the TV's Chrome 69 engine.
No server keys, source URLs, issued tokens or user credentials are embedded.
"""
import argparse
import base64
import hashlib
import json
import os
import re
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.site-build'
OUTPUT = ROOT / 'cinema/site-clients'
INTEGRITY = json.loads((ROOT / 'third-party/site-client-integrity.json').read_text(encoding='utf-8'))
CLIENTS = {
    'cinejoy': ('https://cinejoy.pk/_app/immutable/chunks/DHJgaGwg.js',
                '80a227006dbb01e35ff166a6ed9d9cf14d981f9503db2e2f005332856732f9da'),
    'movy': ('https://www.movy.sx/_next/static/chunks/2l_bq_gylari1.js',
             'c68d6ccfc781cc82358c03fb3986c96ff390a0cfd4305e9972e5420b8e849885'),
}


def download(url, expected=None):
    expected = expected or INTEGRITY.get(url)
    if not expected:
        raise RuntimeError('Unreviewed upstream dependency; review before preparing this client version')
    target = CACHE / urlparse(url).netloc / urlparse(url).path.lstrip('/')
    if not target.exists():
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as response:
            data = response.read(2_000_001)
        if len(data) > 2_000_000:
            raise RuntimeError('Upstream client exceeded build download limit')
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    if expected and hashlib.sha256(target.read_bytes()).hexdigest() != expected:
        raise RuntimeError('Upstream client changed; review and retest before updating the pinned version')
    return target


def cinejoy():
    entry_url, checksum = CLIENTS['cinejoy']
    seen = set()

    def dependencies(url):
        if url in seen:
            return
        seen.add(url)
        if not url.startswith('https://cinejoy.pk/_app/immutable/'):
            raise RuntimeError('Unexpected upstream module origin')
        file = download(url, checksum if url == entry_url else None)
        for relative in re.findall(r'(?:from\s*|import\s*)[\"\x27](\.[^\"\x27]+\.js)[\"\x27]', file.read_text(encoding='utf-8')):
            dependencies(urljoin(url, relative))

    dependencies(entry_url)
    source = CACHE / 'cinejoy-entry.js'
    relative = './' + download(entry_url).relative_to(CACHE).as_posix()
    source.write_text('import {k as movie,l as series,e as servers} from ' + json.dumps(relative) + ';\n'
                      'window.NightSites.register("cinejoy",{movie:movie,series:series,servers:servers});\n', encoding='utf-8')
    return source


def movy():
    url, checksum = CLIENTS['movy']
    source = download(url, checksum).read_text(encoding='utf-8')
    match = re.search(r'\b8311,(e=>\{.*?\}),89079,', source, re.S)
    if not match or 'allServerProviders' not in match[1]:
        raise RuntimeError('Tested Movy client module was not found')
    # Retain the upstream provider client, using native fetch in place of ofetch.
    # The client obtains its own short-lived seed from the ordinary /seed endpoint.
    wrapper = r'''
(function(){
  var exported={},names=['miami','boise','vegas','reno','oakland','seattle','phoenix','atlanta','portland','austin','dallas','tampa','orlando','munich','berlin','paris','delhi','cancun'],provider={};
  names.forEach(function(n){provider[n.toUpperCase()]=n;});
  async function ofetch(url,options){
    options=options||{};var target=new URL(url);
    Object.keys(options.params||{}).forEach(function(k){var v=options.params[k];if(v!==undefined&&v!==null)target.searchParams.set(k,v);});
    var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},18000);
    try{var r=await fetch(target.href,{signal:controller.signal});if(!r.ok){var e=Error('Movy HTTP '+r.status);e.status=r.status;throw e;}
      return (r.headers.get('content-type')||'').indexOf('json')>=0?await r.json():await r.text();
    }finally{clearTimeout(timer);}
  }
  var modules={52543:{Provider:provider},19622:{ofetch:ofetch},39111:{STREAM_API_URL:'https://api.wecollege.net'},10686:{MediaType:{MOVIE:'movie',TV:'tv'}}};
  (__UPSTREAM__)({i:function(id){if(!modules[id])throw Error('Unsupported Movy client dependency');return modules[id];},s:function(values){for(var i=0;i<values.length;i+=3)exported[values[i]]=values[i+2];}});
  window.NightSites.register('movy',{providers:exported.allServerProviders});
})();
'''
    target = CACHE / 'movy-entry.js'
    target.write_text(wrapper.replace('__UPSTREAM__', match[1]), encoding='utf-8')
    return target


def cinejoy_wasm():
    try:
        return download('https://api.wing.st/crush.wasm')
    except urllib.error.HTTPError as error:
        if error.code != 403:
            raise
    # Use the site's normal browser context when its asset host declines a
    # non-browser download. No request headers or origin values are fabricated.
    from playwright.sync_api import sync_playwright
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=os.environ.get('CHROME_EXECUTABLE') or None)
        try:
            page = browser.new_page()
            page.goto('https://cinejoy.pk/', wait_until='domcontentloaded', timeout=30000)
            data = page.evaluate("async()=>{var r=await fetch('https://api.wing.st/crush.wasm');if(!r.ok)throw Error('WASM HTTP '+r.status);return Array.from(new Uint8Array(await r.arrayBuffer()))}")
        finally:
            browser.close()
    target = CACHE / 'api.wing.st/crush.wasm'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(bytes(data))
    if hashlib.sha256(target.read_bytes()).hexdigest() != INTEGRITY['https://api.wing.st/crush.wasm']:
        raise RuntimeError('Upstream WASM changed; review and retest before updating')
    return target


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--esbuild', default=os.environ.get('ESBUILD', 'esbuild'))
    parser.add_argument('--wasm-opt', default=os.environ.get('WASM_OPT', 'wasm-opt'))
    parser.add_argument('--wasm-input', type=Path, help='Original crush.wasm downloaded normally from Cinejoy (optional)')
    args = parser.parse_args()
    CACHE.mkdir(exist_ok=True)
    OUTPUT.mkdir(exist_ok=True)
    for name, prepare in [('cinejoy', cinejoy), ('movy', movy)]:
        entry = prepare()
        subprocess.run([args.esbuild, str(entry), '--bundle', '--format=iife', '--target=chrome69',
                        '--minify', '--legal-comments=inline', '--outfile=' + str(OUTPUT / (name + '.js'))], check=True)
        if name == 'cinejoy':
            wasm = args.wasm_input or cinejoy_wasm()
            if hashlib.sha256(wasm.read_bytes()).hexdigest() != INTEGRITY['https://api.wing.st/crush.wasm']:
                raise RuntimeError('Upstream WASM changed; review and retest before updating')
            lowered = CACHE / 'cinejoy-chrome69.wasm'
            subprocess.run([args.wasm_opt, str(wasm), '--enable-nontrapping-float-to-int', '--enable-sign-ext',
                            '--enable-bulk-memory', '--llvm-nontrapping-fptoint-lowering', '--signext-lowering',
                            '--llvm-memory-copy-fill-lowering', '-o', str(lowered)], check=True)
            blob = base64.b64encode(lowered.read_bytes()).decode()
            target = OUTPUT / 'cinejoy.js'
            # Scope this to the converted client. All ordinary API/media requests
            # retain native fetch; only its build-time-converted WASM asset is local.
            target.write_text('(function(){var normalFetch=window.fetch.bind(window);function fetch(url,options){'
                              'if(String(url).split("?")[0]==="https://api.wing.st/crush.wasm"){'
                              'var raw=atob(' + json.dumps(blob) + '),data=new Uint8Array(raw.length);'
                              'for(var i=0;i<raw.length;i++)data[i]=raw.charCodeAt(i);'
                              'return Promise.resolve(new Response(data,{headers:{"Content-Type":"application/wasm"}}));}'
                              'return normalFetch(url,options);}' + target.read_text(encoding='utf-8') + '\n})();', encoding='utf-8')
        print('Prepared', name, 'for Chrome 69')
