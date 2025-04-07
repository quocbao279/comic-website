// File: apps/routes/uploader.js
const express = require("express");
const router = express.Router();

// Import middleware và controller cần thiết
const { authMiddleware, roleMiddleware } = require("../middleware/auth");
// Có thể tạo controller riêng 'uploaderController.js' hoặc dùng chung 'comicsController.js' với logic kiểm tra quyền sở hữu
const ComicsController = require("../controllers/admin/comicsController"); // Tạm dùng chung
const { uploadComicCover } = require("../middleware/upload"); // Dùng lại middleware upload

// --- Middleware áp dụng cho TOÀN BỘ route trong file này ---
router.use(authMiddleware); // Phải đăng nhập
router.use(roleMiddleware(["uploader", "admin"])); // Phải là uploader hoặc admin

// === Định nghĩa các route con của /uploader ===

// GET /uploader/ hoặc /uploader/comics : Hiển thị danh sách truyện của TÔI
router.get("/", ComicsController.getMyComics); // <<< Cần tạo hàm getMyComics
router.get("/comics", ComicsController.getMyComics); // Alias

// GET /uploader/comics/edit/:id : Hiển thị form sửa truyện CỦA TÔI
router.get("/comics/edit/:id", ComicsController.getMyComicForEdit); // <<< Cần tạo hàm getMyComicForEdit (có kiểm tra sở hữu)

// POST /uploader/comics/edit/:id : Xử lý sửa truyện CỦA TÔI
router.post(
  "/comics/edit/:id",
  uploadComicCover,
  ComicsController.updateMyComic
); // <<< Cần tạo hàm updateMyComic (có kiểm tra sở hữu)

// POST /uploader/comics/delete/:id : Xử lý xóa truyện CỦA TÔI
router.post("/comics/delete/:id", ComicsController.deleteMyComic); // <<< Cần tạo hàm deleteMyComic (có kiểm tra sở hữu)

// Lưu ý: Route để đăng truyện mới (GET/POST /comics/post) đã được định nghĩa ở index.js và cho phép uploader truy cập rồi.

module.exports = router;
