-- 概览/列表高频过滤与聚合的索引（db.txt 建议的三个索引）
CREATE INDEX IF NOT EXISTS idx_anomalies_exit_time ON anomalies(exit_time);
CREATE INDEX IF NOT EXISTS idx_anomalies_car ON anomalies(car_number);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies(status);
