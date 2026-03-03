-- Harden mission/task links: clean existing URLs, require https, and prevent active social/task missions without links.

-- 1) Normalize and clean target/video URLs.
WITH cleaned AS (
  SELECT
    id,
    NULLIF(btrim(target_url), '') AS target_clean,
    NULLIF(btrim(video_url), '') AS video_clean
  FROM public.tasks
)
UPDATE public.tasks AS t
SET
  target_url = CASE
    WHEN c.target_clean IS NULL THEN NULL
    WHEN lower(c.target_clean) IN ('#', 'about:blank', 'null', 'undefined', 'tbd', 'coming soon', 'coming-soon', 'placeholder', 'n/a', 'none') THEN NULL
    WHEN lower(c.target_clean) ~ '^(javascript:|data:|about:|file:|mailto:|tel:|chrome:|chrome-extension:)' THEN NULL
    WHEN c.target_clean ~ '^/' THEN NULL
    WHEN c.target_clean ~* '^https://[^[:space:]]+$' THEN c.target_clean
    WHEN c.target_clean ~* '^http://[^[:space:]]+$' THEN regexp_replace(c.target_clean, '^http://', 'https://', 'i')
    WHEN c.target_clean ~* '^www\.[^[:space:]]+$' THEN 'https://' || c.target_clean
    WHEN c.target_clean ~* '^[^[:space:]]+\.[^[:space:]]+$' THEN 'https://' || c.target_clean
    ELSE NULL
  END,
  video_url = CASE
    WHEN c.video_clean IS NULL THEN NULL
    WHEN lower(c.video_clean) IN ('#', 'about:blank', 'null', 'undefined', 'tbd', 'coming soon', 'coming-soon', 'placeholder', 'n/a', 'none') THEN NULL
    WHEN lower(c.video_clean) ~ '^(javascript:|data:|about:|file:|mailto:|tel:|chrome:|chrome-extension:)' THEN NULL
    WHEN c.video_clean ~ '^/' THEN NULL
    WHEN c.video_clean ~* '^https://[^[:space:]]+$' THEN c.video_clean
    WHEN c.video_clean ~* '^http://[^[:space:]]+$' THEN regexp_replace(c.video_clean, '^http://', 'https://', 'i')
    WHEN c.video_clean ~* '^www\.[^[:space:]]+$' THEN 'https://' || c.video_clean
    WHEN c.video_clean ~* '^[^[:space:]]+\.[^[:space:]]+$' THEN 'https://' || c.video_clean
    ELSE NULL
  END
FROM cleaned AS c
WHERE t.id = c.id;

-- 2) Deactivate active social/task_completion tasks that still have no destination.
UPDATE public.tasks
SET is_active = false,
    updated_at = now()
WHERE is_active = true
  AND task_type IN ('social', 'task_completion')
  AND COALESCE(target_url, video_url) IS NULL;

-- 3) Enforce URL quality constraints.
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_target_url_https_chk;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_target_url_https_chk
  CHECK (target_url IS NULL OR target_url ~* '^https://[^[:space:]]+$');

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_video_url_https_chk;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_video_url_https_chk
  CHECK (video_url IS NULL OR video_url ~* '^https://[^[:space:]]+$');

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_active_link_required_chk;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_active_link_required_chk
  CHECK (
    NOT is_active
    OR task_type NOT IN ('social', 'task_completion')
    OR COALESCE(target_url, video_url) IS NOT NULL
  );
