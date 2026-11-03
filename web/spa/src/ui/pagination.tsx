import { Link, type To } from "react-router";
import { useFormat, useT } from "../i18n";
import "./pagination.css";

/** The page numbers around the current one, five of them (the server's Window). */
function window5(page: number, pages: number): number[] {
  let from = page - 2;
  let to = page + 2;
  if (from < 1) {
    to += 1 - from;
    from = 1;
  }
  if (to > pages) {
    from -= to - pages;
    to = pages;
  }
  from = Math.max(1, from);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

type Props = { page: number; perPage: number; total: number; pages: number; to: (page: number) => To };

/** The list's footer: "1-25 of 60" and previous / numbers / next as router links. */
export function Pagination({ page, perPage, total, pages, to }: Props) {
  const { t } = useT();
  const f = useFormat();
  if (total === 0) return null;
  const first = (page - 1) * perPage + 1;
  const last = Math.min(page * perPage, total);
  return (
    <div className="pager">
      <span>{t("table.range", { first: f.number(first), last: f.number(last), total: f.number(total) })}</span>
      {pages > 1 && (
        <nav aria-label="Pagination">
          {page > 1 ? <Link to={to(page - 1)} rel="prev">{t("table.previous")}</Link> : <span className="pg" aria-disabled="true">{t("table.previous")}</span>}
          {window5(page, pages).map((n) =>
            n === page ? (
              <span className="pg" key={n} aria-current="page">{n}</span>
            ) : (
              <Link key={n} to={to(n)}>{n}</Link>
            ),
          )}
          {page < pages ? <Link to={to(page + 1)} rel="next">{t("table.next")}</Link> : <span className="pg" aria-disabled="true">{t("table.next")}</span>}
        </nav>
      )}
    </div>
  );
}

export function PaginationSkeleton() {
  return <div className="pager" aria-hidden="true" style={{ minHeight: "2.75rem" }} />;
}
