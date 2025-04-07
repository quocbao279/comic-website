// File: apps/controllers/admin/adminController.js
// Chỉ dùng để render các trang dashboard/quản lý chung ban đầu nếu cần
// Logic CRUD cụ thể nên nằm trong các controller tương ứng (usersController, comicsController,...)

class AdminController {
  // Render trang admin chính (dashboard)
  static getAdminDashboard(req, res) {
    // Có thể lấy một số thống kê nhanh ở đây nếu muốn
    // const db = DatabaseConnection.getDb();
    // const userCount = await db.collection('users').countDocuments();
    // ...
    res.render("admin/dashboard"); // <<< Cần tạo view này: apps/views/admin/dashboard.ejs
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
