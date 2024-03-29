// Copyright 2022 the Deno authors. All rights reserved. MIT license.

/** @jsx h */
/// <reference no-default-lib="true"/>
/// <reference lib="dom" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />

import {
  callsites,
  createReporter,
  dirname,
  Feed,
  Fragment,
  fromFileUrl,
  frontMatter,
  gfmHeadingId,
  h,
  html,
  HtmlOptions,
  join,
  mangle,
  Marked,
  relative,
  removeMarkdown,
  serve,
  serveDir,
  walk,
} from "./deps.ts";
import { pooledMap } from "https://deno.land/std@0.193.0/async/pool.ts";
import { Index, NotFound, PostPage } from "./components.tsx";
import type { ConnInfo, FeedItem, marked } from "./deps.ts";
import type {
  BlogContext,
  BlogMiddleware,
  BlogSettings,
  BlogState,
  Post,
} from "./types.d.ts";
import { WalkEntry } from "https://deno.land/std@0.193.0/fs/walk.ts";
import { MATH_STYLE_URI, renderMath } from "./markedMiddleware/math.ts";

export { imageContainer } from "./markedMiddleware/imageContainer.ts";
export { highlight } from "./markedMiddleware/highlight.ts";

export { Fragment, h };

const IS_DEV = Deno.args.includes("--dev") && "watchFs" in Deno;
const POSTS = new Map<string, Post>();
const HMR_SOCKETS: Set<WebSocket> = new Set();

const HMR_CLIENT = `let socket;
let reconnectTimer;

const wsOrigin = window.location.origin
  .replace("http", "ws")
  .replace("https", "wss");
const hmrUrl = wsOrigin + "/hmr";

hmrSocket();

function hmrSocket(callback) {
  if (socket) {
    socket.close();
  }

  socket = new WebSocket(hmrUrl);
  socket.addEventListener("open", callback);
  socket.addEventListener("message", (event) => {
    if (event.data === "refresh") {
      console.log("refreshings");
      window.location.reload();
    }
  });

  socket.addEventListener("close", () => {
    console.log("reconnecting...");
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      hmrSocket(() => {
        window.location.reload();
      });
    }, 1000);
  });
}
`;

function errorHandler(err: unknown) {
  return new Response(`Internal server error: ${(err as Error)?.message}`, {
    status: 500,
  });
}

/** The main function of the library.
 *
 * ```jsx
 * import blog, { ga } from "https://deno.land/x/blog/blog.tsx";
 *
 * blog({
 *   title: "My Blog",
 *   description: "The blog description.",
 *   avatar: "./avatar.png",
 *   middlewares: [
 *     ga("GA-ANALYTICS-KEY"),
 *   ],
 * });
 * ```
 */
export default async function blog(settings?: BlogSettings) {
  const url = callsites()[1].getFileName()!;
  const blogState = await configureBlog(url, IS_DEV, settings);

  const blogHandler = createBlogHandler(blogState);
  serve(blogHandler, {
    port: blogState.port,
    hostname: blogState.hostname,
    onError: errorHandler,
  });
}

export function createBlogHandler(state: BlogState) {
  const inner = handler;
  const withMiddlewares = composeMiddlewares(state);
  return function handler(req: Request, connInfo: ConnInfo) {
    // Redirect requests that end with a trailing slash
    // to their non-trailing slash counterpart.
    // Ex: /about/ -> /about
    const url = new URL(req.url);
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
      return Response.redirect(url.href, 307);
    }
    return withMiddlewares(req, connInfo, inner);
  };
}

function composeMiddlewares(state: BlogState) {
  return (
    req: Request,
    connInfo: ConnInfo,
    inner: (req: Request, ctx: BlogContext) => Promise<Response>,
  ) => {
    const reset_marked: BlogMiddleware = (_req, ctx) => {
      ctx.__marked = undefined;

      return ctx.next();
    };

    const mws = [...(state.middlewares ?? []), reset_marked]?.slice().reverse();

    const handlers: (() => Response | Promise<Response>)[] = [];

    const ctx: BlogContext = {
      next() {
        const handler = handlers.shift()!;
        return Promise.resolve(handler());
      },
      connInfo,
      state,
      get marked() {
        if (this.__marked) {
          return this.__marked;
        }

        const marked = new Marked();
        marked.use(gfmHeadingId() as marked.MarkedExtension);
        marked.use(mangle() as marked.MarkedExtension);

        return this.__marked = marked;
      },
    };

    if (mws) {
      for (const mw of mws) {
        handlers.push(() => mw(req, ctx));
      }
    }

    handlers.push(() => inner(req, ctx));

    const handler = handlers.shift()!;
    return handler();
  };
}

