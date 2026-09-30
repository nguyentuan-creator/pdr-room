# PDR Room

Định vị bên trong một căn phòng trống 10 m × 10 m bằng **Pedestrian Dead Reckoning (PDR)** — chỉ dùng cảm biến trên điện thoại, không cần GPS, Wi-Fi hay quét QR liên tục.

## Thử trên điện thoại

1. Mở link demo (GitHub Pages, HTTPS — cảm biến chỉ hoạt động trên HTTPS).
2. **Chạm lên bản đồ** để đặt vị trí bạn đang đứng — đây là mốc tham chiếu khởi tạo duy nhất (thay cho việc quét QR).
3. Bấm **"Bật cảm biến & Bắt đầu"** (iOS sẽ hỏi quyền truy cập cảm biến chuyển động & hướng).
4. Cầm điện thoại thẳng đứng, mặt màn hình hướng về phía trước, rồi **đi bộ bình thường** trong phòng — chấm đỏ và vệt đường sẽ tự cập nhật theo từng bước chân.

## Nguyên lý

- **Đếm bước chân** — gia tốc kế (kèm trọng lực) được lọc EMA để tách dao động "nảy" của thân người; mỗi đỉnh ≥ 1,35 m/s² cách nhau ≥ 260 ms tính là 1 bước.
- **Hướng đi** — la bàn số: `webkitCompassHeading` (iOS) hoặc `alpha` tuyệt đối (Android), quy về 0–360° từ Bắc.
- **Cập nhật vị trí** — mỗi bước: `x += L·sin(θ)`, `y −= L·cos(θ)` với `L` là chiều dài bước (mặc định 0,7 m, chỉnh được).
- **Chạm tường** — vị trí bị chặn tại 0,25 m từ mép tường và hệ thống gợi ý hiệu chỉnh la bàn (−10° / +10°).

## Giới hạn cần biết (trung thực)

- **Sai số cộng dồn** là bản chất của PDR: lệch hướng nhỏ nhân dần theo số bước (vòng tròn đứt nét trên bản đồ là ước tính).
- **La bàn bị nhiễu bởi sắt thép / bê tông cốt thép** trong tòa nhà — trong phòng thật hãy hiệu chỉnh ±10° ngay khi thấy lệch.
- Trên **máy tính không có cảm biến**: dùng phím mũi tên (↑ bắc, → đông, ↓ nam, ← tây) — mỗi lần bấm là 1 bước, chạy qua đúng thuật toán PDR.
- Trong thực tế, PDR thuần cần các mốc hiệu chỉnh định kỳ (QR, Wi-Fi RTT, beacon BLE) để neo lại vị trí.

## Chạy local

Không cần build tool — mở `index.html` trực tiếp bằng trình duyệt (tính năng cảm biến chỉ dùng được trên điện thoại qua HTTPS).
