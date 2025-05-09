package org.example;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.lang.reflect.Array;
import java.net.InetSocketAddress;

public class MyWebSocketServer extends WebSocketServer {


    int connectionCount = 0;
    String location = "";
    String[] userArray = {"", ""};
    String[] finishedArray = {"", ""};
    Double[] userDistances = {0.0, 0.0};
    boolean userWon = false;
    String winner;
    boolean bothFinished = false;
    boolean recentDisconnection = false;
    Integer finishedCount = 0;
    Integer initCounter = 0;
    Integer[] pointsArr = {0, 0};

    public MyWebSocketServer(InetSocketAddress address) {
        super(address);
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
//        conn.send("Sends to current device"); //This method sends a message to the new client
//        broadcast( "Sends to all device" ); //This method sends a message to all clients connected
        System.out.println(STR."new connection to \{conn.getRemoteSocketAddress()}");
        connectionCount++;
        System.out.println(connectionCount);
        if (connectionCount <= 2) {
            if (userArray[0] == "") {
                userArray[0] = conn.getRemoteSocketAddress().toString();
            } else {
                userArray[1] = conn.getRemoteSocketAddress().toString();
            }
            conn.send(STR."Connection number: \{conn.getRemoteSocketAddress().toString()}");
            conn.send("true");
        } else if (connectionCount > 2) {
            conn.send("false");
        }
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        System.out.println(STR."closed \{conn.getRemoteSocketAddress()} with exit code \{code} additional info: \{reason}");
        connectionCount--;
        bothFinished = false;
        if (initCounter > 0) {
            initCounter--;
        }
        if (recentDisconnection == false) {
            if (conn.getRemoteSocketAddress().toString() == userArray[0] && userArray[0] != "" && userArray[1] != "") {
                userArray[0] = "";
                finishedArray[0] = "";
                broadcast("You won due to disconnection of your enemy");
                userWon = true;
                winner = userArray[1];
                location = "";
                recentDisconnection = true;
            } else if (userArray[0] != "" && userArray[1] != "") {
                userArray[1] = "";
                finishedArray[1] = "";
                broadcast("You won due to disconnection of your enemy");
                userWon = true;
                winner = userArray[0];
                location = "";
                recentDisconnection = true;
            }
        } else {
            recentDisconnection = false;
        }

    }

    @Override
    public void onMessage(WebSocket conn, String message) {
//        System.out.println("received message from "	+ conn.getRemoteSocketAddress() + ": " + message);
        System.out.println(message);
        if (message.startsWith("Location") && location == "") {
            location = message;
            conn.send(location);
//            broadcast("Broadcast: " + message.substring(10));
        } else if (message.startsWith("Location") && location != "") {
//            broadcast("Broadcast: " + message.substring(10));
            conn.send(location);
        }

        if (message.startsWith("RECEIVED POS")) {
            initCounter++;
            System.out.println(initCounter);
            if (initCounter > 1) {
                System.out.println("START");
                broadcast("START");
            }
        }

        if (message.startsWith("Finished")) {
            finishedCount++;
            if (finishedArray[0] == "") {
                finishedArray[0] = conn.getRemoteSocketAddress().toString();
            } else {
                finishedArray[1] = conn.getRemoteSocketAddress().toString();
            }
            if (finishedArray[0] != "" && finishedArray[1] != "") {
                showResults();
            }


        }
        if (message.startsWith("Points")) {
            System.out.println("points");
            if (pointsArr[0] == 0) {
                pointsArr[0] = Integer.parseInt(message.substring("Points: ".length()));
            } else {
                pointsArr[1] = Integer.parseInt(message.substring("Points: ".length()));
            }
            System.out.println(finishedCount);
            if (finishedCount >= 2) {
                System.out.println("points finished");
                Integer points = 0;
                if (pointsArr[0] > pointsArr[1] ){
                    points = pointsArr[0];
                }else{
                    points = pointsArr[1];
                }
                broadcast("Damage: " + points);
                pointsArr = new Integer[]{0, 0};
                finishedCount = 0;
            }
        }
        if (message.startsWith("Clicklocation")) {
            broadcast("Broadcast: " + message.substring("Clicklocation".length()));
        }

        if (message.startsWith("Distance")) {
            Double distance = Double.parseDouble(message.substring(message.indexOf(": ") + 1).trim());
            if (conn.getRemoteSocketAddress().toString() == userArray[0]) {
                userDistances[0] = distance;
            } else {
                userDistances[1] = distance;
            }
        }


    }

    public void showResults() {
        if (finishedCount >= 2) {
            bothFinished = true;
            userWon = true;
            System.out.println("finished");
            broadcast("FINISHED");
            if (userDistances[0] < userDistances[1]) {
                System.out.println(STR."\{userArray[0]} has won");
                winner = userArray[0];
            } else {
                System.out.println(STR."\{userArray[1]} has won");
                winner = userArray[1];
            }
            broadcast(STR."\{winner} was closer");
            location = "";
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println(STR."an error occurred on connection \{conn.getRemoteSocketAddress()}:\{ex}");
    }

    @Override
    public void onStart() {
        System.out.println("server started successfully");
    }


    public static void main(String[] args) {
        String host = "https://landjager.github.io";
        int port = 8887;

        WebSocketServer server = new MyWebSocketServer(new InetSocketAddress(host, port));
        server.start();
    }
}