export async function configureBlog(
  url: string,
  isDev: boolean,
  settings?: BlogSettings,
): Promise<BlogState> {
  let directory;

  try {
    const blogPath = fromFileUrl(url);
    directory = dirname(blogPath);
  } catch (e) {
    console.error(e);
    throw new Error("Cannot run blog from a remote URL.");
  }

  const state: BlogState = {
    directory,
    ...settings,
  };

  await loadContent(directory, isDev);

  return state;
}

async function loadContent(blogDirectory: string, isDev: boolean) {
  // Read posts from the current directory and store them in memory.
  const postsDirectory = join(blogDirectory, "posts");

  const traversal: WalkEntry[] = [];
  for await (const entry of walk(postsDirectory)) {
    if (entry.isFile && entry.path.endsWith(".md")) {
      traversal.push(entry);
    }
  }

  const pool = pooledMap(
    25,
    traversal,
    (entry) => loadPost(postsDirectory, entry.path),
  );

  for await (const _ of pool) {
    // noop
  }

  if (isDev) {
    watchForChanges(postsDirectory).catch(() => {});
  }
}

// Watcher watches for .md file changes and updates the posts.
async function watchForChanges(postsDirectory: string) {
  const watcher = Deno.watchFs(postsDirectory);
  for await (const event of watcher) {
    if (event.kind === "modify" || event.kind === "create") {
      for (const path of event.paths) {
        if (path.endsWith(".md")) {
          try {
            await loadPost(postsDirectory, path);
            HMR_SOCKETS.forEach((socket) => {
              socket.send("refresh");
            });
          } catch (err) {
            console.error(`loadPost ${path} error:`, err.message);
          }
        }
      }
    }
  }
}

async function loadPost(postsDirectory: string, path: string) {
  const contents = await Deno.readTextFile(path);
  let pathname = "/" + relative(postsDirectory, path);
  // Remove .md extension.
  pathname = pathname.slice(0, -3);

  const { body: content, attrs: _data } = frontMatter<Record<string, unknown>>(
    contents,
  );

  const data = recordGetter(_data);

  let snippet: string | undefined = data.get("snippet") ??
    data.get("abstract") ??
    data.get("summary") ??
    data.get("description");
  if (!snippet) {
    const maybeSnippet = content.split("\n\n")[0];
    if (maybeSnippet) {
      snippet = removeMarkdown(maybeSnippet.replace("\n", " "));
    } else {
      snippet = "";
    }
  }

  const publishDate = data.get("publish_date") || data.get("created");

  // Note: users can override path of a blog post using
  // pathname in front matter.
  pathname = data.get("pathname") ?? pathname;

  const post: Post = {
    title: (data.get("title") ?? "Untitled").toString(),
    author: data.get("author"),
    pathname,
    // Note: no error when publish_date is wrong or missed
    publishDate: publishDate instanceof Date ? publishDate! : new Date(),
    snippet,
    markdown: content,
    coverHtml: data.get("cover_html"),
    ogImage: data.get("og:image"),
    invert: Boolean(data.get("invert")),
    tags: [data.get("tags")].flat().filter((tag) => !!tag) as string[],
    readTime: readingTime(content),
    renderMath: data.get("render_math"),
  };

  if (POSTS.get(pathname)) {
    console.warn(`Duplicate blog post path: ${pathname}`);
  }
  POSTS.set(pathname, post);
}

