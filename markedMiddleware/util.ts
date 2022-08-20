import { dirname, fromFileUrl, resolve } from "../deps.ts";

export const load = (path: string) => {
  const base = import.meta.url;
  const protocol = new URL(base).protocol;

  if (protocol === "file:") {
    return Deno.readTextFile(
      resolve(dirname(fromFileUrl(base)), path),
    );
  } else {
    return fetch(new URL(path, base)).then((response) => response.text());
  }
};
