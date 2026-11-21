# 10 — Kiến trúc kỹ thuật (đã đồng bộ với luật đã chốt)

Chỉ quyết định kỹ thuật. Không được đổi luật chơi.

## 1. Stack (chờ duyệt ở P-01)
TypeScript strict · pnpm workspaces · React + Vite (web) · Node.js + `ws` (server) · `zod` (schema) · Vitest (test) · ESLint. Một tiến trình Node giữ các Room trong RAM và phục vụ bản web cùng origin. Demo LAN dùng HTTP/WS; qua Internet cần HTTPS/WSS (xem A-08). Server khởi động lại thì mất ván đang chơi (đúng spec).

## 2. Engine: reducer thuần + event
```ts
applyCommand(state, cmd, ctx: { now: number; rng: Rng }): { state; events: GameEvent[]; error?: ErrorCode }
advanceTime(state, now, rng): { state; events: GameEvent[] }   // xử lý hết hạn: timeout lượt, hết Prep, popup, ROUND END
```
- `Rng` là PRNG có seed (mỗi Room một seed, lưu lại). Mọi lần ngẫu nhiên (Shop, timeout đặt ngẫu nhiên, chọn mục tiêu thẻ, Block, Agares…) đi qua `rng`.
- Server chỉ làm: nhận lệnh → `applyCommand`; timer chỉ gọi `advanceTime`. Timer **không** chứa luật.
- `events` là bản ghi những gì đã xảy ra ("+1 xu", "thẻ bị phá", "tường xuất hiện"). Client dùng events để dựng animation (xem `11_UI_STYLE.md`). Event gửi cho client phải qua projection (mục 5).
- Hành động nguyên tử: một nước đặt/dời quân hoặc một lần dùng thẻ là **một giao dịch**; chuỗi kiểm tra thắng theo `data/constants.json → winCheckOrder`.

## 3. State và cửa sổ lựa chọn
- `phase`: `LOBBY | PREPARATION | ACTION | ROUND_END | FINISHED`.
- Mỗi ghế có `deadline` riêng ở PREPARATION (mặc định 20 s, giảm theo Asmodeus/Belial, sàn 5 s) và cờ `ready`.
- ACTION: X rồi O, 15 s mỗi lượt. Hết hạn mà chưa đặt dấu/dùng thẻ ⇒ engine đặt ngẫu nhiên một dấu vào ô trống (giữ phần đã làm dở nếu có).
- **ChoiceWindow** `{ id, seat, kind, deadline, resumeRemainingMs? }` cho Brutal Ultimatum (người nhận trả lời, 15 s, tạm dừng đồng hồ lượt chính) và lượt cưỡng ép của Belial (chủ Belial chọn ô, 15 s). Lệnh trả lời phải mang `windowId` đúng.
- Trạng thái thẻ Demon: `Locked → Unlocked → Contracted`, mỗi khế ước có bộ đếm riêng và `sourceId` để gỡ hiệu ứng đúng nguồn (Holy Cross).

## 4. Room, phiên, hàng đợi
- Mã Room mời người thứ hai; hai ghế X/O; chủ phòng bắt đầu khi cả hai đã chọn dấu. Mỗi ghế có **token phiên** riêng (chỉ lưu `sessionStorage`, gửi qua message, không đưa vào URL/log).
- Mỗi Room có **một hàng đợi tuần tự** cho cả lệnh lẫn timeout; chỉ một việc chạy tại một thời điểm.
- Lệnh có `commandId`, `windowId` (nếu có) và `expectedPhase`. Server loại lệnh trùng `commandId`, bỏ timeout cũ khi phase đã đổi. Mỗi commit tăng `revision`.
- Server dùng đồng hồ đơn điệu (`performance.now()`/`process.hrtime`) để xét hạn theo **thời điểm nhận lệnh**, kể cả đúng mốc. Client chỉ dùng `serverTime`, `deadline` và ước lượng lệch giờ để hiển thị.
- Kiểm tra theo ghế và cửa sổ, **không** từ chối lệnh của X chỉ vì revision của Room đổi do O.

## 5. Projection (chống lộ thông tin)
Một state đầy đủ trên server → hai snapshot theo ghế.
- **Công khai:** bàn cờ (X/O, Dark Wall, Makeshift Wall), round, phase, lượt, xu của hai bên, deadline liên quan, các hiệu ứng đã xảy ra.
- **Riêng tư (chỉ chủ ghế):** nội dung Shop 4 ô, Bench 5 ô, tiến độ lời nguyền, chi tiết giao dịch.
- Với Cutpurse, Belial, Jester: chỉ công bố **tên thẻ đã dùng** và có thể báo số lượng bị tác động; không lộ tên hoặc số sao của thẻ ẩn bị tác động.
- Lọc luôn **kết quả lệnh, mã lỗi, log và event** theo cùng danh sách trường cho phép. Ví dụ Cutpurse luôn dùng được kể cả khi Bench địch không có mục tiêu, nên lỗi không được phân biệt "có/không có mục tiêu" cho người dùng.
- Snapshot gửi nguyên JSON sau mỗi commit. Chỉ cân nhắc delta nếu đo thấy cần.

## 6. Kết nối lại
Heartbeat Ping/Pong phát hiện socket chết. Client reconnect có backoff, gửi token để lấy lại đúng ghế, server vô hiệu socket cũ và gửi full snapshot đã projection (revision, deadline còn hiệu lực, ChoiceWindow đang chờ nếu ghế đó có quyền). Đồng hồ **không dừng** khi mất kết nối; giữ ghế 45 s. Client đối chiếu lệnh chưa có phản hồi theo `commandId`. Các tình huống chưa rõ (cả hai offline, hết hạn ghế) dừng ở **D-03**.

## 7. Đo mạng và log
- Ping/Pong WebSocket cho heartbeat; ping/echo tầng ứng dụng để trình duyệt đo RTT (báo p50/p95).
- Log JSON: `roomId, commandId, phase, revision, reason, ms, snapshotBytes, reconnectMs`.
- Chế độ debug cho phép mô phỏng độ trễ 0/100/300 ms mỗi chiều và jitter (bật bằng biến môi trường, tắt mặc định).
- Lưu seed + chuỗi lệnh của mỗi ván ra file khi bật `RECORD_MATCH=1` để replay tái hiện lỗi.

## 8. An toàn tối thiểu
Validate mọi message bằng schema; giới hạn kích thước message và tần suất lệnh mỗi socket; kiểm tra `Origin` WebSocket; không tin bất cứ trường nào từ client về ghế/lượt/xu.

## 9. Bố cục repo
```
packages/shared        message types, zod schema, DTO công khai/riêng, ErrorCode
packages/game-engine   board, economy, shop, cards, demons, phase, rng, win
apps/server            rooms, ws, queue, timers, projection, logging, debug-latency
apps/web               lobby, board, clock, shop, bench, popups, connection status
```
