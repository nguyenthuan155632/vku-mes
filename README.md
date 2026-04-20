# VKU MES — Hệ thống giám sát sản xuất

MES đơn giản cho nhà máy: ghi nhận tín hiệu bộ đếm phần cứng, hiển thị sản lượng theo ca và theo giờ, tính OEE, theo dõi dừng máy và cảnh báo, có vai trò quản lý / vận hành / xem.

## Yêu cầu hệ thống

- Docker và Docker Compose
- Node.js 20 (chỉ cần nếu muốn chạy simulator ngoài container)

## Khởi động nhanh

```bash
cp .env.example .env
# Đổi SESSION_SECRET và các mật khẩu cho môi trường production
docker compose up -d --build
# Seed 4 máy mẫu
docker compose exec web pnpm seed
# (Tuỳ chọn) chạy simulator bơm tín hiệu ảo:
node scripts/simulate-pulses.js --base http://localhost:3000 --token "$PULSE_INGEST_TOKEN" --password "$SUPERVISOR_PASSWORD"
```

Truy cập:

- `http://localhost:3000/` — bảng điều khiển vận hành
- `http://localhost:3000/supervisor` — trang quản lý (OEE, dừng máy, cảnh báo)
- `http://localhost:3000/admin/workcenters` — quản lý danh mục máy (chỉ `supervisor`)

## Tài khoản

| Vai trò      | Mật khẩu mặc định | Quyền                                  |
| ------------ | ----------------- | -------------------------------------- |
| `supervisor` | `supervisor123`   | Toàn quyền, xác nhận cảnh báo, tạo máy |
| `operator`   | `operator123`     | Nhập thủ công cho bất kỳ máy nào       |
| `viewer`     | `viewer123`       | Chỉ xem                                |

Thay đổi các mật khẩu trong `.env` trước khi đưa lên production.

## Kiến trúc

- `web` (container): Next.js 14 phục vụ UI và các API `/api/*`.
- `worker` (container): ticker 5 giây phát hiện dừng máy, cảnh báo và đóng ca.
- `db` (container): PostgreSQL 15 + TimescaleDB 2.x, lưu tín hiệu sản xuất dạng hypertable.

Ca 1: 08:00–20:00 (UTC+7). Ca 2: 20:00–08:00 hôm sau.

## Khắc phục sự cố

- **`web` khởi động nhưng không vào được `http://localhost:3000`**: kiểm tra `docker compose logs web`. Thường do migration lỗi (DB chưa healthy) — đợi rồi `docker compose restart web`.
- **Cổng 3000 đã được sử dụng**: đổi `ports: ["3001:3000"]` trong `docker-compose.yml`.
- **Giờ trên dashboard lệch**: kiểm tra biến `TZ=Asia/Ho_Chi_Minh` đã được truyền vào cả `web` và `worker`.
- **Alert không xuất hiện dù có máy dừng**: kiểm tra `docker compose logs worker` và chắc chắn `workcenters.alert_threshold_minutes` phù hợp (mặc định 10 phút).

## Phát triển

```bash
pnpm install
pnpm test          # chạy unit tests (Vitest)
pnpm typecheck     # kiểm tra TypeScript
pnpm lint          # ESLint
pnpm dev           # start Next.js dev server
```
