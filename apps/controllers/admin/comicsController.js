const DatabaseConnection = require("../../database/database");
const { ObjectId } = require("mongodb");
const Chapter = require("../../models/chapter");
const fs = require("fs");
const path = require("path");
const { getAllGenres } = require("./genresController");

class ComicsController {
  // GET all comics - Render trang quản lý comics
  static async getAllComics(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      let filter = {};
      if (req.query.search) {
        filter.$or = [
          { title: { $regex: req.query.search, $options: "i" } },
          { author: { $regex: req.query.search, $options: "i" } },
        ];
      }
      if (req.query.genre) {
        filter.genres = req.query.genre;
      }
      if (req.query.status) {
        filter.status = req.query.status;
      }

      const comics = await db
        .collection("comics")
        .find(filter)
        .sort({ title: 1 })
        .toArray();
      res.render("admin/comics/index", {
        comics: comics,
        title: "Quản lý Truyện",
        query: req.query,
      });
    } catch (error) {
      console.error("Error getting all comics:", error);
      next(error);
    }
  }
  // GET - Render form tạo comic mới
  static async getCreateComicForm(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const allGenres = await db
        .collection("genres")
        .find()
        .sort({ name: 1 })
        .toArray();

      res.render("admin/comics/create", {
        title: "Thêm Truyện Mới",
        allGenres: allGenres,
      });
    } catch (error) {
      console.error("Error getting create comic form:", error);
      next(error);
    }
  }

  // GET - Render form chỉnh sửa comic
  static async getEditComicForm(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const comicId = new ObjectId(req.params.id);
      const comic = await db.collection("comics").findOne({ _id: comicId });

      if (!comic) {
        req.session.message = { type: "error", text: "Truyện không tồn tại!" };
        return res.redirect("/admin/comics");
      }
      const chapters = await Chapter.findChaptersByComicId(db, comicId);
      const allGenres = await db
        .collection("genres")
        .find()
        .sort({ name: 1 })
        .toArray();
      res.render("admin/comics/edit", {
        comic: comic,
        title: `Sửa: ${comic.title}`,
        allGenres: allGenres,
        chapters: chapters,
        formAction: `/admin/comics/edit/${comic._id}`, // Action cho form admin
      });
    } catch (error) {
      console.error(`Error getting comic ${req.params.id} for edit:`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "ID Truyện không hợp lệ.",
        };
        return res.redirect("/admin/comics");
      }
      next(error);
    }
  }
  // POST - Tạo comic mới
  static async createComic(req, res, next) {
    try {
      console.log("DEBUG: Uploaded File Info:", req.file);
      const db = DatabaseConnection.getDb();
      let imageUrl = null;

      if (req.file) {
        imageUrl = `/uploads/covers/${req.file.filename}`;
      }

      const { title, author, genres, status, description, releaseDate } =
        req.body;
      let genresArray = genres
        ? Array.isArray(genres)
          ? genres
          : [genres]
        : [];

      const uploaderId = req.user ? req.user._id : null;
      const newComic = {
        title: title,
        author: author || null,
        description: description || null,
        genres: genresArray,
        status: status || "ongoing",
        imageUrl: imageUrl,
        chapters: [],
        views: 0,
        rating: 0,
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        uploaderId: uploaderId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const result = await db.collection("comics").insertOne(newComic);
      console.log(
        `Comic created: ${title} by ${req.user?.username || "Unknown"} (ID: ${
          result.insertedId
        })`
      );
      req.session.message = {
        type: "success",
        text: "Đã thêm truyện thành công!",
      };

      if (req.user?.role === "admin" && req.originalUrl.startsWith("/admin")) {
        res.redirect("/admin/comics");
      } else {
        res.redirect("/");
      }
    } catch (error) {
      console.error("!!! ORIGINAL Error during comic creation:", error);
      if (req.file && req.file.path) {
        console.log(`Attempting to delete orphaned upload: ${req.file.path}`);
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) {
            console.error(
              `Error deleting uploaded file ${req.file.path} after failed comic creation:`,
              unlinkErr
            );
          } else {
            console.log(
              `Deleted orphaned upload ${req.file.filename} after error.`
            );
          }
        });
      }
      req.session.message = {
        type: "error",
        text: `Lỗi khi thêm truyện: ${error.message}`,
      };
      if (req.user?.role === "admin" && req.originalUrl.startsWith("/admin")) {
        console.log(
          "DEBUG: Redirecting ADMIN from admin path to /admin/comics"
        );
        res.redirect("/admin/comics");
      } else {
        console.log(
          `DEBUG: Redirecting role '<span class="math-inline">\{req\.user?\.role\}' from path '</span>{req.originalUrl}' to /uploader`
        );
        res.redirect("/");
      }
    }
  }

  // POST - Cập nhật comic
  static async updateComic(req, res, next) {
    const comicIdParam = req.params.id;
    let comicId;

    //Kiểm tra và chuyển đổi ObjectId
    try {
      comicId = new ObjectId(comicIdParam);
    } catch (e) {
      req.session.message = { type: "error", text: "ID Truyện không hợp lệ." };
      return res.redirect("/admin/comics");
    }
    try {
      const db = DatabaseConnection.getDb();
      const { title, author, genres, status, description, releaseDate } =
        req.body;
      const updateFields = {
        title: title,
        author: author || null,
        description: description || null,
        genres: Array.isArray(genres) ? genres : genres ? [genres] : [],
        status: status || "ongoing",
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        updatedAt: new Date(),
      };
      //Xử lý Ảnh Bìa Mới (nếu có)
      let oldImageUrl = null;
      if (req.file) {
        updateFields.imageUrl = `/uploads/covers/${req.file.filename}`;
        console.log(
          `New cover image uploaded for ${comicIdParam}: ${updateFields.imageUrl}`
        );
        // Lấy URL ảnh cũ để chuẩn bị xóa (nếu có)
        try {
          const oldComic = await db
            .collection("comics")
            .findOne({ _id: comicId }, { projection: { imageUrl: 1 } });
          if (oldComic && oldComic.imageUrl) {
            oldImageUrl = oldComic.imageUrl;
          }
        } catch (findError) {
          console.error(
            `Error finding old comic ${comicIdParam} to get old image URL:`,
            findError
          );
        }
      } else {
        console.log(
          `No new cover image uploaded for ${comicIdParam}. Keeping existing one.`
        );
      }

      //Thực hiện Cập nhật vào Database
      const result = await db
        .collection("comics")
        .updateOne({ _id: comicId }, { $set: updateFields });

      if (result.matchedCount === 0) {
        req.session.message = {
          type: "error",
          text: "Truyện không tìm thấy để cập nhật.",
        };
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err)
              console.error(
                `Error deleting orphaned upload ${req.file.path}:`,
                err
              );
          });
        }
        return res.redirect("/admin/comics");
      } else {
        req.session.message = {
          type: "success",
          text: "Đã cập nhật truyện thành công!",
        };
        console.log(
          `Comic ${comicIdParam} updated. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`
        );
        if (
          req.file &&
          oldImageUrl &&
          oldImageUrl !== updateFields.imageUrl &&
          oldImageUrl !== "/img/placeholder.png"
        ) {
          const oldPath = path.join(__dirname, "../../public", oldImageUrl);
          console.log(`Attempting to delete old cover image: ${oldPath}`);
          fs.unlink(oldPath, (err) => {
            if (err && err.code !== "ENOENT") {
              console.error(`Error deleting old cover image ${oldPath}:`, err);
            } else if (!err) {
              console.log(`Deleted old cover image: ${oldPath}`);
            }
          });
        }
        return res.redirect("/admin/comics");
      }
    } catch (error) {
      //Xử lý Lỗi Chung
      console.error(`Error updating comic ${comicIdParam}:`, error);
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err)
            console.error(
              `Error deleting uploaded file ${req.file.path} after failed update:`,
              err
            );
        });
      }

      req.session.message = {
        type: "error",
        text: `Lỗi khi cập nhật truyện: ${error.message}`,
      };
      res.redirect(`/admin/comics/edit/${comicIdParam}`);
      // next(error);
    }
  }

  // POST - Xóa comic
  static async deleteComic(req, res, next) {
    const comicIdParam = req.params.id;
    let comicId;
    try {
      comicId = new ObjectId(comicIdParam);
    } catch (e) {
      req.session.message = { type: "error", text: "ID Truyện không hợp lệ." };
      return res.redirect("/admin/comics");
    }

    try {
      const db = DatabaseConnection.getDb();
      const comicToDelete = await db
        .collection("comics")
        .findOne({ _id: comicId }, { projection: { imageUrl: 1 } });

      const result = await db.collection("comics").deleteOne({ _id: comicId });

      if (result.deletedCount === 0) {
        req.session.message = {
          type: "error",
          text: "Không tìm thấy truyện để xóa.",
        };
      } else {
        console.log(`Comic deleted: ${comicIdParam}`);
        req.session.message = {
          type: "success",
          text: "Đã xóa truyện thành công!",
        };
        if (
          comicToDelete &&
          comicToDelete.imageUrl &&
          comicToDelete.imageUrl !== "/img/placeholder.png"
        ) {
          const imagePath = path.join(
            __dirname,
            "../../public",
            comicToDelete.imageUrl
          );
          fs.unlink(imagePath, (err) => {
            if (err)
              console.error(
                `Error deleting cover image ${imagePath} for deleted comic:`,
                err
              );
            else
              console.log(
                `Deleted cover image for deleted comic: ${imagePath}`
              );
          });
        }
      }
      res.redirect("/admin/comics");
    } catch (error) {
      console.error(`Error deleting comic ${comicIdParam}:`, error);
      req.session.message = {
        type: "error",
        text: `Lỗi khi xóa truyện: ${error.message}`,
      };
      res.redirect("/admin/comics");
    }
  }
  static async getMyComics(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id;

      const myComics = await db
        .collection("comics")
        .find({ uploaderId: userId })
        .sort({ updatedAt: -1 })
        .toArray();

      res.render("uploader/dashboard", {
        title: "Truyện của tôi",
        comics: myComics,
      });
    } catch (error) {
      console.error("Error getting my comics:", error);
      next(error);
    }
  }
  // GET /uploader/comics/edit/:id - Hiển thị form sửa truyện của tôi
  static async getMyComicForEdit(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const comicId = new ObjectId(req.params.id);
      const userId = req.user._id;

      const comic = await db.collection("comics").findOne({ _id: comicId });

      if (!comic) {
        req.session.message = { type: "error", text: "Truyện không tồn tại!" };
        return res.redirect("/uploader");
      }
      if (
        comic.uploaderId?.toString() !== userId.toString() &&
        req.user.role !== "admin"
      ) {
        req.session.message = {
          type: "error",
          text: "Bạn không có quyền sửa truyện này.",
        };
        return res.status(403).redirect("/uploader"); // Lỗi Forbidden
      }

      const allGenres = await db
        .collection("genres")
        .find()
        .sort({ name: 1 })
        .toArray();

      // Có thể dùng lại view edit của admin, nhưng action của form cần trỏ đúng về /uploader/comics/edit/:id
      res.render("admin/comics/edit", {
        // Tạm dùng lại view admin/edit
        comic: comic,
        title: `Sửa truyện của tôi: ${comic.title}`,
        allGenres: allGenres,
        formAction: `/uploader/comics/edit/${comic._id}`,
      });
    } catch (error) {
      console.log("Error while editing comics");
      next(error);
    }
  }
  static async getMyComics(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id;

      const myComics = await db
        .collection("comics")
        .find({ uploaderId: userId })
        .sort({ updatedAt: -1 })
        .toArray();

      res.render("uploader/dashboard", {
        title: "Truyện của tôi",
        comics: myComics,
      });
    } catch (error) {
      console.error("Error getting my comics:", error);
      next(error);
    }
  }
  static async getMyComicForEdit(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const comicId = new ObjectId(req.params.id);
      const userId = req.user._id;

      const comic = await db.collection("comics").findOne({ _id: comicId });

      if (!comic) {
        req.session.message = { type: "error", text: "Truyện không tồn tại!" };
        return res.redirect("/uploader");
      }
      if (
        comic.uploaderId?.toString() !== userId.toString() &&
        req.user.role !== "admin"
      ) {
        req.session.message = {
          type: "error",
          text: "Bạn không có quyền sửa truyện này.",
        };
        return res.status(403).redirect("/uploader");
      }

      const allGenres = await db
        .collection("genres")
        .find()
        .sort({ name: 1 })
        .toArray();
      res.render("admin/comics/edit", {
        comic: comic,
        title: `Sửa truyện của tôi: ${comic.title}`,
        allGenres: allGenres,
        formAction: `/uploader/comics/edit/${comic._id}`,
      });
    } catch (error) {
      console.log("Error while editing comics");
      next(error);
    }
  }
  static async updateMyComic(req, res, next) {
    const comicIdParam = req.params.id;
    let comicId;
    try {
      comicId = new ObjectId(comicIdParam);
    } catch (e) {
      console.log("Đã có lỗi xảy ra");
      return res.redirect("/uploader");
    }
    console.log(`DEBUG: updateMyComic called for ID: ${comicIdParam}`);
    console.log("DEBUG: req.body received:", req.body);
    console.log("DEBUG: req.file received:", req.file);

    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id;

      const comicToUpdate = await db
        .collection("comics")
        .findOne(
          { _id: comicId },
          { projection: { uploaderId: 1, imageUrl: 1 } }
        );
      if (!comicToUpdate) {
        req.session.message = { type: "error", text: "Truyện không tồn tại!" };
        return res.redirect("/uploader");
      }
      if (
        comicToUpdate.uploaderId?.toString() !== userId.toString() &&
        req.user.role !== "admin"
      ) {
        req.session.message = {
          type: "error",
          text: "Bạn không có quyền sửa truyện này.",
        };
        return res.status(403).redirect("/uploader");
      }

      const { title, author, genres, status, description, releaseDate } =
        req.body;
      const updateFields = {
        title: title,
        author: author || null,
        description: description || null,
        genres: Array.isArray(genres) ? genres : genres ? [genres] : [],
        status: status || "ongoing",
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        updatedAt: new Date(),
      };
      let oldImageUrl = comicToUpdate.imageUrl;

      if (req.file) {
        updateFields.imageUrl = `/uploads/covers/${req.file.filename}`;
      }

      const result = await db
        .collection("comics")
        .updateOne({ _id: comicId }, { $set: updateFields });

      if (result.matchedCount === 0) {
        /*...*/
      } else {
        req.session.message = {
          type: "success",
          text: "Đã cập nhật truyện thành công!",
        };
        if (
          req.file &&
          oldImageUrl &&
          oldImageUrl !== updateFields.imageUrl &&
          oldImageUrl !== "/img/placeholder.png"
        ) {
          const oldPath = path.join(__dirname, "../../public", oldImageUrl);
          fs.unlink(oldPath, (err) => {
            if (err)
              console.error(`Error deleting old cover image ${oldPath}:`, err);
          });
        }
      }
      res.redirect("/uploader");
    } catch (error) {
      console.log("Error while updating your comics");
      res.redirect(`/uploader/comics/edit/${comicIdParam}`);
    }
  }
  static async deleteMyComic(req, res, next) {
    const comicIdParam = req.params.id;
    let comicId;
    try {
      comicId = new ObjectId(comicIdParam);
    } catch (e) {
      /*...*/ return res.redirect("/uploader");
    }

    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id;

      const comicToDelete = await db
        .collection("comics")
        .findOne(
          { _id: comicId },
          { projection: { uploaderId: 1, imageUrl: 1 } }
        );
      if (!comicToDelete) {
        /*...*/ return res.redirect("/uploader");
      }
      if (
        comicToDelete.uploaderId?.toString() !== userId.toString() &&
        req.user.role !== "admin"
      ) {
        req.session.message = {
          type: "error",
          text: "Bạn không có quyền xóa truyện này.",
        };
        return res.status(403).redirect("/uploader");
      }

      const result = await db.collection("comics").deleteOne({ _id: comicId });
      if (result.deletedCount === 0) {
        /*...*/
      } else {
        req.session.message = {
          type: "success",
          text: "Đã xóa truyện thành công!",
        };
        if (
          comicToDelete.imageUrl &&
          comicToDelete.imageUrl !== "/img/placeholder.png"
        ) {
          const imagePath = path.join(
            __dirname,
            "../../public",
            comicToDelete.imageUrl
          );
          fs.unlink(imagePath, (err) => {
            if (err)
              console.error(`Error deleting cover image ${imagePath}:`, err);
          });
        }
        // await db.collection('chapters').deleteMany({ comicId: comicId });
      }
      res.redirect("/uploader");
    } catch (error) {
      console.log("Error while deleting your comics");
      res.redirect("/uploader");
    }
  }
  /**
   * GET /admin/comics/:comicId/chapters/new
   * Hiển thị form để thêm chapter mới cho một truyện cụ thể.
   */
  static async getAddChapterForm(req, res, next) {
    const comicIdParam = req.params.comicId;
    let comicObjectId;

    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      req.session.message = { type: "error", text: "ID Truyện không hợp lệ." };
      return res.redirect("/admin/comics");
    }

    try {
      const db = DatabaseConnection.getDb();
      const comic = await db
        .collection("comics")
        .findOne({ _id: comicObjectId }, { projection: { title: 1 } });

      if (!comic) {
        req.session.message = {
          type: "error",
          text: "Truyện không tồn tại để thêm chapter.",
        };
        return res.redirect("/admin/comics");
      }
      res.render("admin/chapters/create", {
        title: `Thêm Chapter cho: ${comic.title}`,
        comic: comic,
      });
    } catch (error) {
      console.error(
        `Error getting add chapter form for comic ${comicIdParam}:`,
        error
      );
      next(error);
    }
  }
  /**
   * POST /admin/comics/:comicId/chapters
   * Xử lý việc thêm chapter mới vào database, bao gồm cả upload ảnh.
   */
  static async createChapter(req, res, next) {
    const comicIdParam = req.params.comicId;
    const { chapterNumber, title } = req.body;
    const uploadedFiles = req.files;
    const uploaderId = req.user ? req.user._id : null;
    let comicObjectId;
    let savedImagePaths = [];
    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      req.session.message = { type: "error", text: "ID Truyện không hợp lệ." };

      if (uploadedFiles && uploadedFiles.length > 0) {
        uploadedFiles.forEach((file) =>
          fs.unlink(file.path, (err) => {
            if (err)
              console.error("Error deleting file with invalid comicId:", err);
          })
        );
      }
      return res.redirect("/admin/comics");
    }

    const db = DatabaseConnection.getDb();

    try {
      // Validate Input cơ bản
      if (!chapterNumber || !uploadedFiles || uploadedFiles.length === 0) {
        req.session.message = {
          type: "error",
          text: "Số chương và ít nhất một file ảnh là bắt buộc.",
        };
        if (uploadedFiles && uploadedFiles.length > 0) {
          uploadedFiles.forEach((file) =>
            fs.unlink(file.path, (err) => {
              if (err)
                console.error(
                  "Error deleting file after validation fail:",
                  err
                );
            })
          );
        }
        return res.redirect(`/admin/comics/${comicIdParam}/chapters/new`);
      }

      const chapterNumFloat = parseFloat(chapterNumber);
      if (isNaN(chapterNumFloat)) {
        req.session.message = {
          type: "error",
          text: "Số chương phải là một con số hợp lệ.",
        };
        if (uploadedFiles && uploadedFiles.length > 0) {
          uploadedFiles.forEach((file) =>
            fs.unlink(file.path, (err) => {
              if (err)
                console.error(
                  "Error deleting file after validation fail:",
                  err
                );
            })
          );
        }
        return res.redirect(`/admin/comics/${comicIdParam}/chapters/new`);
      }
      // Sử dụng hàm từ model Chapter
      const existingChapter = await Chapter.findChapterByNumber(
        db,
        comicObjectId,
        chapterNumFloat
      );
      if (existingChapter) {
        req.session.message = {
          type: "error",
          text: `Chapter số ${chapterNumFloat} đã tồn tại cho truyện này.`,
        };
        if (uploadedFiles && uploadedFiles.length > 0) {
          uploadedFiles.forEach((file) =>
            fs.unlink(file.path, (err) => {
              if (err)
                console.error(
                  "Error deleting file after duplicate chapter check:",
                  err
                );
            })
          );
        }
        return res.redirect(`/admin/comics/${comicIdParam}/chapters/new`);
      }
      if (uploadedFiles && uploadedFiles.length > 0) {
        uploadedFiles.sort((a, b) =>
          a.originalname.localeCompare(b.originalname, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );
      }
      savedImagePaths = uploadedFiles.map(
        (file) => `/uploads/chapters/${file.filename}`
      );
      console.log(
        `Chapter ${chapterNumFloat} uploaded image paths (SORTED):`,
        savedImagePaths
      );

      // Chuẩn bị dữ liệu để lưu vào DB
      const chapterData = {
        comicId: comicObjectId,
        chapterNumber: chapterNumFloat,
        title: title || null,
        pages: savedImagePaths,
        uploaderId: uploaderId,
      };

      // Gọi Model để tạo Chapter
      const result = await Chapter.createChapter(db, chapterData);

      console.log(
        `Chapter ${chapterNumFloat} for comic ${comicIdParam} created with ID: ${result.insertedId}`
      );
      req.session.message = {
        type: "success",
        text: `Đã thêm Chapter ${chapterNumFloat} thành công!`,
      };
      // Chuyển hướng về trang sửa truyện (nơi có thể xem danh sách chapter)
      res.redirect(`/admin/comics/edit/${comicIdParam}`);
    } catch (error) {
      console.error(
        `Error creating chapter ${chapterNumber} for comic ${comicIdParam}:`,
        error
      );

      if (savedImagePaths.length > 0) {
        console.log(
          "Attempting to delete uploaded chapter files due to error:",
          savedImagePaths
        );
        savedImagePaths.forEach((filePath) => {
          const fullPath = path.join(__dirname, "../../public", filePath);
          fs.unlink(fullPath, (err) => {
            if (err)
              console.error(
                `Error deleting uploaded chapter file ${fullPath} after error:`,
                err
              );
            else console.log(`Deleted chapter file ${fullPath} after error.`);
          });
        });
      } else if (uploadedFiles && uploadedFiles.length > 0) {
        console.log(
          "Attempting to delete uploaded files (before path processing) due to error"
        );
        uploadedFiles.forEach((file) =>
          fs.unlink(file.path, (err) => {
            if (err)
              console.error("Error deleting file after early error:", err);
          })
        );
      }

      req.session.message = {
        type: "error",
        text: `Lỗi khi thêm chapter: ${error.message}`,
      };
      res.redirect(`/admin/comics/${comicIdParam}/chapters/new`);
    }
  }
  static async getEditChapterForm(req, res, next) {
    const chapterIdParam = req.params.chapterId;
    let chapterObjectId;
    try {
      chapterObjectId = new ObjectId(chapterIdParam);
    } catch (e) {
      /*...*/
    }

    try {
      const db = DatabaseConnection.getDb();
      const chapter = await db
        .collection("chapters")
        .findOne({ _id: chapterObjectId });

      if (!chapter) {
        req.session.message = { type: "error", text: "Chapter không tồn tại!" };
        return res.redirect("/admin/comics");
      }

      const comic = await db
        .collection("comics")
        .findOne({ _id: chapter.comicId }, { projection: { title: 1 } });

      res.render("admin/chapters/edit", {
        title: `Sửa Chapter ${chapter.chapterNumber} - ${
          comic ? comic.title : ""
        }`,
        chapter: chapter,
        comic: comic,
      });
    } catch (error) {
      console.error(`Error getting chapter ${chapterIdParam} for edit:`, error);
      next(error);
    }
  }
  static async updateChapter(req, res, next) {
    const chapterIdParam = req.params.chapterId;
    const { chapterNumber, title } = req.body;
    let chapterObjectId;
    try {
      chapterObjectId = new ObjectId(chapterIdParam);
    } catch (e) {
      /*...*/
    }

    // Validation
    const chapterNumFloat = parseFloat(chapterNumber);
    if (isNaN(chapterNumFloat)) {
      req.session.message = {
        type: "error",
        text: "Số chương phải là số hợp lệ.",
      };
      return res.redirect(`/admin/chapters/${chapterIdParam}/edit`);
    }

    try {
      const db = DatabaseConnection.getDb();
      const currentChapter = await db
        .collection("chapters")
        .findOne({ _id: chapterObjectId }, { projection: { comicId: 1 } });
      if (!currentChapter) {
        req.session.message = { type: "error", text: "Chapter không tồn tại!" };
        return res.redirect("/admin/comics");
      }
      const comicId = currentChapter.comicId;
      const existingChapter = await Chapter.findChapterByNumber(
        db,
        comicId,
        chapterNumFloat
      );
      if (existingChapter && !existingChapter._id.equals(chapterObjectId)) {
        req.session.message = {
          type: "error",
          text: `Chapter số ${chapterNumFloat} đã tồn tại cho truyện này.`,
        };
        return res.redirect(`/admin/chapters/${chapterIdParam}/edit`);
      }
      const updateData = {
        chapterNumber: chapterNumFloat,
        title: title || null,
        updatedAt: new Date(),
      };

      const result = await db
        .collection("chapters")
        .updateOne({ _id: chapterObjectId }, { $set: updateData });

      if (result.matchedCount === 0) {
        req.session.message = {
          type: "error",
          text: "Không tìm thấy chapter để cập nhật.",
        };
      } else if (result.modifiedCount === 0) {
        req.session.message = {
          type: "info",
          text: "Không có thay đổi nào được lưu.",
        };
      } else {
        req.session.message = {
          type: "success",
          text: `Đã cập nhật Chapter ${chapterNumFloat} thành công!`,
        };
      }
      // Chuyển hướng về trang sửa truyện cha
      res.redirect(`/admin/comics/edit/${comicId}`);
    } catch (error) {
      console.error(`Error updating chapter ${chapterIdParam}:`, error);
      req.session.message = {
        type: "error",
        text: `Lỗi khi cập nhật chapter: ${error.message}`,
      };
      res.redirect(`/admin/chapters/${chapterIdParam}/edit`);
    }
  }
  static async deleteChapter(req, res, next) {
    const chapterIdParam = req.params.chapterId;
    let chapterObjectId;
    try {
      chapterObjectId = new ObjectId(chapterIdParam);
    } catch (e) {
      /*...*/
    }

    const db = DatabaseConnection.getDb();
    let comicIdToRedirect = null;

    try {
      const chapterToDelete = await db
        .collection("chapters")
        .findOne({ _id: chapterObjectId });

      if (!chapterToDelete) {
        req.session.message = {
          type: "warning",
          text: "Chapter không tìm thấy hoặc đã bị xóa.",
        };
        return res.redirect("/admin/comics");
      }
      comicIdToRedirect = chapterToDelete.comicId;
      const deleteResult = await Chapter.deleteChapterById(db, chapterObjectId);

      if (deleteResult.deletedCount === 0) {
        req.session.message = {
          type: "error",
          text: "Xóa chapter khỏi database thất bại.",
        };
        return res.redirect(`/admin/comics/edit/${comicIdToRedirect}`);
      }

      console.log(`Chapter document ${chapterIdParam} deleted from DB.`);
      req.session.message = {
        type: "success",
        text: `Đã xóa Chapter ${chapterToDelete.chapterNumber} thành công!`,
      };
      if (chapterToDelete.pages && chapterToDelete.pages.length > 0) {
        console.log(
          `Attempting to delete ${chapterToDelete.pages.length} image files for chapter ${chapterIdParam}...`
        );
        chapterToDelete.pages.forEach((filePath) => {
          const fullPath = path.join(__dirname, "../../public", filePath);
          fs.unlink(fullPath, (err) => {
            if (err && err.code !== "ENOENT") {
              console.error(`Error deleting chapter file ${fullPath}:`, err);
            } else if (!err) {
              console.log(`Deleted chapter file: ${fullPath}`);
            }
          });
        });
      }
      res.redirect(`/admin/comics/edit/${comicIdToRedirect}`);
    } catch (error) {
      console.error(`Error deleting chapter ${chapterIdParam}:`, error);
      req.session.message = {
        type: "error",
        text: `Lỗi khi xóa chapter: ${error.message}`,
      };
      if (comicIdToRedirect) {
        res.redirect(`/admin/comics/edit/${comicIdToRedirect}`);
      } else {
        res.redirect("/admin/comics");
      }
    }
  }

  static async getAddChapterFormForUploader(req, res, next) {
    const comicIdParam = req.params.comicId;
    let comicObjectId;
    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      /*...handle invalid id...*/
    }

    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id;
      const comic = await db
        .collection("comics")
        .findOne(
          { _id: comicObjectId },
          { projection: { title: 1, uploaderId: 1 } }
        );

      if (!comic) {
        /*...*/ return res.redirect("/uploader");
      }
      if (
        comic.uploaderId?.toString() !== userId.toString() &&
        req.user.role !== "admin"
      ) {
        req.session.message = {
          type: "error",
          text: "Bạn không có quyền thêm chapter cho truyện này.",
        };
        return res.status(403).redirect("/uploader");
      }
      res.render("uploader/chapters/create", {
        title: `Thêm Chapter cho: ${comic.title}`,
        comic: comic,
      });
    } catch (error) {
      console.log("Đã có lỗi xảy ra");
      next(error);
    }
  }

  /** POST /uploader/comics/:comicId/chapters */
  static async createChapterForUploader(req, res, next) {
    const comicIdParam = req.params.comicId;
    const { chapterNumber, title } = req.body;
    const uploadedFiles = req.files;
    const uploaderId = req.user._id;
    let comicObjectId;
    let savedImagePaths = [];

    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      /*...handle invalid id...*/
    }

    const db = DatabaseConnection.getDb();
    try {
      const comic = await db
        .collection("comics")
        .findOne({ _id: comicObjectId }, { projection: { uploaderId: 1 } });
      if (!comic) {
        /*...*/
        return res.redirect("/uploader");
      }
      if (
        comic.uploaderId?.toString() !== uploaderId.toString() &&
        req.user.role !== "admin"
      ) {
        req.session.message = {
          type: "error",
          text: "Bạn không có quyền thêm chapter cho truyện này.",
        };
        if (uploadedFiles && uploadedFiles.length > 0) {
          uploadedFiles.forEach((file) =>
            fs.unlink(file.path, (err) => {
              if (err)
                console.error("Error deleting file on permission error:", err);
            })
          );
        }
        return res.status(403).redirect("/uploader");
      }
      if (!chapterNumber || !uploadedFiles || uploadedFiles.length === 0) {
        /*...*/
      }
      const chapterNumFloat = parseFloat(chapterNumber);
      if (isNaN(chapterNumFloat)) {
        /*...*/
      }
      const existingChapter = await Chapter.findChapterByNumber(
        db,
        comicObjectId,
        chapterNumFloat
      );
      if (existingChapter) {
        /*...*/
      }
      savedImagePaths = uploadedFiles.map(
        (file) => `/uploads/chapters/${file.filename}`
      );
      const chapterData = {
        comicId: comicObjectId,
        chapterNumber: chapterNumFloat,
        title,
        pages: savedImagePaths,
        uploaderId,
      };
      const result = await Chapter.createChapter(db, chapterData);
      req.session.message = {
        type: "success",
        text: `Đã thêm Chapter ${chapterNumFloat} thành công!`,
      };
      res.redirect(`/uploader/comics/edit/${comicIdParam}`);
    } catch (error) {
      console.error(
        `Error creating chapter ${chapterNumber} for comic ${comicIdParam} by uploader:`,
        error
      );
      if (savedImagePaths.length > 0) {
        /*...*/
      } else if (uploadedFiles && uploadedFiles.length > 0) {
        /*...*/
      }
      req.session.message = {
        type: "error",
        text: `Lỗi khi thêm chapter: ${error.message}`,
      };
      res.redirect(`/uploader/comics/${comicIdParam}/chapters/new`);
    }
  }
}

module.exports = ComicsController;
