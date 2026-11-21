# 04 — Demon Card và Hell’s Dealer

> **Nguồn:** `CAROCARD_Luat_Da_Chot.docx` — sao chép nguyên văn. Không sửa file này nếu chưa qua cổng **P-03** (xem `../13_DECISIONS_AND_GATES.md`).

---

## CƠ CHẾ CHUNG CỦA DEMON CARD (THẺ QUỶ)

Giá mua & Độ hiếm: 0 xu - Độc bản (không nâng cấp sao). Gồm 5 ác quỷ theo bậc quyền lực tăng dần (chỉ dùng để xử lý phần thưởng trùng thời điểm, không quy định thứ tự mua): Malphas → Agares → Asmodeus → Belial → Abaddon.

**Kích hoạt Lời nguyền (PHASE 1 – PREPARATION):** Ngay thời điểm người chơi bấm mua Demon Card từ Shop, Lời nguyền (thử thách) lập tức có hiệu lực. Thẻ nằm trong kho chứa (Bench) ở trạng thái *Chưa giải nguyền (Locked)*.

**Hiển thị UI / UX:**

- Kích hoạt Lời nguyền: Mua Demon trong PREPARATION đặt thẻ vào Bench ở trạng thái Locked và kích hoạt thử thách ngay. Demon nhận từ Holy Cross chọn sai bắt đầu tính từ round kế tiếp.

- Người chơi có thể bấm vào thẻ Demon trong kho để xem lại toàn bộ mô tả Lời nguyền và Phần thưởng.

Nhận Phần thưởng: Ngay khi hoàn thành đủ điều kiện của Lời nguyền, thẻ Demon chuyển sang trạng thái Đã giải nguyền (Unlocked) và kích hoạt Phần thưởng tối thượng (hoặc mở khóa để sử dụng trong PHASE 2 – ACTION tùy từng thẻ).

**Quy tắc Khế Ước ****&**** Hủy Nguyền: **Khi chưa giải nguyền (Locked — Cho phép hủy kèm hình phạt):

- Trong PHASE 1 – PREPARATION, người chơi có quyền chủ động bán/vứt bỏ thẻ Demon đang chịu nguyền để giải phóng ô kho và chấm dứt ngay lời nguyền.

- Tuy nhiên, hành động này kích hoạt Hình phạt Hủy Khế Ước (Cancellation Penalty) đặc trưng của từng con quỷ *(ví dụ: mất xu, mất lượt đánh cờ tiếp theo, hoặc bị khóa ô trên bàn cờ)*.

- *Ràng buộc cho AI Agent:* Nếu người chơi không đủ điều kiện chi trả hình phạt *(ví dụ: phạt trừ 2 xu nhưng hiện tại chỉ có 1 xu)*, nút Bán/Vứt thẻ sẽ bị vô hiệu hóa (Disabled).

Demon Unlocked đã hoàn thành lời nguyền nhưng chưa dùng thưởng. Chủ thẻ chỉ có thể chủ động giải trừ bằng Holy Cross. Nếu đối thủ trục xuất Demon Unlocked, phản đòn vẫn được xử lý như với Contracted.

Sau khi người chơi sử dụng phần thưởng, thẻ chuyển sang trạng thái Contracted (Đã ký khế ước) và tiếp tục nằm lại trong kho chứa 5 ô (Bench) cho đến hết trận, trừ khi bị Holy Cross của đối thủ trục xuất.

Người chơi vẫn có thể tự do kéo thả, sắp xếp lại vị trí của thẻ Demon giữa 5 ô trong kho như các thẻ bình thường, nhưng do thẻ luôn chiếm 1 ô cố định nên không gian chứa các thẻ khác sẽ tự nhiên thu hẹp dần (4 → 3 → 2 → 1 → 0 ô trống).

Điều kiện kích hoạt Hell's Dealer (Set Bonus): Khi toàn bộ 5 ô trong kho (Bench) đều được lấp đầy bởi 5 Demon Card khác nhau ở trạng thái Contracted, giao ước tối thượng hoàn tất — người chơi lập tức trở thành Hell's Dealer và thắng trực tiếp ván đấu. Demon bị Holy Cross trục xuất không còn chiếm ô Bench; người chơi có thể mua lại Demon đó khi nó xuất hiện trong Shop.

**Giới hạn khế ước đồng thời:** Mỗi người chơi chỉ được có tối đa 2 Demon Card ở trạng thái Locked cùng lúc. Lời nguyền của cả 2 thẻ có hiệu lực ngay khi mua, nên mua thêm Demon là lựa chọn đánh đổi giữa mạo hiểm (gánh thêm ràng buộc) và an toàn (chờ hoàn thành bớt khế ước rồi mới mua, nhưng Demon đang hiện trong Shop sẽ biến mất ở cuối round vì không Hold được). Khi đang có 2 khế ước Locked, các Demon Card trong Shop bị vô hiệu hóa (không thể mua).

