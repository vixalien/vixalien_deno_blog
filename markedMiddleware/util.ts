import { dirname, fromFileUrl, resolve } from "../deps.ts";

export const load = (path: string) => {
  return Deno.readTextFile(
    resolve(dirname(fromFileUrl(import.meta.url)), path),
  );
};
