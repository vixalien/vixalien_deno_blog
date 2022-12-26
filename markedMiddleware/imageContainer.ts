import { BlogMiddleware } from "../types.d.ts";
import { load } from "./util.ts";

let loaded = false;

export const imageContainer: (
  props?: { addCSS: boolean },
) => Promise<BlogMiddleware> = async (props = { addCSS: true }) => {
  const { addCSS = true } = props;
  const css = addCSS ? await load("./image-container.css") : null;

  return (_req, ctx) => {
    if (loaded) return ctx.next();

    if (addCSS && css) {
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
              ? `<div class="text"><small>${text} ${url ? ` - <a href="${url}" target="_blank">${license} ↗</a>` : ""}</small></div>`
              : ""
          }
        </div>`;
        },
      },
    });

    loaded = true;

    return ctx.next();
  };
};
