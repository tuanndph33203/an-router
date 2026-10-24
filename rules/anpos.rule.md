# TÀI LIỆU QUY CHUẨN NGHIỆP VỤ & TÀI CHÍNH BÁN HÀNG ANPOS / PRO_ERP (CẬP NHẬT CHUẨN SCHEMA DB)

## 1. NGUYÊN TẮC XÁC ĐỊNH THỜI GIAN CHỨNG TỪ

- **Ưu tiên ngày chứng từ thực tế**: Toàn bộ các giao dịch mua bán, sử dụng dịch vụ và hoàn trả luôn căn cứ theo ngày chứng từ nghiệp vụ thực tế ghi trên phiếu (`DocumentDate`). Bảng nào có ngày chứng từ thì sử dụng trực tiếp ngày chứng từ đó.
- **Tính liên tục của trục thời gian**: Khi lập báo cáo theo chuỗi ngày (như 7 ngày gần đây, 30 ngày gần đây), mốc kết thúc luôn là ngày hiện tại của hệ thống.

## 2. NGUYÊN TẮC CÔNG THỨC TÀI CHÍNH & DOANH THU

- **Giá niêm yết (Doanh thu gộp)**: Bằng đơn giá nhân với số lượng (`Price * Quantity` hoặc `Money`).
- **Chiết khấu (Giảm giá)**: `DiscountAmount` (+ `Discount2Amount` nếu có).
- **Thuế giá trị gia tăng (VAT)**: `VatAmount` hoặc `VatMoney`.
- **Tổng doanh thu từng luồng**: Bằng `(Price * Quantity) - DiscountAmount - Discount2Amount + VatAmount`.
- **Doanh thu thực thu**: Khoản tiền thực tế khách hàng thanh toán (`MoneyPay` hoặc `PayImmediately`). Không tính trừ vào thẻ trả trước, phiếu quà tặng.
- **Khoản hoàn trả**: Giảm trừ tương ứng khỏi tổng doanh thu và dòng tiền thực thu.

## 3. CẤU TRÚC 4 LUỒNG DOANH THU & TÊN BẢNG SQL CHÍNH XÁC TRONG CSDL

BẮT BUỘC sử dụng đúng 100% tên bảng và cột sau, tuyệt đối KHÔNG tự sáng tạo tên bảng như OrderService:

- **Luồng 1 - Dịch vụ Spa**:
  - Bảng Header: `SaleService` WITH (NOLOCK) (Khóa: `STTRec`, Ngày: `DocumentDate`, Mã phiếu: `DocumentNumber`, Chi nhánh: `BranchCode`, Trạng thái: `Status`)
  - Bảng Detail: `SaleServiceDetail` WITH (NOLOCK) (Khóa ngoại: `STTRec`, Mã DV: `ServiceCode`, Số lượng: `Quantity`, Đơn giá: `Price`, Thành tiền: `Money`, Chiết khấu: `DiscountAmount`, `Discount2Amount`, VAT: `VatAmount`, Thực thu: `MoneyPay`)
  - Điều kiện loại trừ phiếu hủy: `m.Status <> '10'`

- **Luồng 2 - Bán thẻ và gói dịch vụ**:
  - Bảng Header: `SaleBill` WITH (NOLOCK) (Khóa: `STTRec`, Ngày: `DocumentDate`, Mã phiếu: `DocumentNumber`, Chi nhánh: `BranchCode`, Trạng thái: `Status`)
  - Bảng Detail: `SaleBillDetail` WITH (NOLOCK) (Khóa ngoại: `STTRec`, Mã thẻ/DV: `ServiceCode`, Số lượng: `Quantity`, Đơn giá: `Price`, Thành tiền: `Money`, Chiết khấu: `DiscountAmount`, VAT: `VatMoney`, Thực thu: `MoneyPay`)
  - Điều kiện loại trừ phiếu hủy: `m.Status NOT IN ('10', '19')`

- **Luồng 3 - Bán thẻ khách vãng lai (NoName)**:
  - Bảng Header: `NoNameOrders` WITH (NOLOCK) (Khóa: `SttRec`, Ngày: `DocumentDate`, Mã phiếu: `DocumentNumber`, Chi nhánh: `BranchCode`, Trạng thái: `Status`)
  - Bảng Detail: `NoNameOrderDetail` WITH (NOLOCK) (Khóa ngoại: `SttRec`, Số lượng: `Quantity`, Đơn giá: `UnitPrice2`, Thành tiền: `Amount2`, Chiết khấu: `DiscountAmount`, VAT: `TaxAmount`, Thực thu: `PayableAmount`)
  - Lưu ý luồng NoName: Luôn dùng `UnitPrice2` và `Amount2` (không dùng UnitPrice/Amount).
  - Điều kiện loại trừ phiếu hủy: `m.Status <> '6'`

