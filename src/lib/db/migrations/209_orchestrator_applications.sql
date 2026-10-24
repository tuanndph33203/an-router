-- Migration 209: Create orchestrator_applications table and seed default apps
CREATE TABLE IF NOT EXISTS orchestrator_applications (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    capabilities TEXT DEFAULT '["api"]',
    rule_path TEXT,
    base_api_url TEXT NOT NULL,
    swagger_endpoint_url TEXT,
    schema_endpoint_url TEXT,
    sql_execute_endpoint TEXT,
    welcome_message TEXT,
    quick_suggestions TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO orchestrator_applications (
    id, name, capabilities, rule_path, base_api_url, swagger_endpoint_url, welcome_message, quick_suggestions
) VALUES (
    'cmms',
    'An CMMS',
    '["api"]',
    'cmms.rule.md',
    'http://localhost:5077',
    'http://localhost:5077/swagger/v1/swagger.json',
    'Xin chào! Tôi là Trợ lý AI của hệ thống An CMMS.' || char(10) || 'Tôi có thể hỗ trợ bạn tra cứu, tạo mới và thực thi các nghiệp vụ bảo trì, tài sản và sự cố bằng ngôn ngữ tự nhiên.',
    '["Xem danh sách các loại sự cố thiết bị", "Kiểm tra danh mục tài sản bảo trì", "Báo hỏng máy tính bảng tại chi nhánh 1"]'
);

INSERT OR IGNORE INTO orchestrator_applications (
    id, name, capabilities, rule_path, base_api_url, swagger_endpoint_url, schema_endpoint_url, sql_execute_endpoint, welcome_message, quick_suggestions
) VALUES (
    'report',
    'Dynamic Report',
    '["api", "sql"]',
    'anpos.rule.md',
    'http://localhost:5001',
    'http://localhost:5001/swagger/v1/swagger.json',
    'http://localhost:5001/api/ai-report/schema',
    '/api/ai-report/execute-sql',
    'Xin chào! Tôi là Trợ lý AI Phân tích Báo cáo Động.' || char(10) || 'Tôi có thể hỗ trợ bạn truy vấn số liệu thống kê, tổng hợp dữ liệu, vẽ biểu đồ, xuất bảng tính Excel và đưa vào quy trình tự động.',
    '["Tổng doanh thu 7 ngày gần đây", "Top 5 dịch vụ có giá cao nhất", "Thống kê doanh thu hôm nay theo chi nhánh", "Xem danh sách kết nối dữ liệu báo cáo"]'
);

INSERT OR IGNORE INTO orchestrator_applications (
    id, name, capabilities, rule_path, base_api_url, swagger_endpoint_url, schema_endpoint_url, sql_execute_endpoint, welcome_message, quick_suggestions
) VALUES (
    'anpos',
    'AnPOS / ERP Report',
    '["api", "sql"]',
    'anpos.rule.md',
    'http://localhost:5001',
    'http://localhost:5001/swagger/v1/swagger.json',
    'http://localhost:5001/api/ai-report/schema',
    '/api/ai-report/execute-sql',
    'Xin chào! Tôi là Trợ lý AI Báo cáo AnPOS.' || char(10) || 'Tôi có thể hỗ trợ bạn tổng hợp doanh thu, tra cứu hóa đơn và dữ liệu kinh doanh.',
    '["Doanh thu hôm nay", "Top sản phẩm bán chạy", "Thống kê theo ca làm việc"]'
);
