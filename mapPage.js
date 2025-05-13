const socket = new WebSocket("ws://192.168.56.1:8887/");
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
var yourPositions = [{ lat: 0, lng: 0 }];
var enemyPositions = [{ lat: 0, lng: 0 }];
var serverPositions = [{ lat: 0, lng: 0 }];
var timeOut = 5000;
var style = document.createElement("style");
var hasReset = false;
var enemyHP = 6000;
var enemyPoints = 0;
var damage;

socket.onopen = function () {
    console.log("Connected!");
};
socket.onerror = function (error) {
    console.error("WebSocket Error:", error);
};


//for different socket message cases
socket.onmessage = function (message) {
    if (message.data == "true") {
        limitReached = false;

    } else if (message.data == "false") {
        limitReached = true;
        redirectToMain();
    } else if (message.data.startsWith("Location")) {

        var cutMessage = message.data.substring(10);
        var newLat = cutMessage.split(" ")[0];
        var newLng = cutMessage.split(" ")[1];
        fenway = { lat: Number(newLat), lng: Number(newLng) }

        socket.send("RECEIVED POS")


    } else if (message.data.startsWith("Broadcast")) {
        broadcastCounter++;

        if (message.data) {
            const parts = message.data.substring("Broadcast: ".length).split(" ");
            const broadcastString = message.data;
            if (broadcastCounter == 1 && ownData.lat == 0 && ownData.lng == 0) {
                enemyLocation.lat = parts[0];
                enemyLocation.lng = parts[1];
                enemyPoints = Math.round((5500 * Math.exp(-(measure(enemyLocation.lat, enemyLocation.lng, fenway.lat, fenway.lng) * 2.5) / 1491.6)));
                broadcastCounter++;

            } else if (broadcastCounter == 2 && ownData.lat != 0 && ownData.lng != 0) {
                enemyLocation.lat = parts[0];
                enemyLocation.lng = parts[1];
            }
        }

    } else if (message.data.startsWith("Connection number")) {
        userNumber = message.data.substring("Connection number".length + 2);

        // } else if (message.data == "FINISHED") {
        //     displayData();
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
            linksControl: false,
            panControl: true,
            zoomControl: false,
            addressControl: false,
            fullscreenControl: false,
            panControlOptions: {
                position: google.maps.ControlPosition.LEFT_BOTTOM
            }
        });
    } else if (message.data.startsWith("Damage")) {
        if (message.data.substring("Damage: ".length) > points) {
            hp = hp - (Number(message.data.substring("Damage: ".length)) - points);
        } else {
            enemyHP = enemyHP - (points - enemyPoints);
        }
        if (hp < 0) {
            hp = 0;
        }
        console.log(enemyPoints);
        console.log(points);

        displayData();

    } else if (message.data.endsWith("is DEAD")) {
        let winningStatus;

        if (message.data == `${userNumber} is DEAD`) {
            winningStatus = false;
        } else {
            winningStatus = true;
        }
        endScreen(winningStatus);
    } else if (message.data == "RESTART") {
        reset();
    }
}

//initialises the maps and looks for a position to start at
function initialize() {
    var hpBar = document.getElementById("HP-bar");
    hpBar.innerHTML = `<div class="hp-bar">HP: ${hp} </div>`;


    updateBars();



    document.head.append(style);

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
            marker = L.marker(new L.LatLng(e.latlng.lat, e.latlng.lng)).addTo(map);

            map.addLayer(marker);

            // calculate distance of actual position and user input
            let latlngdif = measure(e.latlng.lat, e.latlng.lng, fenway.lat, fenway.lng);
            userPoint = e.latlng;
        }
    })
}

//randomizes a point taken from the excel with positions where street view is aviable
async function generateRandomPoint() {
    await getExcelData();
    var item = pubData[Math.floor(Math.random() * pubData.length)];

    var sv = new google.maps.StreetViewService();
    sv.getPanoramaByLocation(
        //takes the latlng coordinates within a 500 meter range and checks if there is a streetview position withing 
        //this range else tries other position
        new google.maps.LatLng(item.lat, item.lng), 500, processSVData
    );
}

function processSVData(data, status) {
    processSvData = data;
    processSvStatus = status;

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
        console.error('Error while loading data:', err);
    }
}

