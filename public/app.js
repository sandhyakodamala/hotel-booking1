const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

const state = {
  movies: [],
  genre: "All",
  search: "",
  selectedMovieId: "",
  selectedShowtimeId: "",
  selectedSeats: [],
  seats: [],
  reservedSeats: new Set(),
  isBooking: false
};

const elements = {
  movieGrid: document.querySelector("#movieGrid"),
  movieCount: document.querySelector("#movieCount"),
  genreFilters: document.querySelector("#genreFilters"),
  searchInput: document.querySelector("#searchInput"),
  selectedMovie: document.querySelector("#selectedMovie"),
  selectedFormat: document.querySelector("#selectedFormat"),
  showtimeGrid: document.querySelector("#showtimeGrid"),
  seatMap: document.querySelector("#seatMap"),
  seatCounter: document.querySelector("#seatCounter"),
  totalAmount: document.querySelector("#totalAmount"),
  bookingForm: document.querySelector("#bookingForm"),
  bookButton: document.querySelector("#bookButton"),
  toast: document.querySelector("#toast"),
  confirmationModal: document.querySelector("#confirmationModal"),
  confirmationTitle: document.querySelector("#confirmationTitle"),
  confirmationDetails: document.querySelector("#confirmationDetails"),
  closeModal: document.querySelector("#closeModal"),
  doneButton: document.querySelector("#doneButton"),
  printTicket: document.querySelector("#printTicket")
};

async function requestJson(url, options) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }

  return payload;
}

function selectedMovie() {
  return state.movies.find((movie) => movie.id === state.selectedMovieId);
}

function selectedShowtime() {
  return selectedMovie()?.showtimes.find((showtime) => showtime.id === state.selectedShowtimeId);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2600);
}

function genres() {
  return ["All", ...new Set(state.movies.map((movie) => movie.genre))];
}

function filteredMovies() {
  const query = state.search.trim().toLowerCase();
  return state.movies.filter((movie) => {
    const matchesGenre = state.genre === "All" || movie.genre === state.genre;
    const haystack = `${movie.title} ${movie.genre} ${movie.language}`.toLowerCase();
    return matchesGenre && (!query || haystack.includes(query));
  });
}

function renderFilters() {
  elements.genreFilters.replaceChildren(
    ...genres().map((genre) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `filter-button${genre === state.genre ? " is-active" : ""}`;
      button.textContent = genre;
      button.addEventListener("click", () => {
        state.genre = genre;
        render();
      });
      return button;
    })
  );
}

function renderMovieGrid() {
  const movies = filteredMovies();
  elements.movieCount.textContent = `${movies.length} movie${movies.length === 1 ? "" : "s"}`;

  if (!movies.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No movies match your search.";
    elements.movieGrid.replaceChildren(empty);
    return;
  }

  elements.movieGrid.replaceChildren(
    ...movies.map((movie) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = `movie-card${movie.id === state.selectedMovieId ? " is-active" : ""}`;
      card.innerHTML = `
        <img src="${movie.poster}" alt="${movie.title} poster" />
        <span>
          <h3>${movie.title}</h3>
          <span class="movie-meta">
            <span>${movie.genre}</span>
            <span>${movie.rating}</span>
            <span>${movie.duration}</span>
          </span>
          <p>${movie.synopsis}</p>
          <span class="movie-price">
            <span>${money.format(movie.price)}</span>
            <span>${movie.language}</span>
          </span>
        </span>
      `;
      card.addEventListener("click", () => selectMovie(movie.id));
      return card;
    })
  );
}

