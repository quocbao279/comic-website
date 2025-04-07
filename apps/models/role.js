module.exports = {
  collection: "roles",
  getRoleObject(name) {
    return {
      name, // "user", "uploader", "admin"
    };
  },
};
