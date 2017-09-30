var matter = require('matter-js');
var paper = require('paper');
var resurrect = require('resurrect-js');
var Graph = require('./shared/Graph.js');
var Gui = require('./shared/Gui.js');

paper.install(window);
// Only executed our code once the DOM is ready.
window.onload = function() {
    // Get a reference to the canvas object
    // Create an empty project and a view for the canvas:
    var canvas = document.getElementById('myCanvas');
    paper.setup(canvas);
    view.viewSize = new Size(1200, 900);
    //console.log(view.viewSize);
    //(new Size(1200, 900));

    // var path = new Path(500, 500, 500, 700);
    // path.fillColor = "blue";


    var graph = new Graph();
    var gui = new Gui(graph);

    view.onMouseDown = function(event) {
        var x = Math.round(event.point.x);
        var y = Math.round(event.point.y);
        var pointClicked = new Point(x, y);
        //console.log("click down @ ", pointClicked);
        gui.mouseDown(pointClicked);

    }

    view.onFrame = function(event){
        graph.update(event.delta);
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
        gui.mouseDrag(pointDragged);
    }

    view.onMouseUp = function(event) {
        var x = Math.round(event.point.x);
        var y = Math.round(event.point.y);
        var pointRealeased = new Point(x, y);
        //console.log("mouse released");
        gui.mouseUp(pointRealeased);
    }


}//end onload
