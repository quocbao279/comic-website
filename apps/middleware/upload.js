const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadBaseDir = path.join(__dirname, "../../public/uploads");
const coversDir = path.join(uploadBaseDir, "covers");
const chaptersDir = path.join(uploadBaseDir, "chapters");

try {
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  if (!fs.existsSync(chaptersDir)) {
    fs.mkdirSync(chaptersDir, { recursive: true });
  }
} catch (err) {
  console.error("Error creating upload directories:", err);
}

const comicCoverStorage = multer.diskStorage({
  destination: coversDir,
  filename: function (req, file, cb) {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "comicCover-" + uniqueSuffix + path.extname(safeOriginalName));
  },
});

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

const uploadComicCover = multer({
  storage: comicCoverStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).single("comicCover");

const chapterPagesStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, chaptersDir);
  },
  filename: function (req, file, cb) {
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, "_");
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "chapterPage-" + uniqueSuffix + path.extname(safeOriginalName));
  },
});
const uploadChapterPages = multer({
  storage: chapterPagesStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFileFilter,
}).array("chapterPages", 50);

module.exports = {
  uploadComicCover,
  uploadChapterPages,
};
