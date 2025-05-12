const socket = new WebSocket("ws://localhost:8887/");
let fenway = { lat: 0, lng: 0 };
let pubData;
var items;
var hasConfirmed = false;
var limitReached = false;
let userPoint;
var userNumber;
var enemyLocation = { lat: 0, lng: 0 };
var saveMessageData;
var broadcastCounter = 0;
var ownData = { lat: 0, lng: 0 };
var points;
var hp = 6000;
var init;
var processSvData;
var processSvStatus;

socket.onopen = function () {
    console.log("Connected!");
};
socket.onerror = function (error) {
    console.error("WebSocket Error:", error);
};


socket.onmessage = function (message) {

    if (message.data == "true") {
        limitReached = false;

    } else if (message.data == "false") {
        limitReached = true;
        redirectToMain();
    } else if (message.data.startsWith("Location")) {

        var cutMessage = message.data.substring(10);
        // console.log(cutMessage);
        var newLat = cutMessage.split(" ")[0];
        var newLng = cutMessage.split(" ")[1];
        fenway = { lat: Number(newLat), lng: Number(newLng) }

        socket.send("RECEIVED POS")
        console.log({ lat: Number(newLat), lng: Number(newLng) });


    } else if (message.data.startsWith("Broadcast")) {
        broadcastCounter++;
        console.log(message);

        if (message.data) {
            const parts = message.data.substring("Broadcast: ".length).split(" ");
            const broadcastString = message.data;
            console.log(message.data);
            if (broadcastCounter == 1 && ownData.lat == 0 && ownData.lng == 0) {
                enemyLocation.lat = parts[0];
                enemyLocation.lng = parts[1];
                broadcastCounter++;

            } else if (broadcastCounter == 2 && ownData.lat != 0 && ownData.lng != 0) {
                enemyLocation.lat = parts[0];
                enemyLocation.lng = parts[1];
            }
        }

    } else if (message.data.startsWith("Connection number")) {
        userNumber = message.data.substring("Connection number".length + 2);
        console.log(userNumber);

    } else if (message.data == "FINISHED") {
        displayData();
    } else if (message.data == "START") {

        const panorama = new google.maps.StreetViewPanorama(
            document.getElementById("pano"), {
            position: { lat: fenway.lat, lng: fenway.lng },
            pov: {
                heading: 0,
                pitch: 0,
            },
            showRoadLabels: false,
            disableDefaultUI: true,
        });
    } else if (message.data.startsWith("Damage")) {
        console.log(message);
        
        if (message.data.substring("Damage: ".length) > points) {
            hp = hp - (Number(message.data.substring("Damage: ".length)) - points);
        }
        if (hp < 0){
            hp = 0;
        }
        console.log(Number(message.data.substring("Damage: ".length)));
        
        console.log(points);
        console.log(hp);

    } else if (message.data.endsWith("is DEAD")){
        if (message.data == `${window.location.origin} is DEAD`){
            console.log("You lost");
            
        }else{
            console.log("You won");
            
        }
    }
}

function initialize() {

    var bounds = new L.LatLngBounds(new L.LatLng(-100, -190), new L.LatLng(100, 190));
    var map = L.map('map', {
        center: [0, 0],
        zoom: 2,
        zoomControl: false,
        maxBounds: bounds
    });

    var confirmButton = document.getElementById('confirm');


    L.tileLayer('https://mts.google.com/vt/lyrs=m&x={x}&y={y}{r}&z={z}', {}).addTo(map);


    var marker;
    var serverMarker;
    map.on('click', function (e) {

        if (!confirmButton.matches(':hover') && hasConfirmed == false) {
            if (marker != null) {
                map.removeLayer(marker);
                confirmButton.style.backgroundColor = "rgb(49 211 49)";
                confirmButton.ariaDisabled = true;
            } else {
                confirmButton.disabled = false;
                confirmButton.style.backgroundColor = "rgb(49 211 49)";
            }
            if (serverMarker != null) {
                map.removeLayer(serverMarker);
            }
            marker = L.marker(new L.LatLng(e.latlng.lat, e.latlng.lng)).addTo(map);

            // serverMarker = L.marker(new L.LatLng(fenway.lat, fenway.lng)).addTo(map);
            map.addLayer(marker);
            // map.addLayer(serverMarker);

            // calculate distance of actual position and click
            let latlngdif = measure(e.latlng.lat, e.latlng.lng, fenway.lat, fenway.lng);
            userPoint = e.latlng;
            // console.log(latlngdif);
        }
    })
}

