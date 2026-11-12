# Hệ thống Quản lý & Tính lương Phòng Kỹ thuật - Công nghệ (Gạch Men Phương Nam)

Ứng dụng Web App quản lý, tính lương khoán sản lượng, bảo dưỡng, thưởng và xuất bảng thanh toán tiền lương chuẩn thể thức **Nghị định 30/2020/NĐ-CP (TCVN 6909:2001)** cho **Phòng Kỹ thuật - Công nghệ – Công ty Cổ phần Gạch Men Phương Nam**.

## Tính năng chính (5 Tab)
1. **Tab 1 — Trung tâm Nhập liệu & Chứng từ tháng:** Nhập cụm sản lượng (Đơn giá × SL) hoặc nhập thẳng Tổng quỹ khoán, Quỹ bảo dưỡng DC2, Nhật ký giảm trừ (Quỹ thưởng chung / Cá nhân), Upload/Paste bảng chấm công có đối soát trước khi nạp, và Kho lưu trữ Quyết định giao khoán.
2. **Tab 2 — Quản lý Nhân sự & Hệ số định mức:** Quản lý 2 bộ phận (BP Văn phòng & BP Nhân viên Dây chuyền 1+2), hỗ trợ upload Excel nhân sự, khóa/mở khóa và bảo toàn lịch sử hệ số các kỳ lương cũ.
3. **Tab 3 — Bảng Tính lương Chi tiết & Đối soát:** Hỗ trợ 2 chế độ chia quỹ (*Chế độ 1: Gộp quỹ mẫu KTCN* & *Chế độ 2: Tách riêng 3 quỹ*), chuyển nhanh chuẩn *Lương hệ số 1 (27 công / 26 công)*, cảnh báo ngày công bất thường.
4. **Tab 4 — Báo cáo Phân tích & Biến động:** Biểu đồ và bảng so sánh quỹ lương, đơn giá 1 HS-công, thưởng, giảm trừ và tỷ trọng chi lương giữa 2 bộ phận qua các kỳ.
5. **Tab 5 — Xuất Excel NĐ30/CP, Xem trước In/PDF & Sao lưu JSON:** Xuất file `.xlsx` có công thức sống và bản in A4 ngang chuẩn Nghị định 30/2020/NĐ-CP.

## Chạy dự án
```bash
npm install
npm run dev
npm run build
```
