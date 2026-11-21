# 11 — Giao diện kiểu Balatro

Lấy **cảm hứng** về cảm giác, không sao chép asset, tên, logo hay bố cục có bản quyền của Balatro. Asset phải do người dùng cung cấp hoặc có license mở (A-07). Mặc định agent dùng placeholder (CSS, emoji, âm thanh tạo bằng Web Audio).

## Nguyên tắc
1. **Chức năng trước, trang trí sau.** Mỗi milestone có UI tối thiểu dùng được. Milestone M10 mới làm đợt "juice" toàn diện.
2. **Animation chạy từ `events`.** Client nhận snapshot + events; áp snapshot cuối, rồi phát animation theo thứ tự events. Animation không được làm thay đổi state hay chặn thao tác hợp lệ quá 600 ms.
3. **Không lộ thông tin qua giao diện.** Animation của hành động địch (Cutpurse, Belial, Jester) chỉ hiện tên thẻ đã dùng, không hiện thẻ bị tác động (xem projection).
4. **Tôn trọng `prefers-reduced-motion`** và có nút tắt rung màn hình/CRT.

## Gợi ý kỹ thuật (chờ P-01 nếu cần thêm thư viện)
- Thẻ bài: DOM + CSS 3D (nghiêng theo con trỏ, nảy khi mua/ghép sao, rung khi bị phá, tỏa sáng khi lên sao). Framer Motion hoặc react-spring cho chuyển động.
- Bàn 15×15: CSS grid là đủ (225 ô). Quân đặt xuống có hiệu ứng "đóng dấu"; tường có chất liệu khác nhau (Dark Wall vs Makeshift Wall).
- Nền: canvas WebGL nhỏ với fragment shader xoáy màu; lớp CRT/scanline nhẹ tùy chọn.
- Số xu "nhảy", đồng hồ có màu cảnh báo khi còn ≤5 s, pop-up Ultimatum/Belial có đếm ngược 15 s rõ ràng.
- Âm thanh: tiếng đặt quân, mua, ghép sao, đồng hồ, thắng/thua; có nút tắt tiếng.

## Màn hình cần có
Lobby (tạo/vào phòng, mã mời, chọn X/O, chủ phòng bắt đầu) · Bàn cờ + đồng hồ + xu + round/phase · Shop 4 ô (Reroll, Hold, ô Block, ô Demon) · Bench 5 ô (kéo thả, ghép sao, hủy khế ước) · Pop-up Ultimatum / Belial / chọn mục tiêu / Holy Cross · Trạng thái kết nối (RTT, đang kết nối lại, đếm 45 s) · Màn hình kết quả (thắng/thua/hòa, lý do, chơi lại).

## Việc cần người
Font, bảng màu cuối, nhạc nền, artwork thẻ: A-07 / D-08. Ngôn ngữ giao diện: D-07.
