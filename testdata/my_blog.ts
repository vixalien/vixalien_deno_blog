import blog, { highlight, imageContainer } from "../blog.tsx";

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
  ],
  middlewares: [await highlight(), await imageContainer()],
  headLinks: [
    { href: "/css/app.css", rel: "stylesheet" },
  ],
  dateStyle: "long",
  lang: "en-US"
});
