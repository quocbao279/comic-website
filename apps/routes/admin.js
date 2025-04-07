// File: apps/routes/admin.js
const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

// Controller imports
const ComicsController = require("../controllers/admin/comicsController");
const {
  uploadComicCover,
  uploadChapterPages,
} = require("../middleware/upload");
const AdminController = require("../controllers/admin/adminController");
const UsersController = require("../controllers/admin/usersController");
const RolesController = require("../controllers/admin/rolesController");
const GenresController = require("../controllers/admin/genresController");
const { authMiddleware, roleMiddleware } = require("../middleware/auth");

// --- Middleware áp dụng cho tất cả các route admin ---
router.use(authMiddleware);
router.use(roleMiddleware("admin"));

// --- Dashboard ---
router.get("/", AdminController.getAdminDashboard);
router.get("/dashboard", AdminController.getAdminDashboard);

// --- User Management --- (Giữ nguyên các route user)
router.get("/users", UsersController.getAllUsers);
router.get("/users/create", UsersController.getCreateUserForm);
router.post("/users", UsersController.createUser);
router.get("/users/edit/:id", UsersController.getUser);
router.post("/users/edit/:id", UsersController.updateUser);
router.post("/users/delete/:id", UsersController.deleteUser);

// --- Comic Management ---
router.get("/comics", ComicsController.getAllComics);
router.get("/comics/create", ComicsController.getCreateComicForm);
// Sử dụng middleware uploadComicCover
router.post("/comics", uploadComicCover, ComicsController.createComic); // <<< Sử dụng middleware đã import
router.get("/comics/edit/:id", ComicsController.getEditComicForm); // <<< Đảm bảo hàm này là getComic (hoặc getEditComicForm tùy bạn chọn)
// Sử dụng middleware uploadComicCover
router.post("/comics/edit/:id", uploadComicCover, ComicsController.updateComic); // <<< Sử dụng middleware đã import
router.post("/comics/delete/:id", ComicsController.deleteComic);

// ---Chapter Management ---
// GET: Hiển thị form thêm chapter mới cho một comic cụ thể
router.get("/comics/:comicId/chapters/new", ComicsController.getAddChapterForm);
// POST: Xử lý thêm chapter mới (có upload nhiều ảnh)
router.post(
  "/comics/:comicId/chapters",
  uploadChapterPages,
  ComicsController.createChapter
);
// GET: Hiển thị form SỬA chapter cụ thể (Dùng chapterId)
router.get("/chapters/:chapterId/edit", ComicsController.getEditChapterForm); // <<< THÊM ROUTE NÀY

// POST: Xử lý submit form SỬA chapter
router.post("/chapters/:chapterId/edit", ComicsController.updateChapter); // <<< THÊM ROUTE NÀY

// POST: Xử lý XÓA chapter cụ thể
router.post("/chapters/:chapterId/delete", ComicsController.deleteChapter); // <<< THÊM ROUTE NÀY

// --- Role Management --- (Giữ nguyên các route role)
router.get("/roles", RolesController.getAllRoles);
router.get("/roles/create", RolesController.getCreateRoleForm);
router.post("/roles", RolesController.createRole);
router.get("/roles/edit/:id", RolesController.getEditRoleForm);
router.post("/roles/edit/:id", RolesController.updateRole);
router.post("/roles/delete/:id", RolesController.deleteRole);

// --- Genre Management --- (Giữ nguyên các route genre)
router.get("/genres", GenresController.getAllGenres);
router.get("/genres/create", GenresController.getCreateGenreForm);
router.post("/genres", GenresController.createGenre);
router.get("/genres/edit/:id", GenresController.getEditGenreForm);
router.post("/genres/edit/:id", GenresController.updateGenre);
router.post("/genres/delete/:id", GenresController.deleteGenre);

module.exports = router;
