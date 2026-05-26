import { runComplianceStream } from './runner';

interface Env {
  ASSETS: Fetcher;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function notFound(): Response {
  return new Response(JSON.stringify({ error: 'Not Found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  let pathname = url.pathname;
  const hasFileExtension = /\.[a-z0-9]+$/i.test(pathname);

  if (!hasFileExtension) {
    pathname = pathname.endsWith('/') ? `${pathname}index.json` : `${pathname}/index.json`;
  }

  const assetUrl = new URL(pathname, url.origin);
  const response = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));

  const contentType = response.headers.get('Content-Type') || '';
  if (response.status !== 200 || contentType.includes('text/html')) {
    return notFound();
  }

  const headers = new Headers(response.headers);
  if (!hasFileExtension) {
    headers.set('Content-Type', 'application/json');
  }
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }

  return new Response(response.body, { status: response.status, headers });
}

async function handleCompliance(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get('target');
  if (!target) {
    return new Response('missing ?target= parameter', { status: 400 });
  }

  const apiRoot = target.replace(/\/$/, '');

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      for await (const event of runComplianceStream(apiRoot)) {
        await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...CORS_HEADERS,
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/compliance' && url.searchParams.has('target')) {
      return handleCompliance(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
