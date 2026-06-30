//icon vị trí 
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});







//biến toàn cục
var serviceMarkers = [];
var currentLat = null;
var currentLon = null;
var routeLayer = null;
var selectedDestination = null;   // lưu điểm được chọn

var nearestMarker = null;

var searchMode = null; // "nearest" | "all" | null

var selectedSearchLocation = null;

var centerPoint = null;        // vị trí (GPS hoặc search)


var serviceLayer = null;


// Khởi tạo bản đồ
var map = L.map('map').setView([21.0285, 105.8542], 13);

// Tạo BaseMap nhưng KHÔNG addTo(map)
var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
});


// ĐƯỜNG DẪN WMS
var geoserverUrl = "http://localhost:8080/geoserver/webgis/wms";

// Từng layer từ GeoServer
var road = L.tileLayer.wms(geoserverUrl, {
    layers: 'webgis:road',
    format: 'image/png',
    transparent: true
});

var river = L.tileLayer.wms(geoserverUrl, {
    layers: 'webgis:river',
    format: 'image/png',
    transparent: true
});

var water = L.tileLayer.wms(geoserverUrl, {
    layers: 'webgis:water',
    format: 'image/png',
    transparent: true
});

var building = L.tileLayer.wms(geoserverUrl, {
    layers: 'webgis:building',
    format: 'image/png',
    transparent: true
});

var school = L.tileLayer.wms(geoserverUrl, {
    layers: 'webgis:school',
    format: 'image/png',
    transparent: true
});


var overlayMaps = {
    "OpenStreetMap": osm,
    "Road": road,
    "River": river,
    "Water": water,
    "Building": building,
    "School": school
};

L.control.layers(null, overlayMaps).addTo(map);
osm.addTo(map);




var searchLayer = L.layerGroup().addTo(map);




// tìm Vị trí hiện tại
document.getElementById("btnLocate").onclick = function () {
    map.locate({
        setView: true,
        maxZoom: 16,
        enableHighAccuracy: true
    });
};

// Khi tìm thấy vị trí

map.on("locationfound", function (e) {

    var latlng = e.latlng;

    // Xóa marker cũ nếu có
    if (window.currentLocation) {
        map.removeLayer(window.currentLocation);
        map.removeLayer(window.currentCircle);
    }

    // Marker vị trí
    window.currentLocation = L.marker(latlng)
        .addTo(map)
        .bindPopup("Bạn đang ở đây")
        .openPopup();

    // Vòng tròn sai số GPS
    window.currentCircle = L.circle(latlng, {
        radius: e.accuracy,
        color: "blue",
        fillColor: "#30f",
        fillOpacity: 0.2
    }).addTo(map);
});

// Nếu bị lỗi
map.on("locationerror", function () {
    alert("Không lấy được vị trí. Hãy bật GPS hoặc cho phép quyền truy cập.");
});


var userMarker = null;

map.on("locationfound", function (e) {

    centerPoint = e.latlng;   // 🔥 LƯU vị trí GPS

    // 🔥 Xóa marker cũ nếu có
    if (userMarker) {
        map.removeLayer(userMarker);
    }

    userMarker = L.marker(centerPoint)
        .addTo(map)
        .bindPopup("Bạn đang ở đây")
        .openPopup();

    console.log("GPS:", centerPoint.lat, centerPoint.lng);
});




















