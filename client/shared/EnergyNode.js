module.exports = function (ID, point, size) {
    this.id = ID;
    this.point = point;
    this.circle = new paper.Shape.Circle(point, size);
    this.circle.strokeColor = 'blue';
    this.linkedNodes = [];

    this.addLink = function(node){
        console.log("link: ", this.id, " to ", node.id);
        this.linkedNodes.push(node);
    }
}

// EnergyNode.prototype = {
//
// };
