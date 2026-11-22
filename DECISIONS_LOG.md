# Nhật ký quyết định

## 2026-11-21 — P-02

- Trả lời nguyên văn: `A`
- Quyết định: Duyệt kế hoạch M0.
- File bị ảnh hưởng: `DECISIONS_LOG.md`. Các file triển khai M0 sẽ được tạo sau khi qua các cổng liên quan.

## 2026-11-21 — A-01

- Trả lời nguyên văn: `A`
- Quyết định: Thiết lập pnpm cho tài khoản Windows.
- File bị ảnh hưởng: `DECISIONS_LOG.md` và bản cài pnpm trong `%APPDATA%\npm`.
- Xác minh bằng PATH của Windows: pnpm 11.25.0, Node.js 24.13.0 LTS, Git 2.55.0.windows.5.

## 2026-11-21 — A-02

- Trả lời nguyên văn: `A`
- Quyết định: Dùng thư mục hiện tại `C:\Users\Admin\source\CaroCard`, ngoài thư mục đồng bộ `C:\Users\Admin\OneDrive`.
- File bị ảnh hưởng: `DECISIONS_LOG.md`.

## 2026-11-21 — P-01

- Trả lời nguyên văn: `A`
- Quyết định: Duyệt pnpm workspaces, TypeScript strict, React, Vite, Node.js, ws, zod, Vitest, ESLint và các gói tích hợp hoặc khai báo kiểu cần thiết.
- File bị ảnh hưởng: `DECISIONS_LOG.md`, `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.js` và các manifest trong `apps/`, `packages/`.

## 2026-11-21 — P-05

- Trả lời nguyên văn: `A`
- Quyết định: Tạo commit đầu trên máy cho workspace M0, `AGENTS.md` và `spec/`. Giữ `CAROCARD_Luat_Da_Chot.docx` ngoài commit.
- File bị ảnh hưởng: `DECISIONS_LOG.md` và các file thuộc commit khởi tạo M0.

## 2026-11-21 — P-02 (M1)

- Trả lời nguyên văn: `A`
- Quyết định: Duyệt kế hoạch M1.
- File bị ảnh hưởng: `packages/game-engine/`, `apps/web/`, `pnpm-lock.yaml` và `DECISIONS_LOG.md`.

## 2026-11-21 — A-03 (M1)

- Trả lời nguyên văn: `approved`
- Quyết định: Xác nhận ván chơi thử hai người trên cùng máy đạt yêu cầu M1. Ảnh đính kèm hiển thị kết quả X thắng.
- File bị ảnh hưởng: `DECISIONS_LOG.md`.

## 2026-11-21 — P-05 (M1)

- Trả lời nguyên văn: `[https://github.com/phamhuy-ops/CaroCard.git](https://github.com/phamhuy-ops/CaroCard.git) đây là link hãy commit M1 lên với tiếng việt nha`
- Quyết định: Dùng lời nhắn tiếng Việt cho commit M1 và đẩy nhánh `main` lên GitHub.
- File bị ảnh hưởng: `DECISIONS_LOG.md` và cấu hình remote của repo local.

## 2026-11-21 — P-02 (M2)

- Trả lời nguyên văn: A
- Quyết định: Duyệt kế hoạch M2.
- File bị ảnh hưởng: DECISIONS_LOG.md. Phần triển khai chờ quyết định D-05.

## 2026-11-21 — D-05 (M2)

- Trả lời nguyên văn: A
- Quyết định: Hai người chọn hai mặt khác nhau. Chủ phòng tung xu 50/50 trên server. Người đoán đúng nhận X, người kia nhận O. Chủ phòng bắt đầu ván.
- File bị ảnh hưởng: packages/shared/, apps/server/, apps/web/, pnpm-lock.yaml và DECISIONS_LOG.md.

## 2026-11-21 — A-03 (M2)

- Trả lời nguyên văn: Ok xác nhận đạt nha
- Quyết định: Nghiệm thu ván thử qua hai tab. Ảnh đính kèm cho thấy hai ghế X/O trong cùng phòng với cùng bàn cờ và kết quả X thắng.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-21 — P-05 (M2)

- Trả lời nguyên văn: commit lên github tiếng việt
- Quyết định: Tạo commit M2 với lời nhắn tiếng Việt và đẩy nhánh main lên GitHub.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M2.

## 2026-11-21 — P-02 (M3)

