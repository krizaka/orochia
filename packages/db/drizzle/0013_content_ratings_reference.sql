-- Reference data every environment needs (videos and stories point at it): the five content ratings, in English.
-- Upserted, so a database that already has them (development seed) gets the same wording.
INSERT INTO "content_ratings" ("id", "label", "description", "is_adult", "requires_blur", "default_tags", "min_age", "display_order", "icon_name") VALUES
  ('FOR_KIDS', 'Kids safe', 'Suitable for children and families: no strong language, no violence.', false, false, ARRAY['family','kids']::text[], 0, 1, 'baby'),
  ('GENERAL', 'General audience', 'Suitable for most viewers.', false, false, ARRAY['general']::text[], 0, 2, 'users'),
  ('TEEN', 'Teens (13+)', 'Suitable from 13. May touch on more mature themes.', false, false, ARRAY['teen']::text[], 13, 3, 'user-check'),
  ('MATURE', 'Mature (18+)', 'Adults only. Sensitive or intense themes.', true, false, ARRAY['mature','18+']::text[], 18, 4, 'shield-alert'),
  ('ADULT', 'Adult explicit (18+)', 'Explicit content for verified adults. The preview is blurred by default.', true, true, ARRAY['adult','18+']::text[], 18, 5, 'alert-triangle')
ON CONFLICT ("id") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "is_adult" = EXCLUDED."is_adult",
  "requires_blur" = EXCLUDED."requires_blur",
  "min_age" = EXCLUDED."min_age",
  "display_order" = EXCLUDED."display_order";
