import type { Context } from 'hono';
import type { NewPost, Post } from '../../domain/post.js';
import type { ObservabilityVariables } from '../middleware/observability.js';

type AppContext = Context<{ Variables: ObservabilityVariables }>;

/**
 * Each handler below declares its own local, minimal interface for the
 * repository capability it actually uses - not a shared `PostRepository`
 * type imported from the adapter. `listPosts` and `getPost` both need
 * "the ability to read posts", so they each say so independently; if one
 * needed something the other didn't, that difference would show up here
 * directly instead of being hidden inside a shared, wider contract.
 * Any repository whose shape structurally matches satisfies this, with
 * zero import from `adapters/in-memory-post-repository.ts`.
 */

export function listPosts(repo: { findAll: () => Promise<Post[]> }) {
  return async (c: AppContext) => {
    const posts = await repo.findAll();
    return c.json(posts);
  };
}

export function getPost(repo: { findById: (id: string) => Promise<Post | undefined> }) {
  return async (c: AppContext) => {
    const id = c.req.param('id');
    if (!id) {
      return c.json({ error: 'not found' }, 404);
    }
    const post = await repo.findById(id);
    if (!post) {
      return c.json({ error: 'not found' }, 404);
    }
    return c.json(post);
  };
}

export function createPost(repo: { create: (input: NewPost) => Promise<Post> }) {
  return async (c: AppContext) => {
    const signals = c.get('signals');
    const body = await c.req.json<Partial<NewPost>>();
    const { title, body: content } = body;

    if (!title || !content) {
      signals.log.warn('rejected invalid post payload', { hasTitle: Boolean(title) });
      return c.json({ error: 'title and body are required' }, 400);
    }

    const post = await signals.trace.run('posts.create', async (ctx) => {
      ctx.trace.attribute('post.title', title);
      const created = await repo.create({ title, body: content });
      ctx.metric.counter('posts.created');
      return created;
    });

    return c.json(post, 201);
  };
}
