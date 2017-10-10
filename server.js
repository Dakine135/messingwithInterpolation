//NPM PACKAGES
var express = require('express');
var socket = require('socket.io');
var matter = require('matter-js');
var paper = require('paper-jsdom');
var resurrect = require('resurrect-js');
const gameloop = require('node-gameloop');

var GameState = require('./serverGameState.js');
var GLOBALS = require('./GLOBALS.js');
paper.setup();
GLOBALS.paper = paper;

var app = express();
var server = app.listen(3033);
var io = socket(server);

var GAMESTATE = new GameState(paper);
GAMESTATE.setup();

app.use(express.static('./client'));
console.log("Game node server running");

var oneTime = 1;


// start the loop at 60 fps (1000/60ms per frame) and grab its id
let frameCount = 0;
var ticksPerSecond = 60;
var TIMESTEP = 1000 / ticksPerSecond;
var delta = 0;
const id = gameloop.setGameLoop(function(lastTickDelta) {
    // `delta` is the delta time from the last frame
    delta += (lastTickDelta * 1000);
    frameCount++;

    if(frameCount % (ticksPerSecond * 10) == 0){
      //every 10 seconds
      console.log('frame=%s, delta=%s', frameCount, delta);
    }

    if(oneTime > 0){
      var point = new GLOBALS.paper.Point(100,100);
      GAMESTATE.GRAPH.addEnergyNode(point);
      oneTime--;
    }


    // Simulate the total elapsed time in fixed-size chunks
    while (delta >= TIMESTEP) {
        GAMESTATE.update(TIMESTEP);
        delta -= TIMESTEP;
    }

}, TIMESTEP);

//stop the loop
//gameloop.clearGameLoop(id);

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

    socket.on('userEvent', function(userEvent){
        console.log("Event: ", userEvent);
        //handle event in server GAMESTATE
    });


    socket.on('disconnecting', clientDisconnected);
    function clientDisconnected(){
        console.log("client disconnected: ", socket.id);
    }

}//new connection "per socket"
