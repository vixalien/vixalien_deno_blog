import { BlogMiddleware } from "../types.d.ts";
import { load } from "./util.ts";

let loaded = false;

export interface ImageContainerOptions {
  addCSS?: boolean;
  mediumZoom?: boolean;
}

let css: string | null = null;

export function imageContainer(
  { addCSS = true }: ImageContainerOptions = {},
): BlogMiddleware {
  return async function (_req, ctx) {
    if (!css && addCSS) {
      css = await load("./image-container.css");
    }

    if (!loaded && css) {
      ctx.state.styles = [...(ctx.state.styles || []), css];
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
