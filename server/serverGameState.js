var Graph = require('../client/shared/Graph.js');
var GLOBALS = require('./GLOBALS.js');
module.exports = function () {
    this.GRAPH;
    this.timestamp;
    this.tick;

    this.setup = function(){
        this.GRAPH = new Graph();
        this.timestamp = new Date().getTime();
        this.tick = 0;
    }

    this.update = function(delta){
        this.GRAPH.update(delta);
        this.timestamp += delta;
        this.tick++;
    }//end update

    this.package = function(){
      var tempPackage = {
          time: this.timestamp,
          tick: this.tick,
          graph: this.GRAPH.package()
      }
      return tempPackage;
    }

    this.sendState = function(){
        var tempPackage = this.package();
        GLOBALS.socket.sendState(tempPackage);
    }

    this.userEvent = function(userEvent){
        switch (userEvent.type){
            case "addEnergyNode":
                var point = new GLOBALS.paper.Point({
                    x: userEvent.x,
                    y: userEvent.y
                });
                this.GRAPH.addEnergyNode(point);
                break;
        }//end switch on type
    }//end userEvent

}//end server GameState
