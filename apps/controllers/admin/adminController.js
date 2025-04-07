const DatabaseConnection = require("../../database/database");

class AdminController {
  // Render trang admin chính (dashboard)
  static async getAdminDashboard(req, res, next) {
    // <<< Thêm async và next
    try {
      const db = DatabaseConnection.getDb();

      // Thực hiện song song các lệnh count để nhanh hơn
      const [totalComics, totalUsers /*, totalChapters, totalViews... */] =
        await Promise.all([
          db.collection("comics").countDocuments(),
          db.collection("users").countDocuments(),
          // db.collection('chapters').countDocuments(), // Nếu muốn đếm chapter
          // Tính tổng view (phức tạp hơn, có thể dùng aggregation)
        ]);

      // Render view và truyền các số liệu vào
      res.render("admin/dashboard", {
        title: "Admin Dashboard",
        totalComics: totalComics,
        totalUsers: totalUsers,
        // totalChapters: totalChapters,
        // ... các số liệu khác
      });
    } catch (error) {
      console.error("Error getting admin dashboard stats:", error);
      next(error); // Chuyển lỗi nếu có vấn đề khi truy vấn DB
    }
  }

  // Các hàm render trang quản lý tĩnh khác nếu cần (có thể đã được xử lý bởi router)
  static getUserManagementPage(req, res) {
    // Thường thì route /admin/users sẽ do usersController xử lý và render trang index của nó
    res.render("admin/users/index"); // Hoặc tên view bạn dùng, ví dụ UserManagement.ejs nếu đó là trang index
  }

  static getGenreManagementPage(req, res) {
    res.render("admin/genres/index"); // Hoặc GenreManagement.ejs nếu đó là trang index
  }

  static getRoleManagementPage(req, res) {
    res.render("admin/roles/index");
  }

  static getComicManagementPage(req, res) {
    res.render("admin/comics/index"); // Hoặc admin.ejs nếu đó là trang index comic
  }

  // Xóa các hàm logic CRUD (getAdminDashboard cũ, updateUser) vì chúng thuộc về controller khác
}

module.exports = AdminController;

/* Xóa hoặc comment đoạn router cũ này đi nếu không dùng trực tiếp file này làm router
var express = require("express");
var router = express.Router();
// var User = require("../../models/user") // Không cần thiết ở đây nữa

router.get("/", function (req, res) {
    res.render("admin.ejs"); // Nên render trang dashboard cụ thể hơn
});

router.get("/usermanagement", function(req, res){
    res.render("UserManagement.ejs"); // Route này nên do usersController xử lý
});
router.get("/genremanagement", function(req, res){
    res.render("GenreManagement.ejs"); // Route này nên do genresController xử lý
});

// Xóa các hàm getAdminDashboard, updateUser ở đây
module.exports = router;
*/