async function generateRandomPoint() {
    await getExcelData();
    var item = pubData[Math.floor(Math.random() * pubData.length)];

    var sv = new google.maps.StreetViewService();
    sv.getPanoramaByLocation(
        //takes the latlng coordinates within a 500 meter range and checks if there is a streetview position withing this range
        new google.maps.LatLng(item.lat, item.lng), 500, processSVData
    );
}

function processSVData(data, status) {
    processSvData = data;
    processSvStatus = status;
    console.log(data.location);

    if (status == google.maps.StreetViewStatus.OK) {
        socket.send("Location: " + data.location.latLng.lat() + " " + data.location.latLng.lng());



    } else generateRandomPoint();
}

//fetches the local excel that contains city locations so that the user doesnt spawn in the middle of nowhere
async function getExcelData() {
    try {
        const res = await fetch('./worldcities.xlsx');
        const arrayBuffer = await res.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        workbook.SheetNames.forEach(function (sheetName) {
            const rowObjects = XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]);

            pubData = rowObjects;

        });
    } catch (err) {
        console.error('Fehler beim Laden der Excel-Datei:', err);
    }
}

window.initialize = initialize();

function confirmPoint() {
    console.log("sent map point!");
    // generateRandomPoint();
    ownData = userPoint;
    hasConfirmed = true;

    let latlngdif = measure(userPoint.lat, userPoint.lng, fenway.lat, fenway.lng);
    socket.send("Clicklocation" + userPoint.lat + " " + userPoint.lng);
    socket.send("Distance: " + latlngdif);


    socket.send("Finished " + userNumber);

    points = Math.round((5500 - (latlngdif * 2.5)));
    if (points < 0) {
        points = 0;
    } else if (points > 5000) {
        points = 5000;
    }

    socket.send("Points: " + points);


    // location.assign("confirmationScreen.html", socket);

    var mapContainer = document.getElementById('map-container');
    mapContainer.replaceChildren()
    // for (let i = mapContainer.children.length; i >= 0; i--) {
    //     mapContainer.removeChild(mapContainer.childNodes[i]);
    // }

}
function displayData() {

    var container = document.getElementById('container-new');
    container.style.height = "100%";
    container.style.width = "100%";
    container.style = "display: flex; justify-content: center; align-items: center;"

    var newElement = document.createElement("div");
    newElement.id = "map-new";
    newElement.style = "height: 90vh; width: 90vw; top: 5%; bottom: 5%; position: absolute;";

    // var resetButton = document.createElement("button");
    // resetButton.click("reset()");

    // container.append(resetButton);
    container.append(newElement);
    var bounds = new L.LatLngBounds(new L.LatLng(-100, -190), new L.LatLng(100, 190));
    var map = L.map('map-new', {
        center: [userPoint.lat, userPoint.lng],
        zoom: 5,
        zoomControl: false,
        maxBounds: bounds
    });
    L.tileLayer('https://mts.google.com/vt/lyrs=m&x={x}&y={y}{r}&z={z}', {}).addTo(map);
    console.log(enemyLocation);
    console.log(userPoint);


    var myIcon = L.icon({
        iconUrl: 'https://static-00.iconduck.com/assets.00/map-marker-icon-171x256-xkl73sge.png',
        iconSize: [25, 41],
        className: "new-icon-class"
    });
    var marker = L.marker(new L.LatLng(userPoint.lat, userPoint.lng), {
        title: "You"
    }).addTo(map);
    var enemyMarker = L.marker(new L.LatLng(enemyLocation.lat, enemyLocation.lng), {
        title: "Enemy"
    }).addTo(map);
    var serverMarker = L.marker(new L.LatLng(fenway.lat, fenway.lng), {
        icon: myIcon
    }).addTo(map);

    var userLatlng = [
        [userPoint.lat, userPoint.lng],
        [fenway.lat, fenway.lng]
    ];

    var enemyLatlng = [
        [enemyLocation.lat, enemyLocation.lng],
        [fenway.lat, fenway.lng]
    ];


    var polyline = L.polyline(userLatlng, { color: 'green' }).addTo(map);
    var polyline2 = L.polyline(enemyLatlng, { color: 'red' }).addTo(map);

    setTimeout(() => {
        if (hp > 0) {
            initNextRound();
        }else{
            socket.send("DEAD")
            console.log("DEAD");
            
        }
    }, 15000)
}

