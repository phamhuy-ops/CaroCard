# M9 — Đo mạng và demo LAN

## Đo tự động trên máy phát triển

Từ thư mục gốc, chạy:

```powershell
$env:RECORD_MATCH = '1'
node apps/server/src/network-demo.ts
```

Kịch bản đo 20 ping WebSocket cho từng cấu hình 0, 100 và 300 ms mỗi chiều, cùng cấu hình 100 ms với jitter ±40 ms. Kịch bản jitter tạo phòng với seed 7, mua Brutal Ultimatum và xác minh phiên khôi phục sau 500 ms ngắt kết nối. Cùng ghế, ID popup và deadline phải được giữ nguyên; người nhận chọn **Chấp nhận** sau khi nối lại.

Để tái hiện bản ghi vừa tạo và đối chiếu mã băm ở từng sự kiện:

```powershell
$recording = Get-ChildItem records -Filter *.jsonl |
  Sort-Object LastWriteTime -Descending | Select-Object -First 1
node apps/server/src/replay-recording.ts $recording.FullName
```

Các bản ghi từ `pnpm dev` nằm ở `apps/server/records/`. Bản ghi chứa seed, thứ tự lệnh, timestamp và mã băm trạng thái. Git bỏ qua các thư mục `records/`.

### Mốc đo cục bộ

Lần chạy ngày 22/11/2026 đo trên một máy qua loopback, 20 mẫu mỗi cấu hình:

- 0 ms mỗi chiều — p50 1 ms, p95 1 ms.
- 100 ms mỗi chiều — p50 220 ms, p95 224 ms.
- 300 ms mỗi chiều — p50 625 ms, p95 632 ms.
- 100 ms mỗi chiều, jitter ±40 ms — p50 205 ms, p95 280 ms. Khôi phục popup sau 707 ms, gồm 500 ms ngắt kết nối chủ động. Ghế, ID và deadline giữ nguyên sau khi nối lại.

## A-05 — Thử trên máy tính và điện thoại

Lần đo trên điện thoại qua Wi-Fi với cấu hình 0 ms ghi nhận **p50 24 ms, p95 88 ms, 48 mẫu**. Log server của ván thử ghi **10.952 ms** từ lúc phát hiện mất kết nối tới lúc nhận lệnh khôi phục. Điện thoại nối lại sau khi popup Brutal Ultimatum 1★ hết giờ. Server tự chọn Chống lại và Shop khóa hai ô ở vòng tiếp theo. Trường hợp nối lại trước hạn đã được xác minh bằng kịch bản tự động.

1. Kết nối hai thiết bị vào cùng Wi-Fi. Dừng phiên `pnpm dev` đang chạy. Mở PowerShell ở gốc dự án và chạy:

   ```powershell
   $env:CAROCARD_LAN = '1'
   $env:DEBUG_MATCH_SEED = '7'
   $env:DEBUG_LATENCY_MS = '0'
   $env:DEBUG_JITTER_MS = '0'
   pnpm dev
   ```

2. Mở địa chỉ **Network** mà Vite in ra **trên cả hai thiết bị**. Tạo phòng, nhập mã phòng trên thiết bị còn lại, chọn hai mặt và tung xu. Mở **Đo mạng** trên cả hai thiết bị, rồi ghi p50 và p95 sau khi có ít nhất 20 mẫu. Tạo phòng mới sau mỗi lần đổi cấu hình và tải lại cả hai trang để làm mới số mẫu.
3. Với seed 7, chọn **Ngửa** trên máy tính và **Sấp** trên điện thoại để điện thoại nhận O. Ở vòng 1, X mua **Brutal Ultimatum** ở ô thứ tư. Cả hai bấm **Sẵn sàng**. X dùng thẻ, rồi người nhận O ngắt kết nối vài giây và nối lại trước khi hết 15 giây. Kiểm tra điện thoại vẫn ở ghế O, đồng hồ popup tiếp tục và lựa chọn **Chấp nhận** gửi được. Ghi lại thời gian **Khôi phục lần gần nhất** do trình duyệt báo.
4. Lặp lại lần lượt với `DEBUG_LATENCY_MS` bằng `100`, `300`, rồi `100` với `DEBUG_JITTER_MS` bằng `40`. Khởi động lại dev server khi đổi biến môi trường. Báo p50, p95, số mẫu, thời gian khôi phục và kết quả popup cho từng cấu hình. RTT của cấu hình 100 ms mỗi chiều thường tăng khoảng 200 ms so với mốc LAN; với 300 ms mỗi chiều, mức tăng lý thuyết là khoảng 600 ms.

Khi xong, dừng dev server và xóa các biến demo trong phiên PowerShell:

```powershell
Remove-Item Env:DEBUG_MATCH_SEED, Env:DEBUG_LATENCY_MS, Env:DEBUG_JITTER_MS, Env:RECORD_MATCH -ErrorAction SilentlyContinue
```
