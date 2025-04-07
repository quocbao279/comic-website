// File: apps/controllers/homeController.js
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
          .sort({ updatedAt: -1 }) //Sắp xếp theo updatedAt (ngày cập nhật) thì hợp lý hơn createdAt cho truyện mới
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
          }) // Lấy thêm các trường cần hiển thị
          .toArray();
        set(CACHE_KEY_LATEST_COMICS, latestComics, CACHE_TTL_LATEST_COMICS);
        console.log("Latest comics cached.");
      }
      // Lấy thêm completed comics ví dụ
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
        // Render view index.ejs
        title: "Trang Chủ - ReadiWeb",
        latestComics: latestComics,
        completedComics: completedComics, // Truyền completedComics
      });
    } catch (error) {
      console.error("Error getting home page data:", error);
      next(error);
    }
  }
  // Xem chi tiết truyện
  static async getComicDetail(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const comicIdentifier = req.params.idOrSlug;
      let comic;

      // Ưu tiên tìm bằng ObjectId nếu hợp lệ
      if (ObjectId.isValid(comicIdentifier)) {
        try {
          comic = await db
            .collection("comics")
            .findOne({ _id: new ObjectId(comicIdentifier) });
        } catch (e) {
          /* Bỏ qua lỗi ObjectId không hợp lệ */
        }
      }
      // Nếu không tìm thấy bằng ID hoặc identifier không phải ID, thử tìm bằng slug
      if (!comic) {
        comic = await db
          .collection("comics")
          .findOne({ slug: comicIdentifier });
      }
      if (!comic) {
        // Dùng return để dừng hàm sau khi render lỗi
        return res.status(404).render("error", {
          title: "404 Not Found",
          message: "Truyện không tồn tại.",
        });
      }
      // Tăng lượt xem (không cần await)
      db.collection("comics").updateOne(
        { _id: comic._id },
        { $inc: { views: 1 } }
      );
      // Lấy danh sách chapters (Giả định collection 'chapters')
      // Cần tạo collection chapters với các trường: comicId (ObjectId), chapterNumber (Number), title (String, optional), pages (Array of String URLs), createdAt, views
      const chapters = await db
        .collection("chapters")
        .find({ comicId: comic._id })
        .sort({ chapterNumber: 1 }) // Sắp xếp tăng dần theo số chương
        .project({ comicId: 0 }) // Không cần lấy lại comicId
        .toArray();

      res.render("comics/detail", {
        // Render view detail mới
        title: comic.title,
        comic: comic,
        chapters: chapters, // Truyền danh sách chương
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
  // Đọc chương
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
      // Tìm truyện trước
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
        // Render view read mới
        title: `${comic.title} - Chapter ${chapterNumber}`,
        comic: comic, // Chỉ cần thông tin cơ bản của comic
        chapter: chapter, // Chứa pages array
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
  // Render trang Profile
  static async getProfilePage(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const userId = req.user._id;
      console.log(`DEBUG: getProfilePage for userId: ${userId}`); // Log 1

      // 1. Lấy thông tin user
      const userProfile = await db
        .collection("users")
        .findOne({ _id: userId }, { projection: { password: 0 } });
      console.log("DEBUG: Fetched userProfile:", userProfile); // Log 2
      if (!userProfile) {
        req.session.message = {
          type: "error",
          text: "Không tìm thấy thông tin người dùng.",
        };
        // Nếu không tìm thấy user (dù đã qua auth), có thể logout cho an toàn
        return res.redirect("/logout");
      }

      // 2. Lấy danh sách truyện đã bookmark
      let bookmarkedComics = [];
      let bookmarkIds = []; // Khởi tạo mảng bookmarkIds
      if (
        userProfile.bookmarks &&
        Array.isArray(userProfile.bookmarks) &&
        userProfile.bookmarks.length > 0
      ) {
        console.log("DEBUG: userProfile.bookmarks:", userProfile.bookmarks); // <<< Log 3 (Xem ID gốc)
        try {
          // Cẩn thận khi chuyển đổi, dùng filter để bỏ qua ID không hợp lệ
          bookmarkIds = userProfile.bookmarks
            .map((id) => {
              try {
                return new ObjectId(id); // Thử chuyển đổi
              } catch (e) {
                console.warn(
                  `DEBUG: Invalid ObjectId found in bookmarks: ${id}`
                );
                return null; // Trả về null nếu ID không hợp lệ
              }
            })
            .filter((id) => id !== null); // Lọc bỏ các giá trị null
          console.log("DEBUG: Valid bookmark ObjectIds:", bookmarkIds); // <<< Log 4 (Xem các ObjectId hợp lệ)

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
      console.log("DEBUG: Found bookmarkedComics:", bookmarkedComics); // <<< Log 5 (Xem kết quả cuối cùng)

      // 3. Render view
      console.log(
        "DEBUG: Rendering Profile view with userProfile and bookmarkedComics"
      ); // <<< Log 6
      res.render("Profile", {
        title: `Hồ sơ của ${userProfile.username}`,
        userProfile: userProfile,
        bookmarkedComics: bookmarkedComics, // Đảm bảo tên biến là bookmarkedComics
      });
    } catch (error) {
      console.error("Error getting profile page:", error);
      next(error);
    }
  }
  // Xử lý cập nhật profile (ví dụ cơ bản)
  static async updateProfile(req, res, next) {
    try {
      // TODO: Validate input (username, email, password change...)
      // TODO: Lấy dữ liệu từ req.body
      // TODO: Cập nhật vào DB (có thể gọi service hoặc model)
      // Ví dụ: const { username, email } = req.body; await updateUser(req.user._id, { username, email });
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
  // Render trang Bookmarks
  static async getBookmarksPage(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      // TODO: Lấy danh sách bookmark của user req.user._id
      // Ví dụ: Giả sử user có mảng bookmarks là [comicId1, comicId2, ...]
      const userWithBookmarks = await db
        .collection("users")
        .findOne({ _id: req.user._id }, { projection: { bookmarks: 1 } });
      let bookmarkedComics = [];
      if (
        userWithBookmarks &&
        userWithBookmarks.bookmarks &&
        userWithBookmarks.bookmarks.length > 0
      ) {
        // Lấy thông tin chi tiết các truyện đã bookmark
        bookmarkedComics = await db
          .collection("comics")
          .find({
            _id: { $in: userWithBookmarks.bookmarks }, // Tìm các truyện có _id nằm trong mảng bookmarks
          })
          .project({ title: 1, imageUrl: 1, slug: 1, genres: 1, status: 1 })
          .toArray();
      }
      res.render("Bookmarks", {
        title: "Truyện Đã Lưu",
        bookmarks: bookmarkedComics, // Truyền danh sách truyện đã bookmark
      });
    } catch (error) {
      console.error("Error getting bookmarks page:", error);
      next(error);
    }
  }
  // Xử lý thêm bookmark (API endpoint)
  static async addBookmark(req, res, next) {
    const comicIdParam = req.params.comicId;
    const userId = req.user._id; // Lấy từ authMiddleware
    let comicObjectId;

    // Validate comicId
    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      // Trả về lỗi JSON vì thường được gọi bằng fetch
      return res
        .status(400)
        .json({ success: false, message: "ID Truyện không hợp lệ." });
    }

    try {
      const db = DatabaseConnection.getDb();

      // Dùng $addToSet để thêm ID truyện vào mảng bookmarks, tránh trùng lặp
      const result = await db
        .collection("users")
        .updateOne(
          { _id: userId },
          { $addToSet: { bookmarks: comicObjectId } }
        );

      if (result.matchedCount === 0) {
        // Rất hiếm khi xảy ra nếu authMiddleware chạy đúng
        return res
          .status(404)
          .json({ success: false, message: "Không tìm thấy người dùng." });
      } else if (result.modifiedCount === 0) {
        // modifiedCount = 0 khi truyện đã có sẵn trong bookmarks ($addToSet không làm gì cả)
        return res.json({
          success: true,
          message: "Truyện đã có trong danh sách bookmark.",
        });
      } else {
        // modifiedCount = 1 -> Thêm thành công
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
      // Hoặc có thể gọi next(error) nếu muốn xử lý lỗi tập trung
    }
  }

  /**
   * POST /bookmarks/remove/:comicId
   * Xử lý xóa một comic khỏi danh sách bookmark của user hiện tại.
   * Có thể được gọi bằng fetch API hoặc submit form từ trang Bookmarks/Profile.
   */
  static async removeBookmark(req, res, next) {
    const comicIdParam = req.params.comicId;
    const userId = req.user._id; // Lấy từ authMiddleware
    let comicObjectId;

    // Validate comicId
    try {
      comicObjectId = new ObjectId(comicIdParam);
    } catch (e) {
      // Nếu request đến từ form submit (như trong Profile.ejs), nên redirect với flash
      if (req.accepts("html")) {
        req.session.message = {
          type: "error",
          text: "ID Truyện không hợp lệ.",
        };
        return res.redirect(req.headers.referer || "/bookmarks"); // Quay lại trang trước đó
      } else {
        // Nếu từ fetch API, trả về JSON
        return res
          .status(400)
          .json({ success: false, message: "ID Truyện không hợp lệ." });
      }
    }

    try {
      const db = DatabaseConnection.getDb();

      // Dùng $pull để xóa comicId khỏi mảng bookmarks
      const result = await db
        .collection("users")
        .updateOne({ _id: userId }, { $pull: { bookmarks: comicObjectId } });

      if (result.matchedCount === 0) {
        // User không tồn tại?
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
        // modifiedCount = 0 khi truyện không có trong bookmark để xóa
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
        // modifiedCount = 1 -> Xóa thành công
        console.log(
          `User ${userId} removed bookmark for comic ${comicIdParam}`
        );
        if (req.accepts("html")) {
          req.session.message = {
            type: "success",
            text: "Đã xóa truyện khỏi bookmark!",
          };
          return res.redirect(req.headers.referer || "/bookmarks"); // Quay lại trang trước đó
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
      // Hoặc có thể gọi next(error)
    }
  }
  // Render trang Cập nhật mới nhất
  static async getLatestUpdatesPage(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      // TODO: Lấy danh sách truyện/chương mới cập nhật, có thể phân trang
      // Ví dụ: Lấy 20 truyện mới cập nhật gần đây nhất
      const recentUpdates = await db
        .collection("comics")
        .find({}) // Thêm filter nếu cần
        .sort({ updatedAt: -1 })
        .limit(20)
        .project({
          title: 1,
          imageUrl: 1,
          slug: 1,
          genres: 1,
          updatedAt: 1 /*, latestChapterNum */,
        }) // Cần thông tin chapter mới nhất
        .toArray();

      res.render("lastUpdate", {
        title: "Cập Nhật Mới Nhất",
        updates: recentUpdates, // Truyền dữ liệu updates
      });
    } catch (error) {
      console.error("Error getting latest updates page:", error);
      next(error);
    }
  }

  // Render trang truyện theo thể loại
  static async getComicsByGenre(req, res, next) {
    try {
      const db = DatabaseConnection.getDb();
      const genreSlug = req.params.genreSlug; // Lấy slug từ URL
      // Cần tìm tên genre tương ứng với slug hoặc tìm trực tiếp truyện có genre đó
      const genreName = genreSlug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase()); // Chuyển slug thành tên (ví dụ)

      // Lấy truyện thuộc thể loại này, có thể phân trang
      const comicsInGenre = await db
        .collection("comics")
        .find({ genres: { $regex: new RegExp("^" + genreName + "$", "i") } }) // Tìm không phân biệt hoa thường
        .sort({ title: 1 })
        .limit(20) // Giới hạn
        .project({ title: 1, imageUrl: 1, slug: 1, genres: 1, status: 1 })
        .toArray();

      res.render("genre", {
        // <<< Cần tạo view: apps/views/genre.ejs
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
  // Thêm các hàm khác nếu cần: getLatestUpdatesPage, getComicsByGenre, getProfilePage...
  // Ví dụ:
  // static async getLatestUpdatesPage(req, res, next) { ... res.render('lastUpdate', { ... }); }
  // static async getProfilePage(req, res, next) { ... res.render('Profile', { ... }); }
  // static async getBookmarksPage(req, res, next) { ... res.render('Bookmarks', { ... }); }
}

module.exports = HomeController;
