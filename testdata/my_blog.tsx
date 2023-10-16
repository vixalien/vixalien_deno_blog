// Copyright 2022 the Deno authors. All rights reserved. MIT license.

/** @jsx h */

import blog, { h, highlight, imageContainer } from "../blog.tsx";

blog({
  author: "Dino",
  title: "My Blog",
  description: "The blog description.",
  avatar: "https://deno-avatar.deno.dev/avatar/blog.svg",
  avatarClass: "rounded-full",
  links: [
    { title: "bot@deno.com", url: "mailto:bot@deno.com" },
    { title: "GitHub", url: "https://github.com/denobot" },
    { title: "Twitter", url: "https://twitter.com/denobot" },
  ],
  headLinks: [
    { href: "/css/app.css", rel: "stylesheet" },
  ],
  middlewares: [await highlight(), await imageContainer()],
});
