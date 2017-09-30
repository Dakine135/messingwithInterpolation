module.exports = function (ID, point, size) {
    this.id = ID;
    this.circle = new paper.Shape.Circle(point, size);
    this.circle.style = {
        fillColor: 'blue',
        strokeColor: 'green',
        strokeWidth: 3
    }
    //this.circle.fillColor.hue = 20;
    this.currentPath = -1;
    this.linkedNodes = [];

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
        this.currentPath = this.linkedNodes.length - 1;
    }

    this.nextLink = function(){
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

    }
}

// EnergyNode.prototype = {
//
// };
