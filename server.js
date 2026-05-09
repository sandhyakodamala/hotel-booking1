const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const BOOKINGS_FILE = process.env.BOOKINGS_FILE || path.join(DATA_DIR, "bookings.json");

const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];
const seatsPerRow = 12;
const seats = rows.flatMap((row) =>
  Array.from({ length: seatsPerRow }, (_, index) => `${row}${index + 1}`)
);

const movies = [
  {
    id: "stellar-voyage",
    title: "Stellar Voyage",
    genre: "Sci-Fi",
    rating: "UA 13+",
    duration: "2h 18m",
    language: "English",
    format: "IMAX 2D",
    screen: "Screen 1",
    price: 280,
    poster: "/assets/stellar-voyage.png",
    synopsis:
      "A flight engineer leads a rescue mission through a collapsing star route.",
    tags: ["Dolby Atmos", "Recliner"],
    showtimes: [
      { id: "stellar-evening", dayOffset: 0, time: "18:30", format: "IMAX 2D" },
      { id: "stellar-night", dayOffset: 0, time: "21:45", format: "IMAX 2D" },
      { id: "stellar-nextday", dayOffset: 1, time: "11:20", format: "Premium 2D" }
    ]
  },
  {
    id: "metro-hearts",
    title: "Metro Hearts",
    genre: "Romance",
    rating: "U",
    duration: "1h 52m",
    language: "Hindi",
    format: "2D",
    screen: "Screen 2",
    price: 220,
    poster: "/assets/metro-hearts.png",
    synopsis:
      "Two commuters keep missing each other until the city starts working in their favor.",
    tags: ["Couple Seats", "Family"],
    showtimes: [
      { id: "metro-matinee", dayOffset: 0, time: "16:50", format: "2D" },
      { id: "metro-evening", dayOffset: 0, time: "19:15", format: "2D" },
      { id: "metro-late", dayOffset: 1, time: "20:10", format: "2D" }
    ]
  },
  {
    id: "jungle-quest",
    title: "Jungle Quest",
    genre: "Adventure",
    rating: "UA 7+",
    duration: "2h 05m",
    language: "English",
    format: "3D",
    screen: "Screen 3",
    price: 260,
    poster: "/assets/jungle-quest.png",
    synopsis:
      "A cartographer and her nephew follow an impossible map into a living rainforest.",
    tags: ["3D", "Kids Favorite"],
    showtimes: [
      { id: "jungle-noon", dayOffset: 1, time: "12:40", format: "3D" },
      { id: "jungle-evening", dayOffset: 0, time: "18:05", format: "3D" },
      { id: "jungle-night", dayOffset: 1, time: "21:00", format: "3D" }
    ]
  },
  {
    id: "case-47",
    title: "Case 47",
    genre: "Thriller",
    rating: "A",
    duration: "2h 01m",
    language: "Tamil",
    format: "2D",
    screen: "Screen 4",
    price: 240,
    poster: "/assets/case-47.png",
    synopsis:
      "A retired detective returns for one closed-room mystery that refuses to stay solved.",
    tags: ["Subtitled", "Late Night"],
    showtimes: [
      { id: "case-evening", dayOffset: 0, time: "17:35", format: "2D" },
      { id: "case-late", dayOffset: 0, time: "22:20", format: "2D" },
      { id: "case-nextday", dayOffset: 1, time: "19:40", format: "2D" }
    ]
  }
];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(BOOKINGS_FILE);
  } catch {
    await fs.writeFile(BOOKINGS_FILE, "[]\n", "utf8");
  }
}

