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
          return `<div class="block-image">
          <img src="${href}" alt="${title || text}" loading="lazy">
          ${
            text
              ? `<div class="text" aria-hidden="true"><small>${text} - <a href="${href}" target="_blank">View Image ↗</a></small></div>`
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
