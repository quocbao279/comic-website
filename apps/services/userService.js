// File: apps/services/userService.js
const DatabaseConnection = require("../database/database"); // <<< Import DB Connection
const { ObjectId } = require("mongodb"); // <<< Import ObjectId

/**
 * Cập nhật thông tin người dùng.
 * @param {string} userId ID của người dùng cần cập nhật.
 * @param {object} updateData Dữ liệu cần cập nhật.
 * @param {boolean} isAdminUpdate Cờ đánh dấu có phải admin đang cập nhật không (để kiểm tra role).
 * @returns {Promise<import('mongodb').UpdateResult>} Kết quả cập nhật từ MongoDB.
 */
const updateUser = async (userId, updateData, isAdminUpdate = false) => {
  const db = DatabaseConnection.getDb(); // <<< Lấy đối tượng db

  // Tách role ra nếu có, để xử lý riêng
  const { role, ...otherUpdateData } = updateData;
  let finalUpdateData = { ...otherUpdateData }; // Dữ liệu cập nhật cuối cùng

  // Nếu là admin cập nhật và có thay đổi role
  if (isAdminUpdate && role) {
    const validRoles = ["user", "uploader", "admin"]; // Các role hợp lệ
    if (!validRoles.includes(role)) {
      console.warn(`Attempted to set invalid role: ${role} for user ${userId}`);
      throw new Error("Invalid role specified."); // Ném lỗi nếu role không hợp lệ
    }
    finalUpdateData.role = role; // Thêm role vào dữ liệu cập nhật
  } else if (role) {
    // Nếu không phải admin mà cố tình gửi role -> bỏ qua hoặc log cảnh báo
    console.warn(
      `Non-admin user attempted to update role for user ${userId}. Ignoring role change.`
    );
    // Hoặc throw new Error("Permission denied to change role.");
  }

  // Đảm bảo không có trường trống hoặc không mong muốn được gửi lên $set
  // (Ví dụ: loại bỏ các trường có giá trị undefined)
  Object.keys(finalUpdateData).forEach((key) => {
    if (finalUpdateData[key] === undefined) {
      delete finalUpdateData[key];
    }
  });

  // Thêm trường updatedAt nếu muốn
  finalUpdateData.updatedAt = new Date();

  console.log(`Updating user ${userId} with data:`, finalUpdateData);

  try {
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) }, // <<< Sử dụng ObjectId
      { $set: finalUpdateData }
    );

    if (result.matchedCount === 0) {
      console.warn(`User not found for update: ${userId}`);
      throw new Error("User not found.");
    }
    console.log(
      `User ${userId} updated successfully. Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`
    );
    return result;
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    // Ném lại lỗi để controller có thể xử lý
    throw new Error(`Failed to update user: ${error.message}`);
  }
};

module.exports = { updateUser };