- Trả lời nguyên văn: A
- Quyết định: Duyệt kế hoạch M3.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-21 — D-03 (M3)

- Trả lời nguyên văn: A
- Quyết định: Nếu cả hai offline, chờ ghế còn hạn quay lại. Người quay lại sau khi ghế kia hết hạn thắng. Nếu cả hai hết hạn, hủy ván. Kết quả đã xác nhận trên bàn cờ được giữ nguyên.
- File bị ảnh hưởng: apps/server/, apps/web/, packages/shared/ và DECISIONS_LOG.md.

## 2026-11-21 — A-04 (M3)

- Trả lời nguyên văn: t đã test thử và đã đúng
- Quyết định: Nghiệm thu M3 qua LAN trên máy tính và điện thoại. Ảnh cho thấy đồng hồ vẫn chạy khi X mất kết nối, điện thoại tự thử kết nối lại và O thắng khi ghế X hết hạn.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-21 — P-05 (M3)

- Trả lời nguyên văn: OK vậy push M3 lên thôi
- Quyết định: Tạo commit M3 bằng tiếng Việt và đẩy nhánh main lên GitHub.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M3.

## 2026-11-21 — P-02 (M4)

- Trả lời nguyên văn: A
- Quyết định: Duyệt kế hoạch M4.
- File bị ảnh hưởng: packages/game-engine/, packages/shared/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-21 — Nghiệm thu M4

- Trả lời nguyên văn: Ok đã ổn các chức năng ở trên
- Quyết định: Xác nhận Shop, Bench và các thao tác M4 hoạt động trong ván thử. Ảnh cho thấy Cutpurse 2★, ô đã mua để trống và các bản Piggy Bank giữ riêng.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-21 — P-05 (M4)

- Trả lời nguyên văn: M4 commit lên
- Quyết định: Tạo commit M4 bằng tiếng Việt và đẩy nhánh main lên GitHub.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M4.

## 2026-11-21 — P-02 (M5a)

- Trả lời nguyên văn: A
- Quyết định: Duyệt triển khai năm thẻ M5a.
- File bị ảnh hưởng: packages/game-engine/, packages/shared/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-21 — D-11 (M5a)

- Ghi nhận theo roadmap: Playtest combo Hair-Trigger + Aurelia Pocket hoặc Cutpurse. Giữ luật hiện tại trong M5a.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-22 — Nghiệm thu M5a

- Trả lời nguyên văn: Ok đã hoạt động
- Quyết định: Xác nhận M5a sau khi chơi thử. Ảnh trước và sau khi dùng Aurelia Pocket 1★ cho thấy X tăng từ 1 lên 4 xu, thẻ rời kho và lượt chuyển sang O.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-22 — P-05 (M5a)

- Trả lời nguyên văn: push lên git
- Quyết định: Tạo commit M5a bằng tiếng Việt và đẩy nhánh main lên GitHub.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M5a.

## 2026-11-22 — P-02 (M5b)

- Trả lời nguyên văn: A
- Quyết định: Duyệt kế hoạch M5b. Chờ quyết định D-12 về thời hạn phản hồi Ultimatum khi người nhận offline.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-22 — D-12 (M5b)

- Trả lời nguyên văn: A
- Quyết định: Ultimatum giữ hạn 15 giây khi người nhận offline. Hết hạn mặc định Chống lại nếu hợp lệ, nếu không thì Chấp nhận.
- File bị ảnh hưởng: packages/game-engine/, packages/shared/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-22 — Nghiệm thu và điều chỉnh M5b

- Trả lời nguyên văn: đã ok và cho ràng buộc khi đang áp dụng Ultimatum cho người chơi thì trong khi thẻ bài Ultimatum đang có tác dụng thì không thể sử dụng thẻ Ultimatum nữa mà phải chờ hết tác dụng của thẻ Ultimatum trước đó
- Quyết định: Xác nhận luồng M5b đã thử. Cả hai ghế phải chờ khi popup còn mở hoặc ràng buộc còn chờ áp dụng hay đang có hiệu lực. Kết quả tức thời không tạo thời gian chờ thêm.
- File bị ảnh hưởng: apps/server/src/room.ts, apps/server/src/normal.test.ts, packages/shared/src/protocol.ts, apps/web/src/online.tsx và DECISIONS_LOG.md.

## 2026-11-22 — P-05 (M5b)

- Trả lời nguyên văn: Ok tiếp tục
- Quyết định: Commit M5b bằng tiếng Việt và đẩy lên GitHub trước khi sang P-02 của M5c.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M5b.

