import { lazy, Suspense, type ComponentType } from "react";
import { Skeleton } from "./skeleton";

// lazyRoute loads a screen's code when it is first opened, so the screens the
// reader does not visit stay out of the first download. While the chunk
// arrives a generic page shape stands in (the screen's own skeleton lives in
// the chunk it is waiting for).
export function lazyRoute(load: () => Promise<{ default: ComponentType }>) {
  const Screen = lazy(load);
  return function LazyRoute() {
    return (
      <Suspense
        fallback={
          <div aria-busy="true">
            <Skeleton w="10rem" h="1.5rem" className="lz-title" />
            <Skeleton h="14rem" />
          </div>
        }
      >
        <Screen />
      </Suspense>
    );
  };
}