//confirms the user input and sends the calculated points to the websocket
function confirmPoint() {
    ownData = userPoint;
    hasConfirmed = true;

    let latlngdif = measure(userPoint.lat, userPoint.lng, fenway.lat, fenway.lng);
    socket.send("Clicklocation" + userPoint.lat + " " + userPoint.lng);
    socket.send("Distance: " + latlngdif);

    socket.send("Finished " + userNumber);

    //calculates the points exponentially depending on the distance
    points = Math.round((5500 * Math.exp(-(latlngdif * 2.5) / 1491.6)));

    if (points < 0) {
        points = 0;
    } else if (points > 5000) {
        points = 5000;
    }

    socket.send("Points: " + points);

    //deletes the map so the user doesnt give another input
    var mapContainer = document.getElementById('map-container');
    mapContainer.replaceChildren()
}

//displays the data for a short period of time after both players sent their location and loads a map 
//where they see each others input and the actual position
function displayData() {
    var container = document.getElementById('container-new');
    if (!container) {
        container = document.createElement("div");
        container.id = "container-new";
    }
    container.style.height = "100%";
    container.style.width = "100%";
    container.style = "display: flex; justify-content: center; align-items: center;"

    var newElement = document.createElement("div");
    newElement.id = "map-new";
    newElement.style = "height: 90vh; width: 90vw; top: 5%; bottom: 5%; position: absolute;";

    //Countdown for when the next round starts
    var timer = document.createElement("p");
    timer.innerHTML = `Next rounds starts in: ${timeOut / 1000}`;
    container.append(timer);


    var hpBar = document.getElementById("HP-bar");
    if (!hpBar) {
        hpBar = document.createElement("div");
        hpBar.id = "HP-bar"
        // hpBar.appendChild(document.body);
    }
    hpBar.innerHTML = `<div class="hp-bar">HP: ${hp} </div>`;
    container.append(hpBar);

    var enemyBar = document.createElement("div");
    enemyBar.classList = `enemy-bar`;
    enemyBar.innerHTML = `Enemy HP: ${enemyHP}`;
    container.append(enemyBar);

    updateBars();

    container.append(newElement);
    var bounds = new L.LatLngBounds(new L.LatLng(-100, -190), new L.LatLng(100, 190));
    // if (!document.getElementById('map-new')) {
    //     var mapContainer = document.createElement("div");
    //     mapContainer.innerHTML = '<div id="map-new"><button disabled id="confirm" class="confirm-button" onclick="confirmPoint()">Confirm</button>';
    //     container.append(mapContainer);
    // }
    var map = L.map('map-new', {
        center: [userPoint.lat, userPoint.lng],
        zoom: 5,
        zoomControl: false,
        maxBounds: bounds
    });
    L.tileLayer('https://mts.google.com/vt/lyrs=m&x={x}&y={y}{r}&z={z}', {}).addTo(map);

    //custom icon for the actual position
    var myIcon = L.icon({
        iconUrl: 'https://static-00.iconduck.com/assets.00/map-marker-icon-171x256-xkl73sge.png',
        iconSize: [25, 41],
        className: "new-icon-class"
    });
    L.marker(new L.LatLng(userPoint.lat, userPoint.lng), {
        title: "You"
    }).addTo(map);
    L.marker(new L.LatLng(enemyLocation.lat, enemyLocation.lng), {
        title: "Enemy"
    }).addTo(map);
    L.marker(new L.LatLng(fenway.lat, fenway.lng), {
        icon: myIcon
    }).addTo(map);

    //the routes between the users click location and server location
    var userLatlng = [
        [userPoint.lat, userPoint.lng],
        [fenway.lat, fenway.lng]
    ];

    var enemyLatlng = [
        [enemyLocation.lat, enemyLocation.lng],
        [fenway.lat, fenway.lng]
    ];

    //adds the positions to an array for the final output later
    yourPositions.push({ lat: userPoint.lat, lng: userPoint.lng });
    enemyPositions.push({ lat: enemyLocation.lat, lng: enemyLocation.lng });
    serverPositions.push({ lat: fenway.lat, lng: fenway.lng });


    var polyline = L.polyline(userLatlng, { color: 'green' }).addTo(map);
    var polyline2 = L.polyline(enemyLatlng, { color: 'red' }).addTo(map);

    //the timer between rounds
    var countDownDate = new Date().getTime();
    countDownDate += timeOut;
    var x = setInterval(function () {

        // Get today's date and time
        var now = new Date().getTime();

        // Find the distance between now and the count down date
        var distance = countDownDate - now;
        var seconds = Math.round((distance % (1000 * 60)) / 1000);

        // Output the result in an element with id="demo"
        timer.innerHTML = `Next rounds starts in: ${seconds}`;

        //if the countdown is over start the next round
        if (distance < 0) {
            if (hp > 0) {
                initNextRound();
            } else {
                socket.send("DEAD")
            }
            clearInterval(x);
        }
    }, 1000);
}

