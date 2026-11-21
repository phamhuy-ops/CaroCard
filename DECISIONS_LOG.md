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
