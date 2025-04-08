const { ObjectId } = require("mongodb");
const chapterCollection = "chapters";
class Chapter {
  /**
   * @param {import('mongodb').Db} db - Đối tượng database đã kết nối.
   * @param {object} chapterData - Dữ liệu chapter { comicId, chapterNumber, title, pages, uploaderId }.
   * @returns {Promise<import('mongodb').InsertOneResult>} Kết quả từ insertOne.
   */
  static async createChapter(
    db,
    { comicId, chapterNumber, title, pages, uploaderId }
  ) {
    const newChapter = {
      comicId: new ObjectId(comicId),
      chapterNumber: parseFloat(chapterNumber) || 0,
      title: title || null,
      pages: Array.isArray(pages) ? pages : [],
      uploaderId: uploaderId ? new ObjectId(uploaderId) : null,
      views: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return await db.collection(chapterCollection).insertOne(newChapter);
  }
  /**
   * @param {import('mongodb').Db} db - Đối tượng database.
   * @param {string|ObjectId} comicId - ID của truyện.
   * @returns {Promise<Array<object>>} Mảng các document chapter.
   */
  static async findChaptersByComicId(db, comicId) {
    const query = { comicId: new ObjectId(comicId) };
    return await db
      .collection(chapterCollection)
      .find(query)
      .sort({ chapterNumber: 1 })
      .toArray();
  }

  /**
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
   * @param {import('mongodb').Db} db
   * @param {ObjectId} comicId
   * @param {number} currentChapterNumber
   * @returns {Promise<{prevChapterNum: number|null, nextChapterNum: number|null}>}
   */
  static async findPrevNextChapterNumbers(db, comicId, currentChapterNumber) {
    const num = parseFloat(currentChapterNumber) || 0;
    const comicObjectId = new ObjectId(comicId);

    const prevChapter = await db
      .collection(chapterCollection)
      .findOne(
        { comicId: comicObjectId, chapterNumber: { $lt: num } },
        { sort: { chapterNumber: -1 }, projection: { chapterNumber: 1 } }
      );
    const nextChapter = await db
      .collection(chapterCollection)
      .findOne(
        { comicId: comicObjectId, chapterNumber: { $gt: num } },
        { sort: { chapterNumber: 1 }, projection: { chapterNumber: 1 } }
      );

    return {
      prevChapterNum: prevChapter ? prevChapter.chapterNumber : null,
      nextChapterNum: nextChapter ? nextChapter.chapterNumber : null,
    };
  }

  /**
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
   * @param {import('mongodb').Db} db
   * @param {string|ObjectId} comicId
   * @returns {Promise<import('mongodb').DeleteResult>}
   */
  static async deleteChaptersByComicId(db, comicId) {
    console.warn(`Deleting all chapters for comicId: ${comicId}`);
    return await db
      .collection(chapterCollection)
      .deleteMany({ comicId: new ObjectId(comicId) });
  }

  static async incrementChapterView(db, chapterId) {
    try {
      await db
        .collection(chapterCollection)
        .updateOne({ _id: new ObjectId(chapterId) }, { $inc: { views: 1 } });
    } catch (error) {
      console.error(
        `Failed to increment view count for chapter ${chapterId}:`,
        error
      );
    }
  }
}

module.exports = Chapter;
