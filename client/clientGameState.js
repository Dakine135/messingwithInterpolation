var Graph = require('./shared/Graph.js');
var Gui = require('./shared/Gui.js');
var Socket = require('./Socket.js');
module.exports = function () {
    this.GRAPH;
    this.GUI;
    this.SOCKET;

    var that = this;

    this.setup = function(){
        this.GRAPH = new Graph();
        this.GUI = new Gui(this.GRAPH);
        this.SOCKET = new Socket();
        this.SOCKET.getName();
        this.SOCKET.updateServerTimeDiffernce();
    }

    this.update = function(delta){
        this.GRAPH.update(delta);
    }

    /*
        Process User Events
    */
    this.addEnergyNode = function(pointClicked){
        var timeStamp = new Date().getTime();
        var adjustedTimeStamp;
        if(this.SOCKET.timeDiffernce != null){
            adjustedTimeStamp = timeStamp + this.SOCKET.timeDiffernce;
        } else adjustedTimeStamp = timeStamp;
        var  addEnergyNodeEvent = {
            type: "addEnergyNode",
            point: pointClicked,
            time: adjustedTimeStamp
        }
        this.SOCKET.sendUserEvent(addEnergyNodeEvent);
    }


}