// Hàm tìm gần nhất quanh vị trí trung tâm (GPS hoặc search)
function findNearestOSM(type, radius) {

    // 🔥 Kiểm tra có vị trí trung tâm chưa
    if (!centerPoint) {
        alert("Hãy lấy vị trí hoặc tìm kiếm địa điểm trước!");
        return;
    }

    var lat = centerPoint.lat;
    var lon = centerPoint.lng;

    // 🔥 Xóa route cũ
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }

    // 🔥 Xóa nearest cũ
    if (nearestMarker) {
        map.removeLayer(nearestMarker);
        nearestMarker = null;
    }

    // 🔥 Reset điểm đích
    selectedDestination = null;
    document.getElementById("btnRoute").disabled = true;

    var query = "";

    if (type === "hospital") {

        query = `
        [out:json][timeout:25];
        (
          node["amenity"="hospital"](around:${radius},${lat},${lon});
          node["amenity"="clinic"](around:${radius},${lat},${lon});
          node["healthcare"="hospital"](around:${radius},${lat},${lon});
        );
        out body;
        `;

    } else {

        query = `
        [out:json][timeout:25];
        (
          node["amenity"="${type}"](around:${radius},${lat},${lon});
        );
        out body;
        `;
    }

    fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query
    })
        .then(response => response.json())
        .then(data => {

            if (!data.elements || data.elements.length === 0) {
                alert("Không tìm thấy trong phạm vi đã chọn!");
                return;
            }

            var nearest = null;
            var minDistance = Infinity;

            data.elements.forEach(function (element) {

                if (!element.lat || !element.lon) return;

                var serviceLatLng = L.latLng(element.lat, element.lon);
                var distance = centerPoint.distanceTo(serviceLatLng);

                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = element;
                }
            });

            if (nearest) {

                var nearestLatLng = L.latLng(nearest.lat, nearest.lon);

                nearestMarker = L.marker(nearestLatLng)
                    .addTo(map)
                    .bindPopup(
                        "<b>" + (nearest.tags.name || "Không tên") + "</b><br>" +
                        "Khoảng cách: " + (minDistance / 1000).toFixed(2) + " km"
                    )
                    .openPopup();

                // 🔥 Lưu làm điểm đích để chỉ đường
                selectedDestination = nearestLatLng;

                document.getElementById("btnRoute").disabled = false;

                map.setView(nearestLatLng, 16);
            }
        })
        .catch(err => {
            console.error(err);
            alert("Lỗi Overpass!");
        });
}


// Nút tìm gần nhất
document.getElementById("btnFind").onclick = function () {

    var selectedType = document.getElementById("serviceType").value;
    var selectedRadius = document.getElementById("searchRadius").value;

    // 🔥 Chỉ kiểm tra centerPoint
    if (!centerPoint) {
        alert("Hãy lấy vị trí hoặc tìm kiếm địa điểm trước!");
        return;
    }

    findNearestOSM(selectedType, selectedRadius);
};





// Hàm tìm tất cả điểm quanh vị trí hiện tại
function findAllOSM(type, radius) {

    if (!centerPoint) {
        alert("Hãy lấy vị trí hoặc tìm kiếm địa điểm trước!");
        return;
    }

    if (!radius || isNaN(radius)) {
        alert("Bán kính không hợp lệ!");
        return;
    }

    radius = parseInt(radius);

    var lat = centerPoint.lat;
    var lon = centerPoint.lng;

    // Xóa route cũ
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }

    // Xóa marker cũ
    if (serviceMarkers && serviceMarkers.length > 0) {
        serviceMarkers.forEach(marker => map.removeLayer(marker));
    }
    serviceMarkers = [];

    selectedDestination = null;

    var btnRoute = document.getElementById("btnRoute");
    if (btnRoute) btnRoute.disabled = true;

    // Query Overpass tối ưu
    var query = `
[out:json][timeout:25];
(
  node["amenity"="${type}"](around:${radius},${lat},${lon});
  way["amenity"="${type}"](around:${radius},${lat},${lon});
);
out center 50;
`;

    fetch("https://overpass.kumi.systems/api/interpreter", {
        method: "POST",
        body: query
    })
        .then(res => res.text()) // đọc dạng text trước
        .then(text => {

            // Nếu server trả XML (thường là lỗi)
            if (text.startsWith("<")) {
                console.error("Overpass trả lỗi XML:", text);
                alert("Overpass đang quá tải, hãy thử lại!");
                return;
            }

            const data = JSON.parse(text);

            if (!data.elements || data.elements.length === 0) {
                alert("Không tìm thấy trong phạm vi đã chọn!");
                return;
            }

            var userLatLng = L.latLng(lat, lon);

            var results = data.elements.map(el => {

                var elLat, elLon;

                if (el.type === "node") {
                    elLat = el.lat;
                    elLon = el.lon;
                }
                else if (el.center) {
                    elLat = el.center.lat;
                    elLon = el.center.lon;
                }

                if (!elLat || !elLon) return null;

                var distance = userLatLng.distanceTo([elLat, elLon]);

                return {
                    lat: elLat,
                    lon: elLon,
                    name: el.tags?.name || "Không tên",
                    distance: distance
                };

            }).filter(x => x !== null);

            // Sắp xếp gần → xa
            results.sort((a, b) => a.distance - b.distance);

            results.forEach(item => {

                var serviceLatLng = L.latLng(item.lat, item.lon);

                var marker = L.marker(serviceLatLng)
                    .addTo(map)
                    .bindPopup(
                        "<b>" + item.name + "</b><br>" +
                        "Khoảng cách: " + (item.distance / 1000).toFixed(2) + " km"
                    );

                marker.on("click", function () {
                    selectedDestination = serviceLatLng;
                    if (btnRoute) btnRoute.disabled = false;
                });

                serviceMarkers.push(marker);
            });

            alert("Tìm thấy " + serviceMarkers.length + " địa điểm!");

            if (serviceMarkers.length > 0) {
                var group = L.featureGroup(serviceMarkers);
                map.fitBounds(group.getBounds());
            }

        })
        .catch(err => {
            console.error("Overpass lỗi:", err);
            alert("Lỗi mạng hoặc Overpass quá tải!");
        });
}


