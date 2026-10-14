// Truffled site mirror. Serves locally cached copies first and fetches uncached
// paths from the public website so the original pages and assets stay unchanged.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const tls = require('node:tls');
const {Readable} = require('node:stream');
const {once} = require('node:events');

const PORT = Number(process.env.PORT || 3000);
const ORIGIN = 'https://truffled.lol';
const CACHE = path.join(__dirname, 'site-cache');
const MAX_CACHE_BYTES = 5 * 1024 * 1024;

function cachePaths(url) {
  const pathname = decodeURIComponent(url.pathname);
  const parts = pathname.split('/').filter(Boolean);
  if (parts.some(part => part === '..' || part === '.')) return null;
  let relative = parts.length ? parts.join('/') : 'index.html';
  if (url.search) relative += '--' + crypto.createHash('sha256').update(url.search).digest('hex').slice(0, 16);
  return {body: path.join(CACHE, relative), meta: path.join(CACHE, '.headers', relative + '.json')};
}
function send(res, status, headers, body, pathname = '') {
  // Turn ads off before any of the original page scripts run. Keep the hidden
  // settings controls in the DOM because the original settings script uses them.
  const contentType = headers['content-type'] || '';
  // The original site sends cross-origin isolation headers. Dropping them made
  // SharedArrayBuffer-based games and tools fail even in a direct HTTPS tab.
  if (pathname && !pathname.startsWith('/api/')) {
    headers['cross-origin-resource-policy'] ??= 'cross-origin';
    if (contentType.includes('text/html')) {
      headers['cross-origin-opener-policy'] ??= 'same-origin';
      headers['cross-origin-embedder-policy'] ??= 'credentialless';
    }
  }
  if (contentType.includes('text/html') && !/^\/(studying|games|gamefile|api)\//.test(pathname)) {
    const injection = '<script>try{localStorage.setItem("adsEnabled","false")}catch(e){}</script>' +
      '<style>#adsettings{display:none!important}</style>' +
      '<script src="/branding.js"></script>';
    const html = Buffer.from(body).toString('utf8').replace(
      /(<title[^>]*>)([^<]*)(<\/title>)/gi,
      (_, open, title, close) => open + title.replace(/truffled/gi, 'Thetuber79') + close
    );
    body = Buffer.from(html.replace(/<head(\s[^>]*)?>/i, match => match + injection));
  }
  headers['content-length'] = Buffer.byteLength(body);
  res.writeHead(status, headers);
  res.end(body);
}
function safeHeaders(headers) {
  const forwarded = {};
  for (const key of ['content-type', 'cache-control', 'last-modified', 'etag', 'accept-ranges', 'content-range', 'cross-origin-opener-policy', 'cross-origin-embedder-policy', 'cross-origin-resource-policy']) {
    const value = headers.get(key);
    if (value) forwarded[key] = value;
  }
  // Do not forward CSP, HSTS, or Content-Encoding: fetch has decoded the body.
  return forwarded;
}
const server = http.createServer(async (req, res) => {
  if (req.url === '/__mirror_health') return send(res, 200, {'content-type':'text/plain'}, 'ok');
  let url, files;
  try {
    url = new URL(req.url, ORIGIN);
    // An absolute-form request must never turn this public mirror into an
    // open proxy or allow requests to internal/private hosts.
    if (url.origin !== ORIGIN) return send(res, 400, {}, 'Invalid host');
    files = cachePaths(url);
  } catch { return send(res, 400, {}, 'Bad URL'); }
  if (!files) return send(res, 400, {}, 'Invalid path');
  if (url.pathname === '/branding.js') {
    return send(res, 200, {'content-type':'application/javascript; charset=utf-8', 'cache-control':'no-store'}, fs.readFileSync(path.join(__dirname, 'branding.js')));
  }
  // Host the launch page on our own isolated HTTPS origin. A Google Sites
  // embed itself cannot grant the game proxy a first-party service worker.
  if (url.pathname === '/davids-web-launcher.html') {
    return send(res, 200, {'content-type':'text/html; charset=utf-8', 'cache-control':'no-store'}, fs.readFileSync(path.join(__dirname, 'davids-web-launcher.html')), url.pathname);
  }
  // The original ad loader injects two external advertising scripts. Never
  // serve it, even if an old page or browser cache still requests this path.
  if (url.pathname === '/js/ads.js') {
    return send(res, 200, {'content-type':'application/javascript; charset=utf-8'}, '// Ads removed from this mirror.\n');
  }
  const cacheable = req.method === 'GET' && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/wisp/');
  if (cacheable && !req.headers.range && fs.existsSync(files.body) && fs.existsSync(files.meta)) {
    const meta = JSON.parse(fs.readFileSync(files.meta, 'utf8'));
    // Older builds accidentally cached 206 Range responses (sometimes ONE
    // BYTE) as complete pages. Never serve those poisoned cache entries.
    if (meta.status === 200 && !meta.headers['content-range']) {
      return send(res, meta.status, {...meta.headers, 'x-mirror-source':'local-cache'}, fs.readFileSync(files.body), url.pathname);
    }
  }
  try {
    const chunks=[];
    for await (const chunk of req) chunks.push(chunk);
    const input=Buffer.concat(chunks);
    const headers={};
    if (req.headers['content-type']) headers['content-type']=req.headers['content-type'];
    if (req.headers['accept']) headers.accept=req.headers['accept'];
    if (req.headers['range']) headers.range=req.headers['range'];
    const isMusicMedia = url.pathname.startsWith('/api/music/media/');
    const upstream = await fetch(url.href, {
      method:req.method,
      headers,
      body: ['GET','HEAD'].includes(req.method) ? undefined : input,
      redirect:'manual',
      signal:AbortSignal.timeout(isMusicMedia || /^\/(games|gamefile|tools|extra)\//.test(url.pathname) ? 180000 : 45000)
    });
    // Audio players request partial content and may seek repeatedly. Relay the
    // original 206 response, Content-Range, and audio stream without buffering
    // the entire song. That keeps playback and seeking responsive.
    if (isMusicMedia && upstream.ok && upstream.body) {
      const mediaHeaders = safeHeaders(upstream.headers);
      const length = upstream.headers.get('content-length');
      if (length && !upstream.headers.get('content-encoding')) mediaHeaders['content-length'] = length;
      res.writeHead(upstream.status, mediaHeaders);
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = Readable.fromWeb(upstream.body);
      stream.on('error', error => res.destroy(error));
      res.on('close', () => stream.destroy());
      stream.pipe(res);
      return;
    }
    const outHeaders=safeHeaders(upstream.headers);
    if (upstream.status >= 300 && upstream.status < 400) {
      let location = upstream.headers.get('location') || '/';
      if (location.startsWith(ORIGIN)) location = location.slice(ORIGIN.length) || '/';
      outHeaders.location=location;
    }
    // Buffer only small responses. Large WASM/game files used to be held in
    // memory in full, causing proxy timeouts and out-of-memory failures.
    const responseChunks=[];
    let size=0, streaming=false;
    if (upstream.body && req.method !== 'HEAD') {
      for await (const chunk of upstream.body) {
        if (res.destroyed) break;
        if (!streaming) {
          responseChunks.push(Buffer.from(chunk));
          size += chunk.length;
          if (size <= MAX_CACHE_BYTES) continue;
          streaming=true;
          // Streaming responses do not know their final decoded length.
          // Range responses keep their Content-Range and 206 status.
          res.writeHead(upstream.status, outHeaders);
          for (const buffered of responseChunks) {
            if (!res.write(buffered)) await once(res, 'drain');
          }
          responseChunks.length=0;
        } else if (!res.write(chunk)) await once(res, 'drain');
      }
    }
    if (streaming) { if (!res.destroyed) res.end(); return; }
    if (res.destroyed) return;
    const body=Buffer.concat(responseChunks, size);
    // Only complete 200 GETs can be reused; 206 responses MUST NOT poison
    // the cache even if requested with a Range of just one byte.
    if (cacheable && !req.headers.range && upstream.status === 200 &&
        !upstream.headers.has('content-range') && body.length < MAX_CACHE_BYTES &&
        !url.searchParams.has('url')) {
      fs.mkdirSync(path.dirname(files.body), {recursive:true});
      fs.mkdirSync(path.dirname(files.meta), {recursive:true});
      fs.writeFileSync(files.body, body);
      fs.writeFileSync(files.meta, JSON.stringify({status:upstream.status, headers:outHeaders}));
    }
    send(res, upstream.status, outHeaders, body, url.pathname);
  } catch (err) {
    send(res, 502, {'content-type':'text/plain; charset=utf-8'},
      'This part of the mirror could not be loaded from truffled.lol. Please try again when the original site is reachable.\n'+err.message);
  }
});
// Default: keep the proven upstream WISP tunnel. On an opt-in canary only,
// run WISP locally so the browser's WebSocket has no extra Truffled TLS hop.
const WISP_MODE = process.env.WISP_MODE === 'local' ? 'local' : 'relay';
const WISP_TEST_HOST = process.env.WISP_TEST_HOST || '';
let localWisp;
if (WISP_MODE === 'local') {
  if (!WISP_TEST_HOST) throw new Error('WISP_TEST_HOST must be set in local mode');
  localWisp = require('@mercuryworkshop/wisp-js/server').server;
  localWisp.options.dns_method = 'resolve';
  localWisp.options.dns_servers = ['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4'];
  localWisp.options.dns_result_order = 'ipv4first';
  localWisp.options.allow_udp_streams = true;
  localWisp.options.allow_private_ips = false;
  localWisp.options.allow_loopback_ips = false;
  localWisp.options.stream_limit_total = 96;
  // In wisp-js 0.4.1 this particular per-host option throws on first use.
  localWisp.options.stream_limit_per_host = -1;
}
let activeLocalWisp = 0;
const activePerIp = new Map();
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/wisp/')) {
    socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    return;
  }
  if (WISP_MODE === 'local') {
    // This is intentionally limited to the named canary service. A production
    // WISP deployment needs additional abuse controls and a security review.
    const expectedOrigin = WISP_TEST_HOST.startsWith('127.0.0.1:')
      ? 'http://' + WISP_TEST_HOST : 'https://' + WISP_TEST_HOST;
    if (req.headers.host !== WISP_TEST_HOST || req.headers.origin !== expectedOrigin) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    const ip = String(req.headers['x-forwarded-for'] || socket.remoteAddress || '').split(',')[0].trim();
    if (activeLocalWisp >= 16 || (activePerIp.get(ip) || 0) >= 4) {
      socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      return;
    }
    activeLocalWisp++;
    activePerIp.set(ip, (activePerIp.get(ip) || 0) + 1);
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeLocalWisp--;
      const remaining = (activePerIp.get(ip) || 1) - 1;
      if (remaining) activePerIp.set(ip, remaining);
      else activePerIp.delete(ip);
    };
    socket.once('close', release);
    try { localWisp.routeRequest(req, socket, head); }
    catch (error) { console.error('Local WISP upgrade:', error); release(); socket.destroy(); }
    return;
  }
  // Normal mode relays the original WISP connection with no payload changes.
  const remote = tls.connect({host:'truffled.lol', port:443, servername:'truffled.lol'});
  const fail = () => { socket.destroy(); remote.destroy(); };
  remote.on('error', fail);
  socket.on('error', () => remote.destroy());
  remote.on('secureConnect', () => {
    const headers = {...req.headers, host:'truffled.lol', origin:'https://truffled.lol'};
    const request = [`GET ${req.url} HTTP/1.1`, ...Object.entries(headers).map(([key,value]) => `${key}: ${value}`), '', ''].join('\r\n');
    remote.write(request);
    if (head.length) remote.write(head);
    socket.pipe(remote);
    remote.pipe(socket);
  });
});
server.listen(PORT, '0.0.0.0', () => console.log(`Thetuber79 mirror at http://0.0.0.0:${PORT}`));