function renderSelectedMovie() {
  const movie = selectedMovie();
  if (!movie) {
    elements.selectedMovie.textContent = "";
    return;
  }

  elements.selectedMovie.innerHTML = `
    <img class="selected-poster" src="${movie.poster}" alt="${movie.title} poster" />
    <div class="selected-copy">
      <h3>${movie.title}</h3>
      <p>${movie.screen} • ${movie.language} • ${movie.duration}</p>
      <div class="tag-row">
        ${movie.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderShowtimes() {
  const movie = selectedMovie();
  const showtime = selectedShowtime();
  elements.selectedFormat.textContent = showtime ? showtime.format : "";

  if (!movie) {
    elements.showtimeGrid.textContent = "";
    return;
  }

  elements.showtimeGrid.replaceChildren(
    ...movie.showtimes.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `showtime-button${item.id === state.selectedShowtimeId ? " is-active" : ""}`;
      button.innerHTML = `${item.label}<span>${item.format}</span>`;
      button.addEventListener("click", () => selectShowtime(item.id));
      return button;
    })
  );
}

function renderSeats() {
  const nodes = [];
  let currentRow = "";

  state.seats.forEach((seat) => {
    const row = seat.slice(0, 1);
    if (row !== currentRow) {
      currentRow = row;
      const label = document.createElement("span");
      label.className = "row-label";
      label.textContent = row;
      nodes.push(label);
    }

    const isReserved = state.reservedSeats.has(seat);
    const isSelected = state.selectedSeats.includes(seat);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `seat${isReserved ? " is-reserved" : ""}${isSelected ? " is-selected" : ""}`;
    button.textContent = seat.replace(row, "");
    button.disabled = isReserved;
    button.setAttribute("aria-label", `${seat}${isReserved ? " booked" : ""}`);
    button.addEventListener("click", () => toggleSeat(seat));
    nodes.push(button);
  });

  elements.seatMap.replaceChildren(...nodes);
}

function renderSummary() {
  const movie = selectedMovie();
  const total = movie ? movie.price * state.selectedSeats.length : 0;
  const seatLabel =
    state.selectedSeats.length === 0
      ? "0 selected"
      : `${state.selectedSeats.length} selected: ${state.selectedSeats.join(", ")}`;

  elements.seatCounter.textContent = seatLabel;
  elements.totalAmount.textContent = money.format(total);
  elements.bookButton.disabled = state.isBooking || !movie || !state.selectedShowtimeId || !state.selectedSeats.length;
  elements.bookButton.textContent = state.isBooking ? "Booking..." : "Confirm booking";
}

function render() {
  renderFilters();
  renderMovieGrid();
  renderSelectedMovie();
  renderShowtimes();
  renderSeats();
  renderSummary();
}

async function selectMovie(movieId) {
  const movie = state.movies.find((item) => item.id === movieId);
  if (!movie) {
    return;
  }

  state.selectedMovieId = movie.id;
  state.selectedShowtimeId = movie.showtimes[0]?.id || "";
  state.selectedSeats = [];
  render();
  await loadSeats();
}

async function selectShowtime(showtimeId) {
  state.selectedShowtimeId = showtimeId;
  state.selectedSeats = [];
  render();
  await loadSeats();
}

function toggleSeat(seat) {
  if (state.reservedSeats.has(seat)) {
    return;
  }

  if (state.selectedSeats.includes(seat)) {
    state.selectedSeats = state.selectedSeats.filter((item) => item !== seat);
  } else {
    if (state.selectedSeats.length >= 8) {
      showToast("You can book up to 8 seats at once.");
      return;
    }
    state.selectedSeats = [...state.selectedSeats, seat];
  }

  renderSeats();
  renderSummary();
}

async function loadSeats() {
  const movieId = state.selectedMovieId;
  const showtimeId = state.selectedShowtimeId;
  if (!movieId || !showtimeId) {
    return;
  }

  try {
    const payload = await requestJson(`/api/seats?movieId=${movieId}&showtimeId=${showtimeId}`);
    state.seats = payload.seats;
    state.reservedSeats = new Set(payload.reservedSeats);
    renderSeats();
    renderSummary();
  } catch (error) {
    showToast(error.message);
  }
}

function showConfirmation(booking) {
  elements.confirmationTitle.textContent = `${booking.movieTitle} - ${booking.seats.join(", ")}`;
  elements.confirmationDetails.innerHTML = `
    <span><strong>Booking ID:</strong> ${booking.id}</span>
    <span><strong>Showtime:</strong> ${booking.showtimeLabel}</span>
    <span><strong>Screen:</strong> ${booking.screen}</span>
    <span><strong>Guest:</strong> ${booking.customer.name}</span>
    <span><strong>Total:</strong> ${money.format(booking.amount)}</span>
  `;
  elements.confirmationModal.classList.remove("is-hidden");
}

function closeConfirmation() {
  elements.confirmationModal.classList.add("is-hidden");
}

async function submitBooking(event) {
  event.preventDefault();

  const movie = selectedMovie();
  const showtime = selectedShowtime();
  if (!movie || !showtime || !state.selectedSeats.length) {
    showToast("Choose seats before confirming.");
    return;
  }

  const formData = new FormData(elements.bookingForm);
  state.isBooking = true;
  renderSummary();

  try {
    const payload = await requestJson("/api/bookings", {
      method: "POST",
      body: JSON.stringify({
        movieId: movie.id,
        showtimeId: showtime.id,
        seats: state.selectedSeats,
        customer: {
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone")
        }
      })
    });

    state.selectedSeats = [];
    await loadSeats();
    elements.bookingForm.reset();
    showConfirmation(payload.booking);
  } catch (error) {
    showToast(error.message);
  } finally {
    state.isBooking = false;
    renderSummary();
  }
}

async function init() {
  try {
    const payload = await requestJson("/api/movies");
    state.movies = payload.movies;
    state.selectedMovieId = state.movies[0]?.id || "";
    state.selectedShowtimeId = state.movies[0]?.showtimes[0]?.id || "";
    render();
    await loadSeats();
  } catch (error) {
    showToast(error.message);
  }
}

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  renderMovieGrid();
});
elements.bookingForm.addEventListener("submit", submitBooking);
elements.closeModal.addEventListener("click", closeConfirmation);
elements.doneButton.addEventListener("click", closeConfirmation);
elements.printTicket.addEventListener("click", () => window.print());
elements.confirmationModal.addEventListener("click", (event) => {
  if (event.target === elements.confirmationModal) {
    closeConfirmation();
  }
});

init();
