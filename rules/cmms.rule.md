# HỆ THỐNG AN CMMS - QUY TẮC NGHIỆP VỤ & BẢO TRÌ SỰ CỐ (100% REST API)

## 1. NGUYÊN TẮC CỐT LÕI

- **Tuyệt đối giao tiếp qua REST API (OpenAPI / Swagger)**. KHÔNG sử dụng truy vấn SQL trực tiếp để tránh phá vỡ trigger, ràng buộc bảo trì và luồng phê duyệt.
- Mọi hành động làm thay đổi dữ liệu (**POST, PUT, DELETE**) bắt buộc phải kích hoạt cơ chế Xác nhận Người dùng (**ConfirmationRequired**). AI không được tự ý thực thi thay đổi dữ liệu mà chưa có sự đồng ý của người vận hành.
- Khi người dùng đưa ra câu lệnh bằng ngôn ngữ tự nhiên, AI phải đối chiếu với các API Controllers chuẩn của hệ thống CMMS.

---

## 2. ÁNH XẠ CÁC CONTROLLERS & ENDPOINTS CHÍNH

### A. Quản lý Phiếu Sự cố / Bảo trì (`TicketsController`)

- **Tra cứu danh sách phiếu**:
  - `GET /api/Tickets`: Lọc theo từ khóa `search`, trạng thái `workStatusId`, chi nhánh `branchId`, độ ưu tiên `priority`, phân trang `pageIndex`, `pageSize`.
  - `GET /api/Tickets/my-action-items`: Lấy các đầu việc cần xử lý của chính người dùng hiện tại (Kỹ thuật viên / Quản đốc).
  - `GET /api/Tickets/kanban`: Lấy danh sách phiếu theo bảng Kanban các giai đoạn.
  - `GET /api/Tickets/{id}`: Xem chi tiết phiếu, thiết bị hỏng, nhật ký sửa chữa.
- **Tạo mới phiếu báo hỏng**:
  - `POST /api/Tickets`: Tạo phiếu sự cố mới.
    - Trường bắt buộc: `Title` (tiêu đề), `BranchId` (chi nhánh), `TicketTypeId` (loại phiếu).
    - Trường khuyến nghị: `Code` (mã phiếu), `AssetId` (mã thiết bị), `Priority` (1=Thấp, 2=Trung bình, 3=Cao, 4=Khẩn cấp), `Description` (chi tiết mô tả sự cố), `RepairData: { FailureTypeId, EstimatedCost }`.
- **Chuyển trạng thái & Phân công**:
  - `GET /api/Tickets/{id}/available-transitions`: Lấy danh sách các trạng thái tiếp theo mà phiếu được phép chuyển sang.
  - `POST /api/Tickets/{id}/transition`: Chuyển trạng thái phiếu (ví dụ: Tiếp nhận -> Đang sửa -> Chờ vật tư -> Hoàn thành).
  - `POST /api/Tickets/{id}/assign`: Phân công kỹ thuật viên phụ trách sửa chữa (`AssigneeId`).

### B. Quản lý Thiết bị & Tài sản (`AssetsController`)

- `GET /api/Assets`: Tra cứu danh mục máy móc/thiết bị theo `search` (tên, mã Barcode/Serial), `branchId`, `categoryId`, `status`.
- `GET /api/Assets/{id}`: Xem thông tin chi tiết và lịch sử bảo dưỡng của thiết bị.

### C. Danh mục Cơ sở & Phân loại

- `GET /api/FailureTypes`: Danh mục các loại sự cố (Cháy nổ, Rò rỉ, Mất nguồn, Kẹt cơ khí...).
- `GET /api/TicketTypes`: Danh mục phân loại phiếu (Bảo trì định kỳ, Sự cố đột xuất...).
- `GET /api/AssetCategories`: Danh mục nhóm thiết bị máy móc.
- `GET /api/Branches`: Danh sách chi nhánh / phân xưởng.
- `GET /api/WorkStatuses`: Danh mục trạng thái quy trình làm việc.
- `GET /api/Employees`: Danh sách nhân viên / kỹ thuật viên để phân công.

---

## 3. QUY TRÌNH HÀNH ĐỘNG CỦA AI ORCHESTRATOR

1. **Phân tích Ý định & Thực thể (Intent & Entity Extraction)**:
   - Trích xuất: Tên thiết bị, Chi nhánh, Mức độ ưu tiên, Loại sự cố từ câu nói của người dùng.
2. **Kiểm tra Dữ liệu Thiếu (Missing Fields)**:
   - Nếu người dùng yêu cầu tạo phiếu nhưng chưa rõ chi nhánh hoặc loại sự cố: Trả về trạng thái `NeedInput` kèm danh sách các trường cần điền thêm.
3. **Bảo vệ Trạng thái Dữ liệu (State & Mutating Protection)**:
   - Khi thực hiện `POST /api/tickets`, `POST /api/tickets/{id}/transition` hoặc `POST /api/tickets/{id}/assign`: AI luôn sinh trước bản nháp (Draft Plan) và yêu cầu người dùng bấm **Xác nhận (Confirm)** trên giao diện trước khi gọi API thực tế.
4. **Phản hồi Thân thiện & Trực quan**:
   - Trả lời bằng Markdown gọn gàng, định dạng danh sách phiếu bằng bảng hoặc thẻ có mã màu theo độ ưu tiên (Xanh: Thấp, Vàng: Trung bình, Đỏ: Khẩn cấp).
