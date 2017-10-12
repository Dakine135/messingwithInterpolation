var socket = require('socket.io');
var GLOBALS = require('./GLOBALS.js');
module.exports = function (server) {
    this.io = socket(server);

    this.sendState = function(serverGameState){
        this.io.sockets.emit('serverGameState', serverGameState);
    }

    this.io.sockets.on('connection', newConnection);
    function newConnection(socket){
      //Client first connects, create Client object and snake
      console.log("a user connected: ", socket.id);

        socket.on('clientData', clientJoin);
        function clientJoin(clientData){
            console.log("Client Data: ", clientData);
        }

        socket.on('sendPing', ping);
        function ping(){
            var serverTime = new Date().getTime();
            //console.log("Server Time: ", serverTime);
            socket.emit('pong', serverTime);
        }

        socket.on('userEvent', function(userEvent){
            console.log("Event: ", userEvent);
            GLOBALS.gameState.userEvent(userEvent);
        });


        socket.on('disconnecting', clientDisconnected);
        function clientDisconnected(){
            console.log("client disconnected: ", socket.id);
        }

    }//new connection "per socket"

}//end Socket class
