const DatabaseConnection = require("../database/database");
const { ObjectId } = require("mongodb");
const { set, get } = require("../cache/cache");

const CACHE_KEY_LATEST_COMICS = "latestComics";
const CACHE_TTL_LATEST_COMICS = 60000;

class HomeController {
  static async getHomePage(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      let latestComics = get(CACHE_KEY_LATEST_COMICS);
      if (latestComics) {
        console.log("Serving latest comics from cache.");
      } else {
        console.log("Fetching latest comics from DB...");
        latestComics = await db
          .collection("comics")
          .find({
            /* Filter nếu cần */
          })
          .sort({ updatedAt: -1 })
          .limit(12)
          .project({
            title: 1,
            imageUrl: 1,
            genres: 1,
            slug: 1,
            _id: 1,
            createdAt: 1,
            updatedAt: 1,
            status: 1,
            rating: 1,
          })
          .toArray();
        set(CACHE_KEY_LATEST_COMICS, latestComics, CACHE_TTL_LATEST_COMICS);
        console.log("Latest comics cached.");
      }
      const completedComics = await db
        .collection("comics")
        .find({ status: "completed" })
        .sort({ updatedAt: -1 })
        .limit(6)
        .project({
          title: 1,
          imageUrl: 1,
          genres: 1,
          slug: 1,
          _id: 1,
          rating: 1,
          status: 1,
        })
        .toArray();

      res.render("index", {
        title: "Trang Chủ - ReadiWeb",
        latestComics: latestComics,
        completedComics: completedComics,
      });
    } catch (error) {
      console.error("Error getting home page data:", error);
      next(error);
    }
  }
  static async getComicDetail(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const comicIdentifier = req.params.idOrSlug;
      let comic;
      if (ObjectId.isValid(comicIdentifier)) {
        try {
          comic = await db
            .collection("comics")
            .findOne({ _id: new ObjectId(comicIdentifier) });
        } catch (e) {
          console.log("Lỗi đã xảy ra", e);
        }
      }
      if (!comic) {
        comic = await db
          .collection("comics")
          .findOne({ slug: comicIdentifier });
      }
      if (!comic) {
        return res.status(404).render("error", {
          title: "404 Not Found",
          message: "Truyện không tồn tại.",
        });
      }
      db.collection("comics").updateOne(
        { _id: comic._id },
        { $inc: { views: 1 } }
      );
      const chapters = await db
        .collection("chapters")
        .find({ comicId: comic._id })
        .sort({ chapterNumber: 1 })
        .project({ comicId: 0 })
        .toArray();
      res.render("comics/detail", {
        title: comic.title,
        comic: comic,
        chapters: chapters,
      });
    } catch (error) {
      console.error(
        `Error getting comic detail for "${req.params.idOrSlug}":`,
        error
      );
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        return res.status(400).render("error", {
          title: "Bad Request",
          message: "ID truyện không hợp lệ.",
        });
      }
      next(error);
    }
  }
  static async readChapter(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const comicIdentifier = req.params.idOrSlug;
      const chapterNumber = parseInt(req.params.chapterNumber, 10);

      if (isNaN(chapterNumber) || chapterNumber <= 0) {
        return res.status(400).render("error", {
          title: "Bad Request",
          message: "Số chương không hợp lệ.",
        });
      }
      let comic;
      const comicQuery = ObjectId.isValid(comicIdentifier)
        ? { _id: new ObjectId(comicIdentifier) }
        : { slug: comicIdentifier };
      comic = await db
        .collection("comics")
        .findOne(comicQuery, { projection: { _id: 1, title: 1, slug: 1 } });

      if (!comic) {
        return res.status(404).render("error", {
          title: "Not Found",
          message: "Truyện không tồn tại.",
        });
      }
      // Tìm chapter cụ thể
      const chapter = await db.collection("chapters").findOne({
        comicId: comic._id,
        chapterNumber: chapterNumber,
      });
      if (!chapter) {
        return res.status(404).render("error", {
          title: "Not Found",
          message: `Chương ${chapterNumber} không tồn tại cho truyện này.`,
        });
      }
      // Tăng lượt xem chapter
      db.collection("chapters").updateOne(
        { _id: chapter._id },
        { $inc: { views: 1 } }
      );
      // Lấy chapter trước/sau
      const prevChapter = await db
        .collection("chapters")
        .findOne(
          { comicId: comic._id, chapterNumber: chapterNumber - 1 },
          { projection: { chapterNumber: 1 } }
        );
      const nextChapter = await db
        .collection("chapters")
        .findOne(
          { comicId: comic._id, chapterNumber: chapterNumber + 1 },
          { projection: { chapterNumber: 1 } }
        );

      res.render("comics/read", {
        title: `${comic.title} - Chapter ${chapterNumber}`,
        comic: comic,
        chapter: chapter,
        prevChapterNum: prevChapter ? prevChapter.chapterNumber : null,
        nextChapterNum: nextChapter ? nextChapter.chapterNumber : null,
      });
    } catch (error) {
      console.error(
        `Error reading chapter <span class="math-inline">\{req\.params\.chapterNumber\} for comic "</span>{req.params.idOrSlug}":`,
        error
      );
      if (error instanceof require("mongodb").BSON.BSONTypeError) {
        return res.status(400).render("error", {
          title: "Bad Request",
          message: "ID truyện không hợp lệ.",
        });
      }
      next(error);
    }
  }
  static async getProfilePage(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id;
      console.log(`DEBUG: getProfilePage for userId: ${userId}`);
      const userProfile = await db
        .collection("users")
        .findOne({ _id: userId }, { projection: { password: 0 } });
      console.log("DEBUG: Fetched userProfile:", userProfile);
      if (!userProfile) {
        req.session.message = {
          type: "error",
          text: "Không tìm thấy thông tin người dùng.",
        };
        return res.redirect("/logout");
      }

      // Lấy danh sách truyện đã bookmark
      let bookmarkedComics = [];
      let bookmarkIds = [];
      if (
        userProfile.bookmarks &&
        Array.isArray(userProfile.bookmarks) &&
        userProfile.bookmarks.length > 0
      ) {
        console.log("DEBUG: userProfile.bookmarks:", userProfile.bookmarks);
        try {
          bookmarkIds = userProfile.bookmarks
            .map((id) => {
              try {
                return new ObjectId(id);
              } catch (e) {
                console.warn(
                  `DEBUG: Invalid ObjectId found in bookmarks: ${id}`
                );
                return null;
              }
            })
            .filter((id) => id !== null);
          console.log("DEBUG: Valid bookmark ObjectIds:", bookmarkIds);

          if (bookmarkIds.length > 0) {
            bookmarkedComics = await db
              .collection("comics")
              .find({
                _id: { $in: bookmarkIds },
              })
              .project({
                title: 1,
                imageUrl: 1,
                slug: 1,
                genres: 1,
                status: 1,
                _id: 1,
              })
              .toArray();
          }
        } catch (mapError) {
          console.error("DEBUG: Error processing bookmark IDs:", mapError);
        }
      }
      console.log("DEBUG: Found bookmarkedComics:", bookmarkedComics);

      // Render view
      console.log(
        "DEBUG: Rendering Profile view with userProfile and bookmarkedComics"
      );
      res.render("Profile", {
        title: `Hồ sơ của ${userProfile.username}`,
        userProfile: userProfile,
        bookmarkedComics: bookmarkedComics,
      });
    } catch (error) {
      console.error("Error getting profile page:", error);
      next(error);
    }
  }
  static async updateProfile(req, res, next) {
    try {
      req.session.message = {
        type: "success",
        text: "Profile updated successfully! (Logic chưa hoàn thiện)",
      };
      res.redirect("/profile");
    } catch (error) {
      console.error("Error updating profile:", error);
      req.session.message = {
        type: "error",
        text: `Error updating profile: ${error.message}`,
      };
      res.redirect("/profile");
      // next(error);
    }
  }
  static async getBookmarksPage(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const userWithBookmarks = await db
        .collection("users")
        .findOne({ _id: req.user._id }, { projection: { bookmarks: 1 } });
      let bookmarkedComics = [];
      if (
        userWithBookmarks &&
        userWithBookmarks.bookmarks &&
        userWithBookmarks.bookmarks.length > 0
      ) {
        bookmarkedComics = await db
          .collection("comics")
          .find({
            _id: { $in: userWithBookmarks.bookmarks },
          })
          .project({ title: 1, imageUrl: 1, slug: 1, genres: 1, status: 1 })
          .toArray();
      }
      res.render("Bookmarks", {
        title: "Truyện Đã Lưu",
        bookmarks: bookmarkedComics,
      });
    } catch (error) {
      console.error("Error getting bookmarks page:", error);
      next(error);
    }
  }

  static async addBookmark(req, res, next) {
    const comicIdParam = req.params.comicId;
    const userId = req.user._id;
    let comicObjectId;
    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      return res
        .status(400)
        .json({ success: false, message: "ID Truyện không hợp lệ." });
    }

    try {
      const db = DatabaseConnection.getDb();
      const result = await db
        .collection("users")
        .updateOne(
          { _id: userId },
          { $addToSet: { bookmarks: comicObjectId } }
        );

      if (result.matchedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy người dùng." });
      } else if (result.modifiedCount === 0) {
        return res.json({
          success: true,
          message: "Truyện đã có trong danh sách bookmark.",
        });
      } else {
        console.log(`User ${userId} bookmarked comic ${comicIdParam}`);
        return res.json({
          success: true,
          message: "Đã thêm truyện vào bookmark thành công!",
        });
      }
    } catch (error) {
      console.error(
        `Error adding bookmark for user ${userId}, comic ${comicIdParam}:`,
        error
      );
      return res
        .status(500)
        .json({ success: false, message: "Lỗi server khi thêm bookmark." });
    }
  }

  static async removeBookmark(req, res, next) {
    const comicIdParam = req.params.comicId;
    const userId = req.user._id;
    let comicObjectId;
    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      if (req.accepts("html")) {
        req.session.message = {
          type: "error",
          text: "ID Truyện không hợp lệ.",
        };
        return res.redirect(req.headers.referer || "/bookmarks");
      } else {
        return res
          .status(400)
          .json({ success: false, message: "ID Truyện không hợp lệ." });
      }
    }

    try {
      const db = DatabaseConnection.getDb();
      const result = await db
        .collection("users")
        .updateOne({ _id: userId }, { $pull: { bookmarks: comicObjectId } });

      if (result.matchedCount === 0) {
        if (req.accepts("html")) {
          req.session.message = {
            type: "error",
            text: "Không tìm thấy người dùng.",
          };
          return res.redirect(req.headers.referer || "/bookmarks");
        } else {
          return res
            .status(404)
            .json({ success: false, message: "Không tìm thấy người dùng." });
        }
      } else if (result.modifiedCount === 0) {
        if (req.accepts("html")) {
          req.session.message = {
            type: "warning",
            text: "Truyện này không có trong bookmark của bạn.",
          };
          return res.redirect(req.headers.referer || "/bookmarks");
        } else {
          return res.json({
            success: false,
            message: "Truyện không có trong bookmark.",
          });
        }
      } else {
        console.log(
          `User ${userId} removed bookmark for comic ${comicIdParam}`
        );
        if (req.accepts("html")) {
          req.session.message = {
            type: "success",
            text: "Đã xóa truyện khỏi bookmark!",
          };
          return res.redirect(req.headers.referer || "/bookmarks");
        } else {
          return res.json({
            success: true,
            message: "Đã xóa truyện khỏi bookmark!",
          });
        }
      }
    } catch (error) {
      console.error(
        `Error removing bookmark for user ${userId}, comic ${comicIdParam}:`,
        error
      );
      if (req.accepts("html")) {
        req.session.message = {
          type: "error",
          text: "Lỗi server khi xóa bookmark.",
        };
        return res.redirect(req.headers.referer || "/bookmarks");
      } else {
        return res
          .status(500)
          .json({ success: false, message: "Lỗi server khi xóa bookmark." });
      }
      // next(error)
    }
  }
  static async getLatestUpdatesPage(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const recentUpdates = await db
        .collection("comics")
        .find({})
        .sort({ updatedAt: -1 })
        .limit(20)
        .project({
          title: 1,
          imageUrl: 1,
          slug: 1,
          genres: 1,
          updatedAt: 1,
        })
        .toArray();

      res.render("lastUpdate", {
        title: "Cập Nhật Mới Nhất",
        updates: recentUpdates,
      });
    } catch (error) {
      console.error("Error getting latest updates page:", error);
      next(error);
    }
  }

  static async getComicsByGenre(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const genreSlug = req.params.genreSlug;
      const genreName = genreSlug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
      const comicsInGenre = await db
        .collection("comics")
        .find({ genres: { $regex: new RegExp("^" + genreName + "$", "i") } })
        .sort({ title: 1 })
        .limit(20)
        .project({ title: 1, imageUrl: 1, slug: 1, genres: 1, status: 1 })
        .toArray();

      res.render("genre", {
        title: `Thể loại: ${genreName}`,
        genreName: genreName,
        comics: comicsInGenre,
      });
    } catch (error) {
      console.error(
        `Error getting comics for genre ${req.params.genreSlug}:`,
        error
      );
      next(error);
    }
  }
}

module.exports = HomeController;
