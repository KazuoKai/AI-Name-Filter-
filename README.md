# ⚡ AI Name Filter — Bộ Trích Xuất & Lọc Tên Riêng Nhúng Từ Điển Hán Việt

**AI Name Filter** là ứng dụng Desktop chuyên nghiệp (chạy bằng Electron) giúp các dịch giả, converter truyện chữ tự động trích xuất danh sách tên riêng tiếng Trung từ văn bản thô cực nhanh, dịch nghĩa Hán-Việt chuẩn xác 100% nhờ từ điển tích hợp và tự động lọc sạch các từ thường (rác) viết hoa bằng bộ lọc 2 lớp thông minh.

---

## ✨ Tính Năng Nổi Bật

*   ⚡ **Tối Ưu Siêu Tốc Độ:** Tự động tắt cơ chế suy luận ngầm (`thinking: disabled`) của các model Deepseek chat mới nhất, giúp thời gian xử lý giảm tối đa (chương truyện 20.000 chữ chỉ chạy trong vòng ~30 giây).
*   📖 **Tích Hợp Từ Điển Hán-Việt Local:** Nhúng sẵn bộ từ điển Hán-Việt ngoại tuyến gồm **17.000 từ đơn** và **380+ từ ghép** được trích xuất từ web gốc. Tự động đối chiếu ghép âm chuẩn từ điển 100% (ví dụ: `姒璃` -> `Tự Ly`), ngăn chặn tình trạng AI dịch chệch âm.
*   🚫 **Bộ Lọc Bẫy Rác 2 Lớp (AI + Local JS):**
    *   **Lớp 1 (AI):** Quét phát hiện và trích xuất thực thể thô.
    *   **Lớp 2 (JS Offline):** Tự động phát hiện và bóc tách các danh từ chung viết hoa sai quy tắc (như cảnh giới, môn phái, đệ tử, linh thú, các loại đồ ăn...) đưa sang cột riêng.
*   💰 **Theo Dõi Chi Phí & Token Thời Gian Thực:** Thống kê lượng token Input/Output thực tế trả về từ API và quy đổi trực tiếp thành tiền Việt Nam Đồng (**VNĐ - Tỉ giá 25.400đ**) dựa trên đơn giá chính xác của từng dòng model.
*   📂 **Tải File & Biên Tập Tiện Lợi:**
    *   Tải trực tiếp file truyện `.txt` tiếng Trung đầu vào bằng 1 click chuột.
    *   Giao diện bảng 2 cột trực quan: **Tên Riêng Sạch** vs **Từ Thường & Nghi Vấn (Rác)**.
    *   Cho phép click đúp chuột sửa trực tiếp tên, click mũi tên di chuyển từ giữa 2 cột nhanh chóng.
*   📦 **Đóng Gói Portable (.exe):** Đã cấu hình đóng gói sẵn thành file chạy di động di động duy nhất, có thể chia sẻ cho bất kỳ ai chạy ngay mà không cần cài đặt môi trường.

---

## 🛠️ Công Nghệ Sử Dụng

*   **Core Logic:** Vanilla HTML5, CSS3 (Glassmorphism & Harmonious Dark Theme), JavaScript ES6.
*   **Desktop App:** Electron v28.
*   **Packager:** Electron Builder (Target: Portable win-x64).
*   **AI API Integration:** Google Gemini API & DeepSeek API (hỗ trợ hàng đợi chạy song song điều chỉnh luồng, tự động Timeout & Retry).

---

## 🚀 Hướng Dẫn Cài Đặt & Phát Triển Cục Bộ

Yêu cầu máy tính đã cài đặt sẵn [Node.js](https://nodejs.org/).

1.  **Clone dự án về máy:**
    ```bash
    git clone <url-project-github>
    cd name_extractor_app
    ```

2.  **Cài đặt các thư viện phụ thuộc:**
    ```bash
    npm install
    ```

3.  **Chạy ứng dụng trong môi trường phát triển (Dev Mode):**
    ```bash
    npm start
    ```

4.  **Đóng gói thành file `.exe` Portable để chia sẻ:**
    ```bash
    npm run pack
    ```
    Sau khi chạy xong, file chạy `.exe` độc lập sẽ nằm trong thư mục `dist/ai-name-filter 1.0.0.exe`.

---

## 📂 Cấu Trúc Thư Mục Dự Án

```text
├── index.html        # Giao diện chính của ứng dụng
├── style.css         # Thiết kế CSS Premium Dark Mode
├── main.js           # File kiểm soát tiến trình chạy Electron
├── dict_data.js      # Cơ sở dữ liệu từ điển Hán-Việt local
├── filter.js         # Bộ lọc rác lớp 2 & Thuật toán dịch nghĩa từ điển
├── api.js            # Điều phối hàng đợi song song gửi API Gemini/DeepSeek
├── app.js            # Điều phối hoạt động giao diện, lưu trữ, xuất dữ liệu
└── package.json      # File khai báo thư viện và script đóng gói
```

---

## 📜 Hướng Dẫn Sử Dụng App

1.  Mở ứng dụng lên.
2.  Dán API Key (Gemini hoặc DeepSeek) tương ứng và chọn model mong muốn.
3.  Click nút **"Tải file .txt"** để chọn file truyện chữ Hán hoặc dán trực tiếp text vào khung.
4.  Thiết lập các thông số như **Kiểu truyện (Đông phương / Quốc tế)**, **Cỡ chunk**, **Số luồng song song** (khuyên dùng là 2 luồng để tránh dính giới hạn API của DeepSeek).
5.  Bấm **"Bắt đầu Trích Xuất"** và theo dõi tiến độ chạy, lượng token tiêu hao & tiền VNĐ nhảy trực tiếp trên màn hình.
6.  Khi chạy xong, kiểm tra bảng kết quả, nhấp đúp để sửa nhanh hoặc bấm **"Tải Tất Cả File"** để xuất ra file `Names.txt` và `Names2.txt` sạch sẽ.
