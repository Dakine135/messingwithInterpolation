//NPM PACKAGES
var express = require('express');
var socket = require('socket.io');
var matter = require('matter-js');
var paper = require('paper-jsdom');
var resurrect = require('resurrect-js');

var Graph = require('./client/shared/Graph.js');

var app = express();
var server = app.listen(3033);
var io = socket(server);

app.use(express.static('./client'));
console.log("Game node server running");









io.sockets.on('connection', newConnection);
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
        console.log("Server Time: ", serverTime);
        socket.emit('pong', serverTime);
    }

    socket.on('disconnecting', clientDisconnected);
    function clientDisconnected(){
        console.log("client disconnected: ", socket.id);
    }

}//new connection "per socket"
