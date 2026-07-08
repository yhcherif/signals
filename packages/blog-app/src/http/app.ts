import type { Signals } from '@youssoufcherif/signals-core';
import { Hono } from 'hono';
import type { NewPost, Post } from '../domain/post.js';
import { observability } from './middleware/observability.js';
import type { ObservabilityVariables } from './middleware/observability.js';
import { createPost, getPost, listPosts } from './routes/posts.js';

type PostReaderWriter = {
  findAll: () => Promise<Post[]>;
  findById: (id: string) => Promise<Post | undefined>;
  create: (input: NewPost) => Promise<Post>;
};

export type AppDeps = {
  signals: Signals;
  repo: PostReaderWriter;
};

/**
 * The composition root's job: wire dependencies in, wire nothing else.
 * `createApp` never imports `signals-memory`, `-node`, or `-opentelemetry`
 * - it receives whatever `Signals` the caller built (see server.ts) and
 * never imports `in-memory-post-repository.ts` either - it receives
 * whatever satisfies `PostReaderWriter` structurally.
 */
export function createApp(deps: AppDeps) {
  const app = new Hono<{ Variables: ObservabilityVariables }>();

  app.use('*', observability(deps.signals));

  app.get('/posts', listPosts(deps.repo));
  app.get('/posts/:id', getPost(deps.repo));
  app.post('/posts', createPost(deps.repo));

  return app;
}
