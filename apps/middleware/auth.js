// File: apps/middleware/auth.js
const DatabaseConnection = require("../database/database"); // <<< Import DB Connection
const User = require("../models/user"); // Import User model (class)
const { ObjectId } = require("mongodb"); // <<< Import ObjectId

const authMiddleware = async (req, res, next) => {
  console.log("DEBUG: Running authMiddleware for:", req.originalUrl);
  if (!req.session || !req.session.userId) {
    // <<< Kiểm tra session và userId tồn tại
    // Lưu lại trang đang truy cập để redirect sau khi login (tùy chọn)
    // req.session.returnTo = req.originalUrl;
    console.log(
      "AuthMiddleware: No session/userId found, redirecting to login."
    );
    // Có thể gửi thông báo lỗi flash
    // req.session.message = { type: 'error', text: 'Please log in to continue.' };
    return res.redirect("/login"); // Redirect to login if not logged in
  }

  try {
    const db = DatabaseConnection.getDb(); // <<< Lấy đối tượng db
    const userId = new ObjectId(req.session.userId); // <<< Chuyển userId sang ObjectId

    // Sử dụng hàm từ model User để tìm user
    const user = await User.findUserById(db, userId); // <<< Truyền db vào hàm model

    if (!user) {
      console.log(
        `AuthMiddleware: User not found in DB with ID: ${req.session.userId}. Destroying session.`
      );
      // Nếu user không tìm thấy trong DB (có thể đã bị xóa), hủy session và redirect về login
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return next(err); // Chuyển lỗi nếu không hủy session được
        }
        res.clearCookie("connect.sid"); // Xóa cookie session (tên mặc định là connect.sid)
        // req.session.message = { type: 'error', text: 'Your session is invalid. Please log in again.' };
        return res.redirect("/login");
      });
    } else {
      // Gắn thông tin user (có thể chỉ cần role hoặc các thông tin cần thiết khác) vào request
      // Không nên gắn cả object user có password hash vào req
      req.user = {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role, // Quan trọng cho phân quyền
      };
      console.log(`DEBUG: AuthMiddleware PASSED for ${req.user.username}`);
      console.log(
        `AuthMiddleware: User authenticated: ${user.username} (${user.role})`
      );
      next(); // Cho phép đi tiếp
    }
  } catch (error) {
    console.error("AuthMiddleware Error:", error);
    // Có thể hủy session nếu có lỗi nghiêm trọng
    // req.session.destroy(...)
    next(error); // Chuyển lỗi cho global error handler
  }
};

// Middleware kiểm tra vai trò (Role-based access control)
const roleMiddleware = (allowedRoles) => {
  // Chuyển allowedRoles thành Set để kiểm tra nhanh hơn
  const rolesSet = new Set(
    Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  );

  return (req, res, next) => {
    console.log(
      `DEBUG: Running roleMiddleware ('${[...rolesSet].join(",")}') for:`,
      req.originalUrl,
      "User role:",
      req.user?.role
    );
    // Middleware này phải chạy SAU authMiddleware
    if (!req.user || !req.user.role) {
      console.warn(
        "RoleMiddleware: req.user or req.user.role not found. Ensure authMiddleware runs first."
      );
      // Có thể trả về lỗi 401 Unauthorized thay vì 403 Forbidden
      return res.status(401).render("error", {
        title: "Unauthorized",
        message: "Authentication required.",
      });
      // return res.status(401).send("Authentication required.");
    }

    if (!rolesSet.has(req.user.role)) {
      console.warn(
        `RoleMiddleware: Forbidden access for role "${
          req.user.role
        }". Allowed: ${[...rolesSet].join(", ")}. Path: ${req.originalUrl}`
      );
      // Trả về lỗi 403 Forbidden
      return res.status(403).render("error", {
        title: "Forbidden",
        message: "You do not have permission to access this resource.",
      });
      // return res.status(403).send("Forbidden: You do not have permission to access this resource.");
    }

    // Nếu vai trò hợp lệ, cho phép đi tiếp
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };
