const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");

const userCollection = "users";

class User {
  static async createUser(db, { username, email, password }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      username,
      email,
      password: hashedPassword,
      role: "user",
    };
    const result = await db.collection(userCollection).insertOne(newUser);
    return result;
  }

  static async findUserByEmail(db, email) {
    const user = await db.collection(userCollection).findOne({ email });
    return user;
  }

  static async findUserById(db, id) {
    const user = await db.collection(userCollection).findOne({ _id: id });
    return user;
  }

  static async updateUserRole(db, userId, newRole) {
    const result = await db
      .collection(userCollection)
      .updateOne({ _id: userId }, { $set: { role: newRole } });
    return result;
  }

  static async verifyPassword(db, email, password) {
    const user = await this.findUserByEmail(db, email);
    if (!user) return false;
    const match = await bcrypt.compare(password, user.password);
    return match ? user : false;
  }
}

module.exports = User;
