var matter = require('matter-js');
var paper = require('paper');
var resurrect = require('resurrect-js');
var popupS = require('popups');
var Graph = require('./shared/Graph.js');
var Gui = require('./shared/Gui.js');
var GameState = require('./clientGameState.js');
var Socket = require('./Socket.js');

paper.install(window);

var canvas = document.getElementById('myCanvas');
paper.setup(canvas);
view.viewSize = new Size(1200, 900);

global.GRAPH = new Graph();
global.GUI = new Gui(GRAPH);
global.SOCKET = new Socket();
SOCKET.getName();
SOCKET.updateServerTimeDiffernce();

global.GAMESTATE = new GameState();

view.onMouseDown = function(event) {
    var x = Math.round(event.point.x);
    var y = Math.round(event.point.y);
    var pointClicked = new Point(x, y);
    //console.log("click down @ ", pointClicked);
    GUI.mouseDown(pointClicked);

}

view.onFrame = function(event){
    GRAPH.update(event.delta);
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
    GUI.mouseDrag(pointDragged);
}

view.onMouseUp = function(event) {
    var x = Math.round(event.point.x);
    var y = Math.round(event.point.y);
    var pointRealeased = new Point(x, y);
    //console.log("mouse released");
    GUI.mouseUp(pointRealeased);
}
