import type { Db } from "./index.ts";

/** Migration theo thứ tự; không sửa migration đã phát hành, chỉ thêm mới. */
export const migrations: { id: string; sql: string }[] = [
  {
    id: "001_core",
    sql: `
CREATE TABLE users (
  id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('parent','admin')),
  email_hash text NOT NULL UNIQUE,
  email_enc text NOT NULL,
  phone_enc text,
  password_hash text NOT NULL,
  totp_secret_enc text,
  email_verified boolean NOT NULL DEFAULT false,
  locale text NOT NULL DEFAULT 'vi',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ERASURE_REQUESTED','ERASED')),
  created_at timestamptz NOT NULL
);

-- Khóa dữ liệu theo chủ thể (envelope encryption). Xóa hàng = crypto-shredding.
CREATE TABLE subject_keys (
  subject_id uuid PRIMARY KEY,
  wrapped_dek text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE children (
  id uuid PRIMARY KEY,
  parent_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname_enc text NOT NULL,
  birth_enc text NOT NULL,
  level int NOT NULL CHECK (level IN (1,2,3)),
  avatar text NOT NULL,
  pin_hash text NOT NULL,
  pin_failed int NOT NULL DEFAULT 0,
  pin_locked_until timestamptz,
  status text NOT NULL CHECK (status IN ('PENDING_PARENT_CONSENT','ACTIVE','EXPIRED','ERASURE_REQUESTED','ERASED')),
  guardian_verified boolean NOT NULL DEFAULT false,
  child_agreed boolean NOT NULL DEFAULT false,
  age_at_creation int NOT NULL,
  camera_allowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL,
  consent_expires_at timestamptz NOT NULL
);
CREATE INDEX children_parent_idx ON children(parent_id);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('parent','admin','child')),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES children(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL
);

CREATE TABLE otp_codes (
  id uuid PRIMARY KEY,
  subject_id uuid NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('email_verify','guardian_consent')),
  code_hash text NOT NULL,
  channel text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);
CREATE INDEX otp_subject_idx ON otp_codes(subject_id, purpose);

-- Bằng chứng đồng ý: chỉ lưu tham chiếu băm, không lưu PII; giữ lại sau khi xóa (theo DPIA).
CREATE TABLE consent_events (
  id uuid PRIMARY KEY,
  child_ref text NOT NULL,
  actor text NOT NULL CHECK (actor IN ('guardian','child','system')),
  type text NOT NULL,
  terms_version text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY,
  actor_ref text NOT NULL,
  action text NOT NULL,
  target_type text,
  target_ref text,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL
);

-- Nhật ký bất biến: chặn sửa/xóa ở mức DB.
CREATE FUNCTION forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'append-only table: % not allowed', TG_OP; END $$;
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER consent_events_immutable BEFORE UPDATE OR DELETE ON consent_events FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TABLE erasure_requests (
  id uuid PRIMARY KEY,
  subject_type text NOT NULL CHECK (subject_type IN ('child','parent')),
  subject_ref text NOT NULL,
  subject_id uuid NOT NULL,
  requested_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  done_at timestamptz,
  proof text
);
`,
  },
  {
    id: "002_learning",
    sql: `
CREATE TABLE lesson_progress (
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('in_progress','completed')),
  step_index int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL,
  completed_at timestamptz,
  PRIMARY KEY (child_id, lesson_id)
);
CREATE TABLE step_results (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  step_id text NOT NULL,
  kind text NOT NULL,
  correct boolean,
  attempts int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  UNIQUE (child_id, lesson_id, step_id)
);
CREATE TABLE xp_events (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  reason text NOT NULL,
  points int NOT NULL CHECK (points >= 0),
  ref text NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (child_id, reason, ref)
);
CREATE TABLE user_badges (
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  badge_id text NOT NULL,
  earned_at timestamptz NOT NULL,
  PRIMARY KEY (child_id, badge_id)
);
CREATE TABLE assessment_results (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pre','post','micro','misconception')),
  scope text NOT NULL,
  score int NOT NULL,
  max_score int NOT NULL,
  answers jsonb NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX assessment_child_idx ON assessment_results(child_id, kind);
CREATE TABLE screen_time_rules (
  child_id uuid PRIMARY KEY REFERENCES children(id) ON DELETE CASCADE,
  daily_minutes int NOT NULL DEFAULT 30 CHECK (daily_minutes BETWEEN 5 AND 240)
);
CREATE TABLE usage_days (
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  day date NOT NULL,
  seconds int NOT NULL DEFAULT 0,
  PRIMARY KEY (child_id, day)
);
CREATE TABLE project_events (
  id uuid PRIMARY KEY,
  child_id uuid NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  project text NOT NULL,
  accuracy real NOT NULL,
  samples int NOT NULL,
  improved_after_review boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL
);
`,
  },
  {
    id: "003_cms",
    sql: `
CREATE TABLE content_drafts (
  id uuid PRIMARY KEY,
  lesson_id text NOT NULL,
  version int NOT NULL,
  body jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('draft','in_review','published','rejected')),
  author_id uuid NOT NULL,
  reviewer_id uuid,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (lesson_id, version)
);
`,
  },
  {
    id: "004_feedback",
    sql: `
CREATE TABLE parent_feedback (
  id uuid PRIMARY KEY,
  parent_ref text NOT NULL,
  ease int NOT NULL CHECK (ease BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL
);
`,
  },
];

export async function migrate(db: Db): Promise<string[]> {
  await db.query("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await db.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map((r) => r.id));
  const ran: string[] = [];
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    await db.tx(async (t) => {
      await t.exec(m.sql);
      await t.query("INSERT INTO schema_migrations(id) VALUES ($1)", [m.id]);
    });
    ran.push(m.id);
  }
  return ran;
}
