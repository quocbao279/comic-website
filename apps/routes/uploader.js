const express = require("express");
const router = express.Router();

// Import middleware và controller
const { authMiddleware, roleMiddleware } = require("../middleware/auth");
const ComicsController = require("../controllers/admin/comicsController");
const { uploadComicCover } = require("../middleware/upload");
const { uploadChapterPages } = require("../middleware/upload");

router.use(authMiddleware);
router.use(roleMiddleware(["uploader", "admin"]));

router.get("/", ComicsController.getMyComics);
router.get("/comics", ComicsController.getMyComics);

router.get("/comics/edit/:id", ComicsController.getMyComicForEdit);

router.post(
  "/comics/edit/:id",
  uploadComicCover,
  ComicsController.updateMyComic
);

router.post("/comics/delete/:id", ComicsController.deleteMyComic);

router.get(
  "/comics/:comicId/chapters/new",
  ComicsController.getAddChapterFormForUploader
);

router.post(
  "/comics/:comicId/chapters",
  uploadChapterPages,
  ComicsController.createChapterForUploader
);

module.exports = router;
