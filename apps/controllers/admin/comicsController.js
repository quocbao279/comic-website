// File: apps/controllers/admin/comicsController.js
const DatabaseConnection = require("../../database/database");
const { ObjectId } = require("mongodb");
const Chapter = require("../../models/chapter");
const fs = require("fs"); //Thêm fs để xử lý file (tùy chọn)
const path = require("path");
const { getAllGenres } = require("./genresController");

class ComicsController {
  // GET all comics - Render trang quản lý comics
  static async getAllComics(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      // Thêm logic filter/search nếu có query params từ form lọc
      let filter = {};
      if (req.query.search) {
        // Tìm kiếm không phân biệt hoa thường
        filter.$or = [
          { title: { $regex: req.query.search, $options: "i" } },
          { author: { $regex: req.query.search, $options: "i" } },
        ];
      }
      if (req.query.genre) {
        filter.genres = req.query.genre; // Giả sử genres là array string
      }
      if (req.query.status) {
        filter.status = req.query.status;
      }

      const comics = await db
        .collection("comics")
        .find(filter) // Áp dụng filter
        .sort({ title: 1 })
        .toArray();

      res.render("admin/comics/index", {
        // Render view index mới
        comics: comics,
        title: "Quản lý Truyện",
        query: req.query, // Truyền lại query để giữ giá trị filter trên form
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
      // Lấy tất cả genres từ collection 'genres', sắp xếp theo tên
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

      const uploaderId = req.user ? req.user._id : null; // Lấy ID từ req.user (đã được gắn bởi authMiddleware)
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
        uploaderId: uploaderId, // <<< Lưu ID người đăng
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Thêm slug nếu muốn
      // newComic.slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

      const result = await db.collection("comics").insertOne(newComic);
      console.log(
        `Comic created: ${title} by ${req.user?.username || "Unknown"} (ID: ${
          result.insertedId
        })`
      );

      // Chuyển hướng dựa trên vai trò hoặc đường dẫn gốc
      req.session.message = {
        type: "success",
        text: "Đã thêm truyện thành công!",
      };

      if (req.user?.role === "admin" && req.originalUrl.startsWith("/admin")) {
        // Nếu là admin VÀ đang thao tác từ trang /admin/... thì về /admin/comics
        res.redirect("/admin/comics");
      } else {
        // Nếu là uploader (hoặc admin nhưng submit từ /comics/post) thì về trang /uploader
        res.redirect("/"); // <<< QUAN TRỌNG: Phải là /uploader (hoặc /)
      }
    } catch (error) {
      console.error("!!! ORIGINAL Error during comic creation:", error);
      if (req.file && req.file.path) {
        console.log(`Attempting to delete orphaned upload: ${req.file.path}`);
        fs.unlink(req.file.path, (unlinkErr) => {
          // Log lỗi xóa file nếu có, nhưng không cần làm gì thêm
          if (unlinkErr) {
            // Chỉ log lỗi unlink, không nên để nó ghi đè lỗi gốc
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
        // Nếu là admin VÀ đang thao tác từ trang /admin/... thì về /admin/comics
        console.log(
          "DEBUG: Redirecting ADMIN from admin path to /admin/comics"
        ); // Log kiểm tra
        res.redirect("/admin/comics");
      } else {
        // Nếu là uploader (hoặc admin submit từ /comics/post) thì về trang /uploader
        console.log(
          `DEBUG: Redirecting role '<span class="math-inline">\{req\.user?\.role\}' from path '</span>{req.originalUrl}' to /uploader`
        ); // Log kiểm tra
        res.redirect("/"); // <<< PHẢI LÀ /uploader Ở ĐÂY
      }
    }
  }

  // POST - Cập nhật comic
  static async updateComic(req, res, next) {
    const comicIdParam = req.params.id; // Lấy ID từ URL
    let comicId;

    // --- 1. Kiểm tra và chuyển đổi ObjectId ---
    try {
      comicId = new ObjectId(comicIdParam);
    } catch (e) {
      // Nếu ID không hợp lệ, báo lỗi và chuyển về trang danh sách
      req.session.message = { type: "error", text: "ID Truyện không hợp lệ." };
      return res.redirect("/admin/comics");
    }

    try {
      const db = DatabaseConnection.getDb();

      // --- 2. Chuẩn bị dữ liệu cập nhật từ Form ---
      // Lấy các trường cần thiết từ req.body
      const {
        title,
        author,
        genres,
        status,
        description,
        releaseDate /*, isFeatured */,
      } = req.body;

      // Tạo object chứa các trường sẽ được cập nhật bằng $set
      const updateFields = {
        // Gán giá trị từ form, đảm bảo có giá trị mặc định hoặc null nếu cần
        title: title, // Giả sử title là bắt buộc
        author: author || null,
        description: description || null,
        // Đảm bảo genres luôn là mảng
        genres: Array.isArray(genres) ? genres : genres ? [genres] : [],
        status: status || "ongoing",
        // Chuyển đổi ngày tháng nếu có, không thì null
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        // isFeatured: isFeatured === 'true', // Xử lý checkbox nếu có
        updatedAt: new Date(), // Luôn cập nhật thời gian sửa đổi
      };

      // --- 3. Xử lý Ảnh Bìa Mới (nếu có) ---
      let oldImageUrl = null; // Biến lưu trữ URL ảnh cũ để xóa sau
      if (req.file) {
        // Nếu có file mới được upload bởi multer (req.file tồn tại)
        updateFields.imageUrl = `/uploads/covers/${req.file.filename}`; // Cập nhật đường dẫn ảnh mới
        console.log(
          `New cover image uploaded for ${comicIdParam}: ${updateFields.imageUrl}`
        );

        // Lấy URL ảnh cũ để chuẩn bị xóa (nếu có)
        try {
          const oldComic = await db.collection("comics").findOne(
            { _id: comicId },
            { projection: { imageUrl: 1 } } // Chỉ lấy trường imageUrl
          );
          if (oldComic && oldComic.imageUrl) {
            oldImageUrl = oldComic.imageUrl;
          }
        } catch (findError) {
          console.error(
            `Error finding old comic ${comicIdParam} to get old image URL:`,
            findError
          );
          // Vẫn tiếp tục cập nhật dù không lấy được URL cũ
        }
      } else {
        // Không có file mới được upload
        console.log(
          `No new cover image uploaded for ${comicIdParam}. Keeping existing one.`
        );
        // Không cần thêm imageUrl vào updateFields, DB sẽ giữ nguyên giá trị cũ
      }

      // --- 4. Thực hiện Cập nhật vào Database ---
      const result = await db.collection("comics").updateOne(
        { _id: comicId }, // Điều kiện tìm document cần cập nhật
        { $set: updateFields } // Chỉ cập nhật các trường trong updateFields
      );

      // --- 5. Xử lý Kết quả và Chuyển hướng ---
      if (result.matchedCount === 0) {
        // Không tìm thấy truyện với ID cung cấp
        req.session.message = {
          type: "error",
          text: "Truyện không tìm thấy để cập nhật.",
        };
        // Nếu đã upload file mới mà không cập nhật được DB -> xóa file mới đi
        if (req.file) {
          fs.unlink(req.file.path, (err) => {
            if (err)
              console.error(
                `Error deleting orphaned upload ${req.file.path}:`,
                err
              );
          });
        }
        return res.redirect("/admin/comics"); // Về trang danh sách
      } else {
        // Cập nhật thành công (dù có thể không thay đổi gì - modifiedCount = 0)
        req.session.message = {
          type: "success",
          text: "Đã cập nhật truyện thành công!",
        };
        console.log(
          `Comic ${comicIdParam} updated. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`
        );

        // Xóa ảnh cũ (NẾU có ảnh mới upload VÀ có ảnh cũ VÀ ảnh cũ khác ảnh mới VÀ ảnh cũ không phải placeholder)
        if (
          req.file &&
          oldImageUrl &&
          oldImageUrl !== updateFields.imageUrl &&
          oldImageUrl !== "/img/placeholder.png"
        ) {
          // Tạo đường dẫn đầy đủ đến file ảnh cũ trong thư mục public
          const imagePath = path.join(
            __dirname,
            "../../apps/public/uploads/covers",
            comicToDelete.imageUrl
          );
          fs.unlink(oldPath, (err) => {
            // Thực hiện xóa file
            if (err)
              console.error(`Error deleting old cover image ${oldPath}:`, err);
            else console.log(`Deleted old cover image: ${oldPath}`);
          });
        }
        return res.redirect("/admin/comics"); // Về trang danh sách
      }
    } catch (error) {
      // --- 6. Xử lý Lỗi Chung ---
      console.error(`Error updating comic ${comicIdParam}:`, error);

      // Nếu có lỗi xảy ra SAU KHI đã upload file mới -> xóa file mới đó đi
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
      // Quay lại trang edit để user sửa lại và thấy lỗi
      res.redirect(`/admin/comics/edit/${comicIdParam}`);
      // Hoặc gọi next(error) nếu muốn dùng trang error.ejs chung
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

      // (Tùy chọn) Lấy thông tin truyện để xóa ảnh bìa liên quan
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

        // (Tùy chọn) Xóa ảnh bìa sau khi xóa thành công khỏi DB
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
        // (Quan trọng) Cần xóa cả các chapter liên quan nếu có collection chapter riêng
        // await db.collection('chapters').deleteMany({ comicId: comicId });
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
      const userId = req.user._id; // Lấy ID user đang đăng nhập

      const myComics = await db
        .collection("comics")
        .find({ uploaderId: userId }) // <<< Chỉ tìm truyện có uploaderId là user hiện tại
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

      // --- KIỂM TRA SỞ HỮU ---
      if (!comic) {
        req.session.message = { type: "error", text: "Truyện không tồn tại!" };
        return res.redirect("/uploader");
      }
      // Cho phép nếu user là người đăng HOẶC user là admin
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
        formAction: `/uploader/comics/edit/${comic._id}`, // << Truyền action cho form
      });
    } catch (error) {
      console.log("Error while editing comics");
      next(error);
    }
  }
  static async getMyComics(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id; // Lấy ID user đang đăng nhập

      const myComics = await db
        .collection("comics")
        .find({ uploaderId: userId }) // <<< Chỉ tìm truyện có uploaderId là user hiện tại
        .sort({ updatedAt: -1 })
        .toArray();

      res.render("uploader/dashboard", {
        // <<< Tạo view mới: apps/views/uploader/dashboard.ejs
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

      // --- KIỂM TRA SỞ HỮU ---
      if (!comic) {
        req.session.message = { type: "error", text: "Truyện không tồn tại!" };
        return res.redirect("/uploader");
      }
      // Cho phép nếu user là người đăng HOẶC user là admin
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
      // --- KẾT THÚC KIỂM TRA SỞ HỮU ---

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
        formAction: `/uploader/comics/edit/${comic._id}`, // << Truyền action cho form
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
      /*...*/ return res.redirect("/uploader");
    }
    console.log(`DEBUG: updateMyComic called for ID: ${comicIdParam}`); // Log khi hàm được gọi
    console.log("DEBUG: req.body received:", req.body);
    console.log("DEBUG: req.file received:", req.file);

    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id;

      // --- KIỂM TRA SỞ HỮU TRƯỚC KHI UPDATE ---
      const comicToUpdate = await db
        .collection("comics")
        .findOne(
          { _id: comicId },
          { projection: { uploaderId: 1, imageUrl: 1 } }
        ); // Lấy uploaderId và ảnh cũ
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
      // --- KẾT THÚC KIỂM TRA SỞ HỮU ---

      // Logic cập nhật tương tự hàm updateComic của admin
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
      let oldImageUrl = comicToUpdate.imageUrl; // Lấy từ document đã fetch

      if (req.file) {
        updateFields.imageUrl = `/uploads/covers/${req.file.filename}`;
        // Logic xóa ảnh cũ (tương tự updateComic) có thể đặt ở đây hoặc sau khi update thành công
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
        // Logic xóa ảnh cũ nếu cần
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
      res.redirect("/uploader"); // Chuyển về trang quản lý của uploader
    } catch (error) {
      console.log("Error while updating your comics");
      res.redirect(`/uploader/comics/edit/${comicIdParam}`);
    }
  }
  static async deleteMyComic(req, res, next) {
    // Tương tự updateMyComic, cần kiểm tra sở hữu trước khi xóa
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

      // --- KIỂM TRA SỞ HỮU TRƯỚC KHI XÓA ---
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
      // --- KẾT THÚC KIỂM TRA SỞ HỮU ---

      // Logic xóa tương tự deleteComic của admin
      const result = await db.collection("comics").deleteOne({ _id: comicId });
      if (result.deletedCount === 0) {
        /*...*/
      } else {
        req.session.message = {
          type: "success",
          text: "Đã xóa truyện thành công!",
        };
        // Logic xóa ảnh (tương tự deleteComic)
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
        // Cần xóa cả chapters liên quan
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

    // Validate comicId
    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      req.session.message = { type: "error", text: "ID Truyện không hợp lệ." };
      return res.redirect("/admin/comics"); // Chuyển về danh sách truyện admin
    }

    try {
      const db = DatabaseConnection.getDb();
      // Lấy thông tin cơ bản của truyện (chỉ cần title và _id)
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

      // Render view tạo chapter, truyền thông tin comic vào
      res.render("admin/chapters/create", {
        // View nằm trong admin/chapters/
        title: `Thêm Chapter cho: ${comic.title}`,
        comic: comic, // Truyền cả object comic (có _id và title)
      });
    } catch (error) {
      console.error(
        `Error getting add chapter form for comic ${comicIdParam}:`,
        error
      );
      next(error); // Chuyển lỗi cho global handler
    }
  }

  /**
   * POST /admin/comics/:comicId/chapters
   * Xử lý việc thêm chapter mới vào database, bao gồm cả upload ảnh.
   */
  static async createChapter(req, res, next) {
    const comicIdParam = req.params.comicId;
    // Dữ liệu từ form text fields
    const { chapterNumber, title } = req.body;
    // Mảng các file ảnh đã được upload bởi multer 'uploadChapterPages' middleware
    const uploadedFiles = req.files;
    // ID của người dùng đang thực hiện (admin/uploader)
    const uploaderId = req.user ? req.user._id : null;

    let comicObjectId;
    let savedImagePaths = []; // Mảng chứa đường dẫn tương đối các ảnh đã lưu thành công (dùng để xóa nếu lỗi DB)

    // --- 1. Validate Comic ID ---
    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      req.session.message = { type: "error", text: "ID Truyện không hợp lệ." };
      // Nếu ID truyện sai thì nên xóa các file đã lỡ upload (nếu có)
      if (uploadedFiles && uploadedFiles.length > 0) {
        uploadedFiles.forEach((file) =>
          fs.unlink(file.path, (err) => {
            if (err)
              console.error("Error deleting file with invalid comicId:", err);
          })
        );
      }
      return res.redirect("/admin/comics"); // Về danh sách admin
    }

    const db = DatabaseConnection.getDb();

    try {
      // --- 2. Validate Input cơ bản ---
      if (!chapterNumber || !uploadedFiles || uploadedFiles.length === 0) {
        req.session.message = {
          type: "error",
          text: "Số chương và ít nhất một file ảnh là bắt buộc.",
        };
        // Xóa file đã upload nếu validation thất bại
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

      // --- 3. Kiểm tra Chapter Number đã tồn tại chưa ---
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

      // --- 4. Tạo mảng đường dẫn ảnh tương đối ---
      // req.files là một mảng các object file từ multer
      if (uploadedFiles && uploadedFiles.length > 0) {
        uploadedFiles.sort((a, b) =>
          a.originalname.localeCompare(b.originalname, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );
        // localeCompare với numeric: true sẽ sắp xếp đúng 'page2.jpg' trước 'page10.jpg'
      }
      savedImagePaths = uploadedFiles.map(
        (file) => `/uploads/chapters/${file.filename}`
      );
      console.log(
        `Chapter ${chapterNumFloat} uploaded image paths (SORTED):`, // Log đã sắp xếp
        savedImagePaths
      );

      // --- 5. Chuẩn bị dữ liệu để lưu vào DB ---
      const chapterData = {
        comicId: comicObjectId,
        chapterNumber: chapterNumFloat,
        title: title || null,
        pages: savedImagePaths, // Mảng các đường dẫn ảnh
        uploaderId: uploaderId, // Lưu người upload chapter
        // createdAt, updatedAt, views sẽ được thêm bởi model hoặc default
      };

      // --- 6. Gọi Model để tạo Chapter ---
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

      // Quan trọng: Nếu xảy ra lỗi ở bước 5 hoặc 6 (sau khi đã xử lý file),
      // cần phải xóa các file ảnh đã được upload thành công vào thư mục chapters
      if (savedImagePaths.length > 0) {
        console.log(
          "Attempting to delete uploaded chapter files due to error:",
          savedImagePaths
        );
        savedImagePaths.forEach((filePath) => {
          // filePath đang là /uploads/chapters/filename.jpg
          // Cần tạo đường dẫn tuyệt đối để fs.unlink hoạt động
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
        // Xử lý trường hợp lỗi xảy ra trước khi kịp tạo savedImagePaths
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
      res.redirect(`/admin/comics/${comicIdParam}/chapters/new`); // Quay lại form tạo chapter
    }
  }
  static async getEditChapterForm(req, res, next) {
    const chapterIdParam = req.params.chapterId;
    let chapterObjectId;
    try {
      chapterObjectId = new ObjectId(chapterIdParam);
    } catch (e) {
      /*...*/
    } // Bỏ qua phần xử lý lỗi ID cho gọn

    try {
      const db = DatabaseConnection.getDb();
      const chapter = await db
        .collection("chapters")
        .findOne({ _id: chapterObjectId });

      if (!chapter) {
        req.session.message = { type: "error", text: "Chapter không tồn tại!" };
        // Redirect về trang truyện admin nếu không biết truyện cha là gì
        // Hoặc tốt hơn là lấy comicId từ chapter nếu có để redirect về trang edit comic
        return res.redirect("/admin/comics");
      }

      // Lấy thêm thông tin truyện cha để hiển thị breadcrumb/tiêu đề
      const comic = await db
        .collection("comics")
        .findOne({ _id: chapter.comicId }, { projection: { title: 1 } });

      res.render("admin/chapters/edit", {
        // <<< Tạo view này: apps/views/admin/chapters/edit.ejs
        title: `Sửa Chapter ${chapter.chapterNumber} - ${
          comic ? comic.title : ""
        }`,
        chapter: chapter,
        comic: comic, // Truyền comic để có thể link quay lại trang sửa comic
      });
    } catch (error) {
      console.error(`Error getting chapter ${chapterIdParam} for edit:`, error);
      // Xử lý lỗi ObjectId nếu cần
      next(error);
    }
  }
  static async updateChapter(req, res, next) {
    const chapterIdParam = req.params.chapterId;
    const { chapterNumber, title } = req.body; // Lấy dữ liệu mới
    let chapterObjectId;
    try {
      chapterObjectId = new ObjectId(chapterIdParam);
    } catch (e) {
      /*...*/
    }

    // --- Validation ---
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

      // Lấy comicId từ chapter đang sửa để kiểm tra trùng lặp chapterNumber
      const currentChapter = await db
        .collection("chapters")
        .findOne({ _id: chapterObjectId }, { projection: { comicId: 1 } });
      if (!currentChapter) {
        req.session.message = { type: "error", text: "Chapter không tồn tại!" };
        return res.redirect("/admin/comics"); // Hoặc trang admin nào đó
      }
      const comicId = currentChapter.comicId;

      // Kiểm tra trùng chapterNumber (nếu số chapter có thay đổi)
      const existingChapter = await Chapter.findChapterByNumber(
        db,
        comicId,
        chapterNumFloat
      );
      if (existingChapter && !existingChapter._id.equals(chapterObjectId)) {
        // Tìm thấy chapter khác cùng số trong cùng truyện
        req.session.message = {
          type: "error",
          text: `Chapter số ${chapterNumFloat} đã tồn tại cho truyện này.`,
        };
        return res.redirect(`/admin/chapters/${chapterIdParam}/edit`);
      }

      // --- Dữ liệu cập nhật ---
      const updateData = {
        chapterNumber: chapterNumFloat,
        title: title || null,
        updatedAt: new Date(),
        // KHÔNG cập nhật pages ở đây (việc sửa ảnh phức tạp hơn)
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
    let comicIdToRedirect = null; // Lưu lại comicId để redirect

    try {
      // --- 1. Tìm chapter để lấy thông tin (comicId và mảng pages) ---
      const chapterToDelete = await db
        .collection("chapters")
        .findOne({ _id: chapterObjectId });

      if (!chapterToDelete) {
        req.session.message = {
          type: "warning",
          text: "Chapter không tìm thấy hoặc đã bị xóa.",
        };
        return res.redirect("/admin/comics"); // Không biết về truyện nào, về list chung
      }
      comicIdToRedirect = chapterToDelete.comicId; // Lưu lại ID truyện cha

      // --- 2. Xóa document chapter khỏi database ---
      const deleteResult = await Chapter.deleteChapterById(db, chapterObjectId); // Dùng hàm model

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

      // --- 3. Xóa file ảnh liên quan ( chạy nền, không cần đợi) ---
      if (chapterToDelete.pages && chapterToDelete.pages.length > 0) {
        console.log(
          `Attempting to delete ${chapterToDelete.pages.length} image files for chapter ${chapterIdParam}...`
        );
        chapterToDelete.pages.forEach((filePath) => {
          // filePath đang là /uploads/chapters/filename.jpg
          const fullPath = path.join(__dirname, "../../public", filePath); // Tạo path tuyệt đối
          fs.unlink(fullPath, (err) => {
            // Thực hiện xóa bất đồng bộ
            if (err && err.code !== "ENOENT") {
              // Bỏ qua lỗi không tìm thấy file (có thể đã xóa trước đó)
              console.error(`Error deleting chapter file ${fullPath}:`, err);
            } else if (!err) {
              console.log(`Deleted chapter file: ${fullPath}`);
            }
          });
        });
      }

      // Chuyển hướng về trang sửa truyện cha
      res.redirect(`/admin/comics/edit/${comicIdToRedirect}`);
    } catch (error) {
      console.error(`Error deleting chapter ${chapterIdParam}:`, error);
      req.session.message = {
        type: "error",
        text: `Lỗi khi xóa chapter: ${error.message}`,
      };
      // Cố gắng redirect về trang sửa truyện nếu có ID
      if (comicIdToRedirect) {
        res.redirect(`/admin/comics/edit/${comicIdToRedirect}`);
      } else {
        res.redirect("/admin/comics"); // Về list chung nếu không lấy được comicId
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

      // Lấy truyện và kiểm tra sở hữu
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

      // Nếu có quyền, render form
      res.render("uploader/chapters/create", {
        // <<< Tạo view mới: apps/views/uploader/chapters/create.ejs
        title: `Thêm Chapter cho: ${comic.title}`,
        comic: comic,
      });
    } catch (error) {
      /*...*/ next(error);
    }
  }

  /** POST /uploader/comics/:comicId/chapters */
  static async createChapterForUploader(req, res, next) {
    const comicIdParam = req.params.comicId;
    const { chapterNumber, title } = req.body;
    const uploadedFiles = req.files;
    const uploaderId = req.user._id; // Uploader chính là người đang đăng nhập
    let comicObjectId;
    let savedImagePaths = [];

    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      /*...handle invalid id...*/
    }

    const db = DatabaseConnection.getDb();
    try {
      // --- KIỂM TRA SỞ HỮU TRUYỆN TRƯỚC KHI THÊM CHAPTER ---
      const comic = await db
        .collection("comics")
        .findOne({ _id: comicObjectId }, { projection: { uploaderId: 1 } });
      if (!comic) {
        /*...*/ // Xóa file đã upload nếu có
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
      // --- KẾT THÚC KIỂM TRA SỞ HỮU ---

      // --- Logic validate, kiểm tra trùng chapter, tạo mảng pages, gọi Chapter.createChapter tương tự hàm createChapter của admin ---
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
      // --- Hết logic chính ---

      req.session.message = {
        type: "success",
        text: `Đã thêm Chapter ${chapterNumFloat} thành công!`,
      };
      res.redirect(`/uploader/comics/edit/${comicIdParam}`); // Chuyển về trang sửa truyện của uploader
    } catch (error) {
      console.error(
        `Error creating chapter ${chapterNumber} for comic ${comicIdParam} by uploader:`,
        error
      );
      // Xóa file ảnh đã upload nếu có lỗi
      if (savedImagePaths.length > 0) {
        /*...*/
      } else if (uploadedFiles && uploadedFiles.length > 0) {
        /*...*/
      }
      req.session.message = {
        type: "error",
        text: `Lỗi khi thêm chapter: ${error.message}`,
      };
      res.redirect(`/uploader/comics/${comicIdParam}/chapters/new`); // Quay lại form tạo chapter
    }
  }
}

module.exports = ComicsController;