**Demon không thể Hold. Demon chưa mua hết hạn ở cuối round, kể cả khi Hold. Lần làm mới có thể tạo tối đa hai Demon khác tên theo mục Độ hiếm và quy tắc chọn ô của Hold.**

**Mỗi khế ước có bộ đếm riêng. Dùng thưởng Demon thủ công tính là dùng thẻ. Phản đòn tự động đi cùng giao dịch dùng Holy Cross, không phát sinh thêm một lần dùng thẻ. Đặt dấu do timeout được đánh giá theo điều kiện riêng của từng lời nguyền. Phạt hủy bằng xu không tính là tiêu xu.**

**Hủy khế ước:** Hủy riêng từng khế ước; hình phạt chỉ áp dụng cho khế ước đã hủy.

**Thứ tự xử lý phần thưởng:** Khi 2 khế ước hoàn thành cùng một thời điểm, phần thưởng được xử lý theo thứ tự quyền lực tăng dần (Malphas → Agares → Asmodeus → Belial → Abaddon): quỷ yếu hơn trao thưởng trước.

**Mua Demon không theo thứ tự (V4):** Người chơi được mua bất kỳ Demon nào đang hiện trong Shop khi chưa sở hữu thẻ đó và chưa có 2 khế ước Locked. Không còn yêu cầu mua theo bậc quyền lực và không còn mốc mở khóa.

**Ưu tiên Hell’s Dealer:** Nếu Hell’s Dealer đạt được cùng lúc đối thủ tạo được chuỗi 5 quân, Hell’s Dealer thắng (kiểm tra Hell’s Dealer trước chuỗi 5 quân).

### DMN-01: MALPHAS (Bậc 1/5 — Ác Quỷ Pháo Đài)

**Phân loại:** Demon Card | Giá mua: 0 xu | Trạng thái: Độc bản (Không nâng sao)

**Mô tả:** Thử thách sự kiên nhẫn bằng cách kìm hãm nhịp sử dụng thẻ. Hoàn thành khế ước để dựng tường thành cắt đứt thế trận đối thủ.

| Hạng mục | Chi tiết | Điều kiện & Thời điểm |
| --- | --- | --- |
| Lời nguyền | Không sử dụng bất kỳ thẻ bài nào trong PHASE 2 – ACTION suốt 2 round liên tiếp. | Tính ngay từ PHASE 2 của round hiện tại (Current_Round). Dùng thẻ khác sẽ reset tiến độ về 0/2. |
| Hình phạt hủy | Trừ trực tiếp 2 xu hiện có. | Chỉ hủy được trong PHASE 1 khi có đủ ≥ 2 xu. |
| Phần thưởng | Đặt tối đa 2 Dark Wall vĩnh viễn trên các ô trống. Nếu chỉ còn một ô thì đặt một tường. Nếu không còn ô, không đặt tường và vẫn tiêu hao phần thưởng. | Unlocked sau lượt đạt 2/2; dùng từ ACTION kế tiếp. Phần thưởng chiếm toàn bộ lượt, kể cả khi đang có Hair-Trigger (không kèm dấu). |

### DMN-02: AGARES (Bậc 2/5 — Ác Quỷ Rung Chuyển)

**Phân loại:** Demon Card | Giá mua: 0 xu | Trạng thái: Độc bản (Không nâng sao)

**Mô tả:** Ép người chơi phải đánh dạt ra vùng biên nguy hiểm và chịu bất lợi bàn cờ. Hoàn thành khế ước để làm rung chuyển và đảo lộn đội hình quân cờ của đối phương.

| Hạng mục | Chi tiết | Điều kiện & Thời điểm |
| --- | --- | --- |
| Lời nguyền | Đặt tổng cộng 3 quân cờ vào hàng hoặc cột ngoài cùng (viền bàn cờ) *(không bắt buộc liên tiếp)*. | Tính từ ACTION của round mua. Quân đặt do Belial cưỡng ép hoặc do timeout vẫn được tính nếu rơi vào viền; quân dời bằng thẻ không tính. Đặt ở vùng trong không làm reset. |
| Hình phạt hủy | Phá hủy vĩnh viễn 2 thẻ bài ngẫu nhiên khác đang có trong kho chứa (Bench) của bạn *(không hoàn xu dù là thẻ Piggy Bank)*. | Chỉ hủy trong PREPARATION khi có ít nhất 2 Normal hoặc Special khác trong Bench. Không chọn Demon làm mục tiêu phạt. |
| Phần thưởng | Tự động dời tối đa 3 quân hợp lệ của đối thủ từ vùng trong ra các ô trống ngẫu nhiên ở viền, tùy số quân và ô đích hợp lệ. | Kích hoạt khi đặt quân viền thứ 3, sau đó chuyển sang Contracted dù dời được ít hơn 3 quân. |

