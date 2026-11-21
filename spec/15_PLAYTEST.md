# 15 — Playtest và cân bằng (chỉ ghi nhận, agent không tự chỉnh)

## 1. Chỉ số cần đo
- Tỉ lệ thắng của X và O (mục tiêu 48–52%); tỉ lệ hòa.
- Người đi đường Demon đạt Hell's Dealer: mục tiêu **12–15%** số ván; tổng tỉ lệ thắng của họ.
- Tần suất Shop có Demon theo giai đoạn so với 8% / 16% / 34%.
- Tỉ lệ Holy Cross trúng (Malphas phổ biến nhất nên dễ bị đoán).
- Holy Cross lên Demon Unlocked so với Contracted.
- Số lần Belial vô tình tạo chuỗi thắng cho đối thủ.
- Chênh lệch xu giữa hai bên theo round, số round để khoảng cách hình thành, khả năng phục hồi của bên bị dẫn trước.
- Độ dài ván (số round), thời gian thực.

## 2. Dữ liệu mô phỏng cũ (tham khảo, hạn chế lớn)
Bot Caro đơn giản, đối thủ không dùng thẻ: Hell's Dealer khoảng 13–15% số ván (median khoảng round 33), tổng thắng khoảng 24–26%. Bot hay phòng thủ đến hòa nên ván bị kéo dài; hiệu ứng thẻ lên bàn chỉ mô phỏng một phần; lời nguyền được giả định luôn hoàn thành. **Cần playtest thật để xác nhận.**

## 3. Vấn đề đã biết: Makeshift Wall
Bot dùng Makeshift Wall chặn mọi thế 3 mở ⇒ 98–99% ván bot-với-bot hòa (21% khi không có thẻ). Nếu tường tốn lượt vẫn khoảng 92% hòa; giới hạn tối đa 3 tường mỗi người còn khoảng 56–58% hòa. Hướng thử: giới hạn số tường, tường tạm thời, cấm đặt lên ô mở rộng chuỗi 3 của đối thủ. Quyết định ở **D-01**.

## 4. Định hướng bổ sung từ luật
Tiếp tục xem xét thêm thẻ Interest/Debuff để điều tiết snowball; đây chỉ là định hướng, **không** tự đổi xác suất Shop, thu nhập hay giá thẻ.

## 5. Quy trình
Ghi log mỗi ván (seed, chuỗi lệnh, kết quả) → script thống kê → báo cáo cho người dùng → người dùng quyết định (D-xx) → mới sửa `data/*.json` qua P-03.