## 2026-11-22 — P-02 (M5c)

- Trả lời nguyên văn: A
- Quyết định: Duyệt kế hoạch M5c. Triển khai New Angle trước, dừng ở D-01 trước khi triển khai Makeshift Wall.
- File bị ảnh hưởng: packages/game-engine/, packages/shared/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-22 — D-01 (M5c)

- Trả lời nguyên văn: A
- Quyết định: Tối đa 3 Makeshift Wall còn tồn tại trên bàn cho mỗi ghế. Mỗi lần dùng phải đủ số ô theo sao; tường bị phá giải phóng chỗ cho chủ sở hữu.
- File bị ảnh hưởng: packages/game-engine/, packages/shared/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-22 — Nghiệm thu và P-05 (M5c)

- Trả lời nguyên văn: Ok vậy là đc ko cần thử đâu tiếp tục push lên git
- Quyết định: Nghiệm thu M5c dựa trên kết quả kiểm tra hiện có, không yêu cầu thêm lượt chơi thử thủ công. Tạo commit tiếng Việt và đẩy nhánh main lên GitHub.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M5c.

## 2026-11-22 — P-02 và cập nhật Piggy Bank (M6)

- Trả lời nguyên văn: A à ngoài ra Piggy Bank khi mua thẻ thì chỉ có thể mua 1 thẻ duy nhất và thẻ piggy khi đã có trong kho thì ko xh trong shop và ko thể nhận đc thêm nữa nha vì piggy bank đã tự nâng cấp đc ko cần ghép sao
- Quyết định: Duyệt M6. Tối đa một Piggy Bank trên mỗi Bench. Khi đang sở hữu, bỏ các bản Piggy Bank khỏi Shop hiện tại và lần roll mới, đồng thời loại bản thứ hai khỏi các mục tiêu chuyển giao.
- D-04: Ghi nhận theo roadmap, giữ nguyên giá hiện tại và tối đa một bản của từng Special trên mỗi Bench.
- File bị ảnh hưởng: packages/game-engine/, packages/shared/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-22 — Nghiệm thu M6

- Trả lời nguyên văn: OK đã ổn nha
- Quyết định: Nghiệm thu M6. Ảnh thử cho thấy Powder Keg phá đúng một tường và Mirror Image tạo thêm Aurelia Pocket 1★.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-22 — P-05 (M6)

- Trả lời nguyên văn: Ok đẩy lên git giúp t bản M6
- Quyết định: Tạo commit M6 bằng tiếng Việt và đẩy nhánh main lên GitHub.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M6.

## 2026-11-22 — P-02 (M7)

- Trả lời nguyên văn: A
- Quyết định: Duyệt M7. Triển khai Malphas, Agares, Abaddon và Belial trước D-02; chờ quyết định về Asmodeus.
- File bị ảnh hưởng: packages/game-engine/, packages/shared/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-22 — D-02 (M7)

- Trả lời nguyên văn: A
- Quyết định: Dùng ngưỡng Asmodeus 7 giây theo thời điểm server nhận lệnh. Tính cả đúng mốc, loại trừ thời gian popup, không bù RTT.
- File bị ảnh hưởng: packages/game-engine/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-22 — Điều chỉnh thời gian M7

- Trả lời nguyên văn: tăng lên cho 30s chuẩn bị và 30s lượt nha (vì 20s chuẩn bị và 15s đặt sẽ khá căng thời gian cho người mới)
- Quyết định: Chuẩn bị và lượt Hành động thường mặc định 30 giây. Giữ ngưỡng Asmodeus 7 giây, cửa sổ Belial và Ultimatum 15 giây, giữ ghế 45 giây.
- File bị ảnh hưởng: packages/shared/data/timers.json, packages/shared/src/protocol.ts, apps/server/src/room.ts, apps/server/src/normal.test.ts và DECISIONS_LOG.md.

## 2026-11-22 — Điều chỉnh ngưỡng Asmodeus (M7)

- Trả lời nguyên văn: **Asmodeus:** tăng lên cho 10s để đặt thay vì 7s nha
- Quyết định: Ngưỡng Asmodeus là 10 giây, tính cả đúng mốc theo thời điểm server nhận lệnh và loại trừ thời gian popup.
- File bị ảnh hưởng: packages/shared/data/timers.json, apps/web/src/online.tsx, apps/server/src/normal.test.ts và DECISIONS_LOG.md.

