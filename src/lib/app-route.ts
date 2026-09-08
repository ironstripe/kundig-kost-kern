import { getRouteApi } from "@tanstack/react-router";

/** Typed access to the app shell route context (profile, email, user). */
export const appRoute = getRouteApi("/_authenticated/_app");

export function useAppContext() {
  return appRoute.useRouteContext();
}
