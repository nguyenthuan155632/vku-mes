# Tài liệu Giải thích Cơ chế Hoạt động Lõi của hệ thống MES

Tài liệu này tổng hợp toàn bộ các phương thức, logic nghiệp vụ "(Engine)" do hệ thống backend tự động xử lý đằng sau giao diện để hiển thị các con số như "Đang chạy", "Đang dừng", "Tổng sản lượng CA", cũng như các cảnh báo quản lý công việc và OEE.

---

## 1. Cơ chế Start/Stop (Hoạt động / Dừng của Workcenter)

Khác với các hệ thống bấm nút thủ công, trạng thái "Chạy/Dừng" trong MES này được tính toán hoàn toàn **Tự động hóa dựa trên tín hiệu xung mạng (Pulse)** từ các cảm biến.

- **Máy Đang chạy (Running)**:
  Khi có tín hiệu nhịp/xung sản lượng (Pulse) liên tục được gửi từ cảm biến đếm lên Endpoint API. Mỗi lần nhận xung, hệ thống sẽ chốt thời điểm hoạt động cuối cùng của máy (`lastPulseAt`).

- **Máy Đang dừng / Vào trạng thái chờ (Stopped / Downtime Started)**:
  Được định nghĩa bởi ngưỡng **Silence Threshold (Ngưỡng thời gian im lặng)**.
  Nếu máy không gửi bất kỳ xung nào sau khoảng thời gian `alertThresholdMin` được cài đặt riêng cho máy đó (Ví dụ: Qua 5 phút mà không đếm được sản phẩm nào mới):
  - Hệ thống sẽ tự động chuyển trạng thái của máy sang "Dừng (Stopped)".
  - Tự động mở một bản ghi **Downtime open** (Phiên thời gian chết), lấy mốc thời gian bắt đầu chết máy bằng cách tính ngược (thời gian hiện tại trừ đi `alertThresholdMin` phút) nhằm đảm bảo sự chính xác tuyệt đối và bỏ qua độ trễ.
  - Sau đó, hệ thống sẽ xuất hiện một cảnh báo đỏ trên giao diện (ví dụ máy dừng 4 tiếng / 4 phiên khác nhau) buộc công nhân hoặc kỹ sư phải điền thông tin diễn giải tại sao máy dừng.

- **Khôi phục trạng thái (Resume / Downtime Closed)**:
  Nếu máy đang trong phiên dừng máy (`Downtime`) mà bỗng nhiên phát hiện có bất kỳ một nhịp tín hiệu đếm (Pulse) nào mới đến, hệ thống sẽ ngay lập tức **đóng phiên downtime lại (Downtime Closed)**, ghi nhận khoảng thời gian dừng bắt đầu và kết thúc, đồng thời lập tức khôi phục trạng thái lại là "Cảnh báo Xanh: Đang chạy".

## 2. Cơ chế Xác định ca làm việc (Shift Mechanism) và "Tổng sản lượng CA"

Chỉ số "Tổng sản lượng CA" dùng để đếm xem trong 1 ca làm việc đó máy làm được bao nhiêu hàng hóa. Hệ thống xử lý thời gian ca làm việc thực thi trực tiếp dựa theo khung **múi giờ Việt Nam (UTC+7)** và chia làm các khung giờ 12 tiếng cố định:

- **Ca 1 (Shift 1)**: Bắt đầu từ `08:00` sáng đến `20:00` tối cùng ngày.
- **Ca 2 (Shift 2)**: Bắt đầu vắt ngang ngày: Từ `20:00` tối hôm nay kéo dài đến `08:00` sáng ngày hôm sau.

_Nguyên lý chốt số_: Ngay khi bước qua 08:00 hoặc 20:00 (mốc giao ca), "Tổng sản lượng CA" sẽ tự động đặt lại (reset) về 0 để đếm cho một phiên làm việc mới của kíp công nhân mới. Các pulse gửi lên sẽ được ánh xạ chính xác vào id và thời gian của CA tương ứng để vẽ biểu đồ và chốt lương.

## 3. Cảnh báo Sản lượng Thấp (Low output / Low Quantity Threshold)

Từng Workcenter (chuyền / máy) cài đặt hai chỉ số: **Mục tiêu mỗi giờ (Target Qty/Hour)** và **Ngưỡng phần trăm giới hạn tối thiểu (Threshold %)**.

Một máy quét định kỳ (Worker Engine) sẽ kiểm tra **Sản lượng làm ra trong 1 giờ quá khứ gần nhất** (`lastHourQty`).

- Nếu số lượng hàng `lastHourQty` bé hơn tỷ lệ cho phép của mục tiêu (`Target/Hour` x `Threshold %`), thì một nhãn Cảnh báo `low_output` (Sản lượng cảnh báo thấp) sẽ đẩy lên màn hình để đốc công phân tích xem tốc độ làm việc chậm trễ do đâu.

## 4. Tổng Kết Cách tính Điểm số OEE (Hiệu suất tổng thể Thiết bị)

Hệ thống tính điểm tỷ lệ OEE tự động qua 3 cấu phần lõi theo khung CA:

1. **Khả dụng (Availability [%])**:
   = `Thời gian máy chạy thực tế (runtimeMin)` / `Kích thước của CA (ShiftLengthMin = 720 phút)`.
2. **Hiệu năng (Performance [%])**:
   = `Tổng sản phẩm thực tế nhặt được (totalQty)` / `Sản lượng đáng nhẽ phải đạt được ở năng suất 100% trong quãng thời gian Runtime`.
3. **Chất lượng (Quality [%])**:
   = `(Tổng Hàng - Hàng bị lỗi phế phẩm)` / `Tổng hàng hóa`.

> **OEE** = Availability × Performance × Quality (Giới hạn kịch điểm là 100%).