**Anti-Instant-Win: Loại quân đang trực tiếp chặn chuỗi 4 của bên kích hoạt. Loại cả phương án di chuyển nếu batch tạo chuỗi thắng cho bên bị di chuyển. Áp dụng cho thưởng và phản đòn.**

**Bảo vệ chuỗi 5 đã được xác nhận:** Thuật toán random mục tiêu của AGARES (phần thưởng lẫn phản đòn khi bị Holy Cross trục xuất) loại trừ mọi quân thuộc chuỗi 5 quân liên tiếp đã được xác nhận trên bàn cờ, nên Agares không thể phá chuỗi này. Quy tắc này độc lập với Anti-Instant-Win: hai quy tắc cùng được áp dụng, không thay thế hay phụ thuộc nhau.

### DMN-03: ASMODEUS (Bậc 3/5 — Ác Quỷ Cuồng Nộ)

**Phân loại:** Demon Card | Giá mua: 0 xu | Trạng thái: Độc bản (Không nâng sao)

**Mô tả:** Thử thách sự quyết đoán dưới áp lực thời gian cực hạn. Hoàn thành khế ước sẽ truyền cơn cuồng loạn sang tâm trí đối thủ, vĩnh viễn rút ngắn một nửa thời gian chuẩn bị của họ đến hết trận.

| Hạng mục | Chi tiết | Điều kiện & Thời điểm |
| --- | --- | --- |
| Lời nguyền | Tự chọn và gửi nước đặt dấu hợp lệ trong tối đa 7 giây, không dùng thẻ, trong 3 round liên tiếp. Lượt cưỡng ép hoặc đặt ngẫu nhiên do hết giờ làm đứt chuỗi. | Tính ngay từ PHASE 2 của round hiện tại sau khi mua thẻ ở PHASE 1 (0/3 → 3/3). Quá 7 giây hoặc dùng thẻ khác sẽ reset tiến độ về 0/3. |
| Hình phạt hủy | Trừ 3 xu và cấm dùng thẻ lẫn phần thưởng Demon thủ công trong ACTION của 2 round liên tiếp. | Chỉ hủy được trong PHASE 1 khi có đủ ≥ 3 xu *(hiệu lực cấm dùng thẻ tính ngay từ PHASE 2 của round hủy)*. |
| Phần thưởng | Tự động kích hoạt ngay lập tức: Vĩnh viễn giảm 50% thời gian PHASE 1 – PREPARATION của đối thủ *(từ 20 giây xuống còn 10 giây)* cho đến hết trận đấu. | Kích hoạt ngay khoảnh khắc hoàn tất nước đi thứ 3 (3/3) trong PHASE 2 – ACTION, sau đó chuyển sang Contracted. |

**Quy tắc xử lý ngoại lệ:**

- Đồng hồ 7 giây bắt đầu khi cửa sổ lượt mở và không tính thời gian pop-up. Server xét thời điểm nhận nước đi. Quá 7 giây reset tiến độ nhưng lượt thường vẫn tiếp tục cho đến hạn 15 giây.

- Quy tắc tính thời gian giảm (Floor & Stack Rule): Thời gian PHASE 1 của đối thủ được tính bằng Floor(Base_Prep_Time * 0.5) (mặc định 20s → 10s). Nếu đối thủ đồng thời chịu hiệu ứng giảm thời gian từ thẻ bài khác, hiệu ứng giảm theo phần trăm được nhân dồn và đặt ngưỡng tối thiểu là 5 giây (Min_Prep_Time = 5s) để tránh lỗi không kịp thao tác UI.

- Trạng thái sau kích hoạt: Vì hiệu ứng là nội tại vĩnh viễn tự kích hoạt, thẻ bỏ qua bước chờ dùng ở PHASE 2 và chuyển thẳng sang trạng thái Contracted (nằm cố định trong kho 5 ô).

### DMN-04: BELIAL (Bậc 4/5 — Ác Quỷ Phản Nghịch)

**Phân loại:** Demon Card | Giá mua: 0 xu | Trạng thái: Độc bản (Không nâng sao)

**Mô tả:** Thử thách sự kiểm soát tài nguyên và nhịp độ trận đấu. Hoàn thành khế ước để thao túng tâm trí đối thủ, thiêu rụi thẻ bài trong kho và cướp quyền điều khiển nước đi kế tiếp của họ.

