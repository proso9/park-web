-- anomalies 表结构与上游检测工具一致（CREATE IF NOT EXISTS，对远端已存在的表无影响）。
-- 上游拥有全部业务字段；本项目运行期只 UPDATE status / remark。
CREATE TABLE IF NOT EXISTS anomalies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_date      TEXT NOT NULL,
  log_file      TEXT NOT NULL,
  entry_time    TEXT,
  exit_time     TEXT NOT NULL,
  car_number    TEXT NOT NULL,
  fee           REAL,
  is_suspicious INTEGER NOT NULL DEFAULT 0,
  dedup_key     TEXT NOT NULL UNIQUE,
  status        INTEGER NOT NULL DEFAULT 0,
  remark        TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
