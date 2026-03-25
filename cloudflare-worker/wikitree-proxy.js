/**
 * Cloudflare Worker — WikiTree API proxy
 *
 * Forwards GET requests to api.wikitree.com/api.php and adds
 * Access-Control-Allow-Origin so browser clients on any origin can call it.
 *
 * Deploy:
 *   npx wrangler deploy cloudflare-worker/wikitree-proxy.js --name wikitree-proxy
 *
 * Then set VITE_WIKITREE_PROXY=https://wikitree-proxy.<your-subdomain>.workers.dev
 * in demo/.env.production before running `npm run build:demo`.
 */

const WIKITREE_API = 'https://api.wikitree.com/api.php';

const ALLOWED_ORIGINS = [
  'https://conormag.github.io',
];

export default {
  async fetch(request, _env, _ctx) {
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

    // Forward query string to WikiTree
    const incoming = new URL(request.url);
    const target = new URL(WIKITREE_API);
    target.search = incoming.search;

    let wikitreeResponse;
    try {
      wikitreeResponse = await fetch(target.toString());
    } catch {
      return new Response('Failed to reach WikiTree API', { status: 502 });
    }

    const body = await wikitreeResponse.text();

    return new Response(body, {
      status: wikitreeResponse.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        ...corsHeaders(origin),
      },
    });
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