// Hàm tìm tất cả điểm quanh vị trí hiện tại (DÙNG DATABASE - NHANH HƠN)
// function findAllOSM(type, radius) {

//     if (!centerPoint) {
//         alert("Hãy lấy vị trí hoặc tìm kiếm địa điểm trước!");
//         return;
//     }

//     if (!radius || isNaN(radius)) {
//         alert("Bán kính không hợp lệ!");
//         return;
//     }

//     radius = parseInt(radius);

//     var lat = centerPoint.lat;
//     var lon = centerPoint.lng;

//     // 🔥 Xóa route cũ
//     if (routeLayer) {
//         map.removeLayer(routeLayer);
//         routeLayer = null;
//     }

//     // 🔥 Xóa marker cũ
//     if (serviceMarkers && serviceMarkers.length > 0) {
//         serviceMarkers.forEach(marker => map.removeLayer(marker));
//     }
//     serviceMarkers = [];

//     selectedDestination = null;

//     var btnRoute = document.getElementById("btnRoute");
//     if (btnRoute) btnRoute.disabled = true;

//     // 🔥 GỌI API TỪ DATABASE (KHÔNG DÙNG OVERPASS NỮA)
//     fetch(`/api/nearby/${type}?lat=${lat}&lng=${lon}&radius=${radius}`)
//         .then(response => {
//             if (!response.ok) {
//                 throw new Error("Server lỗi " + response.status);
//             }
//             return response.json();
//         })
//         .then(data => {

//             if (!data || data.length === 0) {
//                 alert("Không tìm thấy trong phạm vi đã chọn!");
//                 return;
//             }

//             var userLatLng = L.latLng(lat, lon);

//             data.forEach(item => {

//                 var serviceLatLng = L.latLng(item.lat, item.lng);

//                 var distance = userLatLng.distanceTo(serviceLatLng);

//                 var marker = L.marker(serviceLatLng)
//                     .addTo(map)
//                     .bindPopup(
//                         "<b>" + (item.name || "Không tên") + "</b><br>" +
//                         "Khoảng cách: " + (distance / 1000).toFixed(2) + " km"
//                     );

//                 // click marker để chọn điểm chỉ đường
//                 marker.on("click", function () {
//                     selectedDestination = serviceLatLng;
//                     if (btnRoute) btnRoute.disabled = false;
//                 });

//                 serviceMarkers.push(marker);

//             });

//             alert("Tìm thấy " + serviceMarkers.length + " địa điểm!");

//             if (serviceMarkers.length > 0) {
//                 var group = L.featureGroup(serviceMarkers);
//                 map.fitBounds(group.getBounds());
//             }

//         })
//         .catch(err => {
//             console.error("Server lỗi:", err);
//             alert("Lỗi server hoặc mạng!");
//         });
// }



