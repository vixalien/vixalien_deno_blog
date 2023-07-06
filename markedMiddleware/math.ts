import { marked } from "../deps.ts";

import markedKatex from "https://esm.sh/marked-katex-extension@4.0.2";
import katex from "https://esm.sh/katex@0.16.9";

export function renderMath(): marked.MarkedExtension[] {
  return [
    markedKatex() as marked.MarkedExtension,
    {
      renderer: {
        code(code, language, _isEscaped) {
          if (language === "math") {
            return katex.renderToString(code, { displayMode: true });
          }

          return false;
        },
      },
    },
  ];
}

export const MATH_STYLE_URI =
  "https://unpkg.com/katex@0.16.9/dist/katex.min.css";
