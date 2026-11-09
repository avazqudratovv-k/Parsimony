import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { meQuery } from "../api/auth";
import { ApiError } from "../api/client";

// Set when the server says the session is gone while the user was signed in; the landing page shows it once.
let expired = false;
export const peekExpiredNotice = () => expired;
export const clearExpiredNotice = () => {
  expired = false;
};

/**
 * One QueryClient for the app. A 401 from any request while we think the user is signed in
 * means the cookie expired (or the account was deleted elsewhere): forget the user and go home.
 * A failed login also returns 401, but then nobody is signed in, so it is left alone.
 */
export function createQueryClient(onExpired: () => void, retry: boolean | number = 1): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (e) => check(e) }),
    mutationCache: new MutationCache({ onError: (e) => check(e) }),
    defaultOptions: { queries: { refetchOnWindowFocus: false, retry } },
  });
  function check(error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 401) return;
    if (!client.getQueryData(meQuery.queryKey)) return;
    expired = true;
    client.setQueryData(meQuery.queryKey, null);
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    onExpired();
  }
  return client;
}