async function readBookings() {
  await ensureDataFile();
  const raw = await fs.readFile(BOOKINGS_FILE, "utf8");
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeBookings(bookings) {
  await ensureDataFile();
  await fs.writeFile(BOOKINGS_FILE, `${JSON.stringify(bookings, null, 2)}\n`, "utf8");
}

function buildShowtime(showtime) {
  const [hours, minutes] = showtime.time.split(":").map(Number);
  const date = new Date();
  date.setDate(date.getDate() + showtime.dayOffset);
  date.setHours(hours, minutes, 0, 0);

  if (date < new Date()) {
    date.setDate(date.getDate() + 1);
  }

  return {
    id: showtime.id,
    startsAt: date.toISOString(),
    label: formatShowtime(date),
    format: showtime.format
  };
}

function getMovies() {
  return movies.map((movie) => ({
    ...movie,
    showtimes: movie.showtimes.map(buildShowtime)
  }));
}

function findMovie(movieId) {
  return getMovies().find((movie) => movie.id === movieId);
}

function findShowtime(movie, showtimeId) {
  return movie?.showtimes.find((showtime) => showtime.id === showtimeId);
}

function formatShowtime(date) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((target - today) / 86400000);
  const day =
    dayDiff === 0
      ? "Today"
      : dayDiff === 1
        ? "Tomorrow"
        : date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const time = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return `${day}, ${time}`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, message) {
  sendJson(response, statusCode, { error: message });
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function getReservedSeats(bookings, movieId, showtimeId) {
  return bookings
    .filter(
      (booking) =>
        booking.movieId === movieId &&
        booking.showtimeId === showtimeId &&
        booking.status !== "cancelled"
    )
    .flatMap((booking) => booking.seats);
}

function validateCustomer(customer = {}) {
  const name = String(customer.name || "").trim();
  const email = String(customer.email || "").trim();
  const phone = String(customer.phone || "").trim();

  if (name.length < 2) {
    return "Please enter the guest name.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Please enter a valid email address.";
  }

  if (!/^[0-9+\-\s()]{7,16}$/.test(phone)) {
    return "Please enter a valid phone number.";
  }

  return "";
}

async function handleApi(request, response, pathname) {
  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && pathname === "/api/movies") {
    sendJson(response, 200, { movies: getMovies() });
    return;
  }

  if (request.method === "GET" && pathname === "/api/seats") {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const movieId = requestUrl.searchParams.get("movieId");
    const showtimeId = requestUrl.searchParams.get("showtimeId");
    const movie = findMovie(movieId);
    const showtime = findShowtime(movie, showtimeId);

    if (!movie || !showtime) {
      sendError(response, 404, "Movie or showtime not found.");
      return;
    }

    const bookings = await readBookings();
    sendJson(response, 200, {
      seats,
      reservedSeats: getReservedSeats(bookings, movieId, showtimeId)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/api/bookings") {
    const body = await readJsonBody(request);
    const movie = findMovie(body.movieId);
    const showtime = findShowtime(movie, body.showtimeId);
    const selectedSeats = Array.isArray(body.seats)
      ? [...new Set(body.seats.map((seat) => String(seat).toUpperCase()))]
      : [];

    if (!movie || !showtime) {
      sendError(response, 404, "Movie or showtime not found.");
      return;
    }

    if (!selectedSeats.length || selectedSeats.length > 8) {
      sendError(response, 400, "Choose between 1 and 8 seats.");
      return;
    }

    if (selectedSeats.some((seat) => !seats.includes(seat))) {
      sendError(response, 400, "One or more selected seats are invalid.");
      return;
    }

    const customerError = validateCustomer(body.customer);
    if (customerError) {
      sendError(response, 400, customerError);
      return;
    }

    const bookings = await readBookings();
    const reservedSeats = getReservedSeats(bookings, movie.id, showtime.id);
    const unavailableSeats = selectedSeats.filter((seat) => reservedSeats.includes(seat));

    if (unavailableSeats.length) {
      sendError(response, 409, `Seat ${unavailableSeats.join(", ")} is already booked.`);
      return;
    }

    const booking = {
      id: `MB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      movieId: movie.id,
      movieTitle: movie.title,
      showtimeId: showtime.id,
      showtimeLabel: showtime.label,
      startsAt: showtime.startsAt,
      screen: movie.screen,
      seats: selectedSeats,
      amount: selectedSeats.length * movie.price,
      customer: {
        name: String(body.customer.name).trim(),
        email: String(body.customer.email).trim(),
        phone: String(body.customer.phone).trim()
      },
      status: "confirmed",
      createdAt: new Date().toISOString()
    };

    bookings.push(booking);
    await writeBookings(bookings);
    sendJson(response, 201, { booking });
    return;
  }

  const bookingMatch = pathname.match(/^\/api\/bookings\/([A-Z0-9-]+)$/);
  if (bookingMatch) {
    const bookingId = bookingMatch[1];
    const bookings = await readBookings();
    const booking = bookings.find((item) => item.id === bookingId);

    if (!booking) {
      sendError(response, 404, "Booking not found.");
      return;
    }

    if (request.method === "GET") {
      sendJson(response, 200, { booking });
      return;
    }

    if (request.method === "DELETE") {
      booking.status = "cancelled";
      booking.cancelledAt = new Date().toISOString();
      await writeBookings(bookings);
      sendJson(response, 200, { booking });
      return;
    }
  }

  sendError(response, 404, "API route not found.");
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const decodedPath = decodeURIComponent(requestedPath);
  const filePath = path.resolve(PUBLIC_DIR, `.${decodedPath}`);
  const relativePath = path.relative(PUBLIC_DIR, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    response.end(file);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(request, response, requestUrl.pathname);
      return;
    }

    await serveStatic(response, requestUrl.pathname);
  } catch (error) {
    sendError(response, 500, error.message || "Something went wrong.");
  }
});

ensureDataFile()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Movie booking app running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
