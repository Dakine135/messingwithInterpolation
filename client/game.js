var matter = require('matter-js');
window.paper = require('paper');
var resurrect = require('resurrect-js');
var EnergyNode = require('./shared/EnergyNode.js');

// Only executed our code once the DOM is ready.
window.onload = function() {
    // Get a reference to the canvas object
    // Create an empty project and a view for the canvas:
    var canvas = document.getElementById('myCanvas');
    paper.setup(canvas);

    // Create a Paper.js Path to draw a line into it:
    // Give the stroke a color
    // Move to start and draw a line from there
    var path = new paper.Path();
    path.strokeColor = 'white';
    var start = new paper.Point(100, 100);
    path.moveTo(start);

    //create EnergyNode at start
    var energyNodeStart = EnergyNode(start, 20);

    //create path and end circle
    var end = start.add([ 200, -50 ]);
    path.lineTo(end);
    var energyNodeEnd = EnergyNode(end, 20);

    console.log("Time: ", new Date());

    // Draw the view now:
    paper.view.draw();



    // var myPath;
    //
    // function onMouseDown(event) {
    // 	myPath = new Path();
    // 	myPath.strokeColor = 'black';
    // }
    //
    // function onMouseDrag(event) {
    // 	myPath.add(event.point);
    // }
    //
    // function onMouseUp(event) {
    // 	var myCircle = new Path.Circle({
    // 		center: event.point,
    // 		radius: 10
    // 	});
    // 	myCircle.strokeColor = 'black';
    // 	myCircle.fillColor = 'white';
    // }


}
