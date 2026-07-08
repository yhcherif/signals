import type { NewPost, Post } from '../domain/post.js';

/**
 * This is the ONLY adapter for post storage right now, but it follows the
 * same shape any future adapter (Postgres, SQLite, ...) would: a factory
 * function returning plain methods over closed-over state. Nothing here
 * is exported as a shared "PostRepository" interface for consumers to
 * import - callers declare their own minimal local interface for exactly
 * what they use (structural typing does the rest). See routes/posts.ts.
 */
export function makeInMemoryPostRepository() {
  const posts: Post[] = [];
  let idCounter = 0;

  return {
    findAll: async (): Promise<Post[]> => [...posts].reverse(),

    findById: async (id: string): Promise<Post | undefined> => posts.find((post) => post.id === id),

    create: async (input: NewPost): Promise<Post> => {
      const post: Post = {
        id: `post-${++idCounter}`,
        title: input.title,
        body: input.body,
        createdAt: new Date().toISOString(),
      };
      posts.push(post);
      return post;
    },
  };
}