function reset() {
    console.log("SAODHAOIDHSAODHOIAHDOAHDOAHODS");

}

function redirectToMain() {
    socket.send(window.location.origin + " redirected to main");
    limitReached = false;
    window.location.replace("mainPage.html");
}

// https://stackoverflow.com/questions/639695/how-to-convert-latitude-or-longitude-to-meters#:~:text=245,a%20javascript%20function%3A
function measure(lat1, lon1, lat2, lon2) {
    var R = 6378.137; // Radius of earth in KM
    var dLat = lat2 * Math.PI / 180 - lat1 * Math.PI / 180;
    var dLon = lon2 * Math.PI / 180 - lon1 * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d.toFixed(2); // kilometers limited to 2 decimal numbers
}


function initNextRound() {
    broadcastCounter = 0;
    ownData = { lat: 0, lng: 0 };
    var mapContainer = document.getElementById('map-container');
    mapContainer.innerHTML = `<div id="map"> <button disabled id="confirm" class="confirm-button" onclick="confirmPoint()">Confirm</button> </div>
    <div id="pano" style="width: 100%; left: 0;"></div>`;
    document.getElementById('container-new').replaceChildren();
    newInit();
}
function newInit() {
    hasConfirmed = false;
    var bounds = new L.LatLngBounds(new L.LatLng(-100, -190), new L.LatLng(100, 190));
    var map = L.map('map', {
        center: [0, 0],
        zoom: 2,
        zoomControl: false,
        maxBounds: bounds
    });

    var confirmButton = document.getElementById('confirm');


    L.tileLayer('https://mts.google.com/vt/lyrs=m&x={x}&y={y}{r}&z={z}', {}).addTo(map);


    var markerNew;
    map.on('click', function (e) {
        console.log("ADOIJADJPODSA");

        if (!confirmButton.matches(':hover') && hasConfirmed == false) {
            if (markerNew != null) {
                map.removeLayer(markerNew);
                confirmButton.style.backgroundColor = "rgb(49 211 49)";
                confirmButton.ariaDisabled = true;
            } else {
                confirmButton.disabled = false;
                confirmButton.style.backgroundColor = "rgb(49 211 49)";
            }
            markerNew = L.marker(new L.LatLng(e.latlng.lat, e.latlng.lng)).addTo(map);

            map.addLayer(markerNew);

            // calculate distance of actual position and click
            let latlngdif = measure(e.latlng.lat, e.latlng.lng, fenway.lat, fenway.lng);
            userPoint = e.latlng;
            // console.log(latlngdif);
        }
    })
    console.log(map.on('click'));


    processSVData(processSvData, processSvStatus);
}

function processSVData(data, status) {

    if (status == google.maps.StreetViewStatus.OK) {
        socket.send("Location: " + data.location.latLng.lat() + " " + data.location.latLng.lng());



    } else generateRandomPoint();
}
