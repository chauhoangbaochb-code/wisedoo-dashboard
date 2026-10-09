/* ============================================================
   CẤU HÌNH DASHBOARD — chỉ cần sửa file này khi thêm sự kiện / sheet mới
   ============================================================ */
window.DASHBOARD_CONFIG = {
  // URL Web App của Apps Script (xem apps-script/Code.gs). Khi có URL này, dashboard
  // lấy dữ liệu qua Apps Script — Sheet có thể để riêng tư, email/SĐT không bị gửi ra ngoài.
  // Để trống '' thì dashboard đọc trực tiếp Sheet (Sheet phải chia sẻ công khai).
  appsScriptUrl: 'https://script.google.com/macros/s/AKfycbzBJSQ4MDxTI1yR-gHxE8tAiFybb88AH1ey_5Uv_iOw5Xc07kzzaWVc7aqlCWjAXZnBHg/exec',

  // ID của Google Sheet (phần giữa /d/ và /edit trong link) — chỉ dùng khi appsScriptUrl trống
  sheetId: '1wXDRCniU8TgHSQb-pLDs6IZV3uXpZ5ASSrUx9J4G1pI',

  // Các tab cần đọc. Sự kiện mới đổ vào cùng tab "LadiFlow" thì KHÔNG cần sửa gì —
  // dashboard tự tách sự kiện theo cột "event". Nếu sự kiện mới nằm ở tab khác,
  // thêm 1 dòng { gid: '<số gid của tab>', label: '<tên tab>' }.
  // Một tab có thể có cột khác thứ tự: thêm khoá `columns` riêng cho tab đó.
  sources: [
    { gid: '1632411938', label: 'LadiFlow' },
  ],

  // Tự làm mới dữ liệu sau mỗi N giây
  refreshSeconds: 60,

  // Vị trí cột (đếm từ 0). Sheet hiện không có dòng tiêu đề.
  columns: {
    timestamp: 0,    // 2026/10/05 19:07:14
    event: 1,        // Delegation
    session: 2,      // 19:30-21:00, T5 05/11/2026
    name: 3,
    email: 4,
    phone: 5,
    birthYear: 6,
    position: 7,     // Quản lý cấp trung / Nhân viên / Founder / Điều hành
    industry: 8,     // Lĩnh vực (tự nhập)
    teamSize: 9,     // Số người đang quản lý
    mgmtExp: 10,     // Số năm kinh nghiệm quản lý
    question: 11,    // Khó khăn / câu hỏi gửi về
    consent: 12,     // yes / no
    utmSource: 15,   // facebook / zalo / email / direct
    utmCampaign: 16, // Kickoff / delegation_1105 / ...
    // city: 13,     // bật khi form có trường Tỉnh/Thành phố (điền đúng số cột)
  },

  // Tên hiển thị đẹp cho từng sự kiện (key = giá trị ở cột event). Không bắt buộc.
  events: {
    Delegation: { title: 'Delegation · Giao việc hiệu quả' },
  },

  // Thứ tự chuẩn cho các câu trả lời có thứ bậc
  order: {
    mgmtExp: ['Dưới 1 năm', '1 - 3 năm', '3 - 5 năm', 'Trên 5 năm'],
    teamSize: ['Chưa trực tiếp phụ trách ai', '1 - 3 người', '4 - 10 người', '11 - 30 người', 'Trên 30 người'],
  },

  // Gộp các cách viết khác nhau của cùng một lĩnh vực (viết thường, không cần dấu cách thừa)
  industryAliases: {
    'fmcg': 'FMCG',
    'ecommerce': 'Thương mại điện tử',
    'e-commerce': 'Thương mại điện tử',
    'tmđt': 'Thương mại điện tử',
    'it': 'Công nghệ thông tin',
    'cntt': 'Công nghệ thông tin',
    'công nghệ': 'Công nghệ thông tin',
    'education': 'Giáo dục',
    'edtech': 'Giáo dục',
    'đào tạo': 'Giáo dục',
    'mkt': 'Marketing',
    'hr': 'Nhân sự',
    'f&b': 'F&B',
  },

  // Nhóm chủ đề bận tâm — mỗi câu hỏi có thể thuộc nhiều nhóm.
  // Khi dùng Apps Script + AI: giữ id GIỐNG HỆT THEMES trong apps-script/Code.gs.
  // Thêm từ khoá (viết thường, có dấu) để phân loại chính xác hơn.
  themes: [
    { id: 'delegate', label: 'Giao việc & truyền đạt yêu cầu',
      keywords: ['giao việc', 'phân công', 'phân việc', 'ủy quyền', 'uỷ quyền', 'mô tả', 'truyền đạt', 'hướng dẫn', 'thực hiện sai', 'làm sai', 'hiểu sai', 'delegat'] },
    { id: 'followup', label: 'Theo dõi tiến độ & kiểm soát',
      keywords: ['theo dõi', 'tiến độ', 'follow', 'kiểm soát', 'deadline', 'hối thúc', 'nhắc nhở', 'đánh giá', 'kpi', 'báo cáo', 'chứng minh kết quả', 'kết quả làm việc'] },
    { id: 'ownership', label: 'Nhân sự thiếu chủ động, trì hoãn',
      keywords: ['chủ động', 'trì hoãn', 'trách nhiệm', 'cam kết', 'ỷ lại', 'thụ động', 'toàn tâm', 'chỉ làm khi', 'người ra chỉ thị'] },
    { id: 'retain', label: 'Gắn kết, giữ chân & tạo động lực',
      keywords: ['giữ chân', 'gắn kết', 'giữ lửa', 'động lực', 'rời đi', 'nghỉ việc', 'team thay đổi', 'biến động', 'tình nguyện viên', 'truyền cảm hứng', 'dẫn dắt'] },
    { id: 'hiring', label: 'Tuyển dụng & xây đội ngũ',
      keywords: ['tuyển', 'xây đội', 'xây dựng đội'] },
    { id: 'overload', label: 'Quá tải & quản lý thời gian',
      keywords: ['quá tải', 'nhiều việc', 'ôm việc', 'cùng lúc', 'thời gian', 'ưu tiên'] },
    { id: 'newrole', label: 'Vai trò mới & hoạch định cho team',
      keywords: ['vai trò mới', 'hoạch định', 'kế hoạch', 'làm quen', 'mới lên', 'phát triển của nhân viên', 'phát triển nhân viên'] },
    { id: 'autonomy', label: 'Bị quản lý vi mô, thiếu quyền tự quyết',
      keywords: ['micro', 'quyền quyết định', 'tự quyết', 'bị giám sát'] },
  ],
};
