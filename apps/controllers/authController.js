const DatabaseConnection = require("../database/database");
const User = require("../models/user");

class AuthController {
  static getLoginPage(req, res) {
    res.render("Login", { title: "Login" });
  }
  static getRegisterPage(req, res) {
    res.render("Register", { title: "Register" });
  }
  static async loginUser(req, res, next) {
    const { email, password } = req.body; // Lấy email, password từ form login
    const db = DatabaseConnection.getDb();
    console.log("Login attempt:", { email });

    try {
      // --- 1. Validation cơ bản ---
      if (!email || !password) {
        req.session.message = {
          type: "error",
          text: "Vui lòng nhập đầy đủ email và password.",
        };
        return res.redirect("/login");
      }

      // --- 2. Tìm user bằng email ---
      // Dùng hàm trong model User
      const user = await User.findUserByEmail(db, email);
      if (!user) {
        // Không tìm thấy user với email này
        console.log("Login failed: Email not found", email);
        req.session.message = {
          type: "error",
          text: "Email hoặc mật khẩu không chính xác.",
        };
        return res.redirect("/login");
      }

      // --- 3. Xác thực mật khẩu ---
      // Dùng hàm trong model User (hàm này dùng bcrypt.compare)
      // Giả sử verifyPassword trả về true/false
      const isPasswordValid = await User.verifyPassword(db, email, password);

      if (!isPasswordValid) {
        // Sai mật khẩu
        console.log("Login failed: Incorrect password for email", email);
        req.session.message = {
          type: "error",
          text: "Email hoặc mật khẩu không chính xác.",
        };
        return res.redirect("/login");
      }

      // --- 4. Đăng nhập thành công: Lưu thông tin vào session ---
      req.session.userId = user._id; // Lưu ID (đã là ObjectId)
      req.session.username = user.username; // Lưu username
      req.session.role = user.role; // <<< QUAN TRỌNG: Lưu cả role vào session

      console.log(
        `User logged in: ${user.username} (ID: ${user._id}, Role: ${user.role})`
      );
      req.session.message = {
        type: "success",
        text: `Chào mừng ${user.username} quay trở lại!`,
      };

      // Chuyển hướng đến trang họ định vào trước đó (nếu có lưu trong session) hoặc trang chủ
      const returnTo = req.session.returnTo || "/";
      delete req.session.returnTo; // Xóa returnTo khỏi session sau khi dùng
      res.redirect(returnTo);
    } catch (error) {
      console.error("Login process error:", error);
      next(error); // Chuyển lỗi cho error handler
    }
  }
  static logoutUser(req, res, next) {
    req.session.destroy((err) => {
      // Hủy session
      if (err) {
        console.error("Logout error:", err);
        return next(err); // Chuyển lỗi nếu không hủy được
      }
      res.clearCookie("connect.sid"); // Xóa cookie session (tên mặc định)
      res.redirect("/login"); // Chuyển về trang login
    });
  }
  static async registerUser(req, res, next) {
    const { username, email, password } = req.body;
    const db = DatabaseConnection.getDb();
    console.log("Register attempt received:", { username, email }); // <<< Log dữ liệu nhận được

    try {
      if (!username || !email || !password) {
        console.log("Validation failed: Missing fields."); // <<< Log validation
        req.session.message = {
          type: "error",
          text: "Vui lòng nhập đầy đủ username, email, và password.",
        };
        return res.redirect("/register");
      }

      console.log("Checking for existing email:", email); // <<< Log trước khi kiểm tra DB
      const existingUserByEmail = await User.findUserByEmail(db, email);

      if (existingUserByEmail) {
        console.log("Email already exists:", email); // <<< Log nếu email tồn tại
        req.session.message = {
          type: "error",
          text: `Email "${email}" đã được sử dụng.`,
        };
        return res.redirect("/register");
      }
      // Add similar check/log for username if you implement it

      console.log("Email not found. Proceeding to create user:", username); // <<< Log trước khi tạo user
      const newUserResult = await User.createUser(db, {
        username,
        email,
        password,
      });
      console.log("User created successfully:", newUserResult.insertedId); // <<< Log sau khi tạo user

      // Auto Login
      req.session.userId = newUserResult.insertedId;
      req.session.username = username;

      console.log(`User logged in via session: ${username}`);
      req.session.message = {
        type: "success",
        text: "Đăng ký thành công! Bạn đã được tự động đăng nhập.",
      };
      res.redirect("/");
    } catch (error) {
      console.error("Error during user registration:", error);
      next(error);
    }
  }
}
module.exports = AuthController;
