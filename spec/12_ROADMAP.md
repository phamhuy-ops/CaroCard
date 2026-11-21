# 12 — Lộ trình theo milestone

Mỗi milestone: **Đọc** (spec cần mở) → **Làm** → **Xong khi** → **Cổng** (dừng chờ người dùng) → **Prompt mẫu** (người dùng dán cho agent).
Mọi milestone đều có cổng **P-02** (duyệt kế hoạch) ở đầu và báo cáo theo mẫu `AGENTS.md` ở cuối. Agent không tự sang milestone kế tiếp.

---
## M0 — Khởi tạo dự án
**Đọc:** `AGENTS.md`, `10_ARCHITECTURE.md` mục 1 và 9.
**Làm:** monorepo pnpm (shared, game-engine, server, web), TypeScript strict, ESLint, Vitest, script `typecheck/lint/test/dev`, copy bộ spec vào `spec/` (chỉ đọc), tạo `DECISIONS_LOG.md`, `OPEN_QUESTIONS.md`.
**Xong khi:** `pnpm install && pnpm typecheck && pnpm test` chạy xanh với một test mẫu.
**Cổng:** A-01 (Node, pnpm, git), A-02 (thư mục dự án, tránh OneDrive), P-01 (danh sách thư viện), P-05 (commit đầu).
**Prompt:** "Đọc AGENTS.md và 12_ROADMAP.md, thực hiện M0. Gặp cổng nào thì dừng hỏi tôi."

