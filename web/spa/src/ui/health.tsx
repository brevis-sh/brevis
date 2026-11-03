import type { StreamHealth } from "../api/ingest";
import { useT } from "../i18n";
import { Status } from "./status";

/** A stream's health state as a status kind; a server that predates the field says nothing, which is "unknown". */
export const healthKind = (h?: StreamHealth) => h?.state || "unknown";

/** The sentence for a health reason. Written out key by key so the i18n scan sees every one. */
export function useHealthReason() {
  const { t } = useT();
  return (h?: StreamHealth) => {
    switch (h?.reason) {
      case "destination_unnamed":
        return t("streams.health.destination_unnamed");
      default:
        return t("streams.health.not_reported");
    }
  };
}

/** The mark and word of a stream's health, the reason as its tooltip. */
export function HealthStatus({ health }: { health?: StreamHealth }) {
  const reason = useHealthReason()(health);
  return (
    <span title={reason}>
      <Status kind={healthKind(health)} />
    </span>
  );
}