//resets the game
async function reset() {
    hasConfirmed = false;
    hp = 6000;
    enemyHP = 6000;
    yourPositions = [{ lat: 0, lng: 0 }];
    enemyPositions = [{ lat: 0, lng: 0 }];
    serverPositions = [{ lat: 0, lng: 0 }];
    fenway = { lat: 0, lng: 0 };
    ownData = { lat: 0, lng: 0 };
    enemyLocation = { lat: 0, lng: 0 };

    document.getElementById('container-new').replaceChildren();
    var mapContainer = document.getElementById('map-container');
    mapContainer.replaceChildren();

    var hpBar = document.getElementById("HP-bar");
    if (!hpBar) {
        hpBar = document.createElement("div");
        hpBar.id = "HP-bar"
    }
    hpBar.innerHTML = `<div class="hp-bar">HP: ${hp} </div>`;


    mapContainer.innerHTML = `<div id="map"> <button disabled id="confirm" class="confirm-button" onclick="confirmPoint()">Confirm</button> </div>
    <div id="pano" style="width: 100%; left: 0;"></div>`;
    document.body.append(mapContainer);
    mapContainer.append(hpBar);
    
    updateBars();

    generateRandomPoint();
    document.head.append(style);

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
            marker = L.marker(new L.LatLng(e.latlng.lat, e.latlng.lng)).addTo(map);

            map.addLayer(marker);

            // calculate distance of actual position and user input
            let latlngdif = measure(e.latlng.lat, e.latlng.lng, fenway.lat, fenway.lng);
            userPoint = e.latlng;
        }
    })

    socket.send("RECEIVED POS");

    map.on('contextmenu', function (e) {

    })
}

//redirects a new user to the main page if 2 players are already playing
function redirectToMain() {
    socket.send(window.location.origin + " redirected to main");
    limitReached = false;
    window.location.replace("mainPage.html");
}

//calculates the distance between 2 latlng coordinates (not my function)
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

//starts the next round
function initNextRound() {
    var hpBar = document.getElementById("HP-bar");
    hpBar.innerHTML = `<div class="hp-bar">HP: ${hp} </div>`;
    updateBars();

    broadcastCounter = 0;
    ownData = { lat: 0, lng: 0 };
    var mapContainer = document.getElementById('map-container');
    mapContainer.innerHTML = `<div id="map"> <button disabled id="confirm" class="confirm-button" onclick="confirmPoint()">Confirm</button> </div>
    <div id="pano" style="width: 100%; left: 0;"></div>`;
    document.body.append(mapContainer);
    mapContainer.append(hpBar);
    var newContainer = document.getElementById('container-new');
    newContainer.replaceChildren();

    newInit();
}

//initialises the data as before
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
        //expandes the small map if the user hovers it
        if (!confirmButton.matches(':hover') && hasConfirmed == false) {
            //checks if the player has clicked so he cant send null
            if (markerNew != null) {
                map.removeLayer(markerNew);
                confirmButton.style.backgroundColor = "rgb(49 211 49)";
            } else {
                confirmButton.disabled = false;
                confirmButton.style.backgroundColor = "rgb(49 211 49)";
            }
            markerNew = L.marker(new L.LatLng(e.latlng.lat, e.latlng.lng)).addTo(map);

            map.addLayer(markerNew);

            // calculate distance of actual position and click
            let latlngdif = measure(e.latlng.lat, e.latlng.lng, fenway.lat, fenway.lng);
            userPoint = e.latlng;
        }
    })

    processSVData(processSvData, processSvStatus);
}

