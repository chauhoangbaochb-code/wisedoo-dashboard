# WisEdoo · Dashboard đăng ký sự kiện

Website tĩnh (HTML/CSS/JS), đọc **trực tiếp** Google Sheet đăng ký và tự làm mới mỗi 60 giây. Không cần server hay database.

## Mở dashboard
- **Trên máy:** chạy `python3 -m http.server 8765 --directory wisedoo-dashboard` rồi mở http://localhost:8765
- **Đưa lên mạng để cả team xem:** kéo thả thư mục `wisedoo-dashboard` vào https://app.netlify.com/drop (hoặc GitHub Pages / Vercel). Đây là website tĩnh, không cần cấu hình gì thêm.

## Kết nối qua Apps Script + AI phân loại câu hỏi (khuyên dùng)
1. Mở Google Sheet → **Tiện ích mở rộng → Apps Script**. Xoá code mẫu, dán toàn bộ `apps-script/Code.gs`. Đổi `SALT` thành một chuỗi ngẫu nhiên bất kỳ → **Lưu**.
2. Biểu tượng **bánh răng (Project Settings)** → kéo xuống **Script properties** → **Add script property**:
   - Property: `OPENROUTER_API_KEY` · Value: key OpenRouter của bạn → **Save**.
3. Quay lại trình soạn code → chọn hàm **`setup`** ở thanh công cụ → **Run** → cấp quyền khi Google hỏi.
   → Sheet có thêm 2 tab:
   - **"AI"**: mỗi lượt đăng ký được phân loại câu hỏi (nhóm vấn đề, từ khoá) + xếp lĩnh vực vào nhóm ngành chuẩn. Chạy **15 phút/lần**.
   - **"AI_TOMTAT"**: bản tóm tắt cho toàn chuỗi + từng sự kiện. Viết lúc **7h sáng mỗi ngày**.
4. **Deploy → New deployment** → bánh răng → **Web app** · Execute as: **Me** · Who has access: **Anyone** → Deploy → copy URL `/exec`.
5. Dán URL vào `config.js` → `appsScriptUrl: '...'`. Mở dashboard kiểm tra → đổi chia sẻ Sheet về **"Bị hạn chế"**.

Ghi chú:
- AI dùng: **Claude Haiku 5.5** qua OpenRouter, gom tối đa 20 câu/lần gọi, tối đa 100 câu/lần chạy. Phân loại ≈ 0,06 USD / 1.000 lượt đăng ký; tóm tắt hằng ngày ≈ 0,12 USD / tháng.
- Chỉ gửi **nội dung câu hỏi** — không gửi tên, email, SĐT. Mặc định gửi câu hỏi của tất cả học viên (báo cáo nội bộ); muốn chỉ gửi người đã consent → đặt `AI_REQUIRE_CONSENT = true` trong Code.gs.
- Câu nào AI chưa xử lý (đang chờ, lỗi) → dashboard tạm phân loại theo từ khoá.
- Muốn phân loại lại 1 câu: xoá dòng của câu đó trong tab "AI", lần chạy sau sẽ làm lại.
- Đổi nhóm vấn đề: sửa **cả** `THEMES` trong Code.gs **và** `themes` trong config.js (giữ cùng `id`).
- Đổi danh sách nhóm ngành: sửa `INDUSTRIES` trong Code.gs.
- Mô tả sự kiện mới cho AI tóm tắt sát hơn: thêm vào `EVENT_INFO` trong Code.gs.
- Muốn viết lại tóm tắt ngay (không chờ 7h sáng): chọn hàm **`generateSummaries`** → **Run**.
- Tóm tắt AI chỉ dùng số liệu do script tính sẵn; trích dẫn của học viên được kiểm tra khớp nguyên văn, không khớp thì bị loại.
- Khi sửa Code.gs: **Deploy → Manage deployments → Edit → Version: New version** (URL giữ nguyên).
- Xem lỗi / lịch chạy: menu trái Apps Script → **Executions**.

## Thêm sự kiện mới
- Sự kiện mới đổ vào **cùng tab LadiFlow**: không cần làm gì. Dashboard tự tạo tab mới theo giá trị cột B (tên sự kiện).
- Sự kiện mới nằm ở **tab khác** trong Sheet: mở `config.js`, thêm `{ gid: '<gid của tab>', label: '<tên>' }` vào `sources`. (gid là số sau `#gid=` trên thanh địa chỉ khi bấm vào tab đó.)
- Muốn tên sự kiện dễ đọc hơn: thêm vào `events` trong `config.js`, ví dụ `'Feedback': { title: 'Feedback · Phản hồi hiệu quả' }`.

