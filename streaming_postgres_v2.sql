-- ============================================================
--  Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- สำหรับ gen_random_uuid()

-- ============================================================
--  ENUM Types
-- ============================================================

CREATE TYPE account_status_enum AS ENUM ('active', 'suspended', 'deleted');

CREATE TYPE actor_type_enum  AS ENUM ('user', 'admin');
CREATE TYPE action_type_enum AS ENUM ('create', 'update', 'delete', 'login', 'logout', 'ban', 'other');

-- ============================================================
--  Shared trigger function for updated_at
--  [Fix #1] เพิ่ม trigger function สำหรับอัปเดต updated_at อัตโนมัติ
-- ============================================================

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
--  Core tables
-- ============================================================

CREATE TABLE users (
  id             UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT               NOT NULL,
  username       TEXT               NOT NULL,
  password_hash  TEXT               NOT NULL,
  display_name   TEXT,
  created_at     TIMESTAMPTZ        NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ,
  pfp_url        TEXT,
  account_status account_status_enum NOT NULL DEFAULT 'active',

  CONSTRAINT uq_users_email    UNIQUE (email),
  CONSTRAINT uq_users_username UNIQUE (username)
);

COMMENT ON COLUMN users.password_hash IS 'bcrypt / argon2id hash only — never store plain text';

-- [Fix #1] Trigger: อัปเดต updated_at อัตโนมัติทุกครั้งที่มีการ UPDATE
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- --------------------------------------------------------

CREATE TABLE admins (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  username      TEXT        NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_admins_username UNIQUE (username)
);

COMMENT ON COLUMN admins.password_hash IS 'bcrypt / argon2id hash only — never store plain text';

-- --------------------------------------------------------

CREATE TABLE subscriptions (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT           NOT NULL,
  price         DECIMAL(12,2)  NOT NULL CHECK (price >= 0),
  duration_days INT            NOT NULL CHECK (duration_days > 0),

  -- [Fix #6] ป้องกัน subscription plan ชื่อซ้ำ
  CONSTRAINT uq_subscriptions_name UNIQUE (name)
);

-- --------------------------------------------------------

CREATE TABLE artists (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- [Fix #5] ป้องกันศิลปินชื่อซ้ำในระบบ
  name TEXT NOT NULL,

  CONSTRAINT uq_artists_name UNIQUE (name)
);

-- --------------------------------------------------------

CREATE TABLE albums (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  img_url      TEXT,
  release_date TIMESTAMPTZ
);

-- --------------------------------------------------------

CREATE TABLE genres (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,

  CONSTRAINT uq_genres_name UNIQUE (name)
);

-- --------------------------------------------------------

CREATE TABLE tracks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  duration    INTERVAL    NOT NULL,
  is_free     BOOLEAN     NOT NULL DEFAULT false,
  upload_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ,
  audio_url   TEXT        NOT NULL,
  view_count  BIGINT      NOT NULL DEFAULT 0
              CHECK (view_count >= 0)
);

-- [Fix #1] Trigger: อัปเดต updated_at อัตโนมัติ
CREATE TRIGGER trg_tracks_updated_at
  BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ============================================================
--  Junction tables (M:N)
-- ============================================================

CREATE TABLE album_artists (
  album_id  UUID NOT NULL REFERENCES albums  (id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, artist_id)
);

-- [Fix #3] Index บน FK ฝั่งที่ 2 ของ junction table
CREATE INDEX idx_album_artists_artist_id ON album_artists (artist_id);

-- --------------------------------------------------------

CREATE TABLE track_artists (
  track_id  UUID NOT NULL REFERENCES tracks  (id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, artist_id)
);

-- [Fix #3] Index บน FK ฝั่งที่ 2
CREATE INDEX idx_track_artists_artist_id ON track_artists (artist_id);

-- --------------------------------------------------------

CREATE TABLE track_albums (
  track_id UUID NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  album_id UUID NOT NULL REFERENCES albums (id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, album_id)
);

-- [Fix #3] Index บน FK ฝั่งที่ 2
CREATE INDEX idx_track_albums_album_id ON track_albums (album_id);

-- --------------------------------------------------------

CREATE TABLE track_genres (
  track_id UUID NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES genres (id) ON DELETE CASCADE,
  PRIMARY KEY (track_id, genre_id)
);

-- [Fix #3] Index บน FK ฝั่งที่ 2
CREATE INDEX idx_track_genres_genre_id ON track_genres (genre_id);

-- ============================================================
--  User activity tables
-- ============================================================

CREATE TABLE user_subscriptions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users         (id) ON DELETE CASCADE,
  subscription_id UUID        NOT NULL REFERENCES subscriptions (id) ON DELETE RESTRICT,
  start_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date     TIMESTAMPTZ NOT NULL,

  CHECK (expiry_date > start_date),
  CONSTRAINT uq_user_sub_start UNIQUE (user_id, subscription_id, start_date)
);

-- [Fix #3] Index บน FK ทั้งสองฝั่ง
CREATE INDEX idx_user_subs_user_id         ON user_subscriptions (user_id);
CREATE INDEX idx_user_subs_subscription_id ON user_subscriptions (subscription_id);

-- --------------------------------------------------------

CREATE TABLE playlists (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

-- [Fix #1] Trigger: อัปเดต updated_at อัตโนมัติ
CREATE TRIGGER trg_playlists_updated_at
  BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- --------------------------------------------------------

CREATE TABLE playlist_tracks (
  playlist_id UUID NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  track_id    UUID NOT NULL REFERENCES tracks    (id) ON DELETE CASCADE,
  position    INT  NOT NULL CHECK (position >= 0),
  PRIMARY KEY (playlist_id, track_id)
);

-- [Fix #3] Index บน FK ฝั่งที่ 2
CREATE INDEX idx_playlist_tracks_track_id ON playlist_tracks (track_id);

-- --------------------------------------------------------

CREATE TABLE like_songs (
  user_id  UUID        NOT NULL REFERENCES users  (id) ON DELETE CASCADE,
  track_id UUID        NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  liked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE artist_follows (
  user_id   UUID        NOT NULL REFERENCES users   (id) ON DELETE CASCADE,
  artist_id UUID        NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, artist_id)
);

-- --------------------------------------------------------

CREATE TABLE histories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  listened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id     UUID        NOT NULL REFERENCES users  (id) ON DELETE CASCADE,
  track_id    UUID        NOT NULL REFERENCES tracks (id) ON DELETE CASCADE
);

CREATE INDEX idx_histories_user_id     ON histories (user_id);
CREATE INDEX idx_histories_track_id    ON histories (track_id);
CREATE INDEX idx_histories_listened_at ON histories (listened_at DESC);
-- [Fix #8] Composite index สำหรับ query ประวัติของ user เรียงตามเวลา (ครอบ idx_histories_user_id)
CREATE INDEX idx_histories_user_listened ON histories (user_id, listened_at DESC);

-- ============================================================
--  Shop / merchandise tables
-- ============================================================

CREATE TABLE items (
  id      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name    TEXT          NOT NULL,
  price   DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  img_url TEXT
);

CREATE TABLE artist_items (
  item_id   UUID NOT NULL REFERENCES items   (id) ON DELETE CASCADE,
  artist_id UUID NOT NULL REFERENCES artists (id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, artist_id)
);

-- [Fix #3] Index บน FK ฝั่งที่ 2
CREATE INDEX idx_artist_items_artist_id ON artist_items (artist_id);

-- --------------------------------------------------------

CREATE TABLE purchase_transactions (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  time_purchase    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- [Fix #4] total_item_count และ total_price เป็น snapshot ณ เวลาซื้อ
  --          ควรตรวจสอบความถูกต้องผ่าน application layer หรือ trigger
  --          ไม่ใช้ GENERATED เพราะ transaction_items อาจถูก insert ทีหลัง
  total_item_count INT           NOT NULL CHECK (total_item_count > 0),
  total_price      DECIMAL(12,2) NOT NULL CHECK (total_price >= 0),
  user_id          UUID          NOT NULL REFERENCES users (id) ON DELETE RESTRICT
);

COMMENT ON COLUMN purchase_transactions.total_item_count IS 'Snapshot ณ เวลาซื้อ — ต้องตรวจสอบให้ตรงกับ transaction_items ใน application layer';
COMMENT ON COLUMN purchase_transactions.total_price      IS 'Snapshot ณ เวลาซื้อ — ต้องตรวจสอบให้ตรงกับ SUM(extended_price) ใน transaction_items';

CREATE TABLE transaction_items (
  item_id        UUID          NOT NULL REFERENCES items                (id) ON DELETE RESTRICT,
  tran_id        UUID          NOT NULL REFERENCES purchase_transactions(id) ON DELETE CASCADE,
  unit_price     DECIMAL(12,2) NOT NULL CHECK (unit_price >= 0),
  quantity       INT           NOT NULL CHECK (quantity > 0),
  extended_price DECIMAL(12,2) NOT NULL
                 GENERATED ALWAYS AS (unit_price * quantity) STORED,
  PRIMARY KEY (item_id, tran_id)
);

-- [Fix #3] Index บน FK tran_id เพื่อ JOIN กลับ purchase_transactions
CREATE INDEX idx_transaction_items_tran_id ON transaction_items (tran_id);

-- ============================================================
--  Audit log
-- ============================================================

CREATE TABLE logs (
  id            UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type    actor_type_enum  NOT NULL,
  action_type   action_type_enum NOT NULL,
  action_detail TEXT,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
  user_id       UUID             REFERENCES users  (id) ON DELETE SET NULL,
  admin_id      UUID             REFERENCES admins (id) ON DELETE SET NULL,

  -- [Fix #2] ผูก actor_type ให้ตรงกับ FK ที่ระบุ และห้ามมีทั้งสองพร้อมกัน
  CONSTRAINT chk_logs_actor CHECK (
    (actor_type = 'user'  AND user_id  IS NOT NULL AND admin_id IS NULL) OR
    (actor_type = 'admin' AND admin_id IS NOT NULL AND user_id  IS NULL)
  )
);

-- ============================================================
--  Performance indexes
-- ============================================================

CREATE INDEX idx_users_email           ON users  (email);
CREATE INDEX idx_tracks_title          ON tracks (title);
CREATE INDEX idx_playlists_user_id     ON playlists (user_id);
CREATE INDEX idx_like_songs_track_id   ON like_songs (track_id);
CREATE INDEX idx_artist_follows_artist ON artist_follows (artist_id);
CREATE INDEX idx_logs_user_id          ON logs (user_id);
CREATE INDEX idx_logs_admin_id         ON logs (admin_id);
CREATE INDEX idx_logs_created_at       ON logs (created_at DESC);
CREATE INDEX idx_purchase_user_id      ON purchase_transactions (user_id);
