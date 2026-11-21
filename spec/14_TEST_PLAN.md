# 14 — Kế hoạch test bắt buộc

Mỗi mục là một test (hoặc nhóm test) Vitest. Test nào đụng luật phải trích đường dẫn spec trong tên hoặc chú thích. Mã Q/D chưa chốt ⇒ test để `todo`.

## A. Bàn cờ và thắng/hòa (M1)
- 5 liên tiếp thắng theo hàng, cột, hai đường chéo; ≥6 vẫn thắng; chặn hai đầu vẫn thắng.
- Ô Dark Wall/Makeshift Wall tính là đã chiếm; bàn đủ 225 ô chiếm mà chưa ai thắng ⇒ hòa.
- Thứ tự xét: Hell's Dealer → chuỗi 5 → hòa. Ván kết thúc ngay, đối thủ mất lượt còn lại.
- Nước đi cưỡng ép của Belial tạo chuỗi 5 cho đối thủ ⇒ đối thủ thắng.
- Không còn trường hợp hai bên cùng có chuỗi 5 trong một round.

## B. Phase và đồng hồ (M3)
- PREPARATION: deadline riêng mỗi ghế, sàn 5 s, nút Ready kết thúc sớm.
- ACTION: X rồi O, 15 s; hết giờ ⇒ đặt ngẫu nhiên; lệnh đến đúng mốc hạn được chấp nhận, sau mốc bị từ chối.
- ROUND END chạy một lần đúng thứ tự `roundEndOrder`; hiệu ứng round mới được tính cho Shop tạo cuối round trước.
- Timeout cũ bị bỏ khi phase đã đổi; lệnh trùng `commandId` chỉ chạy một lần.
- Tạm dừng/khôi phục đồng hồ khi mở/đóng popup Ultimatum.

## C. Kinh tế và Shop (M4)
- Xu đầu ván X=3, O=4; +1 mỗi round; xu không âm.
- Phân bố rarity mô phỏng 10.000 Shop khớp `constants.json` theo từng giai đoạn.
- Demon: tối đa 2 Demon khác tên mỗi Shop; trọng số 35/30/20/10/5; Demon đã sở hữu vẫn chiếm ô nhưng không mua được; có 2 Locked thì không mua được.
- Hold giữ ô thường, ô Demon luôn làm mới; Hold tắt Reroll; Block tối đa 3, ô Block cố định.
- Reroll miễn phí +1 mỗi round, tối đa 3 dồn.
- Ghép 3 bản sao ⇒ sao tiếp theo; mua khi Bench đầy nhưng ghép được vẫn hợp lệ; Special 1 bản mỗi loại mỗi Bench.

## D. Thẻ Normal/Special (M5, M6)
Mỗi thẻ ít nhất: dùng đúng, dùng sai phase/lượt, thiếu xu, ★/★★/★★★, tương tác Angel. Đáng chú ý:
- Hair-Trigger cho đặt kèm dấu, kể cả khi dùng Holy Cross; không cộng dồn sai quyền đặt dấu.
- Cutpurse/Great Corruption: ưu tiên sao cao nhất, ngang sao thì ngẫu nhiên theo seed; Cutpurse lên Piggy Bank không hoàn xu.
- Brutal Ultimatum ★★★ chỉ phá Normal Card; chấp nhận/chống lại đúng chi phí; không mở khi popup khác đang mở.
- Jester's Bargain ★ kéo dài 2 round (Current+1…+2); tràn Bench theo spec; Angel miễn nhiễm cả quà Jester.
- Horseman of Rust: xu không xuống dưới 0.
- Rarity Up ★★★: +8 điểm % vào xác suất có Demon, trần 50%, không áp dụng giai đoạn 1, Special không bị ảnh hưởng.
- Makeshift Wall: tường đặt vào ô trống, không cộng dồn sai; Powder Keg phá được, Dark Wall thì không (theo spec).
- Mirror Image dùng ở PREPARATION, đúng giới hạn round.

## E. Demon, Holy Cross, Hell's Dealer (M7, M8)
- Mỗi Demon: bộ đếm lời nguyền, điều kiện reset, phần thưởng, hủy khế ước (đủ/thiếu xu), tối đa 2 Locked.
- Hai phần thưởng hoàn thành cùng lúc xử theo `demonRewardOrder`.
- Agares: Anti-Instant-Win, không phá chuỗi 5 đã xác nhận; Belial/timeout được tính theo spec.
- Belial: tiêu cả lượt, chọn ô cho đối thủ; nhiều nguồn cưỡng ép theo quy tắc ưu tiên.
- Holy Cross: đúng Demon Locked (xóa, không phản đòn); Unlocked/Contracted (phản đòn đúng 5 loại); chọn sai (nhận Demon Locked, không nhận nếu đã sở hữu hoặc đủ 2 Locked, Holy Cross luôn mất); tự giải trừ (không phạt, không chọn Contracted của mình).
- Gỡ hiệu ứng chỉ của **đúng nguồn** Demon bị trục xuất (Malphas Dark Wall, Asmodeus hệ số, Abaddon ô Block).
- Hell's Dealer: 5 Demon Contracted, xét trước chuỗi 5; cả hai cùng đạt thì theo spec.

## F. Lộ thông tin (mọi milestone từ M2)
- Snapshot của ghế X không chứa Shop/Bench/tiến độ lời nguyền của O và ngược lại.
- Kết quả lệnh, mã lỗi, event, log gửi client đều qua projection; Cutpurse/Belial/Jester chỉ lộ tên thẻ đã dùng.
- Test "fuzz": sinh chuỗi lệnh ngẫu nhiên, quét toàn bộ payload gửi cho một ghế và khẳng định không có trường riêng tư của ghế kia.

## G. Kết nối (M3, M9)
- Reconnect bằng token vào đúng ghế, vô hiệu socket cũ, nhận full snapshot (revision, deadline, popup đang chờ).
- Mất kết nối giữa popup: đồng hồ vẫn chạy; hết 45 s xử lý theo kết quả D-03.
- Lệnh chưa có phản hồi trước khi mất mạng được đối chiếu theo `commandId`, không chạy hai lần.

## H. Tái hiện và hồi quy
- Cùng seed + cùng chuỗi lệnh ⇒ cùng hash state sau từng bước (chạy 100 ván tự chơi ngẫu nhiên).
- Bộ test tương tác chéo ưu tiên: Hell's Dealer + chuỗi 5; Belial ép tạo chuỗi; Holy Cross lên Belial đang chờ; Hair-Trigger + Makeshift Wall; Agares + Anti-Instant-Win.
