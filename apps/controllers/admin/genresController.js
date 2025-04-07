// File: apps/controllers/admin/genresController.js
const DatabaseConnection = require("../../database/database");
const { ObjectId } = require("mongodb");
const { getGenreObject } = require("../../models/genre"); // Model chỉ chứa hàm tạo object

class GenresController {
  // GET all genres - Render trang quản lý genres
  static async getAllGenres(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const genres = await db
        .collection("genres")
        .find()
        .sort({ name: 1 })
        .toArray();
      // <<< Cần tạo/sửa view này: apps/views/admin/genres/index.ejs (hoặc GenreManagement.ejs)
      res.render("admin/genres/index", { genres, title: "Quản lý Thể Loại" });
      // res.render("GenreManagement", { genres, title: "Quản lý Thể Loại" }); // Nếu dùng view cũ
    } catch (error) {
      console.error("Error getting all genres:", error);
      next(error);
    }
  }

  // GET - Render form tạo genre mới
  static async getCreateGenreForm(req, res, next) {
    try {
      // <<< Cần tạo/sửa view này: apps/views/admin/genres/create.ejs
      res.render("admin/genres/create", { title: "Thêm Thể Loại Mới" });
    } catch (error) {
      console.error("Error getting create genre form:", error);
      next(error);
    }
  }

  // GET - Render form chỉnh sửa genre
  static async getEditGenreForm(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const genreId = new ObjectId(req.params.id);
      const genre = await db.collection("genres").findOne({ _id: genreId });

      if (!genre) {
        req.session.message = { type: "error", text: "Genre not found!" };
        return res.redirect("/admin/genres");
      }
      // <<< Cần tạo/sửa view này: apps/views/admin/genres/edit.ejs
      res.render("admin/genres/edit", {
        genre,
        title: `Sửa Thể Loại: ${genre.name}`,
      });
    } catch (error) {
      console.error(`Error getting genre ${req.params.id} for edit:`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Invalid Genre ID format.",
        };
        return res.redirect("/admin/genres");
      }
      next(error);
    }
  }

  // POST - Tạo genre mới
  static async createGenre(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      // Cần kiểm tra xem tên genre đã tồn tại chưa
      const existingGenre = await db
        .collection("genres")
        .findOne({ name: req.body.name });
      if (existingGenre) {
        req.session.message = {
          type: "error",
          text: `Genre "${req.body.name}" already exists!`,
        };
        return res.redirect("/admin/genres/create"); // Quay lại form tạo
      }

      const genre = getGenreObject(req.body.name); // Chỉ lấy tên từ model
      // Có thể thêm các trường khác từ form nếu có (icon, color, description...)
      // genre.icon = req.body.icon;
      // genre.color = req.body.color;
      // genre.description = req.body.description;

      const result = await db.collection("genres").insertOne(genre);
      console.log(`Genre created with ID: ${result.insertedId}`);
      req.session.message = {
        type: "success",
        text: "Genre created successfully!",
      };
      res.redirect("/admin/genres");
    } catch (error) {
      console.error("Error creating genre:", error);
      req.session.message = {
        type: "error",
        text: `Error creating genre: ${error.message}`,
      };
      res.redirect("/admin/genres/create");
      // Hoặc next(error);
    }
  }

  // POST - Cập nhật genre
  static async updateGenre(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const genreId = new ObjectId(req.params.id);
      const newName = req.body.name;
      // Thêm các trường khác nếu cần cập nhật (icon, color, description...)
      // const newIcon = req.body.icon;
      // const newColor = req.body.color;
      // const newDescription = req.body.description;

      // Kiểm tra xem tên mới có bị trùng với genre khác không (ngoại trừ chính nó)
      const existingGenre = await db
        .collection("genres")
        .findOne({ name: newName, _id: { $ne: genreId } });
      if (existingGenre) {
        req.session.message = {
          type: "error",
          text: `Genre name "${newName}" already exists!`,
        };
        return res.redirect(`/admin/genres/edit/${req.params.id}`); // Quay lại form edit
      }

      const updateData = { name: newName };
      // Thêm các trường khác vào updateData
      // if (newIcon) updateData.icon = newIcon;
      // if (newColor) updateData.color = newColor;
      // if (newDescription) updateData.description = newDescription;

      const result = await db
        .collection("genres")
        .updateOne({ _id: genreId }, { $set: updateData });

      if (result.matchedCount === 0) {
        req.session.message = {
          type: "error",
          text: "Genre not found for update.",
        };
      } else {
        req.session.message = {
          type: "success",
          text: "Genre updated successfully!",
        };
      }
      res.redirect("/admin/genres");
    } catch (error) {
      console.error(`Error updating genre ${req.params.id}:`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Invalid Genre ID format.",
        };
        return res.redirect("/admin/genres");
      }
      req.session.message = {
        type: "error",
        text: `Error updating genre: ${error.message}`,
      };
      res.redirect(`/admin/genres/edit/${req.params.id}`);
      // Hoặc next(error);
    }
  }

  // POST - Xóa genre
  static async deleteGenre(req, res, next) {
    const genreIdParam = req.params.id;
    let genreId;

    // --- 1. Validate ID ---
    try {
      genreId = new ObjectId(genreIdParam);
    } catch (e) {
      req.session.message = {
        type: "error",
        text: "ID Thể Loại không hợp lệ.",
      };
      return res.redirect("/admin/genres");
    }

    try {
      const db = DatabaseConnection.getDb();

      // --- 2. Lấy thông tin genre cần xóa (để lấy tên) ---
      const genreToDelete = await db
        .collection("genres")
        .findOne({ _id: genreId });

      if (!genreToDelete) {
        req.session.message = {
          type: "warning",
          text: "Thể loại không tìm thấy hoặc đã bị xóa.",
        };
        return res.redirect("/admin/genres");
      }

      const genreName = genreToDelete.name; // Lấy tên thể loại
      console.log(`DEBUG: Checking usage for genre name: "[${genreName}]"`);

      // --- 3. KIỂM TRA XEM GENRE CÓ ĐANG ĐƯỢC SỬ DỤNG KHÔNG ---
      // Tìm MỘT truyện bất kỳ có chứa tên thể loại này trong mảng genres của nó
      const comicUsingGenre = await db.collection("comics").findOne({
        genres: { $regex: genreName, $options: "i" }, // <<< Bỏ dấu ^ và $
      });
      console.log(
        `DEBUG: Found comic using genre? ID:`,
        comicUsingGenre ? comicUsingGenre._id : null
      );
      if (comicUsingGenre) {
        // Nếu tìm thấy -> không cho xóa
        console.warn(
          `Attempted to delete genre "${genreName}" which is in use by comic ${comicUsingGenre._id}`
        );
        req.session.message = {
          type: "error",
          text: `Không thể xóa thể loại "${genreName}" vì đang có truyện sử dụng.`,
        };
        return res.redirect("/admin/genres");
      }
      // --- KẾT THÚC KIỂM TRA ---

      // --- 4. Nếu không có truyện nào dùng -> Tiến hành xóa ---
      const result = await db.collection("genres").deleteOne({ _id: genreId });

      // --- 5. Xử lý kết quả ---
      if (result.deletedCount === 0) {
        // Trường hợp hiếm gặp: tìm thấy ở bước 2 nhưng không xóa được
        req.session.message = {
          type: "warning",
          text: "Không thể xóa thể loại (có thể đã bị xóa bởi người khác).",
        };
      } else {
        console.log(`Genre deleted: ${genreName} (ID: ${genreIdParam})`);
        req.session.message = {
          type: "success",
          text: `Đã xóa thể loại "${genreName}" thành công!`,
        };
      }
      res.redirect("/admin/genres"); // Chuyển về trang danh sách
    } catch (error) {
      console.error(`Error deleting genre ${genreIdParam}:`, error);
      req.session.message = {
        type: "error",
        text: `Lỗi khi xóa thể loại: ${error.message}`,
      };
      res.redirect("/admin/genres");
      // Hoặc next(error);
    }
  }
}

module.exports = GenresController;
