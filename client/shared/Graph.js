var EnergyNode = require('./EnergyNode.js');
var Packet = require('./Packet.js');
module.exports = function () {
    this.currentIdNum = 0;
    this.energyNodes = {};
    //this.path = new paper.Path();
    // this.path.style = {
    //     strokeColor: 'green',
    //     strokeWidth: 3
    // }
    //this.path.fullySelected = true;
    //this.path.closed = true;

    this.packets = [];

    var that = this;

    this.addEnergyNode = function(point){
        var size = 20;
        var newNode = new EnergyNode(this.currentIdNum, point, size);
        this.energyNodes[this.currentIdNum] = newNode;
        var returnId = this.currentIdNum;
        this.currentIdNum++;

        //console.log(Object.keys(this.energyNodes));
        // if(Object.keys(this.energyNodes).length == 1){
        //     //console.log("first Node");
        //     //this.path = new paper.Path();
        //     this.path.moveTo(point);
        // }
        return returnId;
    }

    this.addLink = function(fromNodeId, toNodeId){
        var fromNode = this.energyNodes[fromNodeId];
        var toNode = this.energyNodes[toNodeId];
        fromNode.addLink(toNode);
        //this.path.lineTo(toNode.circle.position);
        //this.path.smooth();
    }

    this.addPacket = function(nodeId){
        var nodeStart = this.energyNodes[nodeId];
        var link = nodeStart.nextLink();
        if(link != null){
            this.packets.push( new Packet(nodeStart, link));
        }
    }

    this.moveEnergyNode = function(nodeId, point){
        var node = this.energyNodes[nodeId];
        node.moveTo(point);
    }

    this.checkIfNodeAtPoint = function(point){
        var nodeClickedId = -1; //no node clicked
        Object.keys(this.energyNodes).forEach( function(nodeId){
            if(that.energyNodes[nodeId].circle.contains(point)){
                nodeClickedId = nodeId;
                return;
            }
        });
        return nodeClickedId;
    }

    this.toggleSelectedNode = function(nodeId){
        this.energyNodes[nodeId].toggleSelected();
    }

    this.update = function(delta){
        this.packets.forEach( function(packet){
            packet.update(delta);
        });
        Object.keys(this.energyNodes).forEach( function(nodeId){
            that.energyNodes[nodeId].update(delta);
        });
    }
}
