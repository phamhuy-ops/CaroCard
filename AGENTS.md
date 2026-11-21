# AGENTS.md — Luật làm việc cho agent (CAROCARD)

Bạn đang xây CAROCARD: game Caro 15×15 hai người, có xu, Shop, thẻ bài và Demon, giao diện kiểu Balatro, chơi qua mạng bằng WebSocket. Đọc `00_README.md` trước.

## 1. Nguyên tắc bất biến
1. **Server là nguồn sự thật.** Client chỉ gửi ý định (command). Server suy ra người gửi từ phiên, kiểm tra phase, lượt, cửa sổ lựa chọn, xu, mục tiêu rồi mới đổi state.
2. **Engine thuần.** `game-engine` không gọi `Date.now()`, `Math.random()`, mạng hay file. Thời gian và RNG đi vào qua tham số. Cùng seed + cùng chuỗi lệnh ⇒ cùng kết quả.
3. **Không lộ thông tin riêng.** Shop, Bench, tiến độ lời nguyền và chi tiết giao dịch của một ghế **không bao giờ** xuất hiện trong dữ liệu gửi cho ghế kia (snapshot, kết quả lệnh, mã lỗi, log gửi client). Có test tự động chứng minh.
4. **Luật nằm trong spec, không nằm trong trí nhớ của bạn.** Trước khi code một thẻ hoặc cơ chế, mở đúng file `rules/*.md` và đọc lại đoạn đó. Không suy diễn từ tên thẻ.
5. **Số liệu lấy từ `data/*.json`**, không viết cứng trong code.
6. **Thứ tự xử lý hành động (nguyên tử):** áp dụng nước đi/hiệu ứng → thưởng tự động → Hell's Dealer → chuỗi 5 → hòa khi kín 225 ô. Ván kết thúc ngay khi xác nhận kết quả.

## 2. Quy trình mỗi milestone
1. Đọc milestone trong `12_ROADMAP.md` và các file spec nó liệt kê.
2. Viết **kế hoạch ngắn** (file nào, test nào, giả định nào). Nếu milestone có cổng **P-02**, dừng chờ người dùng duyệt.
3. Viết test **trước** cho các luật dễ sai (danh sách ở `14_TEST_PLAN.md`), rồi code.
4. Chạy `pnpm typecheck && pnpm lint && pnpm test`. Không báo "xong" nếu còn đỏ.
5. Báo cáo theo mẫu ở mục 5, rồi **dừng** chờ người dùng xác nhận trước khi sang milestone kế tiếp.

## 3. Giao thức cổng dừng (gate)
Có ba loại cổng, định nghĩa trong `13_DECISIONS_AND_GATES.md`:
- **D-xx — Quyết định thiết kế/cân bằng.** Agent không được tự chọn.
- **A-xx — Việc cần người làm** (cài đặt, chạy thử hai trình duyệt, cung cấp asset, thử mạng…).
- **P-xx — Phê duyệt** (thêm thư viện, đổi luật, xóa/refactor lớn, commit/push).

Khi gặp cổng, **dừng lại**, đừng viết code phụ thuộc vào câu trả lời, và gửi tin theo mẫu:

```
🛑 CẦN BẠN QUYẾT/HỖ TRỢ — <mã cổng>
Bối cảnh: <1–2 câu, kèm đường dẫn spec>
Lựa chọn: A) … (hệ quả) / B) … (hệ quả)
Đề xuất của tôi: <A/B> vì …
Nếu bạn chưa trả lời: tôi sẽ làm phần không phụ thuộc là <…>
```

Sau khi người dùng trả lời, ghi vào `DECISIONS_LOG.md` (mã, ngày, câu trả lời nguyên văn, file bị ảnh hưởng).

## 4. Khi spec im lặng, mâu thuẫn hoặc mơ hồ
- **Không tự sáng tạo luật.** Ghi vào `OPEN_QUESTIONS.md` (mã Q-xx, trích đoạn spec, các cách hiểu), rồi hỏi người dùng theo mẫu mục 3.
- Cho phép chọn tạm **chỉ khi** thay đổi nhỏ, đảo ngược dễ và không đổi kết quả thắng/thua: ghi rõ `ASSUMPTION` trong code và báo cáo.
- Không sửa `rules/*.md` và `data/*.json`. Nếu cho rằng spec sai, hỏi qua cổng **P-03**.

## 5. Mẫu báo cáo cuối milestone
```
Milestone: Mx — <tên>
Đã làm: <gạch đầu dòng ngắn>
Test: <số pass/fail>, <test mới đáng chú ý>
Giả định (ASSUMPTION): <liệt kê hoặc "không">
Câu hỏi mở: <Q-xx / "không">
Cần bạn: <các cổng A/D/P đang chờ>
Cách tự kiểm tra: <lệnh hoặc các bước bấm>
```

## 6. Điều cấm
- Cài thư viện ngoài danh sách đã duyệt ở **P-01**.
- Xóa file/thư mục, đổi cấu trúc repo, `git push`, `git reset --hard`, ghi đè lịch sử mà chưa có **P-04/P-05**.
- Tải font, ảnh, âm thanh từ internet khi chưa có **A-07** (license rõ ràng).
- Tự cân bằng lại (đổi giá, xác suất, số liệu thẻ) dù thấy "mất cân bằng". Chỉ ghi vào `15_PLAYTEST.md`.
- Đưa bí mật (token phiên) vào log hoặc URL.
- Dùng `localStorage` để lưu state ván đấu (chỉ được lưu token phiên để reconnect).

## 7. Chuẩn mã
TypeScript strict; validate mọi message vào server bằng schema (zod); giới hạn kích thước message; mã lỗi dạng enum trong `shared`; log JSON một dòng (`roomId`, `commandId`, `phase`, `revision`, `reason`, `ms`). Tên thẻ giữ tiếng Anh như spec; chữ giao diện tiếng Việt (xem D-07).
