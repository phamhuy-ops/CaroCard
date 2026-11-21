# 13 — Quyết định và cổng dừng

Ký hiệu: 🛑 = agent **phải dừng** và hỏi. "Mặc định tạm" là việc agent được làm **trong lúc chờ**, chỉ khi không đổi luật và dễ đảo ngược.

## D — Quyết định thiết kế (người dùng trả lời)
| Mã | Khi nào | Vấn đề | Lựa chọn | Mặc định tạm |
|---|---|---|---|---|
| **D-01** 🛑 | M5c, trước Makeshift Wall | Mô phỏng cũ: bot chặn mọi thế 3 bằng tường ⇒ 98–99% ván hòa. Cần giới hạn. | (a) tối đa N tường trên bàn mỗi người (N=3 cho ~56–58% hòa); (b) tường tạm thời; (c) cấm đặt tường lên ô mở rộng chuỗi 3 của đối thủ; (d) giữ nguyên rồi đo playtest | Làm New Angle trước; viết Makeshift Wall với hằng số cấu hình, **chưa** bật giới hạn |
| **D-02** 🛑 | M7, trước Asmodeus | Ngưỡng 7 s xét theo thời điểm server nhận lệnh nên ping cao bị thiệt | (a) đúng spec, không bù; (b) bù cố định (ví dụ 300 ms); (c) bù theo RTT đo được, có trần | `ASMODEUS_GRACE_MS=0` |
| **D-03** 🛑 | M3, phần ghế hết hạn | Spec: giữ ghế 45 s; "ghế hết hạn khi đối thủ online thì đối thủ thắng"; cả hai offline thì "xử thắng hoặc hủy ván" chưa rõ | (a) cả hai hết hạn ⇒ hủy ván, không thắng/thua; (b) bên rời sau cùng thua; (c) bên có điểm/lượt tốt hơn thắng (cần định nghĩa) | Chỉ làm phần một bên hết hạn khi bên kia online |
| D-04 | M6 | Giới hạn bản sao chung và khoảng giá Special (1→5 xu) chưa chốt | Giữ hiện trạng (3 Special, mỗi Bench 1 bản mỗi loại) hoặc đặt giới hạn | Giữ hiện trạng |
| D-05 | M2 | Chọn X/O: vòng quay ngẫu nhiên hay chọn tay | (a) chọn tay; (b) vòng quay; (c) chủ phòng chọn | (a) |
| D-07 | M0 | Ngôn ngữ giao diện | Tiếng Việt / song ngữ; tên thẻ giữ tiếng Anh | Tiếng Việt, i18n qua file chuỗi |
| D-08 | M10 | Hướng nghệ thuật và bảng màu | Bạn mô tả hoặc đưa tham khảo | Bảng màu trung tính tối |
| D-09 | M9 | Demo qua LAN hay Internet | LAN / Internet (HTTPS/WSS) | LAN |
| D-11 | M5a, M11 | Hair-Trigger + Aurelia/Cutpurse có thể bỏ qua giá "mất lượt" | Chỉ theo dõi playtest | Không chỉnh |
| D-12 | M5b | Brutal Ultimatum/Belial khi người nhận offline | (a) tính như hết hạn 15 s; (b) chờ kết nối lại tối đa 45 s | (a) |

## A — Việc cần người hỗ trợ
| Mã | Việc | Ghi chú |
|---|---|---|
| A-01 | Cài Node.js LTS, pnpm, git và xác nhận chạy được | Agent chỉ hướng dẫn, không tự cài vào hệ thống |
| A-02 | Chọn thư mục dự án; **tránh** OneDrive/Desktop đồng bộ | `node_modules` lớn dễ gây lỗi đồng bộ |
| A-03 | Chơi thử thủ công (hot-seat M1, hai tab M2) và báo kết quả | |
| A-04 | Thử hai máy qua LAN, mở cổng firewall | Agent cung cấp IP:cổng và lệnh |
| A-05 | Chạy kịch bản demo mạng trên thiết bị thật và gửi số đo | RTT, thời gian hồi phục |
| A-06 | Tổ chức playtest ≥10 ván với người thật | Gửi log ván cho agent thống kê |
| A-07 | Cung cấp hoặc duyệt font/ảnh/âm thanh (license rõ) | Không tải tài nguyên ngoài khi chưa duyệt |
| A-08 | Cấu hình HTTPS/WSS (tunnel hoặc chứng chỉ) khi demo Internet | |
| A-09 | Tạo remote git và cấp quyền push | Agent không tự push |

## P — Phê duyệt
| Mã | Cần duyệt |
|---|---|
| P-01 | Danh sách thư viện (agent đề xuất kèm phiên bản và lý do; không dùng bản phát hành dưới 14 ngày) |
| P-02 | Kế hoạch ngắn ở đầu mỗi milestone |
| P-03 | Mọi thay đổi `rules/*.md`, `data/*.json` hoặc phát hiện spec sai/mâu thuẫn |
| P-04 | Xóa file, refactor lớn, đổi cấu trúc repo |
| P-05 | Commit/tag (agent đề xuất thông điệp commit; push chỉ khi có A-09) |

## Mẫu `DECISIONS_LOG.md` (agent tạo)
```
## D-01 — 2026-__-__
Câu trả lời của người dùng: "<nguyên văn>"
Quyết định áp dụng: …
File/Test bị ảnh hưởng: …
```
