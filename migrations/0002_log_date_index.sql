-- 日期是明细/概览筛选的最高优先条件（前端始终携带 from/to），为其建索引
CREATE INDEX IF NOT EXISTS idx_anomalies_log_date ON anomalies(log_date);