export async function handler(
  req: Request,
  ctx: BlogContext,
) {
  const { state: blogState } = ctx;
  const { pathname, searchParams, origin } = new URL(req.url);
  const canonicalUrl = new URL(pathname, blogState.canonicalUrl || origin).href;
  const ogImage = typeof blogState.ogImage !== "string"
    ? blogState.ogImage?.url
    : blogState.ogImage;
  const twitterCard = typeof blogState.ogImage !== "string"
    ? blogState.ogImage?.twitterCard
    : "summary_large_image";

  if (pathname === "/feed") {
    return serveRSS(req, ctx, POSTS);
  }

  if (IS_DEV) {
    if (pathname == "/hmr.js") {
      return new Response(HMR_CLIENT, {
        headers: {
          "content-type": "application/javascript",
        },
      });
    }

    if (pathname == "/hmr") {
      const { response, socket } = Deno.upgradeWebSocket(req);
      HMR_SOCKETS.add(socket);
      socket.onclose = () => {
        HMR_SOCKETS.delete(socket);
      };

      return response;
    }
  }

  const scripts = blogState.scripts || [];

  const sharedHtmlOptions: HtmlOptions = {
    lang: blogState.lang ?? "en",
    scripts: IS_DEV ? [{ src: "/hmr.js" }, ...scripts] : scripts,
    styles: blogState.styles,
    links: [
      { href: canonicalUrl, rel: "canonical" },
      ...(blogState.headLinks ?? []),
    ],
  };

  const sharedMetaTags = {
    "theme-color": blogState.theme === "dark" ? "#000" : null,
  };

  if (typeof blogState.favicon === "string") {
    sharedHtmlOptions.links?.push({
      href: blogState.favicon,
      type: "image/x-icon",
      rel: "icon",
    });
  } else {
    if (blogState.favicon?.light) {
      sharedHtmlOptions.links?.push({
        href: blogState.favicon.light,
        type: "image/x-icon",
        media: "(prefers-color-scheme:light)",
        rel: "icon",
      });
    }

    if (blogState.favicon?.dark) {
      sharedHtmlOptions.links?.push({
        href: blogState.favicon.dark,
        type: "image/x-icon",
        media: "(prefers-color-scheme:dark)",
        rel: "icon",
      });
    }
  }

  if (pathname === "/") {
    return html({
      ...sharedHtmlOptions,
      title: blogState.title ?? "My Blog",
      meta: {
        ...sharedMetaTags,
        "description": blogState.description,
        "og:title": blogState.title,
        "og:description": blogState.description,
        "og:image": ogImage ?? blogState.cover,
        "twitter:title": blogState.title,
        "twitter:description": blogState.description,
        "twitter:image": ogImage ?? blogState.cover,
        "twitter:card": ogImage ? twitterCard : undefined,
      },
      body: (
        <Index
          state={blogState}
          posts={filterPosts(POSTS, searchParams)}
        />
      ),
    });
  }

  const post = POSTS.get(decodeURIComponent(pathname));
  if (post) {
    // Check for an Accept: text/plain header
    if (
      req.headers.has("Accept") && req.headers.get("Accept") === "text/plain"
    ) {
      return new Response(post.markdown);
    }
    return html({
      ...sharedHtmlOptions,
      title: post.title,
      meta: {
        ...sharedMetaTags,
        "description": post.snippet,
        "og:title": post.title,
        "og:description": post.snippet,
        "og:image": post.ogImage,
        "twitter:title": post.title,
        "twitter:description": post.snippet,
        "twitter:image": post.ogImage,
        "twitter:card": post.ogImage ? twitterCard : undefined,
      },
      links: [
        ...(sharedHtmlOptions.links ?? []),
        ...(post.renderMath
          ? [{ href: MATH_STYLE_URI, rel: "stylesheet" }]
          : []),
      ],
      body: <PostPage post={post} context={ctx} />,
    });
  }

  let fsRoot = blogState.directory;
  try {
    await Deno.lstat(join(blogState.directory, "./posts", pathname));
    fsRoot = join(blogState.directory, "./posts");
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      console.error(e);
      return new Response(e.message, { status: 500 });
    }
  }

  const response = await serveDir(req, { fsRoot });

  if (response.status === 404) {
    return html({
      ...sharedHtmlOptions,
      title: "Not Found",
      meta: {
        description: "404 - page not found",
      },
      links: [
        ...sharedHtmlOptions.links!,
        { rel: "canonical", href: new URL("/404", canonicalUrl).href },
      ],
      styles: blogState.styles,
      body: blogState.notFound?.({ req, ctx }) ?? (
        <NotFound ctx={ctx} req={req} />
      ),
    });
  } else return response;
}

