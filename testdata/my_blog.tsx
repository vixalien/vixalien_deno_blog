// Copyright 2022 the Deno authors. All rights reserved. MIT license.

/** @jsx h */

import blog, { h, highlight, imageContainer } from "../blog.tsx";

function IconFile() {
  return (
    <svg
      width="1em"
      height="1em"
      stroke-width={2}
      stroke="currentColor"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M0 0h24v24H0z" stroke="none" />
      <path d="M14 3v4a1 1 0 001 1h4" />
      <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2zM9 9h1M9 13h6M9 17h6" />
    </svg>
  );
}

blog({
  author: "vixalien",
  title: "vixalien's blog",
  description:
    `Hello! I'm Angelo Verlain, but you can call me vixalien. I am a web \
    developer. This is my website, a collection of projects and writings.`,
  avatar: "https://deno-avatar.deno.dev/avatar/blog.svg",
  avatarClass: "rounded-full",
  links: [
    { title: "bot@deno.com", url: "mailto:bot@deno.com" },
    { title: "GitHub", url: "https://github.com/denobot" },
    { title: "Twitter", url: "https://twitter.com/denobot" },
    { title: "Resume", url: "/resume", icon: <IconFile /> },
  ],
  middlewares: [await highlight(), await imageContainer()],
  headLinks: [
    { href: "/css/app.css", rel: "stylesheet" },
  ],
  dateStyle: "long",
  lang: "en-US",
});
