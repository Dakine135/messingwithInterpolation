//NPM PACKAGES
var express = require('express');
var socket = require('socket.io');

var app = express();
var server = app.listen(3033);
var io = socket(server);

app.use(express.static('./phaser/examples'));
console.log("Phaser node server running");

io.sockets.on('connection', newConnection);

function newConnection(socket){
  //Client first connects, create Client object and snake
  console.log("a user connected: ", socket.id);

    // socket.on('guiState', updateGuiState);
    // function updateGuiState(guiState){
    //     GLOBALS.CURRENTGAMESTATE.updateGuiState(guiState);
    // }

    socket.on('disconnecting', clientDisconnected);
    function clientDisconnected(){
        console.log("client disconnected: ", socket.id);
    }

}//new connection "per socket"
