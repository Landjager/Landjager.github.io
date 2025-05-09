
const socket = new WebSocket("ws://localhost:8887/");
socket.onopen = function () {
    // socket.send();
};
socket.onerror = function (error) {
    console.error("WebSocket Error:", error);
};
socket.onmessage = function(message){

}