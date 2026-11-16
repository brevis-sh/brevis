-- +goose Up
-- Why a step was skipped: 'design' when there was nothing for it to do (an empty
-- unless_empty value or for_each list, a rule waiting on a failure that did not
-- come, or an upstream that was itself skipped by design) and 'upstream' when
-- something it depended on failed. The catalog's freshness reads it: a step
-- that stood down by design kept its schedule, one cut off by a failure did not.
-- NULL on every row written before this column, which freshness does not count.
ALTER TABLE task_runs ADD COLUMN skip_cause TEXT;
COMMENT ON COLUMN task_runs.skip_cause IS 'design | upstream, set when status = skipped';

-- +goose Down
ALTER TABLE task_runs DROP COLUMN skip_cause;
