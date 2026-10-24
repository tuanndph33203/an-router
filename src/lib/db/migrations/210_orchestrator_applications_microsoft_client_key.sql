-- Migration 210: Add microsoft_client_key to orchestrator_applications
ALTER TABLE orchestrator_applications ADD COLUMN microsoft_client_key TEXT;

CREATE INDEX IF NOT EXISTS idx_orchestrator_apps_client_key ON orchestrator_applications (microsoft_client_key);

-- Cập nhật client key mặc định cho các ứng dụng đã seed
UPDATE orchestrator_applications 
SET microsoft_client_key = '232FB9D1-D0B8-413C-871C-45C280BBF94F' 
WHERE id = 'anpos' AND (microsoft_client_key IS NULL OR microsoft_client_key = '');

UPDATE orchestrator_applications 
SET microsoft_client_key = 'C222016D-F533-4BEF-99AD-FBB08BE01F76' 
WHERE id = 'cmms' AND (microsoft_client_key IS NULL OR microsoft_client_key = '');

UPDATE orchestrator_applications 
SET microsoft_client_key = '5B56BEEE-E8AE-4FD6-A986-730312C7E4C4' 
WHERE id = 'report' AND (microsoft_client_key IS NULL OR microsoft_client_key = '');
