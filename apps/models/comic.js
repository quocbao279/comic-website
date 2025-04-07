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
      genres, // array of genre names
      uploader, // uploader user ID
      imageUrl,
      chapters, // array of chapters { title, pages: [img1, img2,...] }
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  },
};
