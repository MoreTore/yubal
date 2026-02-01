import createClient from "openapi-fetch";
import type { paths } from "./schema";

const fetchWithCredentials = (input: Request): Promise<Response> => {
  const request = new Request(input, { credentials: "include" });
  return fetch(request);
};

export const api = createClient<paths>({
  baseUrl: "/api",
  fetch: fetchWithCredentials,
});