// Nút tìm tất cả
document.getElementById("btnFindAll").onclick = function () {

    if (!centerPoint) {
        alert("Hãy lấy vị trí hoặc tìm kiếm địa điểm trước!");
        return;
    }

    var selectedType = document.getElementById("serviceType").value;
    var selectedRadius = document.getElementById("searchRadius").value;

    findAllOSM(selectedType, selectedRadius);
};



// Hàm chỉ đường
function drawRoute() {

    // 🔥 Kiểm tra vị trí bắt đầu (centerPoint)
    if (!centerPoint) {
        alert("Hãy lấy vị trí hoặc tìm kiếm địa điểm trước!");
        return;
    }

    // 🔥 Kiểm tra điểm đích
    if (!selectedDestination || !selectedDestination.lat || !selectedDestination.lng) {
        alert("Chưa có điểm đích!");
        return;
    }

    // Xóa route cũ nếu có
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }

    var startLat = centerPoint.lat;
    var startLon = centerPoint.lng;

    var endLat = selectedDestination.lat;
    var endLon = selectedDestination.lng;

    var url = `https://router.project-osrm.org/route/v1/driving/` +
        `${startLon},${startLat};${endLon},${endLat}` +
        `?overview=full&geometries=geojson`;

    fetch(url)
        .then(res => res.json())
        .then(data => {

            if (!data.routes || data.routes.length === 0) {
                alert("Không tìm được đường!");
                return;
            }

            var routeGeoJSON = data.routes[0].geometry;

            routeLayer = L.geoJSON(routeGeoJSON, {
                style: {
                    color: "blue",
                    weight: 5
                }
            }).addTo(map);

            map.fitBounds(routeLayer.getBounds());
        })
        .catch(err => {
            console.error("OSRM error:", err);
            alert("Lỗi vẽ đường!");
        });
}

//nút chỉ đường
document.getElementById("btnRoute").onclick = function () {
    drawRoute();
};



// Hàm tìm kiếm theo: chi tiết (số nhà/thôn/đường), xã, huyện, tỉnh
function searchAddress(chiTiet, xa, huyen, tinh) {

    if (!xa || !huyen || !tinh) {
        alert("Vui lòng nhập đầy đủ xã, huyện, tỉnh!");
        return;
    }

    // 🔥 Ghép địa chỉ linh hoạt
    var parts = [];

    if (chiTiet) parts.push(chiTiet);
    parts.push(xa);
    parts.push(huyen);
    parts.push(tinh);
    parts.push("Vietnam");

    var fullAddress = parts.join(", ");

    var url = "https://nominatim.openstreetmap.org/search?" +
        "format=json&limit=1&addressdetails=1&q=" +
        encodeURIComponent(fullAddress);

    fetch(url, {
        headers: {
            "Accept": "application/json"
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP status " + response.status);
            }
            return response.json();
        })
        .then(data => {

            if (!data || data.length === 0) {
                alert("Không tìm thấy địa chỉ!");
                return;
            }

            var lat = parseFloat(data[0].lat);
            var lon = parseFloat(data[0].lon);
            var latLng = L.latLng(lat, lon);

            // 🔥 LƯU centerPoint
            centerPoint = latLng;

            // Xóa route cũ
            if (routeLayer) {
                map.removeLayer(routeLayer);
                routeLayer = null;
            }

            // Xóa nearest marker
            if (nearestMarker) {
                map.removeLayer(nearestMarker);
                nearestMarker = null;
            }

            // Xóa serviceMarkers
            if (serviceMarkers && serviceMarkers.length > 0) {
                serviceMarkers.forEach(marker => map.removeLayer(marker));
                serviceMarkers = [];
            }

            // Tạo searchLayer nếu chưa có
            if (!searchLayer) {
                searchLayer = L.layerGroup().addTo(map);
            }

            searchLayer.clearLayers();

            // Thêm marker tìm kiếm
            L.marker(latLng)
                .addTo(searchLayer)
                .bindPopup(data[0].display_name)
                .openPopup();

            map.setView(latLng, 17);

            // Reset điểm đích
            selectedDestination = null;

            var btnRoute = document.getElementById("btnRoute");
            if (btnRoute) btnRoute.disabled = true;

            console.log("Đã lưu centerPoint:", centerPoint.lat, centerPoint.lng);
        })
        .catch(error => {
            console.error("Nominatim error:", error);
            alert("Không kết nối được Nominatim!");
        });
}


