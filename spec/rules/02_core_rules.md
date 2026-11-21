# 02 — Luật cốt lõi: thắng, round, phòng, kết nối, xu

> **Nguồn:** `CAROCARD_Luat_Da_Chot.docx` — sao chép nguyên văn. Không sửa file này nếu chưa qua cổng **P-03** (xem `../13_DECISIONS_AND_GATES.md`).

---

# TỔNG QUAN Ý TƯỞNG

Một trò chơi Caro cơ bản, 2 người chơi vừa phải xây dựng thế cờ 5 dấu, vừa phải quản lý xu, lựa chọn thời điểm sử dụng thẻ bài và dự đoán hành động của đối phương.

Các yếu tố cơ bản của trò chơi gồm:

- **Không phải lượt nào cũng đặt dấu:** Người chơi phải cân nhắc giữa việc phát triển thế cờ và sử dụng kỹ năng,

- **Nâng cấp thẻ bài:** Tạo ra mục tiêu dài hạn, khiến người chơi phải quyết định giữ bài hay tiêu thụ bài.

- **Kinh tế xu:** Giới hạn sức mạnh, tạo ra sự đánh đổi giữa hiện tại và tương lai.

# GAMEPLAY CỦA TRÒ CHƠI 

## CƠ CHẾ THẮNG CUỘC

Người chơi cần đạt được 5 dấu hàng dọc, ngang hoặc chéo để thắng được trò chơi. Kết hợp với các lợi thế từ thẻ bài mua trong Shop.

- **Bàn cờ:** 15x15 ô.

- **Chuỗi thắng:** 5 quân liên tiếp trở lên của cùng một người chơi theo hàng ngang, hàng dọc hoặc đường chéo (6 quân trở lên vẫn thắng).

- **Chặn hai đầu:** chuỗi đã đủ 5 quân liên tiếp vẫn thắng dù bị chặn cả hai đầu.

- **Xử lý nguyên tử nước đặt/dời quân và các phần thưởng tự động do nước đó kích hoạt. Sau giao dịch, xét Hell’s Dealer trước, tiếp đến chuỗi từ 5 quân, rồi mới xét hòa. Khi xác nhận kết quả, ván kết thúc ngay.**

- **Nếu một batch hoặc phản đòn tạo chuỗi thắng cho cả hai bên, ưu tiên bên đạt chuỗi trước theo thứ tự xử lý trong batch. Quân bị Belial cưỡng ép vẫn thuộc bên có dấu được đặt. Nếu cả hai hoàn thành Hell’s Dealer trong cùng round, bên kích hoạt trước thắng.**

- **Bàn cờ đầy 225 ô: sau bất kỳ hành động nào làm kín bàn, nếu chưa có bên thắng thì hòa ngay. Dark Wall và Makeshift Wall đều tính là ô đã bị chiếm.**

- **Ô trống (định nghĩa chung):** ô không có quân X/O và không phải ô Dark Wall hoặc Makeshift Wall. Mọi hiệu ứng yêu cầu “ô trống” (đặt quân, dời quân, nước đi bị Belial cưỡng ép, Agares, Malphas, đặt Makeshift Wall) đều theo định nghĩa này.

- **Agares và chuỗi 5 quân:** Agares không thể phá chuỗi 5 đã được xác nhận; các quân thuộc chuỗi này bị loại khỏi danh sách mục tiêu của Agares. Anti-Instant-Win vẫn giữ nguyên và hoạt động độc lập với quy tắc này.

## CƠ CHẾ ROUND & XU VÀNG

### Cấu trúc một Round đấu

Một round đấu sẽ gồm 3 giai đoạn chính:

- **PHASE 1 – PREPARATION: Mỗi người có tối đa 20 giây mặc định để mua, ghép bài, vứt bài, Reroll hoặc Hold. Bấm Ready hoặc hết hạn sẽ khóa thao tác chuẩn bị của người đó. ACTION bắt đầu khi cả hai đã Ready hoặc hết thời gian riêng.**

- **PHASE 2 – ACTION: X trước, O sau, 15 giây mỗi lượt thường. Hết hạn mà chưa đặt dấu hoặc dùng thẻ thì server đặt ngẫu nhiên một dấu vào ô trống. Nếu đã thực hiện một phần lượt, kể cả dựng tường, giữ phần đã thực hiện và bỏ phần còn lại.**

- **PHASE 3 – ROUND END: Một giao dịch theo thứ tự +1 xu → Interest → Buff → Debuff (gồm phạt Brutal Ultimatum) → kiểm tra Demon → tạo Shop và cấp lượt Reroll cho round mới. X trước O trong từng bước. Shop và lượt Reroll mới dùng các hiệu ứng của round sắp bắt đầu.**

## Phòng và kết nối

Tạo phòng hoặc tham gia bằng mã mời. Hai người chọn dấu X/O; chủ phòng bắt đầu khi cả hai đã chọn. Có thể dùng vòng quay để phân dấu. Chơi lại không bắt buộc đổi bên. Ván trong RAM kết thúc khi server khởi động lại. Không giới hạn round để xử hòa.

Server xét deadline theo thời điểm nhận lệnh, kể cả đúng mốc. Pop-up Ultimatum có 15 giây và tạm dừng đồng hồ lượt chính. Belial có 15 giây thay toàn bộ lượt bị cưỡng ép.

Mất kết nối không dừng đồng hồ. Giữ ghế 45 giây và gửi lại snapshot theo ghế khi reconnect. Giữ nguyên kết quả timeout đã diễn ra. Nếu một ghế hết hạn giữ ghế 45 giây (không quay lại kịp) khi đối thủ đang online, đối thủ thắng; hết giờ lượt 15 giây thì xử lý bằng đặt ngẫu nhiên, không thua. **[Làm rõ, chờ xác nhận ở D-03]** Nếu cả hai đang offline, chờ ghế còn hạn quay lại hoặc hết hạn rồi xử thắng hoặc hủy ván. **[Chưa rõ khi nào xử thắng, khi nào hủy: agent dừng ở D-03]** Kết quả thắng/hòa trên bàn cờ đã xác nhận có hiệu lực ngay.

Fog of War: bàn cờ, xu của hai bên và hiệu ứng đã xảy ra là công khai. Shop, Bench và chi tiết thẻ của đối thủ là riêng tư. Với Cutpurse, Belial và Jester, chỉ công bố tên thẻ đã dùng và có thể báo số lượng bị tác động; không tiết lộ tên hoặc số sao của thẻ ẩn bị tác động.

### Cơ chế tiền tệ - Xu vàng

Mỗi round, mỗi người chơi được cấp 1 xu vàng tại PHASE 3 – ROUND END. Xu vàng có thể kiếm được thông qua cấp xu mỗi round và các thẻ bài. 

- **Xu khởi đầu:** X bắt đầu trận với 3 xu. O bắt đầu với 4 xu để bù lợi thế được đi trước của X.

- **Thứ tự hành động:** X luôn hành động trước O ở mọi round (giữ nguyên).

- **Reroll Shop: Mỗi round cấp 1 lượt miễn phí hệ thống, trừ khi bị phạt bởi Ultimatum ★. Lượt từ Rarity Up ★★★ vẫn được cấp nếu đang có hiệu lực. Hết lượt miễn phí thì Reroll tốn 1 xu.**
