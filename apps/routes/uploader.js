// File: apps/routes/uploader.js
const express = require("express");
const router = express.Router();

// Import middleware và controller
const { authMiddleware, roleMiddleware } = require("../middleware/auth");
const ComicsController = require("../controllers/admin/comicsController"); // Dùng chung controller
const { uploadComicCover } = require("../middleware/upload"); // Middleware upload
const { uploadChapterPages } = require("../middleware/upload");

// --- Middleware áp dụng cho toàn bộ route /uploader ---
router.use(authMiddleware); // Phải đăng nhập
router.use(roleMiddleware(["uploader", "admin"])); // Phải là uploader hoặc admin

// === Định nghĩa các route con ===

// GET /uploader/ hoặc /uploader/comics : Hiển thị danh sách truyện của TÔI
router.get("/", ComicsController.getMyComics);
router.get("/comics", ComicsController.getMyComics); // Alias

// GET /uploader/comics/edit/:id : Hiển thị form sửa truyện CỦA TÔI
router.get("/comics/edit/:id", ComicsController.getMyComicForEdit);

// POST /uploader/comics/edit/:id : Xử lý sửa truyện CỦA TÔI
router.post(
  "/comics/edit/:id",
  uploadComicCover,
  ComicsController.updateMyComic
);

// POST /uploader/comics/delete/:id : Xử lý xóa truyện CỦA TÔI
router.post("/comics/delete/:id", ComicsController.deleteMyComic);

// GET: Hiển thị form thêm chapter cho truyện CỦA TÔI
router.get(
  "/comics/:comicId/chapters/new",
  ComicsController.getAddChapterFormForUploader
); // <<< Hàm controller mới

// POST: Xử lý thêm chapter mới cho truyện CỦA TÔI
router.post(
  "/comics/:comicId/chapters",
  uploadChapterPages,
  ComicsController.createChapterForUploader
); // <<< Hàm controller mới

module.exports = router;