## 2026-11-22 — Nghiệm thu M7

- Trả lời nguyên văn: Ok tiếp tục
- Quyết định: Xác nhận tiếp tục sau M7 với thời gian Chuẩn bị và Hành động thường 30 giây, ngưỡng Asmodeus 10 giây.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-22 — P-05 (M7)

- Trả lời nguyên văn: đẩy m7 lên git và chọn A cho m8
- Quyết định: Tạo commit M7 bằng tiếng Việt và đẩy nhánh main lên GitHub.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M7.

## 2026-11-22 — P-02 (M8)

- Trả lời nguyên văn: đẩy m7 lên git và chọn A cho m8
- Quyết định: Duyệt triển khai Holy Cross, Hell’s Dealer và kiểm tra tái hiện M8.
- File bị ảnh hưởng: packages/game-engine/, packages/shared/, apps/server/, apps/web/ và DECISIONS_LOG.md.

## 2026-11-22 — Nghiệm thu và P-05 (M8)

- Trả lời nguyên văn: commit lên git và tiếp tục (sau khi làm hết t sẽ yêu cầu bạn tạo cho t 1 list check để kt toàn bộ dự án)
- Quyết định: Commit M8 bằng tiếng Việt, đẩy nhánh main lên GitHub và tiếp tục sang P-02 của M9.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai M8.

## 2026-11-22 — P-02 (M9)

- Trả lời nguyên văn: A
- Quyết định: Duyệt kế hoạch M9. Chờ D-09 để chốt demo qua LAN hay Internet.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-22 — D-09 (M9)

- Trả lời nguyên văn: A thử mạng LAN trước sau này t sẽ thử triển khai như game online kết nối internet là chơi đc
- Quyết định: Demo M9 qua LAN trước. Demo qua Internet và HTTPS/WSS để sau.
- File bị ảnh hưởng: apps/server/, apps/web/, packages/shared/, kịch bản demo và DECISIONS_LOG.md.

## 2026-11-22 — A-05 (M9), đo trước trên máy chính

- Trả lời nguyên văn: chọn A nhưng bạn có thể đo giúp t đc ko
- Kết quả: Đã đo 20 mẫu mỗi cấu hình qua IP LAN của máy chính và proxy WebSocket. RTT p50/p95 (ms): 0 ms → 2/15; 100 ms → 218/222; 300 ms → 624/628; 100 ms và jitter ±40 ms → 218/252.
- Còn chờ: Xác minh LAN trên thiết bị thứ hai và nối lại giữa popup.
- File bị ảnh hưởng: DECISIONS_LOG.md.

## 2026-11-22 — A-05 (M9), số đo điện thoại

- Bằng chứng: Ảnh người dùng gửi từ điện thoại truy cập địa chỉ Wi-Fi của máy chính.
- Kết quả: RTT p50 24 ms, p95 88 ms, 48 mẫu ở cấu hình không mô phỏng trễ.
- Còn chờ: Đo thời gian khôi phục và xác minh nối lại giữa popup trên điện thoại.
- File bị ảnh hưởng: DECISIONS_LOG.md và docs/M9_NETWORK_DEMO.md.

## 2026-11-22 — A-05 (M9), thử nối lại trong ván

- Trả lời nguyên văn: khi tắt mạng và kết nối lại thì đã hết time nên brutal **Ultimatum** đã hết thời gian nên t cũng ko bik xảy ra gì
- Kết quả: Điện thoại nối lại thành công sau khi popup Brutal Ultimatum 1★ hết hạn. Log server ghi 10.952 ms từ lúc phát hiện mất kết nối tới lúc nhận lệnh khôi phục. Ảnh Shop cho thấy hai ô bị khóa, đúng nhánh Chống lại mặc định của D-12.
- Điều chỉnh: Hiển thị lựa chọn mặc định và hiệu ứng sau timeout cho riêng người nhận.
- File bị ảnh hưởng: DECISIONS_LOG.md, docs/M9_NETWORK_DEMO.md, apps/server/, apps/web/ và packages/shared/.

## 2026-11-22 — P-05 (M9)

- Trả lời nguyên văn: push lên git M9
- Quyết định: Commit M9 bằng tiếng Việt và đẩy nhánh main lên GitHub.
- File bị ảnh hưởng: DECISIONS_LOG.md và các tệp triển khai, kiểm thử, hướng dẫn demo M9.
