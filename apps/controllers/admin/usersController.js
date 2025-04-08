// File: apps/controllers/admin/usersController.js
const DatabaseConnection = require("../../database/database");
const { ObjectId } = require("mongodb");
const User = require("../../models/user");
const { updateUser } = require("../../services/userService");

class UsersController {
  // GET all users - Render trang quản lý users
  static async getAllUsers(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const users = await db
        .collection("users")
        .find({}, { projection: { password: 0 } })
        .sort({ username: 1 })
        .toArray();
      res.render("admin/users/index", { users, title: "Quản lý Người Dùng" });
    } catch (error) {
      console.error("Error getting all users:", error);
      next(error);
    }
  }

  // GET - Render form chỉnh sửa user
  static async getUser(req, res, next) {
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
      // const roles = await db.collection('roles').find().toArray();
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
      // const db = DatabaseConnection.getDb();
      // const roles = await db.collection('roles').find().toArray();
      res.render("admin/users/create", { title: "Thêm User Mới" /*, roles*/ });
    } catch (error) {
      console.error("Error getting create user form:", error);
      next(error);
    }
  }

  // POST - Tạo user mới
  static async createUser(req, res, next) {
    const db = DatabaseConnection.getDb();
    const { username, email, password, role } = req.body;

    try {
      // --- Input Validation ---
      if (!username || !email || !password) {
        req.session.message = {
          type: "error",
          text: "Username, email, and password are required.",
        };
        return res.redirect("/admin/users/create");
      }
      const validRoles = ["user", "uploader", "admin"];
      const assignedRole = role && validRoles.includes(role) ? role : "user";
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
      res.redirect("/admin/users");
    } catch (error) {
      console.error("Error creating user (admin):", error);
      req.session.message = {
        type: "error",
        text: `Error creating user: ${error.message}`,
      };
      res.redirect("/admin/users/create");
      // next(error);
    }
  }

  // POST - Cập nhật user (gọi service)
  static async updateUser(req, res, next) {
    try {
      const updateData = { ...req.body };
      const userId = req.params.id;
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
      res.redirect(`/admin/users/edit/${req.params.id}`);
      // next(error);
    }
  }

  // POST - Xóa user
  static async deleteUser(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const userId = new ObjectId(req.params.id);
      if (req.user && req.user._id.equals(userId)) {
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
      // next(error);
    }
  }
}

module.exports = UsersController;
