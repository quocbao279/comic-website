const DatabaseConnection = require("../../database/database");
const { ObjectId } = require("mongodb");
const { getRoleObject } = require("../../models/role");

class RolesController {
  // GET all roles - Render trang quản lý roles
  static async getAllRoles(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();

      const roles = await db
        .collection("roles")
        .find()
        .sort({ name: 1 })
        .toArray();
      res.render("admin/roles/index", { roles, title: "Quản lý Vai Trò" });
    } catch (error) {
      console.error("Error getting all roles:", error);
      next(error);
    }
  }

  static async getCreateRoleForm(req, res, next) {
    try {
      res.render("admin/roles/create", { title: "Thêm Vai Trò Mới" });
    } catch (error) {
      console.error("Error getting create role form:", error);
      next(error);
    }
  }

  // GET - Render form chỉnh sửa role
  static async getEditRoleForm(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const roleId = new ObjectId(req.params.id);
      const role = await db.collection("roles").findOne({ _id: roleId });

      if (!role) {
        req.session.message = { type: "error", text: "Role not found!" };
        return res.redirect("/admin/roles");
      }
      res.render("admin/roles/edit", {
        role,
        title: `Sửa Vai Trò: ${role.name}`,
      });
    } catch (error) {
      console.error(`Error getting role ${req.params.id} for edit:`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Invalid Role ID format.",
        };
        return res.redirect("/admin/roles");
      }
      next(error);
    }
  }

  // POST - Tạo role mới
  static async createRole(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const existingRole = await db
        .collection("roles")
        .findOne({ name: req.body.name });
      if (existingRole) {
        req.session.message = {
          type: "error",
          text: `Role "${req.body.name}" already exists!`,
        };
        return res.redirect("/admin/roles/create");
      }
      const role = getRoleObject(req.body.name);
      const result = await db.collection("roles").insertOne(role);
      console.log(`Role created with ID: ${result.insertedId}`);
      req.session.message = {
        type: "success",
        text: "Role created successfully!",
      };
      res.redirect("/admin/roles");
    } catch (error) {
      console.error("Error creating role:", error);
      req.session.message = {
        type: "error",
        text: `Error creating role: ${error.message}`,
      };
      res.redirect("/admin/roles/create");
      // next(error);
    }
  }

  // POST - Cập nhật role
  static async updateRole(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const roleId = new ObjectId(req.params.id);
      const newName = req.body.name;

      const existingRole = await db
        .collection("roles")
        .findOne({ name: newName, _id: { $ne: roleId } });
      if (existingRole) {
        req.session.message = {
          type: "error",
          text: `Role name "${newName}" already exists!`,
        };
        return res.redirect(`/admin/roles/edit/${req.params.id}`);
      }

      const result = await db
        .collection("roles")
        .updateOne(
          { _id: roleId },
          { $set: { name: newName /*, permissions: ... */ } }
        );

      if (result.matchedCount === 0) {
        req.session.message = {
          type: "error",
          text: "Role not found for update.",
        };
      } else {
        req.session.message = {
          type: "success",
          text: "Role updated successfully!",
        };
      }
      res.redirect("/admin/roles");
    } catch (error) {
      console.error(`Error updating role ${req.params.id}:`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Invalid Role ID format.",
        };
        return res.redirect("/admin/roles");
      }
      req.session.message = {
        type: "error",
        text: `Error updating role: ${error.message}`,
      };
      res.redirect(`/admin/roles/edit/${req.params.id}`);
      // Hoặc next(error);
    }
  }

  // POST - Xóa role
  static async deleteRole(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const roleId = new ObjectId(req.params.id);
      const usersWithRole = await db
        .collection("users")
        .countDocuments({ roleId: roleId }); // Giả sử user lưu roleId
      // const usersWithRole = await db.collection('users').countDocuments({ role: roleName });

      if (usersWithRole > 0) {
        req.session.message = {
          type: "error",
          text: "Cannot delete role as it is currently assigned to users.",
        };
        return res.redirect("/admin/roles");
      }
      const roleToDelete = await db
        .collection("roles")
        .findOne({ _id: roleId });
      if (["admin", "user", "uploader"].includes(roleToDelete?.name)) {
        req.session.message = {
          type: "error",
          text: "Cannot delete core system roles.",
        };
        return res.redirect("/admin/roles");
      }

      const result = await db.collection("roles").deleteOne({ _id: roleId });

      if (result.deletedCount === 0) {
        req.session.message = {
          type: "error",
          text: "Role not found for deletion.",
        };
      } else {
        console.log(`Role deleted: ${roleId}`);
        req.session.message = {
          type: "success",
          text: "Role deleted successfully!",
        };
      }
      res.redirect("/admin/roles");
    } catch (error) {
      console.error(`Error deleting role ${req.params.id}:`, error);
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        req.session.message = {
          type: "error",
          text: "Invalid Role ID format.",
        };
      } else {
        req.session.message = {
          type: "error",
          text: `Error deleting role: ${error.message}`,
        };
      }
      res.redirect("/admin/roles");
      // next(error);
    }
  }
}

module.exports = RolesController;
