const DatabaseConnection = require("../database/database");
const User = require("../models/user");
const { ObjectId } = require("mongodb");

const authMiddleware = async (req, res, next) => {
  console.log("DEBUG: Running authMiddleware for:", req.originalUrl);
  if (!req.session || !req.session.userId) {
    console.log(
      "AuthMiddleware: No session/userId found, redirecting to login."
    );
    return res.redirect("/login");
  }

  try {
    const db = DatabaseConnection.getDb();
    const userId = new ObjectId(req.session.userId);

    const user = await User.findUserById(db, userId);
    if (!user) {
      console.log(
        `AuthMiddleware: User not found in DB with ID: ${req.session.userId}. Destroying session.`
      );
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
          return next(err);
        }
        res.clearCookie("connect.sid");
        return res.redirect("/login");
      });
    } else {
      req.user = {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      };
      console.log(`DEBUG: AuthMiddleware PASSED for ${req.user.username}`);
      console.log(
        `AuthMiddleware: User authenticated: ${user.username} (${user.role})`
      );
      next();
    }
  } catch (error) {
    console.error("AuthMiddleware Error:", error);
    next(error);
  }
};

const roleMiddleware = (allowedRoles) => {
  const rolesSet = new Set(
    Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  );

  return (req, res, next) => {
    console.log(
      `DEBUG: Running roleMiddleware ('${[...rolesSet].join(",")}') for:`,
      req.originalUrl,
      "User role:",
      req.user?.role
    );

    if (!req.user || !req.user.role) {
      console.warn(
        "RoleMiddleware: req.user or req.user.role not found. Ensure authMiddleware runs first."
      );
      return res.status(401).render("error", {
        title: "Unauthorized",
        message: "Authentication required.",
      });
    }

    if (!rolesSet.has(req.user.role)) {
      console.warn(
        `RoleMiddleware: Forbidden access for role "${
          req.user.role
        }". Allowed: ${[...rolesSet].join(", ")}. Path: ${req.originalUrl}`
      );
      return res.status(403).render("error", {
        title: "Forbidden",
        message: "You do not have permission to access this resource.",
      });
    }
    next();
  };
};

module.exports = { authMiddleware, roleMiddleware };
