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
    const { email, password } = req.body;
    const db = DatabaseConnection.getDb();
    console.log("Login attempt:", { email });

    try {
      // Validation cơ bản
      if (!email || !password) {
        req.session.message = {
          type: "error",
          text: "Vui lòng nhập đầy đủ email và password.",
        };
        return res.redirect("/login");
      }
      // Tìm user bằng email
      const user = await User.findUserByEmail(db, email);
      if (!user) {
        console.log("Login failed: Email not found", email);
        req.session.message = {
          type: "error",
          text: "Email hoặc mật khẩu không chính xác.",
        };
        return res.redirect("/login");
      }
      // Xác thực mật khẩu
      const isPasswordValid = await User.verifyPassword(db, email, password);
      if (!isPasswordValid) {
        console.log("Login failed: Incorrect password for email", email);
        req.session.message = {
          type: "error",
          text: "Email hoặc mật khẩu không chính xác.",
        };
        return res.redirect("/login");
      }
      // Đăng nhập thành công: Lưu thông tin vào session
      req.session.userId = user._id;
      req.session.username = user.username;
      req.session.role = user.role;

      console.log(
        `User logged in: ${user.username} (ID: ${user._id}, Role: ${user.role})`
      );
      req.session.message = {
        type: "success",
        text: `Chào mừng ${user.username} quay trở lại!`,
      };
      const returnTo = req.session.returnTo || "/";
      delete req.session.returnTo;
      res.redirect(returnTo);
    } catch (error) {
      console.error("Login process error:", error);
      next(error);
    }
  }
  static logoutUser(req, res, next) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return next(err);
      }
      res.clearCookie("connect.sid");
      res.redirect("/login");
    });
  }
  static async registerUser(req, res, next) {
    const { username, email, password } = req.body;
    const db = DatabaseConnection.getDb();
    console.log("Register attempt received:", { username, email });

    try {
      if (!username || !email || !password) {
        console.log("Validation failed: Missing fields.");
        req.session.message = {
          type: "error",
          text: "Vui lòng nhập đầy đủ username, email, và password.",
        };
        return res.redirect("/register");
      }

      console.log("Checking for existing email:", email);
      const existingUserByEmail = await User.findUserByEmail(db, email);

      if (existingUserByEmail) {
        console.log("Email already exists:", email);
        req.session.message = {
          type: "error",
          text: `Email "${email}" đã được sử dụng.`,
        };
        return res.redirect("/register");
      }

      console.log("Email not found. Proceeding to create user:", username);
      const newUserResult = await User.createUser(db, {
        username,
        email,
        password,
      });
      console.log("User created successfully:", newUserResult.insertedId);
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
