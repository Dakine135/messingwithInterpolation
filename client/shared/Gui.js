var Graph = require('./Graph.js');
var Button = require('./Button.js');
var Cookies = require('cookies-js');
module.exports = function (graph) {

    //main graph reference
    this.graph = graph;

    //variables
    this.nodeBeingMoved = -1;
    this.addLinkStartNode = -1;
    this.activeTool = "None";
    this.buttonClicked = false;

    var that = this;

    //text
    this.nameText = new PointText(new Point(10, 20));
    this.pingText = new PointText(new Point(10, 40));
    this.updatesText = new PointText(new Point(10, 60));
    this.fpsText = new PointText(new Point(10, 80));
    this.timeDiffernceText = new PointText(new Point(10, 100));
    this.textGroup = new Group(this.nameText, this.timeDiffernceText,
        this.pingText,this.fpsText, this.updatesText);
    this.textGroup.style = {
        justification: 'left',
        fillColor: 'white'
    };

    //buttons
    this.buttons = [];
    var xPos = 760;
    this.buttons.push(
        new Button("Add Node", xPos, 10, function(self, pointClicked){
            that.activeTool = "addNode";
            that.removeStrokeFromAllButtons();
            self.rectangle.strokeWidth = 4;

    }));
    xPos += 110;
    this.buttons.push(
        new Button("Move Node", xPos, 10, function(self, pointClicked){
            that.activeTool = "moveNode";
            that.removeStrokeFromAllButtons();
            self.rectangle.strokeWidth = 4;
    }));
    xPos += 110;
    this.buttons.push(
        new Button("Add Link", xPos, 10, function(self, pointClicked){
            that.activeTool = "addLink";
            that.removeStrokeFromAllButtons();
            self.rectangle.strokeWidth = 4;
    }));
    xPos += 110;
    this.buttons.push(
        new Button("Add Packet", xPos, 10, function(self, pointClicked){
            that.activeTool = "addPacket";
            that.removeStrokeFromAllButtons();
            self.rectangle.strokeWidth = 4;
    }));

    this.removeStrokeFromAllButtons = function(){
      this.buttons.forEach( function(button){
          button.rectangle.strokeWidth = 0;
      });
    }

    this.mouseDown = function(pointClicked){
        //check if gui button clicked
        this.buttonClicked = false;
        this.buttons.forEach( function(button){
            var tempClickedBool = button.clicked(pointClicked);
            if(tempClickedBool) that.buttonClicked = true;
        });

        if(!this.buttonClicked){
            if(this.activeTool == "moveNode"){
                //check if clicked on node
                var nodeClickedId = this.graph.checkIfNodeAtPoint(pointClicked);
                if(nodeClickedId != -1){
                    //console.log("Node Clicked: ", nodeClickedId);
                    this.nodeBeingMoved = nodeClickedId;
                    this.graph.toggleSelectedNode(nodeClickedId);
                }
            }//end moveNodeTool
            else if(this.activeTool == "addNode"){
                //create new node
                //var newNodeId = this.graph.addEnergyNode(pointClicked);
                GAMESTATE.addEnergyNode(pointClicked);
            }//end addNodeTool
            else if(this.activeTool == "addLink"){
                //add Link
                var nodeClickedId = this.graph.checkIfNodeAtPoint(pointClicked);
                if(nodeClickedId != -1){
                    //console.log("Node Clicked: ", nodeClickedId);
                    this.addLinkStartNode = nodeClickedId;
                }
            }//end addNodeTool
            else if(this.activeTool == "addPacket"){
                var nodeClickedId = this.graph.checkIfNodeAtPoint(pointClicked);
                if(nodeClickedId != -1){
                    this.graph.addPacket(nodeClickedId);
                }
            }//end addPacketTool


        }//end no buttonClicked
    }//end mouseDown

    this.mouseDrag = function(pointDragged){
        if(this.activeTool == "addLink"){

        }
        else if(this.activeTool == "moveNode" && this.nodeBeingMoved != -1){
            this.graph.moveEnergyNode(this.nodeBeingMoved, pointDragged);
        }
    }//end mouseDrag

    this.mouseUp = function(pointRealeased){
        if(this.activeTool == "addLink" && this.addLinkStartNode != -1){
            var nodeClickedId = this.graph.checkIfNodeAtPoint(pointRealeased);
            if(nodeClickedId != -1 && nodeClickedId != this.addLinkStartNode){
                console.log("addLink: ", this.addLinkStartNode, nodeClickedId);
                this.graph.addLink(this.addLinkStartNode, nodeClickedId);
            }
            this.addLinkStartNode = -1;
        }
        else if(this.activeTool == "moveNode" && this.nodeBeingMoved != -1){
            this.graph.toggleSelectedNode(this.nodeBeingMoved);
            this.nodeBeingMoved = -1;
        }
    }//end mouseUp

}//end Gui Class
