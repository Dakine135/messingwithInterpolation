var Graph = require('./client/shared/Graph.js');
module.exports = function () {
  this.GRAPH;

  this.setup = function(){
    this.GRAPH = new Graph();
  }

  this.update = function(delta){
    this.GRAPH.update(delta);
  }//end update

}//end server GameState
