var GLOBALS = require('../../server/GLOBALS.js');
var isNode = require('detect-node');
module.exports = function (ID, point, size) {
  var paper;
  if(isNode) {
      console.log("server addEnergyNode");
      paper = GLOBALS.paper;
  } else {
      console.log("browser addEnergyNode");
      paper = window.paper;
  }
    this.id = ID;
    this.temp = 0;
    var maxTemp = 1000;
    this.circle = new paper.Shape.Circle(point, size);
    this.circle.style = {
        fillColor: 'blue',
        strokeColor: 'green',
        strokeWidth: 3
    }
    this.circle.fillColor.blue = 1;
    this.circle.fillColor.red = 0;
    this.currentPath = -1;
    this.linkedNodes = [];
    this.linkedFromNodes = [];

    this.debugText = new paper.PointText(point.x + 10, point.y - 10);
    this.debugText.fillColor = "white";
    this.debugText.content = this.temp;

    var that = this;

    this.package = function(){
        var tempPackage = {
            id: this.id,
            x: this.circle.position.x,
            y: this.circle.position.y,
            linkedNodes: this.linkedNodes,
            linkedFromNodes: this.linkedFromNodes
        }
        return tempPackage;
    }

    this.addLink = function(node){
        //console.log("link: ", this.id, " to ", node.id);
        var newLinkPath = new paper.Path(this.circle.position, node.circle.position);
        newLinkPath.style = {
            strokeColor: 'green',
            strokeWidth: 3
        }
        var link = {
            path: newLinkPath,
            node: node
        }
        this.linkedNodes.push(link);
        node.linkedFromNodes.push(this);
        this.currentPath = this.linkedNodes.length - 1;
    }

    this.moveTo = function(point){
      this.circle.position = point;
      this.debugText.position = new paper.Point(point.x + 10, point.y - 10);
      //move begining of all paths going out
      this.linkedNodes.forEach( function(link){
        link.path.segments[link.path.firstSegment.index].point = point;
      });
      //move end of all paths linking in
      this.linkedFromNodes.forEach( function(fromNode){
        fromNode.linkedNodes.forEach( function(link){
            if(link.node.id == that.id){
                link.path.segments[link.path.lastSegment.index].point = point;
            }
        });
      });
    }

    this.nextLink = function(){
        this.temp += 5;
        if(this.currentPath == -1) return null;
        var link = this.linkedNodes[this.currentPath];
        this.currentPath++;
        if(this.currentPath >= this.linkedNodes.length) this.currentPath = 0;
        return link;
    }

    this.toggleSelected = function(){
        this.circle.selected = !this.circle.selected;
    }

    this.update = function(delta){
      //console.log(this.temp);
      if(this.temp > 0) this.temp--;
      if(this.temp > maxTemp) this.temp = maxTemp;
      var tempScale = this.temp / maxTemp;
      this.circle.fillColor = {
        gradient: {
          stops: [['red', tempScale], ['blue', 1]],
          radial: true
        },
        origin: this.circle.position,
        destination: this.circle.bounds.rightCenter
      };
      this.debugText.content = this.temp;
    }//end update
}

// EnergyNode.prototype = {
//
// };
