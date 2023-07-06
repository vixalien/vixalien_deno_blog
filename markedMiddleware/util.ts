import { cache, dirname, fromFileUrl, resolve } from "../deps.ts";

export const load = (path: string) => {
  const base = import.meta.url;

  const remote_uri = new URL(path, base);

  if (remote_uri.protocol === "file:") {
    return Deno.readTextFile(
      resolve(dirname(fromFileUrl(base)), path),
    );
  } else {
    return cache(remote_uri)
      .then((file) => Deno.readTextFile(file.path))
      .catch(() => {
        return fetch(remote_uri)
          .then((response) => response.text());
      });
  }
};
