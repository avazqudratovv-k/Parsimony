import type { QueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";
import { meQuery } from "./api/auth";
import { AppPage } from "./routes/AppPage";
import { LandingPage } from "./routes/LandingPage";
import { NotFound } from "./routes/NotFound";

type RouterContext = { queryClient: QueryClient };

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFound,
});

// "/" is the sign-in page; signed-in people go straight to the app.
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (me) throw redirect({ to: "/app" });
  },
  component: LandingPage,
});

// "/app" needs a session; signed-out people go back to "/".
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!me) throw redirect({ to: "/" });
  },
  component: AppPage,
});

const routeTree = rootRoute.addChildren([landingRoute, appRoute]);

export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({ routeTree, context: { queryClient }, history, defaultPreload: "intent" });
}

export const memoryHistory = (path: string) => createMemoryHistory({ initialEntries: [path] });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
