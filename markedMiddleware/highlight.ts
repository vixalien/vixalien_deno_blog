import hljs from "https://cdn.skypack.dev/highlight.js@11.6.0?dts";
import type { marked } from "../deps.ts";
import { BlogMiddleware } from "../types.d.ts";
import { load } from "./util.ts";

function doHiglight(code: string, language?: string) {
  return hljs.highlightAuto(code, [language]) as {
    language: string;
    value: string;
  };
}

const escapeTest = /[&<>"']/;
const escapeReplace = /[&<>"']/g;
const escapeTestNoEncode = /[<>"']|&(?!#?\w+;)/;
const escapeReplaceNoEncode = /[<>"']|&(?!#?\w+;)/g;
const escapeReplacements = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const getEscapeReplacement = (ch: string) =>
  escapeReplacements[ch as keyof typeof escapeReplacements];
function escape(html: string, encode: boolean) {
  if (encode) {
    if (escapeTest.test(html)) {
      return html.replace(escapeReplace, getEscapeReplacement);
    }
  } else {
    if (escapeTestNoEncode.test(html)) {
      return html.replace(escapeReplaceNoEncode, getEscapeReplacement);
    }
  }

  return html;
}

let loaded = false;

export const highlight: (
  props?: { addCSS: boolean },
) => Promise<BlogMiddleware> = async (props = { addCSS: true }) => {
  const { addCSS = true } = props;
  const css = addCSS ? await load("./highlight.css") : null;

  return (_req, ctx) => {
    if (!loaded) {
      if (addCSS && css) {
        ctx.state.styles = [...(ctx.state.styles || []), css];
      }
    }

    ctx.marked.use({
      renderer: {
        code: function (code, infostring = "", escaped) {
          const lang = infostring.match(/\S*/)?.[0];
          let { value, language } = doHiglight(code, lang);
          if (value != null && value !== code) {
            escaped = true;
          }

          value = value.replace(/\n$/, "") + "\n";

          if (!lang) {
            return '<pre class="block-code"><code>' +
              (escaped ? value : escape(value, true)) +
              "</code></pre>\n";
          }

          return '<pre class="block-code"><code class="' +
            (this as marked.Renderer<never>).options.langPrefix +
            escape(language, true) +
            '">' +
            (escaped ? value : escape(value, true)) +
            "</code></pre>\n";
        },
      },
    });

    loaded = true;

    return ctx.next();
  };
};
