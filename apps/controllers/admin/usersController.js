// File: apps/controllers/admin/usersController.js
const DatabaseConnection = require("../../database/database");
const { ObjectId } = require("mongodb");
const User = require("../../models/user"); // Import User class từ model
const { updateUser } = require("../../services/userService"); // Import service updateUser

class UsersController {
  // GET all users - Render trang quản lý users
  static async getAllUsers(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      // Lấy tất cả user, có thể thêm phân trang sau này
      // Bỏ qua trường password khi lấy dữ liệu
      const users = await db
        .collection("users")
        .find({}, { projection: { password: 0 } })
        .sort({ username: 1 })
        .toArray();
      // <<< Cần tạo/sửa view này: apps/views/admin/users/index.ejs (hoặc UserManagement.ejs)
      res.render("admin/users/index", { users, title: "Quản lý Người Dùng" });
      // res.render("UserManagement", { users, title: "Quản lý Người Dùng" }); // Nếu dùng view cũ
    } catch (error) {
      console.error("Error getting all users:", error);
      next(error);
    }
  }

  // GET - Render form chỉnh sửa user
  static async getUser(req, res, next) {
    // Đổi tên hàm cho rõ ràng hơn
    try {
      const db = DatabaseConnection.getDb();
      const userId = new ObjectId(req.params.id);
      // Lấy user, bỏ qua password
      const user = await db
        .collection("users")
        .findOne({ _id: userId }, { projection: { password: 0 } });

      if (!user) {
        req.session.message = { type: "error", text: "User not found!" };
        return res.redirect("/admin/users");
      }
      // Có thể lấy danh sách roles để hiển thị trong form edit
      // const roles = await db.collection('roles').find().toArray();
      // <<< Cần tạo/sửa view này: apps/views/admin/users/edit.ejs
      res.render("admin/users/edit", {
        user,
        title: `Sửa User: ${user.username}` /*, roles*/,
      });
    } catch (error) {
      console.error(`Error getting user ${req.params.id} for edit:`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Invalid User ID format.",
        };
        return res.redirect("/admin/users");
      }
      next(error);
    }
  }

  // GET - Render form tạo user mới
  static async getCreateUserForm(req, res, next) {
    try {
      // Có thể lấy danh sách roles để hiển thị trong form tạo
      // const db = DatabaseConnection.getDb();
      // const roles = await db.collection('roles').find().toArray();
      // <<< Cần tạo/sửa view này: apps/views/admin/users/create.ejs
      res.render("admin/users/create", { title: "Thêm User Mới" /*, roles*/ });
    } catch (error) {
      console.error("Error getting create user form:", error);
      next(error);
    }
  }

  // POST - Tạo user mới
  static async createUser(req, res, next) {
    const db = DatabaseConnection.getDb(); // Lấy db trước để kiểm tra email/username
    const { username, email, password, role } = req.body; // Lấy dữ liệu từ form

    try {
      // --- Input Validation ---
      if (!username || !email || !password) {
        req.session.message = {
          type: "error",
          text: "Username, email, and password are required.",
        };
        return res.redirect("/admin/users/create");
      }
      // Thêm các validation khác nếu cần (độ dài password, định dạng email...)

      // Kiểm tra role hợp lệ
      const validRoles = ["user", "uploader", "admin"];
      const assignedRole = role && validRoles.includes(role) ? role : "user"; // Gán role hoặc mặc định là 'user'

      // Kiểm tra Username hoặc Email đã tồn tại chưa
      const existingUser = await db
        .collection("users")
        .findOne({ $or: [{ email: email }, { username: username }] });
      if (existingUser) {
        let errorMessage = "";
        if (existingUser.email === email)
          errorMessage = `Email "${email}" already exists.`;
        if (existingUser.username === username)
          errorMessage += `<span class="math-inline">\{errorMessage ? ' ' \: ''\}Username "</span>{username}" already exists.`;
        req.session.message = { type: "error", text: errorMessage };
        return res.redirect("/admin/users/create");
      }

      // --- Tạo User bằng Model (Đã bao gồm hash password) ---
      // Truyền db và dữ liệu user vào hàm của Model
      const result = await User.createUser(db, {
        username,
        email,
        password,
        role: assignedRole,
      });

      console.log(
        `Admin created user: <span class="math-inline">\{username\} \(</span>{email}) with ID: ${result.insertedId}`
      );
      req.session.message = {
        type: "success",
        text: "User created successfully!",
      };
      res.redirect("/admin/users"); // Redirect về trang quản lý
    } catch (error) {
      console.error("Error creating user (admin):", error);
      req.session.message = {
        type: "error",
        text: `Error creating user: ${error.message}`,
      };
      res.redirect("/admin/users/create"); // Quay lại form tạo với lỗi
      // Hoặc next(error);
    }
  }

  // POST - Cập nhật user (gọi service)
  static async updateUser(req, res, next) {
    // Đổi tên hàm cho rõ ràng
    try {
      // Dữ liệu từ form, có thể bao gồm cả role nếu admin được phép sửa
      const updateData = { ...req.body };
      const userId = req.params.id;

      // Gọi service để cập nhật, đánh dấu là admin đang update (true)
      await updateUser(userId, updateData, true);

      req.session.message = {
        type: "success",
        text: "User updated successfully!",
      };
      res.redirect("/admin/users");
    } catch (error) {
      console.error(`Error updating user ${req.params.id} (admin):`, error);
      req.session.message = {
        type: "error",
        text: `Error updating user: ${error.message}`,
      };
      res.redirect(`/admin/users/edit/${req.params.id}`); // Quay lại form edit với lỗi
      // Hoặc next(error);
    }
  }

  // POST - Xóa user
  static async deleteUser(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const userId = new ObjectId(req.params.id);

      // (Quan trọng) Ngăn admin tự xóa chính mình
      if (req.user && req.user._id.equals(userId)) {
        // req.user được gắn từ authMiddleware
        req.session.message = {
          type: "error",
          text: "You cannot delete your own account.",
        };
        return res.redirect("/admin/users");
      }

      const result = await db.collection("users").deleteOne({ _id: userId });

      if (result.deletedCount === 0) {
        req.session.message = {
          type: "error",
          text: "User not found for deletion.",
        };
      } else {
        console.log(`Admin deleted user: ${userId}`);
        req.session.message = {
          type: "success",
          text: "User deleted successfully!",
        };
      }
      res.redirect("/admin/users");
    } catch (error) {
      console.error(`Error deleting user ${req.params.id} (admin):`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Invalid User ID format.",
        };
      } else {
        req.session.message = {
          type: "error",
          text: `Error deleting user: ${error.message}`,
        };
      }
      res.redirect("/admin/users");
      // Hoặc next(error);
    }
  }
}

module.exports = UsersController;
