import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { useT } from "../i18n";
import { Empty } from "../ui/card";
import { PageFrame } from "../ui/page-frame";
import { LoadError } from "../ui/query-boundary";
import { Skeleton } from "../ui/skeleton";

type Project = { slug: string; name: string; workflows: number; runs: number; createdAt: string };

const grid = "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4";
const card = "group rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong";

// web/pages Projects: the words are literals there, and stay literals here.
function CardSkeleton() {
  return (
    <div className={card} aria-hidden="true">
      <div className="flex items-baseline justify-between gap-3">
        <Skeleton w="45%" h="20px" />
        <Skeleton w="4rem" h="11px" />
      </div>
      <div className="mt-4 flex gap-3">
        <div><span className="text-[0.7rem] tracking-wide text-muted uppercase">Workflows</span><div className="mt-1"><Skeleton w="2rem" h="24px" /></div></div>
        <div><span className="text-[0.7rem] tracking-wide text-muted uppercase">Runs</span><div className="mt-1"><Skeleton w="2rem" h="24px" /></div></div>
      </div>
      <div className="mt-4"><Skeleton w="35%" h="12px" /></div>
    </div>
  );
}

export default function ProjectsRoute() {
  const { t } = useT();
  const q = useQuery({ queryKey: ["projects"], queryFn: ({ signal }) => getJSON<Project[]>("/api/projects", signal) });
  const data = q.data;
  return (
    <PageFrame title={t("nav.projects")}>
      <p className="mb-4 max-w-3xl text-sm text-muted">
        A project namespaces its workflows: two projects can each have a <code className="font-mono text-xs">daily_ingest</code> without colliding. A workflow joins one with <code className="font-mono text-xs">brevis publish --project</code>.
      </p>
      {q.isError ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : data && data.length === 0 ? (
        <Empty text="No project yet." hint="brevis publish --project my-project" />
      ) : (
        <div className={grid} aria-busy={!data}>
          {!data
            ? Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)
            : data.map((p) => (
                <Link key={p.slug} to={`/workflows?project=${encodeURIComponent(p.slug)}`} className={card}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="display truncate text-base text-ink">{p.name}</h3>
                    <span className="shrink-0 font-mono text-[0.7rem] text-muted">{p.slug}</span>
                  </div>
                  <dl className="mt-4 flex gap-3 text-sm">
                    <div>
                      <dt className="text-[0.7rem] tracking-wide text-muted uppercase">Workflows</dt>
                      <dd className="display text-xl text-ink tabular-nums">{p.workflows}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.7rem] tracking-wide text-muted uppercase">Runs</dt>
                      <dd className="display text-xl text-ink tabular-nums">{p.runs}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 flex items-center justify-between text-xs text-muted">
                    <span>since {p.createdAt.slice(0, 10)}</span>
                    <span className="text-muted opacity-0 transition-opacity group-hover:opacity-100">see the workflows →</span>
                  </p>
                </Link>
              ))}
        </div>
      )}
    </PageFrame>
  );
}
