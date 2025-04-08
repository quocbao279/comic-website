const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");

// Controller imports
const ComicsController = require("../controllers/admin/comicsController");
const {
  uploadComicCover,
  uploadChapterPages,
} = require("../middleware/upload");
const AdminController = require("../controllers/admin/adminController");
const UsersController = require("../controllers/admin/usersController");
const RolesController = require("../controllers/admin/rolesController");
const GenresController = require("../controllers/admin/genresController");
const { authMiddleware, roleMiddleware } = require("../middleware/auth");

//Middleware for admin
router.use(authMiddleware);
router.use(roleMiddleware("admin"));

//Dashboard
router.get("/", AdminController.getAdminDashboard);
router.get("/dashboard", AdminController.getAdminDashboard);

//User management
router.get("/users", UsersController.getAllUsers);
router.get("/users/create", UsersController.getCreateUserForm);
router.post("/users", UsersController.createUser);
router.get("/users/edit/:id", UsersController.getUser);
router.post("/users/edit/:id", UsersController.updateUser);
router.post("/users/delete/:id", UsersController.deleteUser);

//Comic management
router.get("/comics", ComicsController.getAllComics);
router.get("/comics/create", ComicsController.getCreateComicForm);

router.post("/comics", uploadComicCover, ComicsController.createComic);
router.get("/comics/edit/:id", ComicsController.getEditComicForm);

router.post("/comics/edit/:id", uploadComicCover, ComicsController.updateComic);
router.post("/comics/delete/:id", ComicsController.deleteComic);

//Chapter management
router.get("/comics/:comicId/chapters/new", ComicsController.getAddChapterForm);
router.post(
  "/comics/:comicId/chapters",
  uploadChapterPages,
  ComicsController.createChapter
);
router.get("/chapters/:chapterId/edit", ComicsController.getEditChapterForm);
router.post("/chapters/:chapterId/edit", ComicsController.updateChapter);
router.post("/chapters/:chapterId/delete", ComicsController.deleteChapter);

//Role management
router.get("/roles", RolesController.getAllRoles);
router.get("/roles/create", RolesController.getCreateRoleForm);
router.post("/roles", RolesController.createRole);
router.get("/roles/edit/:id", RolesController.getEditRoleForm);
router.post("/roles/edit/:id", RolesController.updateRole);
router.post("/roles/delete/:id", RolesController.deleteRole);

//Genre management
router.get("/genres", GenresController.getAllGenres);
router.get("/genres/create", GenresController.getCreateGenreForm);
router.post("/genres", GenresController.createGenre);
router.get("/genres/edit/:id", GenresController.getEditGenreForm);
router.post("/genres/edit/:id", GenresController.updateGenre);
router.post("/genres/delete/:id", GenresController.deleteGenre);

module.exports = router;
