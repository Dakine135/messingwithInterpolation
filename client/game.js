var matter = require('matter-js');
var paper = require('paper');
var resurrect = require('resurrect-js');
var popupS = require('popups');
var GameState = require('./clientGameState.js');

paper.install(window);

var canvas = document.getElementById('myCanvas');
paper.setup(canvas);
view.viewSize = new Size(1200, 900);

global.GAMESTATE = new GameState();
GAMESTATE.setup();

view.onMouseDown = function(event) {
    var x = Math.round(event.point.x);
    var y = Math.round(event.point.y);
    var pointClicked = new Point(x, y);
    //console.log("click down @ ", pointClicked);
    GAMESTATE.GUI.mouseDown(pointClicked);

}

// We want to simulate 1000 ms / 60 FPS = 16.667 ms per frame every time we run update()
global.TIMESTEP = 1000 / 60;
var delta = 0;

var fps = 60,
    framesThisSecond = 0,
    lastFpsUpdate = 0;
var numOfUpdatesThisSecond = 0;

//onFrame calls requestAnimationFrame with browser
//main game loop
view.onFrame = function(event){
    // Track the accumulated time that hasn't been simulated yet
    delta += (event.delta * 1000); //event.delta is in full seconds, we need ms
    //console.log("delta: ", delta);

    if (Math.floor(event.time) > lastFpsUpdate) { // update every second
        fps = Math.round(0.25 * framesThisSecond + (1 - 0.25) * fps); // compute the new FPS
        GAMESTATE.GUI.fpsText.content = "FPS: " + fps;
        GAMESTATE.GUI.updatesText.content = "Updates/s: " + numOfUpdatesThisSecond;
        lastFpsUpdate = Math.floor(event.time);
        framesThisSecond = 0;
        numOfUpdatesThisSecond = 0;
    }
    framesThisSecond++;


    // Simulate the total elapsed time in fixed-size chunks
    while (delta >= TIMESTEP) {
        numOfUpdatesThisSecond++;
        if(numOfUpdatesThisSecond > 200){
            console.log("to many updates");
            break; // way to far behind to catch up
        }
        GAMESTATE.update(TIMESTEP);
        delta -= TIMESTEP;
    }

}

view.onResize = function(event){

}

// Draw the view now:
// paper.view.draw();

view.onMouseDrag = function(event) {
    var x = Math.round(event.point.x);
    var y = Math.round(event.point.y);
    var pointDragged = new Point(x, y);
    //console.log("Mouse Drag: ", pointDragged);
    GAMESTATE.GUI.mouseDrag(pointDragged);
}

view.onMouseUp = function(event) {
    var x = Math.round(event.point.x);
    var y = Math.round(event.point.y);
    var pointRealeased = new Point(x, y);
    //console.log("mouse released");
    GAMESTATE.GUI.mouseUp(pointRealeased);
}
