-- Moderator tools: reversible ban, temporary mute, audit fields for both.
-- Hard account deletion needs no schema change -- existing FKs already do
-- the right thing (ON DELETE SET NULL for posts/comments/guides/AARs so
-- content survives; ON DELETE CASCADE for votes/messages/notifications/
-- inventory so those go with the account).

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at     TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS muted_until   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_is_banned ON users (is_banned) WHERE is_banned = TRUE;
