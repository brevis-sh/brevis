import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { useT } from "../i18n";
import { Skeleton } from "../ui/skeleton";

type Project = { slug: string; name: string; workflows: number; runs: number; createdAt: string };

// The same grid for the cards and for their skeletons, so the page does not
// move when the data arrives.
function CardSkeleton() {
  return (
    <div className="proj" aria-hidden="true">
      <Skeleton w="60%" h="1.1rem" />
      <div className="proj-nums">
        <Skeleton w="3.5rem" h="2rem" />
        <Skeleton w="3.5rem" h="2rem" />
      </div>
      <Skeleton w="40%" h=".8rem" />
    </div>
  );
}

export function ProjectsSkeleton() {
  return (
    <div className="proj-grid" aria-busy="true" aria-label="Loading projects">
      {Array.from({ length: 6 }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

function Projects() {
  const { data } = useSuspenseQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => getJSON<Project[]>("/api/projects", signal),
  });

  if (data.length === 0) {
    return (
      <section className="card">
        <p>No project yet.</p>
        <code>brevis publish --project my-project</code>
      </section>
    );
  }

  return (
    <>
      <p className="muted lead">
        A project namespaces its workflows: two projects can each have a <code>daily_ingest</code> without colliding. A
        workflow joins one with <code>brevis publish --project</code>.
      </p>
      <div className="proj-grid">
        {data.map((p) => (
          // A plain link: the Workflows screen is still the server's page, and
          // this becomes a router link when that screen moves.
          <a key={p.slug} className="proj" href={`/workflows?project=${encodeURIComponent(p.slug)}`}>
            <div className="proj-head">
              <h3>{p.name}</h3>
              <span className="muted mono">{p.slug}</span>
            </div>
            <dl className="proj-nums">
              <div>
                <dt>Workflows</dt>
                <dd>{p.workflows}</dd>
              </div>
              <div>
                <dt>Runs</dt>
                <dd>{p.runs}</dd>
              </div>
            </dl>
            <small className="muted">since {p.createdAt.slice(0, 10)}</small>
          </a>
        ))}
      </div>
    </>
  );
}

function Title() {
  const { t } = useT();
  return <h1 className="page-title">{t("nav.projects")}</h1>;
}

export default function ProjectsRoute() {
  return (
    <>
      <Suspense fallback={<Skeleton w="8rem" h="1.5rem" />}>
        <Title />
      </Suspense>
      <Suspense fallback={<ProjectsSkeleton />}>
        <Projects />
      </Suspense>
    </>
  );
}
