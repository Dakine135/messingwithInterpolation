var EnergyNode = require('./EnergyNode.js');
module.exports = function (nodeStart, link) {
    //console.log("NodeStart: ", nodeStart.id);
    this.nodeStart = nodeStart;
    this.nodeEnd = link.node;
    this.size = 6;
    this.speed = 300; //  pixels/second
    this.dir = 1;
    this.path = link.path;
    this.offset = 0;
    this.circle = new paper.Shape.Circle(nodeStart.circle.position, this.size);
    this.circle.style = {
        fillColor: 'yellow',
        strokeColor: 'white',
        strokeWidth: 2
    }

    this.update = function (delta, path) {
          this.offset += this.dir * delta * this.speed; // speed - 150px/second
          if(this.offset > this.path.length){
              var nextLink = this.nodeEnd.nextLink();
              if(nextLink != null){
                  this.nodeStart = this.nodeEnd;
                  this.nodeEnd = nextLink.node;
                  this.path = nextLink.path;
                  this.offset = 0;
              } else {
                  this.offset = this.path.length;
                  this.dir = -1;
              }
          } else if (this.offset < 0){
              //came back to start Node
              var nextLink = this.nodeStart.nextLink();
              if(nextLink != null){
                  this.nodeEnd = nextLink.node;
                  this.path = nextLink.path;
                  this.offset = 0;
                  this.dir = 1;
              } else {
                  this.offset = 0;
                  this.dir = 1;
              }
          }
          this.circle.position = this.path.getPointAt(this.offset);
    }//end update function

} //end Packet class
