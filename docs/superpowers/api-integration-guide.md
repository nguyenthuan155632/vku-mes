# Hướng dẫn Tích hợp API Cảm biến Đếm Sản lượng (Counter Sensor)

Tài liệu này cung cấp hướng dẫn chi tiết cách thức sử dụng API để cập nhật sản lượng từ một thiết bị cảm biến (counter sensor) bên ngoài vào hệ thống MES.

## 1. Thông tin chung về API

- **Endpoint**: `/api/pulse`
- **Method**: `POST`
- **Mục đích**: Nhận dữ liệu (xung/nhịp) đếm sản lượng từ các thiết bị cảm biến phần cứng bên ngoài và ghi nhận vào hệ thống.
- **Content-Type**: `application/json`

## 2. Xác thực (Authentication)

API sử dụng cơ chế xác thực bằng mã thông báo (Bearer Token). Bạn cần đính kèm token vào trong HTTP header `Authorization` của mỗi request gửi lên.

Token này được lưu trữ trong biến môi trường `PULSE_INGEST_TOKEN` của hệ thống máy chủ MES. Hãy liên hệ người quản trị hệ thống để lấy chuỗi token chính xác này.

**Định dạng thiết lập Header:**
```http
Authorization: Bearer <PULSE_INGEST_TOKEN>
```

## 3. Cấu trúc Payload (Request Body)

Dữ liệu được gửi lên server phải được định dạng chuẩn JSON và bắt buộc bao gồm các trường dữ liệu sau:

| Thuộc tính | Kiểu dữ liệu | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `workcenter_id` | Số nguyên (Integer) > 0 | Có | ID của chuyền/máy (workcenter) mà cảm biến đang được gắn vào để theo dõi. |
| `qty` | Số nguyên (Integer) >= 0 | Có | Số lượng sản phẩm đếm được trong đợt gửi. (Thường là `1` cho mỗi nhịp đếm từ cảm biến, hoặc tổng số nếu gom nhóm tín hiệu). |
| `source` | Chuỗi (String) | Có | Nguồn gửi dữ liệu. Bắt buộc phải truyền giá trị đích danh là `"sensor"`. |

**Ví dụ một Request hoàn chỉnh (JSON):**
```json
{
  "workcenter_id": 1,
  "qty": 1,
  "source": "sensor"
}
```

## 4. Kết quả Trả về (Response)

### 4.1. Cập nhật thành công
- **HTTP Status Code:** `201 Created`
- **Body:** Null (hệ thống không biểu diễn nội dung nhằm tiết kiệm băng thông).

### 4.2. Lỗi thông dụng
Nếu có lỗi xảy ra, API sẽ trả về HTTP Status Code tương ứng kèm cấu trúc JSON mô tả lỗi:

**Lỗi sai Token hoặc không có Token (401 Unauthorized):**
```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid ingest token"
  }
}
```

**Lỗi dữ liệu cấu trúc không hợp lệ (400 Bad Request):**
Xảy ra khi thiếu các trường bắt buộc, giá trị `qty` nhỏ hơn 0, hoặc `source` truyền sai giá trị.
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Dữ liệu không hợp lệ"
  }
}
```

## 5. Hướng dẫn Tích hợp Chi tiết (Ví dụ Code / Pseudocode)

Dưới đây là một số ví dụ minh họa cách lập trình nhúng / gọi lệnh trên các môi trường kết nối khác nhau để gửi dữ liệu vào API này:

### Cách 1: Chạy kiểm thử thủ công qua CLI bằng cURL
Bạn có thể dùng công cụ dòng lệnh cURL để giả lập hành động phần cứng gửi xung:

```bash
curl -X POST http://<TEN-MIEN-HOAC-IP>/api/pulse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_PULSE_INGEST_TOKEN_HERE" \
  -d '{
    "workcenter_id": 1,
    "qty": 1,
    "source": "sensor"
  }'
```

### Cách 2: Tích hợp Firmware với Arduino / ESP32 (C/C++)
Nếu bạn dùng vi điều khiển ESP32, đoạn mã dưới đây cung cấp hàm gửi POST request chuẩn tới MES:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* serverUrl = "http://<TEN-MIEN-HOAC-IP>/api/pulse";
const char* token = "YOUR_PULSE_INGEST_TOKEN_HERE";

void updateProduction(int workcenterId, int quantity) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    
    // Gắn Headers cần thiết
    http.addHeader("Content-Type", "application/json");
    
    String authHeader = String("Bearer ") + token;
    http.addHeader("Authorization", authHeader);
    
    // Build JSON Payload
    String requestBody = "{\"workcenter_id\":" + String(workcenterId) + 
                         ",\"qty\":" + String(quantity) + 
                         ",\"source\":\"sensor\"}";
    
    // Exec POST
    int httpResponseCode = http.POST(requestBody);
    
    if (httpResponseCode == 201) {
      Serial.println("Cập nhật sản lượng lên MES thành công!");
    } else {
      Serial.print("Phát hiện lỗi HTTP khi kết nối API: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  } else {
    Serial.println("Chưa có kết nối WiFi");
  }
}
```

### Cách 3: Tích hợp Cảm biến điều khiển bởi Máy tính / Raspberry Pi (Python)
Script mô tả gửi request bằng Python sử dụng cấu trúc `requests`:

```python
import requests
import json

URL = "http://<TEN-MIEN-HOAC-IP>/api/pulse"
TOKEN = "YOUR_PULSE_INGEST_TOKEN_HERE"

def trigger_sensor_pulse(workcenter_id: int):
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}"
    }
    payload = {
        "workcenter_id": workcenter_id,
        "qty": 1,
        "source": "sensor"
    }

    try:
        response = requests.post(URL, headers=headers, data=json.dumps(payload))
        if response.status_code == 201:
            print("Đẩy dữ liệu sản lượng (1 pulse) thành công")
        else:
            print(f"Báo lỗi mạng đẩy MES - Status: {response.status_code}, Msg: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"Kết nối MES Server gặp sự cố đứt đoạn: {e}")

# Khi chân GPIO bắt được sự kiện kích hoạt xung đầu vào, hãy gọi lệnh:
# trigger_sensor_pulse(workcenter_id=1)
```
