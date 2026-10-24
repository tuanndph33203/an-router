-- Migration 208: Seed CMMS API Key và liên kết Rule Book cmms
INSERT OR IGNORE INTO api_keys (id, name, key, app_id, app_name, created_at)
VALUES ('key_cmms_demo', 'An CMMS Maintenance Key', 'sk-omni-cmms-' || lower(hex(randomblob(16))), 'cmms', 'An CMMS (Bảo trì & Sự cố)', datetime('now'));

INSERT OR IGNORE INTO api_key_rules (api_key_id, rule_book_id, created_at)
SELECT 'key_cmms_demo', id, datetime('now')
FROM rule_books
WHERE file_name = 'cmms.rule.md';
