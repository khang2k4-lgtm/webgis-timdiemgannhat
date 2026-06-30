function register() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch("/api/register", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert("Đăng ký thành công!");
            }
        });
}

function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    fetch("/api/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.error) {
                alert(data.error);
            } else {
                alert("Đăng nhập thành công!");
                localStorage.setItem("user", JSON.stringify(data.user));
                window.location.href = "/";
            }
        });
}