## M1 — Engine bàn cờ và luật thắng (chưa có mạng)
**Đọc:** `rules/02_core_rules.md` (luật thắng, bàn đầy), `data/constants.json`.
**Làm:** bàn 15×15, đặt quân, ô "đã chiếm" (quân, Dark Wall, Makeshift Wall), thắng ≥5 liên tiếp kể cả chặn hai đầu, hòa khi kín 225 ô, đường ống nguyên tử theo `winCheckOrder` (Hell's Dealer là chỗ trống để nối sau), `Rng` có seed, UI hot-seat rất đơn giản để thử.
**Xong khi:** test M1 trong `14_TEST_PLAN.md` mục A đều xanh; hai người thử đánh một ván trên một máy.
**Cổng:** A-03 (bạn chơi thử hot-seat và xác nhận).
**Prompt:** "Thực hiện M1 theo 12_ROADMAP.md, viết test mục A trước."

## M2 — Room, phiên và WebSocket
**Đọc:** `rules/02_core_rules.md` (phòng, kết nối), `10_ARCHITECTURE.md` mục 3–5.
**Làm:** tạo/vào Room bằng mã, chọn X/O, chủ phòng bắt đầu, token phiên, snapshot projection, hàng đợi tuần tự, `commandId`, `revision`, đặt quân qua mạng, log JSON.
**Xong khi:** hai tab trình duyệt chơi hết một ván Caro; test mục F (lộ thông tin, lệnh trùng) xanh.
**Cổng:** A-03 (thử hai tab), D-05 (vòng quay chọn X/O hay chọn tay).
**Prompt:** "Thực hiện M2; trước khi code hãy hỏi tôi D-05."

## M3 — Phase, đồng hồ, timeout, kết nối lại
**Đọc:** `rules/02_core_rules.md` (phase, đồng hồ, ROUND END), `10_ARCHITECTURE.md` mục 3, 4, 6.
**Làm:** PREPARATION (deadline riêng, Ready), ACTION 15 s, ROUND END theo thứ tự cố định, timeout đặt ngẫu nhiên, đồng hồ đơn điệu, khung ChoiceWindow (chưa có thẻ), reconnect bằng token, giữ ghế 45 s.
**Xong khi:** test mục B và G xanh; ngắt mạng một tab giữa lượt, quay lại vẫn đúng ghế và đúng deadline.
**Cổng:** **D-03** (cả hai offline, hết hạn ghế: xử thắng hay hủy ván), A-04 (thử hai máy LAN, mở firewall).
**Prompt:** "Thực hiện M3; dừng ở D-03 trước khi viết phần ghế hết hạn."

## M4 — Kinh tế, Shop, Bench, ghép sao
**Đọc:** `rules/02_core_rules.md` (xu), `rules/03_cards_shop_economy.md`, `data/*.json`.
**Làm:** xu đầu ván X=3/O=4, +1 mỗi round, Shop 4 ô theo bảng rarity và RNG seed, Reroll (miễn phí tối đa 3), Hold, Block, Bench 5 ô, mua/hủy, ghép 3 → sao, Special 1 bản/Bench, Piggy Bank không ghép. Thẻ chưa có hiệu ứng thì để placeholder không làm gì.
**Xong khi:** test mục C xanh; xác suất Shop mô phỏng 10.000 lần khớp bảng (sai số hợp lý); dữ liệu Shop/Bench địch không lộ.
**Cổng:** không có D mới (nếu gặp chỗ spec im lặng thì Q-xx).
**Prompt:** "Thực hiện M4 theo 12_ROADMAP.md."

## M5a — Normal Card: Interest và Buff đơn giản
**Đọc:** `rules/05_normal_cards.md` (INT-C01, INT-R01, BUF-C01, BUF-C02, BUF-L01).
**Làm:** Aurelia Pocket, Piggy Bank, Rarity Up, Hair-Trigger, Angel of Mercy's Thesis; thứ tự Interest ở ROUND END; cooldown, cho phép dùng thẻ làm mất lượt đặt dấu.
**Xong khi:** test mục D (thẻ tương ứng) xanh.
**Cổng:** D-11 chỉ ghi nhận: combo Hair-Trigger với Aurelia/Cutpurse để playtest, không chỉnh.

## M5b — Normal Card: Debuff
**Đọc:** `rules/05_normal_cards.md` (DEB-*).
**Làm:** Shop Disruption, Cutpurse, Brutal Ultimatum (ChoiceWindow 15 s, tạm dừng đồng hồ chính), Jester's Bargain, Horseman of Rust, The Great Corruption; kiểm thử projection cho mọi thẻ nhắm vào Bench/Shop địch.
**Xong khi:** test mục D và F xanh; popup Ultimatum khôi phục đúng phần thời gian còn lại; Angel chặn đúng Debuff.
**Cổng:** D-12 (Ultimatum khi người nhận đang offline: theo timeout hay chờ kết nối lại).

## M5c — Buff bàn cờ
**Đọc:** `rules/05_normal_cards.md` (BUF-R01, BUF-E01), `rules/02_core_rules.md` (ô trống, bàn đầy), `15_PLAYTEST.md` mục 3.
**Làm:** New Angle, Makeshift Wall.
**Cổng:** 🛑 **D-01** — **bắt buộc trả lời trước khi code Makeshift Wall** (mô phỏng cũ cho thấy hòa gần 100%). Làm New Angle trước trong lúc chờ.
**Xong khi:** test mục D và A (tường tính là ô đã chiếm) xanh.

## M6 — Special Card (Powder Keg, Mirror Image)
**Đọc:** `rules/06_special_cards.md` (SPC-02, SPC-03).
**Làm:** hai thẻ này (Holy Cross để M8). Kiểm tra Powder Keg phá được Makeshift Wall nhưng không phá Dark Wall.
**Xong khi:** test mục D (Special) xanh.
**Cổng:** D-04 (giới hạn bản sao chung và khoảng giá Special, hiện chỉ ghi nhận).

## M7 — Demon (Malphas, Agares, Asmodeus, Belial, Abaddon)
**Đọc:** `rules/04_demons.md` toàn bộ.
**Làm:** trạng thái Locked/Unlocked/Contracted, tối đa 2 Locked, cơ chế mua + roll hai lần/tối đa 2 Demon khác tên mỗi Shop, trọng số xuất hiện, Demon không Hold, bộ đếm lời nguyền và điều kiện reset (tiêu xu, dùng thẻ…), phần thưởng và hủy khế ước, thứ tự xử lý phần thưởng cùng lúc.
**Làm theo thứ tự:** Malphas → Agares (Anti-Instant-Win) → Abaddon → Belial (ChoiceWindow) → Asmodeus.
**Cổng:** 🛑 **D-02** trước khi code ngưỡng 7 giây của Asmodeus (bù trễ mạng). Làm bốn Demon còn lại trước.
**Xong khi:** test mục E xanh.

## M8 — Holy Cross và Hell's Dealer
**Đọc:** `rules/06_special_cards.md` (SPC-01), `rules/04_demons.md` (Hell's Dealer), `14_TEST_PLAN.md` mục E, H.
**Làm:** Holy Cross đủ ba nhánh (đúng/sai/tự giải trừ) và phản đòn từng Demon, Hell's Dealer xét trước chuỗi 5, test tương tác chéo.
**Xong khi:** test mục E, H xanh; chạy bộ test tái hiện (seed + log lệnh) ổn định 100 lần.

## M9 — Đo mạng và demo
**Đọc:** `10_ARCHITECTURE.md` mục 6–7.
**Làm:** RTT ping/echo (p50/p95), mô phỏng trễ 0/100/300 ms mỗi chiều, jitter, ngắt mạng giữa popup, kịch bản demo, bảng kết quả.
**Cổng:** A-05 (người chạy demo trên hai thiết bị/hai trình duyệt, ghi số), A-08 (HTTPS/WSS nếu demo qua Internet), D-09 (LAN hay Internet).
**Xong khi:** có báo cáo số liệu + kịch bản demo chạy lặp lại được.

## M10 — Đợt "juice" kiểu Balatro
**Đọc:** `11_UI_STYLE.md`.
**Cổng:** A-07 (asset/font/âm thanh), D-08 (bảng màu và hướng nghệ thuật), D-07 (ngôn ngữ).
**Xong khi:** animation chạy từ events, có thể tắt rung/CRT, `prefers-reduced-motion` được tôn trọng, không làm chậm thao tác.

## M11 — Playtest và báo cáo cân bằng
**Đọc:** `15_PLAYTEST.md`.
**Làm:** thêm chế độ ghi log số liệu ván, script thống kê. **Không tự chỉnh số liệu.**
**Cổng:** A-06 (người chơi thật, tối thiểu 10 ván), D-01/D-11 xem lại theo số liệu.
