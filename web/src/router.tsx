/* eslint-disable react-refresh/only-export-components */

import { AudioPlayerBar } from "@/components/audio-player-bar";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { AudioPlayerProvider } from "@/features/player/audio-player-provider";
import { SearchStateProvider } from "@/features/search/search-state";
import { useAuth } from "@/features/auth/auth-context";
import { DownloadsPage } from "@/pages/downloads";
import { LoginPage } from "@/pages/login";
import { SearchPage } from "@/pages/search";
import { SubscriptionsPage } from "@/pages/subscriptions";
import { HeroUIProvider, Spinner, ToastProvider } from "@heroui/react";
import {
    createRootRoute,
    createRoute,
    createRouter,
    NavigateOptions,
    Outlet,
    ToOptions,
    useNavigate,
    useRouter,
    useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner color="primary" />
    </div>
  );
}

function RootLayout() {
  const router = useRouter();
  const routerState = useRouterState();
  const { enabled, status } = useAuth();
  const isLoginRoute = routerState.location.pathname === "/login";

  useEffect(() => {
    if (!enabled || status === "loading") return;
    if (enabled && status === "unauthenticated" && !isLoginRoute) {
      router.navigate({ to: "/login", replace: true });
    } else if (enabled && status === "authenticated" && isLoginRoute) {
      router.navigate({ to: "/", replace: true });
    }
  }, [enabled, status, isLoginRoute, router]);

  const shouldShowLoader =
    status === "loading" || (enabled && status === "unauthenticated" && !isLoginRoute);

  return (
    <HeroUIProvider
      navigate={(to, options) => router.navigate({ to, ...options })}
      useHref={(to) => router.buildLocation({ to }).href}
    >
      <ToastProvider />
      {shouldShowLoader ? (
        <LoadingScreen />
      ) : isLoginRoute ? (
        <Outlet />
      ) : (
        <AudioPlayerProvider>
          <SearchStateProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="m-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-32">
                <Outlet />
              </main>
              <Footer />
            </div>
            <AudioPlayerBar />
          </SearchStateProvider>
        </AudioPlayerProvider>
      )}
    </HeroUIProvider>
  );
}

function NotFoundRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/" });
  }, [navigate]);
  return null;
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundRedirect,
});

const downloadsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DownloadsPage,
});

const subscriptionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/subscriptions",
  component: SubscriptionsPage,
});

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/search",
  component: SearchPage,
  validateSearch: (search: Record<string, unknown>) => {
    const q = typeof search.q === "string" ? search.q : "";
    const view =
      search.view === "album" ||
      search.view === "related" ||
      search.view === "artist"
        ? search.view
        : "results";
    const albumId =
      typeof search.albumId === "string" ? search.albumId : undefined;
    const songId =
      typeof search.songId === "string" ? search.songId : undefined;
    const artistId =
      typeof search.artistId === "string" ? search.artistId : undefined;
    return { q, view, albumId, songId, artistId };
  },
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});
const routeTree = rootRoute.addChildren([
  downloadsRoute,
  subscriptionsRoute,
  searchRoute,
  loginRoute,
]);

export const router = createRouter({ routeTree });

declare module "@react-types/shared" {
  interface RouterConfig {
    href: ToOptions["to"];
    routerOptions: Omit<NavigateOptions, keyof ToOptions>;
  }
}
