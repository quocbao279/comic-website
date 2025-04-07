// File: apps/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- Đường dẫn (Đã sửa) ---
const uploadBaseDir = path.join(__dirname, "../../public/uploads");
const coversDir = path.join(uploadBaseDir, "covers");
const chaptersDir = path.join(uploadBaseDir, "chapters");

// --- Tạo thư mục ---
try {
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  if (!fs.existsSync(chaptersDir)) {
    fs.mkdirSync(chaptersDir, { recursive: true });
  } // <<< Đảm bảo tạo thư mục chapters
} catch (err) {
  console.error("Error creating upload directories:", err);
}

// --- Cấu hình lưu trữ Ảnh Bìa ---
const comicCoverStorage = multer.diskStorage({
  destination: coversDir,
  filename: function (req, file, cb) {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "comicCover-" + uniqueSuffix + path.extname(safeOriginalName));
  },
});

// --- Bộ lọc file ảnh ---
const imageFileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const isImage =
    filetypes.test(path.extname(file.originalname).toLowerCase()) &&
    filetypes.test(file.mimetype);
  if (isImage) {
    cb(null, true);
  } else {
    cb(new Error("Loại file không hợp lệ! Chỉ chấp nhận ảnh."), false);
  }
};

// --- Middleware Ảnh Bìa ---
const uploadComicCover = multer({
  storage: comicCoverStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFileFilter,
}).single("comicCover");

// --- Cấu hình lưu trữ cho Ảnh Chapter ---
const chapterPagesStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Lưu tất cả vào public/uploads/chapters/
    // Sau này nếu muốn lưu vào thư mục con theo comic/chapter thì cần xử lý phức tạp hơn
    cb(null, chaptersDir);
  },
  filename: function (req, file, cb) {
    // Tạo tên file duy nhất để tránh trùng lặp
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "chapterPage-" + uniqueSuffix + path.extname(safeOriginalName));
  },
});

// 'chapterPages' là giá trị thuộc tính 'name' của input type="file" multiple
// 50 là giới hạn số file tối đa trong 1 lần upload
const uploadChapterPages = multer({
  storage: chapterPagesStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Giới hạn mỗi ảnh 2MB (ví dụ)
  fileFilter: imageFileFilter,
}).array("chapterPages", 50); // <<< Dùng .array()

// --- Export các middleware ---
module.exports = {
  uploadComicCover,
  uploadChapterPages,
};
