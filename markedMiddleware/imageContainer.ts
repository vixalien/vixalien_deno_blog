import { BlogMiddleware } from "../types.d.ts";
import { load } from "./util.ts";

let loaded = false;

export interface ImageContainerOptions {
  addCSS?: boolean;
  mediumZoom?: boolean;
}

let css: string | null = null;

export function imageContainer(options: ImageContainerOptions): BlogMiddleware;
export function imageContainer(
  {
    addCSS = true,
    mediumZoom = false,
  } = {},
): BlogMiddleware {
  return async function (_req, ctx) {
    if (!css && addCSS) {
      css = await load("./image-container.css");
    }

    if (!loaded) {
      if (css) {
        ctx.state.styles = [...(ctx.state.styles || []), css];
      }

      if (mediumZoom) {
        ctx.state.scripts = [
          ...(ctx.state.scripts || []),
          {
            defer: true,
            type: "module",
            text:
`import "https://unpkg.com/medium-zoom/dist/medium-zoom.min.js";
mediumZoom("div.block-image > img", { margin: 30, background: "color-mix(in srgb, var(--bg) 70%, transparent)" })`,
          },
        ];
      }
    }

    ctx.marked.use({
      renderer: {
        image: function (href, title, text) {
          let license: string | null = null;
          let url: string | null = null;

          try {
            if (title) {
              const attribution = title.split(" --- ");
              license = attribution[0];
              url = new URL(attribution[1]).href;
            }
          } catch {
            // nothing
          }

          return `<div class="block-image">
          <img src="${href}" alt="${title || text}" loading="lazy">
          ${
            text
              ? `<div class="text"><small>${text} ${
                url
                  ? ` - <a href="${url}" target="_blank">${license} ↗</a>`
                  : ""
              }</small></div>`
              : ""
          }
        </div>`;
        },
      },
    });

    loaded = true;

    return ctx.next();
  };
}
