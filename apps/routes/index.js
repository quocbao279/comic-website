const express = require("express");
const router = express.Router();

const AuthController = require("../controllers/authController");
const HomeController = require("../controllers/homeController");
const ComicsController = require("../controllers/admin/comicsController");
const { authMiddleware, roleMiddleware } = require("../middleware/auth");
const { uploadComicCover } = require("../middleware/upload");
const adminRoutes = require("./admin");
const uploaderRoutes = require("./uploader");

router.get("/", HomeController.getHomePage);
router.get("/home", HomeController.getHomePage);
router.get("/lastupdate", HomeController.getLatestUpdatesPage);
router.get("/genres/:genreSlug", HomeController.getComicsByGenre);

router.get(
  "/comics/post",
  authMiddleware,
  roleMiddleware(["uploader", "admin"]),
  ComicsController.getCreateComicForm
);

router.post(
  "/comics/post",
  authMiddleware,
  roleMiddleware(["uploader", "admin"]),
  uploadComicCover,
  ComicsController.createComic
);

router.get("/comics/:idOrSlug", HomeController.getComicDetail);
router.get(
  "/comics/:idOrSlug/chapter/:chapterNumber",
  HomeController.readChapter
);

router.get("/login", AuthController.getLoginPage);
router.post("/login", AuthController.loginUser);
router.get("/register", AuthController.getRegisterPage);
router.post("/register", AuthController.registerUser);
router.get("/logout", AuthController.logoutUser);

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
