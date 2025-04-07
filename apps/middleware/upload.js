// File: apps/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs"); // Dùng để tạo thư mục

// --- Tạo thư mục lưu trữ nếu chưa có ---
// Đường dẫn tuyệt đối đến thư mục public/uploads
const uploadBaseDir = path.join(__dirname, "../public/uploads");
const coversDir = path.join(uploadBaseDir, "covers");
const chaptersDir = path.join(uploadBaseDir, "chapters"); // Chuẩn bị sẵn cho chapter

// --- Cấu hình lưu trữ cho Ảnh Bìa ---
const comicCoverStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, coversDir); // Lưu vào public/uploads/covers
  },
  filename: function (req, file, cb) {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "comicCover-" + uniqueSuffix + path.extname(safeOriginalName));
  },
});

// --- Bộ lọc chỉ cho phép file ảnh ---
const imageFileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const isImage =
    filetypes.test(path.extname(file.originalname).toLowerCase()) &&
    filetypes.test(file.mimetype);
  if (isImage) {
    cb(null, true);
  } else {
    // Từ chối file và trả về lỗi (có thể bắt lỗi này trong controller)
    cb(new Error("Loại file không hợp lệ! Chỉ chấp nhận ảnh."), false);
  }
};

// --- Middleware Multer cho upload ảnh bìa ---
// 'comicCover' là giá trị thuộc tính 'name' của input type="file" trong form
const uploadComicCover = multer({
  storage: comicCoverStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
  fileFilter: imageFileFilter,
}).single("comicCover");

// --- (Tương lai) Middleware cho upload nhiều ảnh chapter ---
// const chapterPagesStorage = ...
// const uploadChapterPages = multer({ storage: chapterPagesStorage, ... }).array('chapterPages', 50); // Ví dụ: name="chapterPages", tối đa 50 ảnh

// --- Export các middleware ---
module.exports = {
  uploadComicCover,
  // uploadChapterPages // Sẽ export khi làm chức năng upload chapter
};