| Hạng mục | Chi tiết | Điều kiện & Thời điểm |
| --- | --- | --- |
| Lời nguyền | Không dùng thẻ trong ACTION và giữ số dư ≤4 xu tại bước kiểm tra Demon của ROUND END trong 3 round liên tiếp. | Bắt đầu từ round mua. Dùng thẻ hoặc có hơn 4 xu sau Interest, Buff và Debuff làm reset tiến độ. Tiền phạt Ultimatum có thể giúp đạt ngưỡng ≤4 xu. |
| Hình phạt hủy | Phá hủy toàn bộ thẻ bài thường đang có trong kho chứa (Bench) và giảm 50% thời gian PHASE 1 của chính bạn trong 2 round. | Hủy trong PREPARATION. Giảm thời gian PREPARATION của hai round kế tiếp, kể cả khi Bench không có Normal để hủy. |
| Phần thưởng | Khi kích hoạt trong PHASE 2 – ACTION: 1. Phá hủy ngẫu nhiên tối đa 2 thẻ bài thường trong kho chứa (Bench) của đối thủ. 2. Cướp quyền điều khiển lượt hành động PHASE 2 tiếp theo của đối thủ: Bắt buộc đối thủ chọn hành động Đặt dấu, và bạn là người trực tiếp chọn ô trống trên bàn cờ để đặt quân cờ của đối thủ vào đó | Chuyển sang Unlocked sau khi xong round thứ 3; kích hoạt trong PHASE 2 – ACTION tiếp theo rồi chuyển sang Contracted. |

**Quy tắc xử lý ngoại lệ ****&**** Luồng UI (Cho AI Agent):**

Dùng thưởng Belial trong ACTION chiếm toàn bộ lượt, kể cả khi đang có Hair-Trigger. Cửa sổ cưỡng ép 15 giây thay toàn bộ lượt kế tiếp của đối thủ và áp dụng cả cho phản đòn Holy Cross.

- Quyền chọn ô trống trên bàn cờ chuyển sang cho người chơi sở hữu BELIAL (đếm ngược 15 giây; nếu hết giờ chưa chọn, hệ thống tự đặt quân của đối thủ vào 1 ô trống ngẫu nhiên).

- Quân cờ đặt xuống vẫn mang màu/ký hiệu của đối thủ. Nếu nước đi bị cưỡng ép vô tình tạo thành chuỗi 5 quân cho đối thủ, đối thủ thắng bình thường; người sở hữu BELIAL thua. Không có ngoại lệ vì nước đi bị cưỡng ép.

**Belial phá ngẫu nhiên tối đa 2 Normal, không chọn Demon hoặc Special. Nếu nhiều nguồn nhắm cùng lượt, giữ nguồn đến trước. Chặn kích hoạt thủ công nguồn sau; phản đòn đến sau vẫn xử lý phần phá Normal.**

**Trạng thái sau sử dụng:** Ngay sau khi dùng phần thưởng, thẻ chuyển sang Contracted (nằm cố định trong kho 5 ô, không thể bán).

### DMN-05: ABADDON (Bậc 5/5 — Kẻ Hủy Diệt Vực Thẳm)

**Phân loại:** Demon Card | Giá mua: 0 xu | Trạng thái: Độc bản (Không nâng sao)

**Mô tả:** Thử thách sinh tồn khắc nghiệt nhất dành cho kẻ dám chạm tới quyền năng tối thượng. Hoàn thành khế ước sẽ mở ra cánh cổng vực thẳm, vĩnh viễn nuốt chửng nguồn cung Shop và xóa sổ mọi lợi thế cường hóa của đối thủ.

| Hạng mục | Chi tiết | Điều kiện & Thời điểm |
| --- | --- | --- |
| Lời nguyền | Trong 3 round liên tiếp, không dùng thẻ trong ACTION, không tiêu xu sau khi nhận lời nguyền và không có chuỗi từ 4 quân liên tiếp. Tính cả tạo mới, kéo dài, giữ chuỗi đã có hoặc chuỗi do thẻ hay đối thủ tạo hộ. | Bắt đầu theo dõi ngay sau khi mua trong PREPARATION. Chi tiêu trước lúc mua không tính. Vi phạm bất kỳ điều kiện nào reset tiến độ về 0/3. |
| Hình phạt hủy | Xóa xu ngay khi hủy và đầu round tiếp theo. Khóa Bench đến hết round tiếp theo: cấm mua, nâng cấp, dùng, vứt hoặc bán Normal, Special và Demon. Thu nhập cuối round, Piggy Bank và phần thưởng Demon tự động vẫn chạy. | Chỉ hủy được trong PHASE 1 *(không tác động lên bàn cờ nên không gây thua oan lượt X/O)*. |
| Phần thưởng | Block vĩnh viễn tối đa 2 ô Shop đối thủ theo giới hạn Block chung. Xóa ngẫu nhiên tối đa 2 Buff đối thủ đang có hiệu lực. Loại khỏi danh sách Buff chưa kích hoạt, khiên Angel ★★★ và sức mạnh Demon. | Tại ROUND END, sau Interest, Buff và Debuff, nếu đạt 3/3 thì tự động trao thưởng và chuyển Contracted. |
