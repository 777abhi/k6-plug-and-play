import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

let nextId = 3;
const users = [
  { id: 1, name: 'Alice Johnson', email: 'alice.johnson@example.com' },
  { id: 2, name: 'Bob Smith', email: 'bob.smith@example.com' },
];

const sendJson = (res, status, data) => {
  const body = data === null ? '' : JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => resolve(raw));
  });

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0];
  const method = req.method || 'GET';

  if (method === 'GET' && url === '/health') {
    return sendJson(res, 200, { status: 'ok' });
  }

  if (method === 'POST' && url === '/oauth/token') {
    await readBody(req);
    return sendJson(res, 200, {
      access_token: 'mock-jwt-access-token',
      token_type: 'Bearer',
      expires_in: 300,
    });
  }

  if (REQUIRE_AUTH) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
  }

  if (url === '/users' && method === 'GET') {
    return sendJson(res, 200, users);
  }

  if (url === '/users' && method === 'POST') {
    const raw = await readBody(req);
    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }
    const created = {
      id: nextId++,
      name: parsed.name || 'Unnamed',
      email: parsed.email || 'user@example.com',
    };
    users.push(created);
    return sendJson(res, 201, created);
  }

  const userMatch = url.match(/^\/users\/(\d+)$/);
  if (userMatch) {
    const id = Number(userMatch[1]);
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) {
      return sendJson(res, 404, { error: 'User not found' });
    }

    if (method === 'PUT' || method === 'PATCH') {
      const raw = await readBody(req);
      let parsed;
      try {
        parsed = raw ? JSON.parse(raw) : {};
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
      users[idx] = { ...users[idx], ...parsed, id };
      return sendJson(res, 200, users[idx]);
    }

    if (method === 'DELETE') {
      users.splice(idx, 1);
      res.writeHead(204);
      return res.end();
    }
  }

  return sendJson(res, 404, { error: `Route not found: ${method} ${url}` });
});

server.listen(PORT, () => {
  console.log(`Mock API server listening on http://localhost:${PORT}`);
});