/** Serves the rss/atom feed of the blog. */
function serveRSS(
  req: Request,
  ctx: BlogContext,
  posts: Map<string, Post>,
): Response {
  const state = ctx.state;
  const url = state.canonicalUrl
    ? new URL(state.canonicalUrl)
    : new URL(req.url);
  const origin = url.origin;
  const copyright = `Copyright ${new Date().getFullYear()} ${origin}`;
  const feed = new Feed({
    title: state.title ?? "Blog",
    description: state.description,
    id: `${origin}/blog`,
    link: `${origin}/blog`,
    language: state.lang ?? "en",
    favicon: `${origin}/favicon.ico`,
    copyright: copyright,
    generator: "Feed (https://github.com/jpmonette/feed) for Deno",
    feedLinks: {
      rss: `${origin}/rss`,
    },
  });

  for (const [_key, post] of posts.entries()) {
    const item: FeedItem = {
      id: `${origin}${post.pathname}`,
      title: post.title,
      description: post.snippet,
      date: post.publishDate,
      link: `${origin}${post.pathname}`,
      author: (post.author ?? state.author ?? state.title ?? "Author")?.split(
        ",",
      ).map((author: string) => ({
        name: author.trim(),
      })),
      image: post.ogImage ? new URL(post.ogImage, origin).href : undefined,
      copyright,
      published: post.publishDate,
      content: renderMarkdown(ctx, post),
    };

    feed.addItem(item);
  }

  const rssFeed = feed.rss2();
  return new Response(rssFeed, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
    },
  });
}

export function ga(gaKey: string): BlogMiddleware {
  if (gaKey.length === 0) {
    throw new Error("GA key cannot be empty.");
  }

  const gaReporter = createReporter({ id: gaKey });

  return async function (
    request: Request,
    ctx: BlogContext,
  ): Promise<Response> {
    let err: undefined | Error;
    let res: undefined | Response;

    const start = performance.now();
    try {
      res = await ctx.next() as Response;
    } catch (e) {
      err = e as Error;
      res = new Response(`Internal server error: ${err.message}`, {
        status: 500,
      });
    } finally {
      if (gaReporter) {
        gaReporter(request, ctx.connInfo, res!, start, err);
      }
    }
    return res;
  };
}

export function redirects(redirectMap: Record<string, string>): BlogMiddleware {
  return async function (req: Request, ctx: BlogContext): Promise<Response> {
    const { pathname } = new URL(req.url);

    let maybeRedirect = redirectMap[pathname];

    if (!maybeRedirect) {
      // trim leading slash
      maybeRedirect = redirectMap[pathname.slice(1)];
    }

    if (maybeRedirect) {
      if (
        !maybeRedirect.startsWith("/") && !(maybeRedirect.startsWith("http"))
      ) {
        maybeRedirect = "/" + maybeRedirect;
      }

      return new Response(null, {
        status: 307,
        headers: {
          "location": maybeRedirect,
        },
      });
    }
    try {
      return await ctx.next();
    } catch (e) {
      console.error(e);
      return new Response(`Internal server error: ${e.message}`, {
        status: 500,
      });
    }
  };
}

function filterPosts(
  posts: Map<string, Post>,
  searchParams: URLSearchParams,
) {
  const tag = searchParams.get("tag");
  if (!tag) {
    return posts;
  }
  return new Map(
    Array.from(posts.entries()).filter(([, p]) => p.tags?.includes(tag)),
  );
}

function recordGetter(data: Record<string, unknown>) {
  return {
    get<T>(key: string): T | undefined {
      return data[key] as T;
    },
  };
}

function readingTime(text: string) {
  const wpm = 225;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / wpm);
}

export function renderMarkdown(ctx: BlogContext, post: Post) {
  if (post.renderMath) {
    ctx.marked.use(...renderMath());
  }

  return ctx.marked.parse(post.markdown);
}
