const express = require("express");
const path = require("path");
const session = require("express-session"); // Import express-session
const DatabaseConnection = require("./apps/database/database"); // Import lớp kết nối DB đã sửa
const mainRouter = require("./apps/routes/index"); // Import router chính từ apps/routes/index.js

const app = express();
const port = 3000; // Đặt port trực tiếp

// Hàm khởi động server chính
async function startServer() {
  try {
    //Kết nối Database TRƯỚC khi làm mọi việc khác
    console.log("Initializing database connection...");
    await DatabaseConnection.connect();
    console.log("Database connection initialized.");

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "apps", "views"));
    app.use(express.static(path.join(__dirname, "public")));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    // Cấu hình express-session
    app.use(
      session({
        secret: "your-very-strong-secret-key",
        resave: false,
        saveUninitialized: false,
        // cookie: { secure: true } // Bật true nếu dùng HTTPS
      })
    );

    // (Tùy chọn) Middleware để truyền thông tin user vào tất cả các view nếu đã đăng nhập
    app.use((req, res, next) => {
      if (req.session && req.session.userId) {
        res.locals.currentUser = {
          id: req.session.userId,
          username: req.session.username,
          role: req.session.role,
        };
      } else {
        res.locals.currentUser = null;
      }
      console.log("DEBUG: res.locals.currentUser =", res.locals.currentUser);
      res.locals.message = req.session.message; // Giữ nguyên xử lý message
      delete req.session.message;
      next();
    });

    app.use("/", mainRouter);

    app.use((req, res, next) => {
      // Cần tạo file apps/views/error.ejs
      res.status(404).render("error", {
        title: "404 Not Found",
        message: "Xin lỗi, trang bạn tìm kiếm không tồn tại.",
      });
    });

    app.use((err, req, res, next) => {
      console.error("!!! Global Error Handler:", err.stack);
      // Cần tạo file apps/views/error.ejs
      res.status(err.status || 500).render("error", {
        title: "Lỗi Server",
        message: err.message || "Đã có lỗi không mong muốn xảy ra phía server!",
      });
    });

    //Bắt đầu lắng nghe request
    app.listen(port, () => {
      console.log(`=> Server ReadiWeb is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("!!! Failed to start server:", error);
    process.exit(1);
  }
}
// Đảm bảo đóng kết nối DB
process.on("SIGINT", async () => {
  console.log("\nSIGINT signal received: Closing MongoDB connection...");
  await DatabaseConnection.close();
  console.log("Exiting process.");
  process.exit(0);
});
process.on("SIGTERM", async () => {
  console.log("\nSIGTERM signal received: Closing MongoDB connection...");
  await DatabaseConnection.close();
  console.log("Exiting process.");
  process.exit(0);
});

startServer();
