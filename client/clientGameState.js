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

    this.handleServerPackage = function(serverGameState){
        //console.log(serverGameState.graph);
        serverGameState.graph.energyNodes.forEach( function(node){
            if(that.GRAPH.energyNodes[node.id] == null){
                var point = new Point(node.x, node.y);
                that.GRAPH.addEnergyNode(point);
            }
        });
        //this.GRAPH = serverGameState.graph;
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
            x: pointClicked.x,
            y: pointClicked.y,
            time: adjustedTimeStamp
        }
        this.SOCKET.sendUserEvent(addEnergyNodeEvent);
    }


}
