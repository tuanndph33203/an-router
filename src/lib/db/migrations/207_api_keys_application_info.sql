-- Migration 207: Thêm trường app_id và app_name vào bảng api_keys
ALTER TABLE api_keys ADD COLUMN app_id TEXT;
ALTER TABLE api_keys ADD COLUMN app_name TEXT;
