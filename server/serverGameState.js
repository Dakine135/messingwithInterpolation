var Graph = require('../client/shared/Graph.js');
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
          graph: this.GRAPH
      }
      return tempPackage;
  }

    this.userEvent = function(userEvent){
        switch (userEvent.type){
            case "addEnergyNode":
            this.GRAPH.addEnergyNode(userEvent.point);
        }//end switch on type
    }//end userEvent

}//end server GameState
