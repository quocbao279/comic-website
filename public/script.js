document.addEventListener("DOMContentLoaded", () => {
  const track = document.querySelector(".carousel-track");
  const slides = Array.from(document.querySelectorAll(".carousel-slide"));
  const nextButton = document.querySelector(".next-button");
  const prevButton = document.querySelector(".prev-button");
  const indicators = Array.from(
    document.querySelectorAll(".carousel-indicator")
  );

  let slideWidth = slides[0].getBoundingClientRect().width;
  let slideIndex = 0;
  let slidesPerView = getViewableSlides();
  const totalSlides = slides.length;

  // Initialize slider
  function initSlider() {
    // Set width based on number of slides and width of container
    slides.forEach((slide) => {
      slide.style.width = `${slideWidth}px`;
    });

    updateSlidePosition();
  }

  // Get number of viewable slides based on screen width
  function getViewableSlides() {
    if (window.innerWidth > 992) {
      return 3;
    } else if (window.innerWidth > 768) {
      return 2;
    } else {
      return 1;
    }
  }

  // Update slide position
  function updateSlidePosition() {
    track.style.transform = `translateX(-${slideIndex * slideWidth}px)`;

    // Update indicators
    indicators.forEach((indicator, index) => {
      if (index === Math.floor(slideIndex / slidesPerView)) {
        indicator.classList.add("active");
      } else {
        indicator.classList.remove("active");
      }
    });
  }

  // Move to next slide
  function moveToNextSlide() {
    if (slideIndex >= totalSlides - slidesPerView) {
      slideIndex = 0;
    } else {
      slideIndex++;
    }
    updateSlidePosition();
  }

  // Move to previous slide
  function moveToPrevSlide() {
    if (slideIndex <= 0) {
      slideIndex = totalSlides - slidesPerView;
    } else {
      slideIndex--;
    }
    updateSlidePosition();
  }

  // Move to specific slide via indicators
  function moveToSlide(index) {
    slideIndex = index * slidesPerView;
    if (slideIndex > totalSlides - slidesPerView) {
      slideIndex = totalSlides - slidesPerView;
    }
    updateSlidePosition();
  }

  // Event Listeners
  nextButton.addEventListener("click", moveToNextSlide);
  prevButton.addEventListener("click", moveToPrevSlide);

  indicators.forEach((indicator, index) => {
    indicator.addEventListener("click", () => {
      moveToSlide(index);
    });
  });

  // Handle resize
  window.addEventListener("resize", () => {
    const newSlidesPerView = getViewableSlides();

    if (newSlidesPerView !== slidesPerView) {
      slidesPerView = newSlidesPerView;
      slideIndex = 0;
    }

    slideWidth = slides[0].getBoundingClientRect().width;
    updateSlidePosition();
  });

  // Auto slide every 5 seconds
  setInterval(moveToNextSlide, 5000);

  // Initialize the slider
  initSlider();
});
// Mobile menu toggle
const menuIcon = document.querySelector(".menu-icon");
const navLinks = document.querySelector(".nav-links");

menuIcon.addEventListener("click", () => {
  navLinks.classList.toggle("active");
});

// For mobile dropdown menus
if (window.innerWidth <= 768) {
  const dropdowns = document.querySelectorAll(".dropdown");

  dropdowns.forEach((dropdown) => {
    dropdown.addEventListener("click", (e) => {
      dropdown.classList.toggle("active");
      e.stopPropagation();
    });
  });
}
