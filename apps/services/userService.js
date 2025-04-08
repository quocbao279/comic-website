const DatabaseConnection = require("../database/database");
const { ObjectId } = require("mongodb");
/**
 * @param {string} userId
 * @param {object} updateData
 * @param {boolean} isAdminUpdate
 * @returns {Promise<import('mongodb').UpdateResult>}
 */
const updateUser = async (userId, updateData, isAdminUpdate = false) => {
  const db = DatabaseConnection.getDb();

  // Tách role ra nếu có, để xử lý riêng
  const { role, ...otherUpdateData } = updateData;
  let finalUpdateData = { ...otherUpdateData };

  // Nếu là admin cập nhật và có thay đổi role
  if (isAdminUpdate && role) {
    const validRoles = ["user", "uploader", "admin"];
    if (!validRoles.includes(role)) {
      console.warn(`Attempted to set invalid role: ${role} for user ${userId}`);
      throw new Error("Invalid role specified.");
    }
    finalUpdateData.role = role;
  } else if (role) {
    console.warn(
      `Non-admin user attempted to update role for user ${userId}. Ignoring role change.`
    );
  }

  Object.keys(finalUpdateData).forEach((key) => {
    if (finalUpdateData[key] === undefined) {
      delete finalUpdateData[key];
    }
  });

  finalUpdateData.updatedAt = new Date();

  console.log(`Updating user ${userId} with data:`, finalUpdateData);

  try {
    const result = await db
      .collection("users")
      .updateOne({ _id: new ObjectId(userId) }, { $set: finalUpdateData });

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
    throw new Error(`Failed to update user: ${error.message}`);
  }
};

module.exports = { updateUser };
