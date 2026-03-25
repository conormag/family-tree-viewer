/**
 * Cloudflare Worker — WikiTree API proxy
 *
 * Forwards GET requests to api.wikitree.com/api.php and adds
 * Access-Control-Allow-Origin so browser clients on any origin can call it.
 * Uses the Cloudflare Cache API to avoid repeated upstream requests.
 *
 * Deploy:
 *   npx wrangler deploy cloudflare-worker/wikitree-proxy.js --name wikitree-proxy
 *
 * Then set VITE_WIKITREE_PROXY=https://wikitree-proxy.<your-subdomain>.workers.dev
 * in demo/.env.production before running `npm run build:demo`.
 */

const WIKITREE_API = 'https://api.wikitree.com/api.php';
const CACHE_TTL = 300; // seconds — 5 minutes

const ALLOWED_ORIGINS = [
  'https://conormag.github.io',
];

export default {
  async fetch(request, _env, ctx) {
    const origin = request.headers.get('Origin') ?? '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Build the upstream URL
    const incoming = new URL(request.url);
    const target = new URL(WIKITREE_API);
    target.search = incoming.search;
    const cacheKey = new Request(target.toString());

    // Check Cloudflare cache first
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      const body = await cached.text();
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Cache': 'HIT',
          ...corsHeaders(origin),
        },
      });
    }

    // Fetch from WikiTree
    let wikitreeResponse;
    try {
      wikitreeResponse = await fetch(target.toString());
    } catch {
      return new Response('Failed to reach WikiTree API', {
        status: 502,
        headers: corsHeaders(origin),
      });
    }

    if (wikitreeResponse.status === 429) {
      return new Response('WikiTree rate limit reached — please wait a moment and try again', {
        status: 429,
        headers: corsHeaders(origin),
      });
    }

    if (!wikitreeResponse.ok) {
      return new Response(`WikiTree API error: HTTP ${wikitreeResponse.status}`, {
        status: wikitreeResponse.status,
        headers: corsHeaders(origin),
      });
    }

    const body = await wikitreeResponse.text();

    const response = new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_TTL}`,
        'X-Cache': 'MISS',
        ...corsHeaders(origin),
      },
    });

    // Store in cache asynchronously — don't block the response
    ctx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  },
};

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
