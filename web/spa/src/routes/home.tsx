import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { Skeleton, SkeletonText } from "../ui/skeleton";

type Health = { status: string };

// A screen is two exports that share one layout: the page and its skeleton.
export function HomeSkeleton() {
  return (
    <section className="card" aria-busy="true" aria-label="Loading">
      <Skeleton w="8rem" h="1.5rem" />
      <SkeletonText lines={2} />
    </section>
  );
}

function Home() {
  const { data } = useSuspenseQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => getJSON<Health>("/health", signal),
  });
  return (
    <section className="card">
      <h1>Brevis</h1>
      <p>
        The engine reports <strong>{data.status}</strong>.
      </p>
    </section>
  );
}

export default function HomeRoute() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Home />
    </Suspense>
  );
}
