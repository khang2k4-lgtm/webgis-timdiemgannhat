require("dotenv").config();
const express = require("express");

const configViewEngine = require("./config/viewEngine");
const webRoutes = require("./routes/web");

const app = express();

const port = process.env.PORT || 8888;
const hostname = process.env.HOST_NAME || "localhost";

// ==========================
// ==========================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================
// STATIC FILE (CSS, JS)
// ==========================
app.use(express.static("src/public"));

// ==========================
// VIEW ENGINE
// ==========================
configViewEngine(app);

// ==========================
// ROUTES
// ==========================
app.use("/", webRoutes);
app.use("/api", require("./routes/api"));
//app.use("/auth", require("./routes/auth")); // ✅ đúng

app.use(express.static("src/public"));


// ==========================
// START SERVER
// ==========================
app.listen(port, hostname, () => {
    console.log(`✅ Server running at http://${hostname}:${port}`);
});