- **Luồng 4 - Giảm trừ Hoàn trả**:
  - Bảng Header: `SaleReturn` WITH (NOLOCK) (Khóa: `STTRec`, Ngày: `DocumentDate`, Chi nhánh: `BranchCode`, Trạng thái: `Status`, Số tiền hoàn trả thực tế: `MoneyPay`)
  - Điều kiện loại trừ phiếu hủy: `m.Status <> '6'`
  - Giá trị hoàn trả tính âm (-) vào Doanh thu và Thực thu.

- **Tổng hợp chung**:
  - Tổng doanh thu = Luồng 1 + Luồng 2 + Luồng 3 - Hoàn trả Luồng 4.
  - Tổng thực thu = Thực thu Luồng 1 + Thực thu Luồng 2 + Thực thu Luồng 3 - Hoàn trả Luồng 4.

## 4. DANH MỤC PHỤ TRỢ QUAN TRỌNG

- **Bảng Khách hàng**: Bảng `Customer` WITH (NOLOCK) (Điều kiện loại trừ bản ghi xóa: `ISNULL(IsDelete, 0) = 0`).
- **Bảng Ca làm việc**: Bảng là `Shifts` WITH (NOLOCK) (`Code`, `Name`, `StartTime`, `EndTime`, `BranchCode`, `ISNULL(IsGetDeleted, 0) = 0`).
  - Bắt buộc có chữ 's' (`Shifts`).
  - **QUY TẮC PHÂN BIỆT RÕ RÀNG**:
    - Khi người dùng hỏi về **Ca làm việc** (ví dụ: "Thống kê theo ca làm việc", "Danh sách ca làm việc", "Hệ thống có những ca nào", "Xem ca làm việc"): **CHỈ TRUY VẤN DUY NHẤT BẢNG `Shifts`** để hiển thị danh mục các ca (Mã ca, Tên ca, Giờ bắt đầu, Giờ kết thúc, Chi nhánh). **TUYỆT ĐỐI KHÔNG tự tiện JOIN bảng bán hàng hay tính toán doanh thu/tiền nong khi người dùng không yêu cầu về doanh thu**.
    - **CHỈ KHI NÀO** người dùng hỏi đích danh về **TIỀN / DOANH THU THEO CA** (ví dụ: "Doanh thu theo ca", "Doanh số từng ca", "Thống kê tiền bán hàng theo ca") thì mới được liên kết thời gian chứng từ với `[StartTime, EndTime]` của bảng `Shifts` để tính doanh thu.
- **Bảng Chi nhánh**: Bảng là `Branchs` WITH (NOLOCK) (`Code`, `Name`, có chữ 's').
- **Bảng Sản phẩm/Dịch vụ**: Bảng là `Product` WITH (NOLOCK) (`Code`, `Name`, `SellingPrice`, `ProductTypeCode`, `BranchCode`).
  - Dịch vụ Spa/Trị liệu: `ISNULL(Product.ProductTypeCode, '') <> '61'`.
  - Hàng hóa/Sản phẩm: `Product.ProductTypeCode = '61'`.
- **Bảng Phòng (Room)**:
  - Danh mục phòng: `Room` WITH (NOLOCK) (Mã phòng: `Code`, Tên phòng: `Name`, Chi nhánh: `BranchCode`).
  - Chỉ có dịch vụ Spa (`SaleServiceDetail`) mới thực hiện tại phòng (cột liên kết: `d.RoomCode = r.Code`). Các đơn bán thẻ (`SaleBill`) không phát sinh tại phòng.
  - Cú pháp chuẩn khi thống kê doanh thu theo phòng:
    ```sql
    SELECT
      ISNULL(r.Name, d.RoomCode) AS TenPhong,
      SUM(d.Money - d.DiscountAmount - ISNULL(d.Discount2Amount, 0) + ISNULL(d.VatAmount, 0)) AS DoanhThu
    FROM SaleServiceDetail d WITH (NOLOCK)
    INNER JOIN SaleService m WITH (NOLOCK) ON d.STTRec = m.STTRec
    LEFT JOIN Room r WITH (NOLOCK) ON d.RoomCode = r.Code
    WHERE m.Status <> '10' AND ISNULL(d.RoomCode, '') <> ''
    GROUP BY ISNULL(r.Name, d.RoomCode)
    ORDER BY DoanhThu DESC
    ```
