// Copyright 2022 the Deno authors. All rights reserved. MIT license.

import type { ConnInfo, HtmlOptions, Marked } from "./deps.ts";

export interface BlogContext {
  __marked?: Marked;
  state: BlogState;
  connInfo: ConnInfo;
  next: () => Promise<Response>;
  get marked(): Marked;
}

export type BlogMiddleware = (
  req: Request,
  ctx: BlogContext,
) => Promise<Response>;

type DateFormat = (date: Date) => string;

export interface BlogSettings {
  /** The blog title */
  title?: string;
  /** The blog description */
  description?: string;
  /** URL to avatar. Can be relative. */
  avatar?: string;
  /** CSS classes to use with the avatar. */
  avatarClass?: string;
  /** URL to background cover. Can be relative. */
  cover?: string;
  /** Color of the text that goes on the background cover. */
  coverTextColor?: string;
  /** The author of the blog. Can be overridden by respective post settings. */
  author?: string;
  /** Social links */
  links?: {
    /** The link title */
    title: string;
    /** The link */
    url: string;
    /** The element to use as the icon of the link */
    icon?: JSX.Element;
    /** The link target */
    target?: "_self" | "_blank" | "_parent" | "_top";
    /** Rel */
    rel?: string;
  }[];
  /** The element ot use as header */
  header?: JSX.Element;
  /** Whether to show the header on post pages */
  showHeaderOnPostPage?: boolean;
  /** The element to use as section. Access to Post props. */
  section?: (post: Post) => JSX.Element;
  /** The element to use as footer */
  footer?: JSX.Element;
  /** Custom CSS */
  styles?: string[];
  /** URL to open graph image. Can be relative. */
  ogImage?: string | {
    url: string;
    twitterCard: "summary" | "summary_large_image" | "app" | "player";
  };
  /** Functions that are called before rendering and can modify the content or make other changes. */
  middlewares?: BlogMiddleware[];
  /** The ISO code of the language the blog is in */
  lang?: string;
  /** Date appearance */
  dateFormat?: DateFormat;
  /** The canonical URL of the blog */
  canonicalUrl?: string;
  /** Color scheme */
  theme?: "dark" | "light" | "auto";
  /**
   * URL to favicon. Can be relative.
   * Supports dark and light mode variants through "prefers-color-scheme".
   */
  favicon?: string | { light?: string; dark?: string };
  /** The port to serve the blog on */
  port?: number;
  /** The hostname to serve the blog on */
  hostname?: string;
  /** Additional links inside head */
  headLinks?: HtmlOptions["links"];
  /** Page to render when nothing is found */
  notFound?: (props: { req: Request; ctx: BlogContext }) => JSX.Element;
  /** Whether to display readtime or not */
  readtime?: boolean;
}

export interface BlogState extends BlogSettings {
  directory: string;
}

/** Represents a Post in the Blog. */
export interface Post {
  pathname: string;
  markdown: string;
  title: string;
  publishDate: Date;
  author?: string;
  snippet?: string;
  coverHtml?: string;
  /** An image URL which is used in the OpenGraph og:image tag. */
  ogImage?: string;
  invert: boolean;
  tags?: string[];
  readTime: number;
  renderMath?: boolean;
}
