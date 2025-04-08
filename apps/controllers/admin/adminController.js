const DatabaseConnection = require("../../database/database");

class AdminController {
  // Render trang admin chính (dashboard)
  static async getAdminDashboard(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const [totalComics, totalUsers] = await Promise.all([
        db.collection("comics").countDocuments(),
        db.collection("users").countDocuments(),
      ]);
      res.render("admin/dashboard", {
        title: "Admin Dashboard",
        totalComics: totalComics,
        totalUsers: totalUsers,
      });
    } catch (error) {
      console.error("Error getting admin dashboard stats:", error);
      next(error);
    }
  }
  static getUserManagementPage(req, res) {
    res.render("admin/users/index");
  }

  static getGenreManagementPage(req, res) {
    res.render("admin/genres/index");
  }

  static getRoleManagementPage(req, res) {
    res.render("admin/roles/index");
  }

  static getComicManagementPage(req, res) {
    res.render("admin/comics/index");
  }
}

module.exports = AdminController;