- **Bảng Hình thức thanh toán (Tiền mặt, Chuyển khoản, Cà thẻ...)**:
  - Danh mục hình thức thanh toán: `PaymentTypes` WITH (NOLOCK) (`Code`, `Name`).
  - Dòng tiền thanh toán dịch vụ: `SaleServicePayment` WITH (NOLOCK) (`STTRec`, `TransTypeCode`, `MoneyPay`).
  - Dòng tiền thanh toán thẻ & gói: `SaleBillPayment` WITH (NOLOCK) (`STTRec`, `TransTypeCode`, `MoneyPay`).
  - Dòng tiền thanh toán thẻ vãng lai: `NoNameCardOrderPay` WITH (NOLOCK) (`SttRec`, `PaymentMethodCode`, `TotalAmount`).
  - **QUY TẮC BẮT BUỘC KHI TRUY VẤN HÌNH THỨC / PHƯƠNG THỨC THANH TOÁN**:
    - TUYỆT ĐỐI KHÔNG dùng tên cột bịa đặt như `PaymentMethod`, `PayMethod`, `PaymentType`.
    - TUYỆT ĐỐI KHÔNG tìm phương thức thanh toán trong các bảng Header `SaleService`, `SaleBill`, `NoNameOrders`.
    - Cú pháp chuẩn xác 100% để thống kê theo hình thức thanh toán:
      ```sql
      SELECT
        ISNULL(p.Name, t.TransTypeCode) AS HinhThucThanhToan,
        SUM(t.MoneyPay) AS TongTien
      FROM (
        SELECT TransTypeCode, MoneyPay FROM SaleServicePayment WITH (NOLOCK)
        UNION ALL
        SELECT TransTypeCode, MoneyPay FROM SaleBillPayment WITH (NOLOCK)
      ) t
      LEFT JOIN PaymentTypes p WITH (NOLOCK) ON t.TransTypeCode = p.Code
      GROUP BY ISNULL(p.Name, t.TransTypeCode)
      HAVING SUM(t.MoneyPay) > 0
      ORDER BY TongTien DESC
      ```
    - Nếu có lọc theo ngày (DocumentDate), JOIN với `SaleService` và `SaleBill` qua `STTRec` để lọc `DocumentDate`.

## 5. NGUYÊN TẮC FORWARD SANG API AI BÁO CÁO (DYNAMIC REPORT SERVICE)

- Khi người dùng hỏi về doanh thu, hóa đơn, báo cáo, ca làm việc, top sản phẩm, biểu đồ:
  - Action: "POST"
  - Endpoint: "/api/ai-report/execute-sql"
  - RequiresConfirmation:
    - Mặc định là FALSE nếu truy vấn có phạm vi an toàn, thời gian rõ ràng trong vòng 30 ngày (ví dụ: hôm nay, hôm qua, tuần này, tháng này, 7 ngày qua) hoặc có TOP <= 100.
    - BẮT BUỘC ĐẶT LÀ TRUE khi câu hỏi có phạm vi dữ liệu lớn: không có bộ lọc ngày (DocumentDate), hoặc khoảng thời gian > 3 tháng, cả năm, "từ trước đến nay", "toàn bộ", hoặc quét bảng chi tiết (SaleBillDetail, SaleServiceDetail, NoNameOrderDetail) mà không có giới hạn TOP.
    - Khi RequiresConfirmation = TRUE, trong `directAnswer` ghi cảnh báo chi tiết: "⚠️ Yêu cầu báo cáo này có phạm vi dữ liệu rất lớn (không giới hạn ngày / toàn bộ lịch sử / quét bảng chi tiết). Việc truy vấn có thể mất nhiều thời gian và tài nguyên hệ thống.\n\n👉 Bạn có thể bấm **Xác nhận thực hiện** bên dưới để tiếp tục, hoặc điều chỉnh câu hỏi thu hẹp thời gian (ví dụ: tháng này, tuần này) để truy vấn nhanh hơn."
  - Payload mẫu:
    ```json
    {
      "sql": "<Câu lệnh SELECT hợp lệ sử dụng đúng các bảng SaleService, SaleBill, NoNameOrders, SaleReturn, Shifts>",
      "applicationId": "UAT_anpos",
      "summary": "<Mô tả ngắn gọn báo cáo bằng tiếng Việt>",
      "chartSpec": {
        "type": "bar | line | pie",
        "title": "<Tiêu đề biểu đồ>",
        "labels": [],
        "datasets": [{ "label": "...", "data": [] }]
      }
    }
    ```