## Các phần trong dashboard
| Phần | Trả lời câu hỏi |
|---|---|
| Thẻ buổi học | Mỗi buổi: ngày giờ, đếm ngược, số người đăng ký, % đạt mục tiêu (sửa mục tiêu ngay trên thẻ) |
| KPI + "Đọc nhanh" | Tổng lượt, 24 giờ / 7 ngày qua, bình quân từ ngày mở, % đang phụ trách người + nhận định tự động |
| So sánh sự kiện (tab Tổng quan) | Sự kiện nào hút người hơn, tốc độ đăng ký, chân dung khác nhau ra sao |
| 1. Nhịp đăng ký | Đăng ký theo ngày (theo kênh), luỹ kế, heatmap giờ × thứ, buổi được chọn |
| 2. Họ đến từ đâu | Kênh, chiến dịch (UTM), **chất lượng theo kênh**, vị trí địa lý (khi form có trường này) |
| 3. Quảng cáo Facebook | Đã chi, lead theo Meta, đăng ký thực từ quảng cáo, chi phí / đăng ký, hiệu quả theo chiến dịch · nhóm quảng cáo · mẫu quảng cáo |
| 4. Họ là ai | Cấp bậc, độ tuổi, kinh nghiệm quản lý, quy mô đội, ma trận kinh nghiệm × quy mô đội |
| 5. Họ đang làm gì | Lĩnh vực (đã gộp cách viết khác nhau), lĩnh vực × cấp bậc |
| 6. Họ bận tâm điều gì | Nhóm vấn đề (tự phân loại), word cloud, vấn đề × kinh nghiệm/vị trí/tuổi/kênh, danh sách câu hỏi ẩn danh |
| 7. Consent & chất lượng dữ liệu | Tỉ lệ consent, trùng lặp, thiếu dữ liệu |

## Chi phí quảng cáo (tab "Facebook Ads")
1. **Cài một lần:** `Code.gs` phải có hàm `readAdsSheet_` và dòng `ads: readAdsSheet_(ss),` trong `doGet` (bản từ 15/10/2026 đã có sẵn). Dán bản mới vào Apps Script → **Deploy → Manage deployments → Edit → Version: New version**.
2. **Cập nhật số liệu:** Trình quản lý quảng cáo → chọn khoảng ngày → Xuất bảng → dán đè vào tab "Facebook Ads" (giữ nguyên dòng tiêu đề). Dashboard tự nhận trong vòng 1 phút.
3. **Ghép quảng cáo với sự kiện:** chiến dịch có tên chứa tên sự kiện (vd. `MCDelegation_Leads_Web` → Delegation) được tự gắn. Đặt tên khác → khai báo ở `config.js → ads.eventOf`.
4. **Đăng ký thực từ quảng cáo:** đếm người có `utm_source=facebook` và `utm_campaign` nằm trong tên chiến dịch (vd. `mc_delegation`). Nên điền ở phần URL parameters của quảng cáo: `utm_source=facebook&utm_campaign=mc_delegation`.
5. Số liệu quảng cáo hiện ở mục 3 của dashboard; ai mở được dashboard đều xem được chi tiêu.

## Mục tiêu đăng ký cho từng buổi
- Mặc định mỗi buổi là `defaultTarget` trong `config.js` (đang để 100).
- Đặt riêng cho sự kiện / từng buổi: thêm `target` hoặc `targets` vào `events` trong `config.js` (có ví dụ trong file) — áp dụng cho cả team.
- Gõ trực tiếp vào ô "Mục tiêu" trên thẻ buổi: chỉ lưu trên trình duyệt của người gõ, người khác không thấy.

## Tinh chỉnh phân loại câu hỏi
Trong `config.js` → `themes`: thêm/bớt từ khoá cho từng nhóm vấn đề. Câu hỏi không khớp nhóm nào sẽ vào "Khác / chưa phân loại". Xem nhóm này để biết cần bổ sung từ khoá gì.

## Lưu ý quyền riêng tư
- Dashboard **không hiển thị** tên, email, SĐT. Danh sách câu hỏi chỉ hiện hồ sơ nghề nghiệp.
- Dùng Apps Script: Sheet để riêng tư, email/SĐT không rời khỏi Google.
- Chưa dùng Apps Script (`appsScriptUrl` trống): Sheet phải để "Bất kỳ ai có đường liên kết đều xem được" → ai có link Sheet là xem được email/SĐT.