// Nút tìm kiếm
document.getElementById("btnSearchAddress").onclick = function () {

    var chiTiet = document.getElementById("chiTiet").value.trim();
    var xa = document.getElementById("xa").value.trim();
    var huyen = document.getElementById("huyen").value.trim();
    var tinh = document.getElementById("tinh").value.trim();

    if (!xa || !huyen || !tinh) {
        alert("Nhập đầy đủ Xã - Huyện - Tỉnh!");
        return;
    }

    searchAddress(chiTiet, xa, huyen, tinh);
};










//them 
// ====== LAYER CHỨA MARKER ======
let markerLayer = L.layerGroup().addTo(map);

// ====== BIẾN CHẾ ĐỘ THÊM ======
let isAddMode = false;
let isSending = false; // 🔥 chống spam click

// ====== NÚT BẬT CHẾ ĐỘ THÊM ======
document.getElementById("btnAdd").addEventListener("click", function () {

    isAddMode = !isAddMode;

    if (isAddMode) {
        alert("Đã bật chế độ thêm. Click vào bản đồ để thêm.");
        this.style.backgroundColor = "green";
    } else {
        this.style.backgroundColor = "";
    }
});


// ====== CLICK MAP ĐỂ THÊM ======
map.on("click", async function (e) {

    if (!isAddMode) return;

    // 🔥 chỉ cho thêm 1 lần
    isAddMode = false;
    document.getElementById("btnAdd").style.backgroundColor = "";

    if (isSending) return;
    isSending = true;

    const type = document.getElementById("serviceType").value;
    const name = prompt("Nhập tên:");

    // ❌ nếu bấm cancel hoặc rỗng
    if (!name || name.trim() === "") {
        isSending = false;
        return;
    }

    const payload = {
        name: name.trim(),
        lat: Number(e.latlng.lat),
        lng: Number(e.latlng.lng)
    };

    console.log("SEND DATA:", payload); // 🔥 debug

    try {
        const res = await fetch(`http://localhost:8081/api/add/${type}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        console.log("RESPONSE:", text);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error("Server không trả JSON");
        }

        if (!res.ok || !data.success) {
            throw new Error(data.message || "Thêm thất bại");
        }

        alert("Thêm thành công!");

        // 🔥 reload marker
        loadAll();

    } catch (err) {
        console.error("ADD ERROR:", err);
        alert("Lỗi: " + err.message);
    } finally {
        isSending = false;
    }
});







// ====== LOAD TẤT CẢ ======
function loadAll() {

    markerLayer.clearLayers();


    const types = ["school1", "hospital", "atm"];

    types.forEach(type => {

        fetch(`/api/list/${type}`)
            .then(res => res.json())
            .then(data => {

                // tránh lỗi data.forEach is not a function
                if (!Array.isArray(data)) return;

                data.forEach(item => {

                    if (!item.lat || !item.lng) return;

                    const marker = L.marker([item.lat, item.lng]);

                    marker.bindPopup(`
                        <b>${item.name}</b><br>
                        <button onclick="deletePoint('${type}', ${item.id})">❌ Xóa</button>
                    `);

                    markerLayer.addLayer(marker);

                });

            })
            .catch(err => console.error(err));

    });

}


// ====== XÓA ======
function deletePoint(type, id) {

    if (!confirm("Bạn chắc chắn muốn xóa?")) return;

    fetch(`/api/delete/${type}/${id}`, {
        method: "DELETE"
    })
        .then(res => res.json())
        .then(() => {
            alert("Đã xóa!");
            loadAll();
        })
        .catch(err => console.error(err));
}


// ====== GỌI KHI MỞ TRANG ======
loadAll();





//dang suat
document.getElementById("btnLogout").addEventListener("click", function () {

    if (!confirm("Bạn có chắc muốn đăng xuất?")) return;

    // Xóa user khỏi localStorage
    localStorage.removeItem("user");

    alert("Đã đăng xuất!");

    // quay về login
    window.location.href = "/login.html";
});



const user = localStorage.getItem("user");

if (!user) {
    window.location.href = "/login.html";
}

































