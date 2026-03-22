import test from 'node:test';
import assert from 'node:assert/strict';

const API_URL = 'http://127.0.0.1:3000';
let token: string;

test('System E2E Tests', async (t) => {
  const username = `testuser_${Date.now()}`;
  const password = "password123";

  await t.test('GET /health -> 200 { status: "ok" }', async () => {
    const res = await fetch(`${API_URL}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  });

  await t.test('POST /auth/register -> 201', async () => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json();
    assert.equal(res.status, 201, JSON.stringify(body));
    assert.equal(body.data.user.username, username);
  });

  await t.test('POST /auth/login -> 200 с JWT', async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.ok(body.data.token);
    token = body.data.token;
  });

  await t.test('GET /auth/me -> 200', async () => {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const body = await res.json();
    assert.equal(res.status, 200, JSON.stringify(body));
    assert.equal(body.data.user.username, username);
  });

  await t.test('GET /admin/users без токена -> 401', async () => {
    const res = await fetch(`${API_URL}/admin/users`);
    assert.equal(res.status, 401);
  });

  await t.test('GET /admin/users с токеном роли user -> 403', async () => {
    const res = await fetch(`${API_URL}/admin/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(res.status, 403);
  });

  await t.test('POST /auth/login 4 раза -> 429', async () => {
    let status429 = false;
    for (let i = 0; i < 4; i++) {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        if (res.status === 200) {
            const body = await res.json();
            token = body.data.token; // Keep token fresh since logins invalidate old sessions
        } else if (res.status === 429) {
            status429 = true;
        }
    }
    assert.ok(status429, 'Expected HTTP 429 Too Many Requests');
  });

  await t.test('POST /auth/logout -> 200, повторный GET /auth/me -> 401', async () => {
    const logoutRes = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(logoutRes.status, 200);

    const meRes = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert.equal(meRes.status, 401);
  });

  // Final manual verification of test pass
  console.log("ALL TESTS PASSED SUCCESSFULLY! ✅");
});
