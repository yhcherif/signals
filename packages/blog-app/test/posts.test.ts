import { createMemorySignals } from '@youssoufcherif/signals-memory';
import { expectSpanEnded } from '@youssoufcherif/signals-testing';
import { describe, expect, it } from 'vitest';
import { makeInMemoryPostRepository } from '../src/adapters/in-memory-post-repository.js';
import { createApp } from '../src/http/app.js';

function setup() {
  const signals = createMemorySignals();
  const repo = makeInMemoryPostRepository();
  const app = createApp({ signals, repo });
  return { app, signals };
}

describe('blog-app: POST /posts', () => {
  it('creates a post and records the expected telemetry', async () => {
    const { app, signals } = setup();

    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Hello', body: 'World' }),
    });

    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({ title: 'Hello', body: 'World' });

    // HTTP-level span (from the observability middleware) and the
    // domain-level span (from inside the handler) both recorded and ended.
    expectSpanEnded(signals, 'http.POST /posts');
    expectSpanEnded(signals, 'posts.create');

    expect(signals.getMetrics().some((m) => m.name === 'posts.created')).toBe(true);

    const httpSpan = signals.getSpans().find((s) => s.name === 'http.POST /posts');
    expect(httpSpan?.attributes).toMatchObject({ 'http.method': 'POST', 'http.status': 201 });
  });

  it('rejects an invalid payload with 400 and logs a warning', async () => {
    const { app, signals } = setup();

    const res = await app.request('/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '' }),
    });

    expect(res.status).toBe(400);
    expect(signals.getLogs().some((l) => l.level === 'warn')).toBe(true);
  });
});

describe('blog-app: GET /posts', () => {
  it('lists created posts, newest first', async () => {
    const { app } = setup();

    await app.request('/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'First', body: '...' }),
    });
    await app.request('/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Second', body: '...' }),
    });

    const res = await app.request('/posts');
    const posts = await res.json();

    expect(posts).toHaveLength(2);
    expect(posts[0].title).toBe('Second');
  });
});

describe('blog-app: GET /posts/:id', () => {
  it('returns 404 for a missing post', async () => {
    const { app } = setup();
    const res = await app.request('/posts/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns a created post by id', async () => {
    const { app } = setup();
    const createRes = await app.request('/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Findable', body: '...' }),
    });
    const created = await createRes.json();

    const getRes = await app.request(`/posts/${created.id}`);
    expect(getRes.status).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.title).toBe('Findable');
  });
});
