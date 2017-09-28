var matter = require('matter-js');
window.paper = require('paper');
var resurrect = require('resurrect-js');
var EnergyNode = require('./shared/EnergyNode.js');
var Graph = require('./shared/Graph.js');

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


    // var start = new paper.Point(100, 100);
    // var energyNodeStart = new EnergyNode(start, 20);
    //
    // var end = start.add([ 200, -50 ]);
    // var energyNodeEnd = new EnergyNode(end, 20);
    // energyNodeStart.addLink(energyNodeEnd);

    var graph = new Graph();

    var lastNodeId = null;

    view.onMouseDown = function(event) {
        var x = Math.round(event.point.x);
        var y = Math.round(event.point.y);
        var pointClicked = new Point(x, y);
        console.log("click down @ ", pointClicked);
    	var newNodeId = graph.addEnergyNode(pointClicked);
        if(lastNodeId == null){
            lastNodeId = newNodeId;
        } else {
            graph.addLink(lastNodeId, newNodeId);
            lastNodeId = newNodeId;
        }
    }

    view.onFrame = function(event){
        //console.log(event);
    }

    view.onResize = function(event){

    }

    // Draw the view now:
    // paper.view.draw();

    function onMouseDrag(event) {
        console.log("Mouse Drag: ", event);
    	//myPath.add(event.point);
    }

    function onMouseUp(event) {
        console.log("mouse up: ", event);
    	// var myCircle = new Path.Circle({
    	// 	center: event.point,
    	// 	radius: 10
    	// });
    	// myCircle.strokeColor = 'black';
    	// myCircle.fillColor = 'white';
    }


}//end onload
