//NPM PACKAGES
var express = require('express');
var matter = require('matter-js');
var paper = require('paper-jsdom');
const gameloop = require('node-gameloop');

var GameState = require('./serverGameState.js');
var Socket = require('./Socket.js');
var GLOBALS = require('./GLOBALS.js');
paper.setup();
GLOBALS.paper = paper;

var app = express();
var server = app.listen(3033);
var socket = new Socket(server);
GLOBALS.socket = socket;

var GAMESTATE = new GameState();
GAMESTATE.setup();

GLOBALS.gameState = GAMESTATE;

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

    if(frameCount % (ticksPerSecond / 4) == 0){
      //every 4th update
      GAMESTATE.sendState();
    }

    if(oneTime > 0){
        //GAMESTATE.sendState();
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
