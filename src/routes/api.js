const express = require("express");
const router = express.Router();
const pool = require("../config/database");

const allowedTables = ["school1", "hospital", "atm"];

// 🔥 MAP type → table (fix lỗi school vs school1)
const tableMap = {
    school: "school1",
    school1: "school1", // 🔥 fix luôn nếu frontend còn sót
    hospital: "hospital",
    atm: "atm"
};



// ======================
// 1. THÊM
// ======================
router.post("/add/:type", async (req, res) => {
    try {
        const { type } = req.params;
        const { name, lat, lng } = req.body;

        console.log("TYPE:", type);
        console.log("BODY:", req.body);

        // 🔥 map sang table thật
        const table = tableMap[type];

        if (!table) {
            return res.status(400).json({
                success: false,
                message: "Invalid type"
            });
        }

        // 🔥 ép kiểu + validate
        const latNum = parseFloat(lat);
        const lngNum = parseFloat(lng);

        if (!name || isNaN(latNum) || isNaN(lngNum)) {
            return res.status(400).json({
                success: false,
                message: "Dữ liệu không hợp lệ",
                received: req.body
            });
        }

        const result = await pool.query(
            `INSERT INTO ${table} (name, lat, lng)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [name.trim(), latNum, lngNum]
        );

        return res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {
        console.error("ADD ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});



// ======================
// 2. LẤY DANH SÁCH
// ======================
router.get("/list/:type", async (req, res) => {
    try {
        const { type } = req.params;

        const table = tableMap[type];

        if (!table) {
            return res.status(400).json({
                success: false,
                message: "Invalid type"
            });
        }

        const result = await pool.query(`SELECT * FROM ${table}`);

        return res.json(result.rows);

    } catch (err) {
        console.error("LIST ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});



// ======================
// 3. XÓA
// ======================
router.delete("/delete/:type/:id", async (req, res) => {
    try {
        const { type, id } = req.params;

        const table = tableMap[type];

        if (!table) {
            return res.status(400).json({
                success: false,
                message: "Invalid type"
            });
        }

        await pool.query(
            `DELETE FROM ${table} WHERE id = $1`,
            [id]
        );

        return res.json({
            success: true
        });

    } catch (err) {
        console.error("DELETE ERROR:", err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
});


//dangnhap dang suat
// ======================
// ĐĂNG KÝ
// ======================
router.post("/register", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: "Thiếu thông tin" });
        }

        const check = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [username]
        );

        if (check.rows.length > 0) {
            return res.status(400).json({ error: "User đã tồn tại" });
        }

        await pool.query(
            "INSERT INTO users(username, password) VALUES ($1, $2)",
            [username, password]
        );

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server lỗi" });
    }
});

// ======================
// ĐĂNG NHẬP
// ======================
router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1 AND password = $2",
            [username, password]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Sai tài khoản hoặc mật khẩu" });
        }

        res.json({
            success: true,
            user: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server lỗi" });
    }
});


module.exports = router;







