import { useT } from "../i18n";

// A connector's or a language's mark on the server's quiet tile (`cg`). The
// brand drawings stay server-side for now, so every key is drawn as its
// monogram, as the server draws one it has no mark for. A brand is its own
// name in every language; "file" and "gateway" are words, and are translated.
const MONO: Record<string, string> = { file: "FS", http: "{}", gateway: "→", kinesis: "KS", sftp: "SF" };
const BRAND: Record<string, string> = {
  bigquery: "Google BigQuery", duckdb: "DuckDB", gcs: "Google Cloud Storage", kafka: "Apache Kafka", mysql: "MySQL",
  postgres: "PostgreSQL", pubsub: "Google Pub/Sub", redis: "Redis", redshift: "Amazon Redshift", s3: "Amazon S3",
  snowflake: "Snowflake", sqs: "Amazon SQS", http: "HTTP", kinesis: "Amazon Kinesis", sftp: "SFTP",
};

/** A key's name for a reader and a screen reader. */
export function useLogoTitle() {
  const { t } = useT();
  return (k: string) => (k === "file" || k === "gateway" ? t(`logo.${k}`) : (BRAND[k] ?? k));
}

export function Logo({ k, size = 18, title }: { k: string; size?: 18 | 28 | 40; title?: string }) {
  const name = useLogoTitle()(k);
  const mono = MONO[k] ?? k.replace(/[^\p{L}]/gu, "").slice(0, 2).toUpperCase();
  return (
    <span className={`cg cg-mono cg-${size}`} role="img" aria-label={title ?? name} title={title ?? name}>
      {mono}
    </span>
  );
}
