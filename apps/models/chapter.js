// File: apps/models/chapter.js
const { ObjectId } = require("mongodb"); // Cần ObjectId

const chapterCollection = "chapters"; // Tên collection

class Chapter {
  /**
   * Tạo một chapter mới trong database.
   * @param {import('mongodb').Db} db - Đối tượng database đã kết nối.
   * @param {object} chapterData - Dữ liệu chapter { comicId, chapterNumber, title, pages, uploaderId }.
   * @returns {Promise<import('mongodb').InsertOneResult>} Kết quả từ insertOne.
   */
  static async createChapter(
    db,
    { comicId, chapterNumber, title, pages, uploaderId }
  ) {
    const newChapter = {
      comicId: new ObjectId(comicId), // Đảm bảo comicId là ObjectId
      chapterNumber: parseFloat(chapterNumber) || 0, // Chuyển sang số, mặc định là 0 nếu lỗi
      title: title || null, // Title có thể null
      pages: Array.isArray(pages) ? pages : [], // Đảm bảo pages là array
      uploaderId: uploaderId ? new ObjectId(uploaderId) : null, // uploaderId có thể null
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // TODO: Có thể thêm kiểm tra xem chapterNumber đã tồn tại cho comicId này chưa trước khi insert
    return await db.collection(chapterCollection).insertOne(newChapter);
  }

  /**
   * Tìm tất cả chapters của một truyện, sắp xếp theo số chương.
   * @param {import('mongodb').Db} db - Đối tượng database.
   * @param {string|ObjectId} comicId - ID của truyện.
   * @returns {Promise<Array<object>>} Mảng các document chapter.
   */
  static async findChaptersByComicId(db, comicId) {
    const query = { comicId: new ObjectId(comicId) };
    return await db
      .collection(chapterCollection)
      .find(query)
      .sort({ chapterNumber: 1 }) // Sắp xếp tăng dần
      .toArray();
  }

  /**
   * Tìm một chapter cụ thể bằng comicId và chapterNumber.
   * @param {import('mongodb').Db} db - Đối tượng database.
   * @param {string|ObjectId} comicId - ID của truyện.
   * @param {number} chapterNumber - Số chương.
   * @returns {Promise<object|null>} Document chapter hoặc null nếu không tìm thấy.
   */
  static async findChapterByNumber(db, comicId, chapterNumber) {
    const query = {
      comicId: new ObjectId(comicId),
      chapterNumber: parseFloat(chapterNumber) || 0,
    };
    return await db.collection(chapterCollection).findOne(query);
  }

  /**
   * Lấy chapter trước và sau của một chapter hiện tại.
   * @param {import('mongodb').Db} db
   * @param {ObjectId} comicId
   * @param {number} currentChapterNumber
   * @returns {Promise<{prevChapterNum: number|null, nextChapterNum: number|null}>}
   */
  static async findPrevNextChapterNumbers(db, comicId, currentChapterNumber) {
    const num = parseFloat(currentChapterNumber) || 0;
    const comicObjectId = new ObjectId(comicId);

    const prevChapter = await db.collection(chapterCollection).findOne(
      { comicId: comicObjectId, chapterNumber: { $lt: num } }, // Tìm chapter < số hiện tại
      { sort: { chapterNumber: -1 }, projection: { chapterNumber: 1 } } // Lấy cái lớn nhất trong số nhỏ hơn
    );
    const nextChapter = await db.collection(chapterCollection).findOne(
      { comicId: comicObjectId, chapterNumber: { $gt: num } }, // Tìm chapter > số hiện tại
      { sort: { chapterNumber: 1 }, projection: { chapterNumber: 1 } } // Lấy cái nhỏ nhất trong số lớn hơn
    );

    return {
      prevChapterNum: prevChapter ? prevChapter.chapterNumber : null,
      nextChapterNum: nextChapter ? nextChapter.chapterNumber : null,
    };
  }

  /**
   * Xóa một chapter bằng ID của chapter đó.
   * @param {import('mongodb').Db} db
   * @param {string|ObjectId} chapterId
   * @returns {Promise<import('mongodb').DeleteResult>}
   */
  static async deleteChapterById(db, chapterId) {
    return await db
      .collection(chapterCollection)
      .deleteOne({ _id: new ObjectId(chapterId) });
  }

  /**
   * Xóa TẤT CẢ chapters của một comic (dùng khi xóa comic).
   * @param {import('mongodb').Db} db
   * @param {string|ObjectId} comicId
   * @returns {Promise<import('mongodb').DeleteResult>}
   */
  static async deleteChaptersByComicId(db, comicId) {
    console.warn(`Deleting all chapters for comicId: ${comicId}`); // Cảnh báo hành động nguy hiểm
    return await db
      .collection(chapterCollection)
      .deleteMany({ comicId: new ObjectId(comicId) });
  }

  // TODO: Thêm hàm updateChapter nếu cần
  // static async updateChapter(db, chapterId, updateData) { ... }

  // TODO: Thêm hàm tăng view
  static async incrementChapterView(db, chapterId) {
    try {
      await db
        .collection(chapterCollection)
        .updateOne({ _id: new ObjectId(chapterId) }, { $inc: { views: 1 } });
    } catch (error) {
      // Lỗi tăng view thường không nghiêm trọng, chỉ cần log lại
      console.error(
        `Failed to increment view count for chapter ${chapterId}:`,
        error
      );
    }
  }
}

module.exports = Chapter;
