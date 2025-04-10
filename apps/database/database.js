const { MongoClient } = require("mongodb");
const config = require("./../../config/setting.json");

class DatabaseConnection {
  static client = null;
  static db = null;

  /**
   * @returns {Promise<import('mongodb').Db>}
   */
  static async connect() {
    if (this.db && this.client?.topology?.isConnected()) {
      return this.db;
    }

    const username = encodeURIComponent(config.mongodb.username);
    const password = encodeURIComponent(config.mongodb.password);
    const dbName = config.mongodb.database;
    if (!username || !password) {
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
    const url = `mongodb+srv://sa:sa@ktgiuaki.xvu6k.mongodb.net/?retryWrites=true&w=majority`;
    const options = {};

    console.log(`Connecting to MongoDB Atlas with Database: ${dbName}...`);
    try {
      this.client = new MongoClient(url, options);
      await this.client.connect();
      this.db = this.client.db(dbName);

      console.log(
        `=> Connected successfully to database: "${dbName}" on Atlas cluster.`
      );
      return this.db;
    } catch (error) {
      console.error("!!! MongoDB Atlas Connection Error:", error);
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
      process.exit(1);
    }
  }
  static getDb() {
    if (!this.db || !this.client?.topology?.isConnected()) {
      console.error(
        "!!! Database not connected or connection lost. Ensure connect() was called and successful."
      );
      throw new Error("Database not connected or connection lost.");
    }
    return this.db;
  }
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
