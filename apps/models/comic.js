module.exports = {
  collection: "comics",
  getComicObject({
    title,
    author,
    description,
    genres = [],
    uploader,
    imageUrl = "",
    chapters = [],
  }) {
    return {
      title,
      author,
      description,
      genres,
      uploader,
      imageUrl,
      chapters,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};
