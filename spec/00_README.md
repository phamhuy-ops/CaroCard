# CAROCARD — Bộ spec cho agent vibe code

Bộ này thay cho file `CAROCARD_Luat_Da_Chot.docx` khi giao việc cho AI agent. Luật được tách nhỏ để agent chỉ đọc phần cần cho bước hiện tại, số liệu được tách ra JSON, và mọi chỗ agent **không được tự quyết** đều có cổng dừng (gate) kèm mã.

## Thứ tự đọc
1. `AGENTS.md` — luật làm việc của agent (đọc đầu mỗi phiên).
2. `12_ROADMAP.md` — milestone hiện tại, việc cần làm, tiêu chí xong, prompt mẫu.
3. `13_DECISIONS_AND_GATES.md` — danh sách quyết định (D), việc cần người (A), phê duyệt (P).
4. Chỉ các file spec mà milestone yêu cầu:
   - `rules/01_rules_summary.md` … `rules/06_special_cards.md` — luật gốc, nguyên văn.
   - `data/constants.json`, `data/cards.json` — số liệu.
   - `10_ARCHITECTURE.md`, `11_UI_STYLE.md`, `14_TEST_PLAN.md`, `15_PLAYTEST.md`.

## Thứ tự ưu tiên khi các file mâu thuẫn
1. Câu trả lời của người dùng đã ghi trong `DECISIONS_LOG.md` (agent tạo file này).
2. `rules/01_rules_summary.md` và nội dung chính trong `rules/02`–`06`.
3. `data/*.json` (chỉ cho số liệu).
4. `10_ARCHITECTURE.md` (chỉ cho kỹ thuật, không được thay đổi luật chơi).

Nhật ký V2/V3/V4 của file gốc **đã bị loại** vì chứa luật cũ. Chỉ giữ lại các mục còn giá trị: chỉ số playtest và vấn đề cân bằng Makeshift Wall (xem `15_PLAYTEST.md`).

## Thay đổi so với file gốc
- Chỉ thêm hai ghi chú `[Làm rõ, chờ xác nhận ở D-03]` trong `rules/02_core_rules.md`. Các file luật còn lại giữ nguyên văn.
- `10_ARCHITECTURE.md` đã sửa lệch với luật: ACTION là 15 giây (bản kiến trúc cũ ghi 20 giây), Asmodeus chỉ giảm thời gian PREPARATION, nút Ready đã chốt, giữ ghế 45 giây đã chốt.

## Cấu trúc dự án đích
```
carocard/
  AGENTS.md  DECISIONS_LOG.md  OPEN_QUESTIONS.md  (agent duy trì)
  spec/            <- thư mục này, chỉ đọc
  packages/shared/       kiểu message, schema, DTO, mã lỗi
  packages/game-engine/  luật thuần, không I/O
  apps/server/           Room, WebSocket, timer, projection, log
  apps/web/              React + Vite
```
