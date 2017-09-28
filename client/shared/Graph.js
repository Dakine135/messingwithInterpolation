var EnergyNode = require('./EnergyNode.js');
module.exports = function () {
    this.currentIdNum = 0;
    this.energyNodes = {};
    this.path = new paper.Path();
    this.path.strokeColor = 'white';

    this.addEnergyNode = function(point){
        var size = 20;
        var newNode = new EnergyNode(this.currentIdNum, point, size);
        this.energyNodes[this.currentIdNum] = newNode;
        var returnId = this.currentIdNum;
        this.currentIdNum++;

        //console.log(Object.keys(this.energyNodes));
        if(Object.keys(this.energyNodes).length == 1){
            console.log("first Node");
            //this.path = new paper.Path();
            this.path.moveTo(point);
        }

        return returnId;
    }

    this.addLink = function(fromNodeId, toNodeId){
        var fromNode = this.energyNodes[fromNodeId];
        var toNode = this.energyNodes[toNodeId];
        fromNode.addLink(toNode);
        this.path.lineTo(toNode.point);
        this.path.smooth();
    }
}
