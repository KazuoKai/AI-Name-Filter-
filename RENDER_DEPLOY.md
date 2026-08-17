# Deploy lên Render từ GitHub

## Cách app hoạt động khi public
- Frontend là trang dùng chung: mỗi visitor tự nhập API key riêng (Gemini, DeepSeek hoặc Proxy) rồi trích xuất ngay trên trình duyệt.
- Server không giữ key cho visitor, nên chủ web không bị tốn credit.
- `ADMIN_KEY` chỉ dùng cho việc lưu cấu hình chung trên server (ignore rules, Names.txt) và gọi API phía server.

## Các file bắt buộc trong GitHub
- `server.js`, `api.js`, `app.js`, `dict_data.js`, `filter.js`, `index.html`, `style.css`
- `package.json`, `package-lock.json`
- `render.yaml`, `.gitignore`, `.env.example`
- Thư mục `public/` chứa bản tĩnh đã đồng bộ; server chỉ phục vụ `public/`.

Không push các thứ này lên GitHub:
- `node_modules/`, `data/`, `.env`
- `server.js.bak`, `public/server.js` (nếu có)
- Các file log.

## Deploy bằng Blueprint
1. Push repo lên GitHub.
2. Render -> New -> Blueprint -> chọn repo.
3. Render nhận `render.yaml` và tự tạo service web `name-extractor-web`.
4. Vào Env/Settings của service và điền:
   - `ADMIN_KEY`: đặt một chuỗi dài, chỉ bạn biết.
   - `ALLOWED_ORIGIN`: đúng domain Render, ví dụ `https://name-extractor.onrender.com`.
   - `RATE_LIMIT_PER_MIN`: mặc định `60` trong render.yaml.
   - `NEXUS_API_KEYS`: có thể bỏ trống vì visitor tự nhập key; chỉ cần nếu bạn dùng `/api/extract-names` phía server.
5. Deploy xong, thay domain thật vào `ALLOWED_ORIGIN` nếu Render cấp domain khác.

## Nếu Render báo lỗi build
- Kiểm tra đã push `package-lock.json`.
- Build command là `npm ci --omit=dev`, nên không cần cài Electron/electron-builder.
- Node version tối thiểu 20, khai báo trong `package.json`.

## Lưu ý bảo mật
- Trang public nên luôn dùng HTTPS (Render cấp sẵn).
- Không đặt API key cá nhân vào GitHub hoặc `render.yaml`.
- Khi visitor gửi nội dung lên AI, nội dung đó đi từ trình duyệt visitor đến provider, không qua server.
- `/api/proxy-extract` chỉ cho phép các domain AI trong allowlist để tránh SSRF.