function processSVData(data, status) {

    if (status == google.maps.StreetViewStatus.OK) {
        socket.send("Location: " + data.location.latLng.lat() + " " + data.location.latLng.lng());
    } else generateRandomPoint();
}

//if a player has 0 hp left the game ends and the players see the final statistic
function endScreen(winningStatus) {
    document.getElementById("HP-bar").replaceChildren();
    var mapContainer = document.getElementById('map-container');
    mapContainer.replaceChildren();

    var container = document.getElementById('container-new');
    container.replaceChildren();
    container.style.height = "100%";
    container.style.width = "100%";
    container.style = "display: flex; justify-content: center; align-items: center;"

    updateBars();

    var userStats = document.createElement("div");
    userStats.style = 'display: flex; align-items: center;';

    userStats.innerHTML = `${winningStatus ? "You won" : "You lost"}
    <div class="hp-bar" >HP: ${hp} </div> 
    <button onClick="restart()" style="z-index: 501;
            position: relative;
            bottom: 1vh;
            height: 5vh;
            width: 25vh;
            border-radius: 20px;
            background-color: rgb(44, 165, 44);">Restart</button> `;

    var newElement = document.createElement("div");
    newElement.id = "map-new";
    newElement.style = "height: 90vh; width: 90vw; top: 5%; bottom: 5%; position: absolute;";

    container.append(newElement);
    container.append(userStats);
    var bounds = new L.LatLngBounds(new L.LatLng(-100, -190), new L.LatLng(100, 190));
    var map = L.map('map-new', {
        center: [0, 0],
        zoom: 2,
        zoomControl: false,
        maxBounds: bounds
    });
    L.tileLayer('https://mts.google.com/vt/lyrs=m&x={x}&y={y}{r}&z={z}', {}).addTo(map);
    var myIcon = L.icon({
        iconUrl: 'https://static-00.iconduck.com/assets.00/map-marker-icon-171x256-xkl73sge.png',
        iconSize: [25, 41],
        className: "new-icon-class"
    });
    for (let i = 1; i < serverPositions.length; i++) {

        L.marker(new L.LatLng(yourPositions[i].lat, yourPositions[i].lng), {
            title: "You"
        }).addTo(map);
        L.marker(new L.LatLng(enemyPositions[i].lat, enemyPositions[i].lng), {
            title: "Enemy"
        }).addTo(map);
        L.marker(new L.LatLng(serverPositions[i].lat, serverPositions[i].lng), {
            icon: myIcon
        }).addTo(map);

        var userLatlng = [
            [yourPositions[i].lat, yourPositions[i].lng],
            [serverPositions[i].lat, serverPositions[i].lng]
        ];

        var enemyLatlng = [
            [enemyPositions[i].lat, enemyPositions[i].lng],
            [serverPositions[i].lat, serverPositions[i].lng]
        ];

        var polyline = L.polyline(userLatlng, { color: 'green' }).addTo(map);
        var polyline2 = L.polyline(enemyLatlng, { color: 'red' }).addTo(map);
    }
}

//requests for a restart and awaits if both players want to restart
function restart() {
    if (hasReset == true) {
        socket.send("vote4restart");
    }
    hasReset = true;
}

//shortcut for data confirmation with spacebar
addEventListener("keydown", (event) => {
    var confirmButton = document.getElementById('confirm');

    if (event.code == "Space" && confirmButton.disabled == false) {
        confirmPoint();
    }
})

function updateBars() {
    style.innerHTML = `.hp-bar {
    z-index: 502; height: 3vh; position: fixed; top: 1vh; left: 1vw; width: 10vw; border: black 2px solid;
    background: linear-gradient(to right, ${hp ? '#00ff00' : '#ffffff'} ${(hp / 60) * 1}%, #ffffff 0.1%, #ffffff 100%);
    display: flex; justify-content: center; align-items: center;
    }
    
    .enemy-bar {
     z-index: 502; height: 3vh; position: fixed; top: 1vh; right: 1vw; width: 10vw; border: black 2px solid;
    background: linear-gradient(to right, ${enemyHP ? '#ff0000' : '#ffffff'} ${(enemyHP / 60) * 1}%, #ffffff 0.1%, #ffffff 100%);
    display: flex; justify-content: center; align-items: center;
    }`;
}

//calls the initialize function once the page has loaded
window.initialize = initialize();
