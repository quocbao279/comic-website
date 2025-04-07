// File: apps/controllers/admin/comicsController.js
const DatabaseConnection = require("../../database/database");
const { ObjectId } = require("mongodb");
const { getComicObject } = require("../../models/comic"); // Model tạo object
const fs = require("fs"); //Thêm fs để xử lý file (tùy chọn)
const path = require("path");

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
      const genres = await db
        .collection("genres")
        .find()
        .sort({ name: 1 })
        .toArray(); // Lấy genres nếu cần
      res.render("admin/comics/edit", {
        comic: comic,
        title: `Sửa: ${comic.title}`,
        // genres: genres // Truyền genres vào view edit
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
  static async getComic(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      let comicId;
      try {
        // Chuyển đổi ID từ params sang ObjectId
        comicId = new ObjectId(req.params.id);
      } catch (e) {
        // Nếu ID không hợp lệ
        console.warn(`Invalid ObjectId format for comic ID: ${req.params.id}`);
        req.session.message = {
          type: "error",
          text: "ID Truyện không hợp lệ.",
        };
        return res.redirect("/admin/comics"); // Redirect về danh sách
      }

      // Tìm comic trong database bằng ObjectId
      const comic = await db.collection("comics").findOne({ _id: comicId });

      if (!comic) {
        // Nếu không tìm thấy comic
        req.session.message = { type: "error", text: "Truyện không tồn tại!" };
        return res.redirect("/admin/comics"); // Redirect về danh sách
      }

      // Lấy danh sách genres nếu cần hiển thị trong form select
      const genres = await db
        .collection("genres")
        .find()
        .sort({ name: 1 })
        .toArray();

      // Render view edit và truyền dữ liệu comic tìm được
      res.render("admin/comics/edit", {
        // <<< Render view edit
        comic: comic,
        title: `Sửa: ${comic.title}`,
        genres: genres, // Truyền genres nếu có
      });
    } catch (error) {
      // Xử lý lỗi chung
      console.error(`Error getting comic ${req.params.id} for edit:`, error);
      // Không redirect ở đây nữa vì lỗi có thể không phải do ID
      next(error); // Chuyển lỗi cho middleware xử lý lỗi chung
    }
  }

  // POST - Tạo comic mới
  static async createComic(req, res, next) {
    try {
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
        res.redirect("/admin/comics"); // Admin thì về trang quản lý
      } else {
        res.redirect("/");
      }
    } catch (error) {
      console.error("Error creating comic:", error);
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err)
            console.error("Error deleting uploaded file after error:", err);
        });
      }
      req.session.message = {
        type: "error",
        text: `Lỗi khi thêm truyện: ${error.message}`,
      };
      // Redirect về form tương ứng
      if (req.originalUrl.startsWith("/admin")) {
        res.redirect("/admin/comics/create");
      } else {
        res.redirect("/comics/post");
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
          const oldPath = path.join(__dirname, "../../public", oldImageUrl);
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
        /* ... tạo updateFields như cũ ... */ updatedAt: new Date(),
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
}

module.exports = ComicsController;
