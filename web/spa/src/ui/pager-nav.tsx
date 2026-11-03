import { Link } from "react-router";
import { useFormat, useT } from "../i18n";
import "./wf-ui.css";

// PagerNav is a list's footer: the range shown and previous/next as links, so
// the page lives in the URL.
export function PagerNav({ page, perPage, total, hrefFor }: { page: number; perPage: number; total: number; hrefFor: (page: number) => string }) {
  const { t } = useT();
  const { number } = useFormat();
  if (total === 0) return null;
  const pages = Math.ceil(total / perPage);
  const first = Math.min((page - 1) * perPage + 1, total);
  const last = Math.min(page * perPage, total);
  return (
    <div className="pager">
      <span>{t("table.range", { first: number(first), last: number(last), total: number(total) })}</span>
      {pages > 1 && (
        <nav aria-label="Pages">
          {page > 1 ? (
            <Link className="btn" to={hrefFor(page - 1)} rel="prev">
              {t("table.previous")}
            </Link>
          ) : (
            <span className="btn" aria-disabled="true">
              {t("table.previous")}
            </span>
          )}
          {page < pages ? (
            <Link className="btn" to={hrefFor(page + 1)} rel="next">
              {t("table.next")}
            </Link>
          ) : (
            <span className="btn" aria-disabled="true">
              {t("table.next")}
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
