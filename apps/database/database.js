// File: apps/database/database.js
const { MongoClient } = require("mongodb");
const config = require("./../../config/setting.json"); // Load config

class DatabaseConnection {
  static client = null; // Lưu trữ đối tượng MongoClient
  static db = null; // Lưu trữ đối tượng Database

  /**
   * Kết nối tới MongoDB Atlas cluster và chọn database.
   * @returns {Promise<import('mongodb').Db>} Đối tượng Db đã kết nối.
   */
  static async connect() {
    if (this.db && this.client?.topology?.isConnected()) {
      return this.db;
    }

    const username = encodeURIComponent(config.mongodb.username);
    const password = encodeURIComponent(config.mongodb.password);
    const dbName = config.mongodb.database; // Lấy tên DB từ config

    // --- Kiểm tra thông tin cần thiết ---
    if (!username || !password) {
      // Atlas thường yêu cầu xác thực
      console.error(
        "!!! Lỗi: Username và Password trong setting.json là bắt buộc để kết nối tới MongoDB Atlas."
      );
      throw new Error(
        "Username and Password are required in setting.json for Atlas connection."
      );
    }
    if (!dbName) {
      console.error(
        "!!! Lỗi: Tên database ('database') trong setting.json là bắt buộc."
      );
      throw new Error("Database name is required in setting.json.");
    }

    // --- Xây dựng chuỗi kết nối SRV ---
    const url = `mongodb+srv://${username}:${password}@cluster0.2dbdr.mongodb.net/?retryWrites=true&w=majority`;

    // --- Tùy chọn kết nối (không cần useUnifiedTopology nữa) ---
    const options = {
      // serverApi: { version: ServerApiVersion.v1 } // Có thể cần nếu bạn dùng Server API trên Atlas
    };

    console.log(`Connecting to MongoDB Atlas with Database: ${dbName}...`);
    try {
      this.client = new MongoClient(url, options);
      await this.client.connect(); // Thực hiện kết nối
      this.db = this.client.db(dbName);

      console.log(
        `=> Connected successfully to database: "${dbName}" on Atlas cluster.`
      );
      return this.db;
    } catch (error) {
      console.error("!!! MongoDB Atlas Connection Error:", error);
      // Cung cấp thêm gợi ý dựa trên lỗi thường gặp
      if (error.code === 18 || error.codeName === "AuthenticationFailed") {
        console.error(
          `   >>> Xác thực thất bại! Kiểm tra lại username ('${config.mongodb.username}') và password trong setting.json có khớp với user trên Atlas cluster '${clusterAddress}' không.`
        );
      } else if (error.constructor.name === "MongoParseError") {
        console.error(
          "   >>> Lỗi phân tích chuỗi kết nối. Kiểm tra lại định dạng."
        );
      } else if (
        error.message.includes("querySrv ENOTFOUND") ||
        error.message.includes("queryTxt ENOTFOUND")
      ) {
        console.error(
          `   >>> Lỗi DNS! Không tìm thấy địa chỉ cluster cluster0.2dbdr.mongodb.net . Kiểm tra lại địa chỉ cluster và kết nối mạng/DNS của bạn.`
        );
      } else if (error.message.includes("access control")) {
        console.error(
          `   >>> Lỗi quyền truy cập! User '${config.mongodb.username}' có thể không có quyền truy cập database '${dbName}'. Kiểm tra lại quyền user trên Atlas.`
        );
      }
      process.exit(1); // Dừng ứng dụng nếu lỗi kết nối
    }
  }

  /**
   * Lấy đối tượng Db đã được kết nối.
   */
  static getDb() {
    if (!this.db || !this.client?.topology?.isConnected()) {
      console.error(
        "!!! Database not connected or connection lost. Ensure connect() was called and successful."
      );
      throw new Error("Database not connected or connection lost.");
    }
    return this.db;
  }

  /**
   * Đóng kết nối MongoDB Atlas.
   */
  static async close() {
    if (this.client) {
      try {
        await this.client.close();
        this.client = null;
        this.db = null;
        console.log("MongoDB Atlas connection closed successfully.");
      } catch (error) {
        console.error("!!! Error closing MongoDB Atlas connection:", error);
      }
    }
  }
}

module.exports = DatabaseConnection;
