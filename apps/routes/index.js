// File: apps/routes/index.js (Sửa lại thứ tự)
const express = require("express");
const router = express.Router();

// --- Requires ---
const AuthController = require("../controllers/authController");
const HomeController = require("../controllers/homeController");
const ComicsController = require("../controllers/admin/comicsController");
const { authMiddleware, roleMiddleware } = require("../middleware/auth");
const { uploadComicCover } = require("../middleware/upload");
const adminRoutes = require("./admin");
const uploaderRoutes = require("./uploader");

// === PUBLIC ROUTES ===
router.get("/", HomeController.getHomePage);
router.get("/home", HomeController.getHomePage);
router.get("/lastupdate", HomeController.getLatestUpdatesPage);
router.get("/genres/:genreSlug", HomeController.getComicsByGenre);
// ... other public routes ...

// === COMIC SPECIFIC ROUTES (Thứ tự quan trọng!) ===

// --- Route Đăng Truyện (GET) - Cần auth + role - Phải đặt TRƯỚC /comics/:idOrSlug ---
router.get(
  "/comics/post",
  authMiddleware, // << Áp dụng middleware trực tiếp
  roleMiddleware(["uploader", "admin"]),
  ComicsController.getCreateComicForm
);
// --- Route Đăng Truyện (POST) - Cần auth + role - Phải đặt TRƯỚC /comics/:idOrSlug ---
router.post(
  "/comics/post",
  authMiddleware, // << Áp dụng middleware trực tiếp
  roleMiddleware(["uploader", "admin"]),
  uploadComicCover,
  ComicsController.createComic
);

// --- Route chi tiết/chapter (Public) - Đặt SAU /comics/post ---
router.get("/comics/:idOrSlug", HomeController.getComicDetail);
router.get(
  "/comics/:idOrSlug/chapter/:chapterNumber",
  HomeController.readChapter
);

// === AUTHENTICATION ROUTES ===
router.get("/login", AuthController.getLoginPage);
router.post("/login", AuthController.loginUser);
router.get("/register", AuthController.getRegisterPage);
router.post("/register", AuthController.registerUser);
router.get("/logout", AuthController.logoutUser);

// === OTHER AUTHENTICATED USER ROUTES (Profile, Bookmarks etc.) ===
// Áp dụng authMiddleware trực tiếp cho các route này
router.get("/profile", authMiddleware, HomeController.getProfilePage);
router.post("/profile", authMiddleware, HomeController.updateProfile);
router.get("/bookmarks", authMiddleware, HomeController.getBookmarksPage);
router.post(
  "/bookmarks/add/:comicId",
  authMiddleware,
  HomeController.addBookmark
);
router.post(
  "/bookmarks/remove/:comicId",
  authMiddleware,
  HomeController.removeBookmark
);

router.use("/admin", adminRoutes);
router.use("/uploader", uploaderRoutes);

module.exports = router;
