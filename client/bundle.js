(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var GLOBALS = {};
GLOBALS.paper = null;
module.exports = GLOBALS;

},{}],2:[function(require,module,exports){
var Cookies = require('cookies-js');
module.exports = function () {
    this.socket = io();
    this.client = {
        name: ""
    };
    this.timeDiffernce = null;
    this.serverTick = 0;
    this.ping = 30;

    var that = this;

    this.getName = function(){
        //get and set name, or pull from Cookies
        this.client.name = Cookies.get('name');
        if(this.client.name == null){
            popupS.prompt({
                content:     'What is your name?',
                placeholder: '>>>',
                onSubmit: function(val) {
                    if(val) {
                        that.client.name = val;
                        Cookies.set('name', val, { expires: Infinity });
                        console.log("Name: ", that.client.name);
                        GAMESTATE.GUI.nameText.content = "Name: " + that.client.name;
                        that.updateClientData();
                    } else {
                        console.log("no val");
                        that.getName();
                    }
                }
            });
        } else {
            console.log("Name: ", this.client.name);
            GAMESTATE.GUI.nameText.content = "Name: " + that.client.name;
            this.updateClientData();
        }
    }

    this.updateClientData = function(){
        this.socket.emit('clientData',this.client);
    }

    this.getServerTimeStamp = function(){
        return new Promise(function(resolve){
            that.socket.emit('sendPing');
            that.socket.on('pong', function(serverTimeStamp){
                //console.log("serverTimeStamp: ", serverTimeStamp);
                resolve(serverTimeStamp);
            });
        });
    }//end ping server

    this.timeDiffernceArray = [];
    this.updateServerTimeDiffernce = function(){
        if(this.timeDiffernceArray.length < 5){
            this.getServerTimeDiffernce().then((timeDiffernce) => {
                if(that.timeDiffernce == null){
                    that.timeDiffernce = timeDiffernce;
                    GAMESTATE.GUI.timeDiffernceText.content = "Time Differnce: Calculating";
                }
                that.timeDiffernceArray.push(timeDiffernce);
                //console.log(timeDiffernce);
                setTimeout(function(){
                    that.updateServerTimeDiffernce();
                }, 3000);
            });

        } else {
            //calculate standard deviation and mean, then set timeDiffernce
            this.timeDiffernceArray.sort();
            console.log(this.timeDiffernceArray);
            var midIndex = Math.floor(this.timeDiffernceArray.length / 2);
            var mean = this.timeDiffernceArray[midIndex];
            //console.log("Mean: ", mean);
            var squareSum = 0;
            for(var i=0; i<this.timeDiffernceArray.length; i++){
              var diff = mean - this.timeDiffernceArray[i];
              var square = Math.pow(diff, 2);
              squareSum += square;
            }
            var avgSquaredDistance = squareSum / this.timeDiffernceArray.length;
            var standardDeviation = Math.pow(avgSquaredDistance, 0.5);
            //console.log("standardDeviation: ", standardDeviation);
            var sumOfCluster = 0;
            totalCount = 0;
            this.timeDiffernceArray.forEach((time) => {
              if(time < standardDeviation){
                sumOfCluster += time;
                totalCount++;
              }
            });
            this.timeDiffernce = sumOfCluster / totalCount;
            GAMESTATE.GUI.timeDiffernceText.content = "Time Differnce: " + this.timeDiffernce;
            //console.log("this.timeDiffernce: ",this.timeDiffernce);
        }
    } //end updateServerTimeDiffernce

    this.getServerTimeDiffernce = function(){
        var timeSent = new Date().getTime();
        //ping server and recieve server timestamp (time received from server's prespective)
        var serverTimePromise = this.getServerTimeStamp();
        return serverTimePromise.then((serverTime) => {
            //take time when recieved on client, this is the round-trip time
            var timeRecieved = new Date().getTime();
            var roundTripTime = timeRecieved - timeSent;
            this.ping = Math.round(0.75 * roundTripTime + (0.25) * this.ping);
            GAMESTATE.GUI.pingText.content = "Ping: " + this.ping;
            //half this for the one-way time delay
            var delay = roundTripTime / 2;
            //subtract travel time from servers timestamp
            var adjustedServerTime = serverTime - delay;
            //now you can calculate differnce in server and client time
            var timeDiffernce = adjustedServerTime - timeSent;
            // console.log("Time Sent:          ", timeSent);
            // console.log("Time Recieved:      ", timeRecieved);
            // console.log("serverTime:         ", serverTime);
            // console.log("roundTripTime:      ", roundTripTime);
            // console.log("Delay:              ", delay);
            // console.log("adjustedServerTime: ", adjustedServerTime);
            //console.log("timeDiffernce:      ", timeDiffernce);
            return new Promise(function(resolve){
                resolve(timeDiffernce);
            });
        });
    }//end getServerTimeDiffernce

    this.sendUserEvent = function(addEnergyNodeEvent){
        this.socket.emit("userEvent", addEnergyNodeEvent);
    }

}// end socket class

},{"cookies-js":12}],3:[function(require,module,exports){
var Graph = require('./shared/Graph.js');
var Gui = require('./shared/Gui.js');
var Socket = require('./Socket.js');
module.exports = function () {
    this.GRAPH;
    this.GUI;
    this.SOCKET;

    var that = this;

    this.setup = function(){
        this.GRAPH = new Graph();
        this.GUI = new Gui(this.GRAPH);
        this.SOCKET = new Socket();
        this.SOCKET.getName();
        this.SOCKET.updateServerTimeDiffernce();
    }

    this.update = function(delta){
        this.GRAPH.update(delta);
    }

    /*
        Process User Events
    */
    this.addEnergyNode = function(pointClicked){
        var timeStamp = new Date().getTime();
        var adjustedTimeStamp = timeStamp + this.SOCKET.timeDiffernce;
        var  addEnergyNodeEvent = {
            type: "addEnergyNode",
            point: pointClicked,
            time: adjustedTimeStamp
        }
        this.SOCKET.sendUserEvent(addEnergyNodeEvent);
    }


}

},{"./Socket.js":2,"./shared/Graph.js":7,"./shared/Gui.js":8}],4:[function(require,module,exports){
(function (global){
var matter = require('matter-js');
var paper = require('paper');
var resurrect = require('resurrect-js');
var popupS = require('popups');
var GameState = require('./clientGameState.js');

paper.install(window);

var canvas = document.getElementById('myCanvas');
paper.setup(canvas);
view.viewSize = new Size(1200, 900);

global.GAMESTATE = new GameState();
GAMESTATE.setup();

view.onMouseDown = function(event) {
    var x = Math.round(event.point.x);
    var y = Math.round(event.point.y);
    var pointClicked = new Point(x, y);
    //console.log("click down @ ", pointClicked);
    GAMESTATE.GUI.mouseDown(pointClicked);

}

// We want to simulate 1000 ms / 60 FPS = 16.667 ms per frame every time we run update()
global.TIMESTEP = 1000 / 60;
var delta = 0;

var fps = 60,
    framesThisSecond = 0,
    lastFpsUpdate = 0;
var numOfUpdatesThisSecond = 0;

//onFrame calls requestAnimationFrame with browser
//main game loop
view.onFrame = function(event){
    // Track the accumulated time that hasn't been simulated yet
    delta += (event.delta * 1000); //event.delta is in full seconds, we need ms
    //console.log("delta: ", delta);

    if (Math.floor(event.time) > lastFpsUpdate) { // update every second
        fps = Math.round(0.25 * framesThisSecond + (1 - 0.25) * fps); // compute the new FPS
        GAMESTATE.GUI.fpsText.content = "FPS: " + fps;
        GAMESTATE.GUI.updatesText.content = "Updates/s: " + numOfUpdatesThisSecond;
        lastFpsUpdate = Math.floor(event.time);
        framesThisSecond = 0;
        numOfUpdatesThisSecond = 0;
    }
    framesThisSecond++;


    // Simulate the total elapsed time in fixed-size chunks
    while (delta >= TIMESTEP) {
        numOfUpdatesThisSecond++;
        if(numOfUpdatesThisSecond > 200){
            console.log("to many updates");
            break; // way to far behind to catch up
        }
        GAMESTATE.update(TIMESTEP);
        delta -= TIMESTEP;
    }

}

view.onResize = function(event){

}

// Draw the view now:
// paper.view.draw();

view.onMouseDrag = function(event) {
    var x = Math.round(event.point.x);
    var y = Math.round(event.point.y);
    var pointDragged = new Point(x, y);
    //console.log("Mouse Drag: ", pointDragged);
    GAMESTATE.GUI.mouseDrag(pointDragged);
}

view.onMouseUp = function(event) {
    var x = Math.round(event.point.x);
    var y = Math.round(event.point.y);
    var pointRealeased = new Point(x, y);
    //console.log("mouse released");
    GAMESTATE.GUI.mouseUp(pointRealeased);
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./clientGameState.js":3,"matter-js":14,"paper":15,"popups":16,"resurrect-js":17}],5:[function(require,module,exports){
module.exports = function (text, x, y, callBack) {
    var viewWidth = view.viewSize._width;
    var viewHeight = view.viewSize._height;
    this.width = 100;
    this.height = 50;
    this.x = x;
    this.y = y;
    this.rectangle = new paper.Shape.Rectangle(this.x, this.y, this.width, this.height);
    this.rectangle.style = {
        fillColor: 'brown',
        strokeColor: 'yellow',
        strokeWidth: 0
    }

    this.text = new PointText(new Point(
        (this.x + (this.width/2)),
        (this.y + (this.height/2))
    ));
    this.text.justification = 'center';
    this.text.fillColor = 'white';
    this.text.content = text;
    this.rectangle.addChild(this.text);

    this.callBack = callBack;

    this.clicked = function(pointClicked){
        if(this.rectangle.contains(pointClicked)){
            this.callBack(this, pointClicked);
            return true;
        }
        return false;
    }
}//end Button Class

},{}],6:[function(require,module,exports){
var GLOBALS = require('../../GLOBALS.js');
var isNode = require('detect-node');
module.exports = function (ID, point, size) {
  var paper;
  if(isNode) {
      console.log("server");
      paper = GLOBALS.paper;
  } else {
      console.log("browser");
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

},{"../../GLOBALS.js":1,"detect-node":13}],7:[function(require,module,exports){
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

},{"./EnergyNode.js":6,"./Packet.js":9}],8:[function(require,module,exports){
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

},{"./Button.js":5,"./Graph.js":7,"cookies-js":12}],9:[function(require,module,exports){
var EnergyNode = require('./EnergyNode.js');
var GLOBALS = require('../../GLOBALS.js');
var isNode = require('detect-node');
module.exports = function (nodeStart, link) {
  var paper;
  if(isNode) {
      console.log("server");
      paper = GLOBALS.paper;
  } else {
      console.log("browser");
      paper = window.paper;
  }

    //console.log("NodeStart: ", nodeStart.id);
    this.nodeStart = nodeStart;
    this.nodeEnd = link.node;
    this.size = 6;
    this.speed = 0.3; //  pixels/update
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
          this.offset += this.dir * delta * this.speed;
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

},{"../../GLOBALS.js":1,"./EnergyNode.js":6,"detect-node":13}],10:[function(require,module,exports){
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.acorn = global.acorn || {})));
}(this, (function (exports) { 'use strict';

// Reserved word lists for various dialects of the language

var reservedWords = {
  3: "abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile",
  5: "class enum extends super const export import",
  6: "enum",
  strict: "implements interface let package private protected public static yield",
  strictBind: "eval arguments"
}

// And the keywords

var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this"

var keywords = {
  5: ecma5AndLessKeywords,
  6: ecma5AndLessKeywords + " const class extends export import super"
}

// ## Character categories

// Big ugly regular expressions that match characters in the
// whitespace, identifier, and identifier-start categories. These
// are only applied when a character is found to actually have a
// code point above 128.
// Generated by `bin/generate-identifier-regex.js`.

var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u037f\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u052f\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0-\u08b4\u08b6-\u08bd\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0af9\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c39\u0c3d\u0c58-\u0c5a\u0c60\u0c61\u0c80\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d54-\u0d56\u0d5f-\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f5\u13f8-\u13fd\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f8\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191e\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1c80-\u1c88\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2118-\u211d\u2124\u2126\u2128\u212a-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309b-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fd5\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua69d\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua7ae\ua7b0-\ua7b7\ua7f7-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua8fd\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\ua9e0-\ua9e4\ua9e6-\ua9ef\ua9fa-\ua9fe\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa7e-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uab30-\uab5a\uab5c-\uab65\uab70-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc"
var nonASCIIidentifierChars = "\u200c\u200d\xb7\u0300-\u036f\u0387\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08d4-\u08e1\u08e3-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c00-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c81-\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d01-\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0de6-\u0def\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1369-\u1371\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19d0-\u19da\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1ab0-\u1abd\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1cf8\u1cf9\u1dc0-\u1df5\u1dfb-\u1dff\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69e\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c5\ua8d0-\ua8d9\ua8e0-\ua8f1\ua900-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\ua9e5\ua9f0-\ua9f9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b-\uaa7d\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe2f\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f"

var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]")
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]")

nonASCIIidentifierStartChars = nonASCIIidentifierChars = null

// These are a run-length and offset encoded representation of the
// >0xffff code points that are a valid part of identifiers. The
// offset starts at 0x10000, and each pair of numbers represents an
// offset to the next range, and then a size of the range. They were
// generated by bin/generate-identifier-regex.js
var astralIdentifierStartCodes = [0,11,2,25,2,18,2,1,2,14,3,13,35,122,70,52,268,28,4,48,48,31,17,26,6,37,11,29,3,35,5,7,2,4,43,157,19,35,5,35,5,39,9,51,157,310,10,21,11,7,153,5,3,0,2,43,2,1,4,0,3,22,11,22,10,30,66,18,2,1,11,21,11,25,71,55,7,1,65,0,16,3,2,2,2,26,45,28,4,28,36,7,2,27,28,53,11,21,11,18,14,17,111,72,56,50,14,50,785,52,76,44,33,24,27,35,42,34,4,0,13,47,15,3,22,0,2,0,36,17,2,24,85,6,2,0,2,3,2,14,2,9,8,46,39,7,3,1,3,21,2,6,2,1,2,4,4,0,19,0,13,4,159,52,19,3,54,47,21,1,2,0,185,46,42,3,37,47,21,0,60,42,86,25,391,63,32,0,449,56,264,8,2,36,18,0,50,29,881,921,103,110,18,195,2749,1070,4050,582,8634,568,8,30,114,29,19,47,17,3,32,20,6,18,881,68,12,0,67,12,65,0,32,6124,20,754,9486,1,3071,106,6,12,4,8,8,9,5991,84,2,70,2,1,3,0,3,1,3,3,2,11,2,0,2,6,2,64,2,3,3,7,2,6,2,27,2,3,2,4,2,0,4,6,2,339,3,24,2,24,2,30,2,24,2,30,2,24,2,30,2,24,2,30,2,24,2,7,4149,196,60,67,1213,3,2,26,2,1,2,0,3,0,2,9,2,3,2,0,2,0,7,0,5,0,2,0,2,0,2,2,2,1,2,0,3,0,2,0,2,0,2,0,2,0,2,1,2,0,3,3,2,6,2,3,2,3,2,0,2,9,2,16,6,2,2,4,2,16,4421,42710,42,4148,12,221,3,5761,10591,541]
var astralIdentifierCodes = [509,0,227,0,150,4,294,9,1368,2,2,1,6,3,41,2,5,0,166,1,1306,2,54,14,32,9,16,3,46,10,54,9,7,2,37,13,2,9,52,0,13,2,49,13,10,2,4,9,83,11,7,0,161,11,6,9,7,3,57,0,2,6,3,1,3,2,10,0,11,1,3,6,4,4,193,17,10,9,87,19,13,9,214,6,3,8,28,1,83,16,16,9,82,12,9,9,84,14,5,9,423,9,838,7,2,7,17,9,57,21,2,13,19882,9,135,4,60,6,26,9,1016,45,17,3,19723,1,5319,4,4,5,9,7,3,6,31,3,149,2,1418,49,513,54,5,49,9,0,15,0,23,4,2,14,1361,6,2,16,3,6,2,1,2,4,2214,6,110,6,6,9,792487,239]

// This has a complexity linear to the value of the code. The
// assumption is that looking up astral identifier characters is
// rare.
function isInAstralSet(code, set) {
  var pos = 0x10000
  for (var i = 0; i < set.length; i += 2) {
    pos += set[i]
    if (pos > code) return false
    pos += set[i + 1]
    if (pos >= code) return true
  }
}

// Test whether a given character code starts an identifier.

function isIdentifierStart(code, astral) {
  if (code < 65) return code === 36
  if (code < 91) return true
  if (code < 97) return code === 95
  if (code < 123) return true
  if (code <= 0xffff) return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code))
  if (astral === false) return false
  return isInAstralSet(code, astralIdentifierStartCodes)
}

// Test whether a given character is part of an identifier.

function isIdentifierChar(code, astral) {
  if (code < 48) return code === 36
  if (code < 58) return true
  if (code < 65) return false
  if (code < 91) return true
  if (code < 97) return code === 95
  if (code < 123) return true
  if (code <= 0xffff) return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code))
  if (astral === false) return false
  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes)
}

// ## Token types

// The assignment of fine-grained, information-carrying type objects
// allows the tokenizer to store the information it has about a
// token in a way that is very cheap for the parser to look up.

// All token type variables start with an underscore, to make them
// easy to recognize.

// The `beforeExpr` property is used to disambiguate between regular
// expressions and divisions. It is set on all token types that can
// be followed by an expression (thus, a slash after them would be a
// regular expression).
//
// The `startsExpr` property is used to check if the token ends a
// `yield` expression. It is set on all token types that either can
// directly start an expression (like a quotation mark) or can
// continue an expression (like the body of a string).
//
// `isLoop` marks a keyword as starting a loop, which is important
// to know when parsing a label, in order to allow or disallow
// continue jumps to that label.

var TokenType = function TokenType(label, conf) {
  if ( conf === void 0 ) conf = {};

  this.label = label
  this.keyword = conf.keyword
  this.beforeExpr = !!conf.beforeExpr
  this.startsExpr = !!conf.startsExpr
  this.isLoop = !!conf.isLoop
  this.isAssign = !!conf.isAssign
  this.prefix = !!conf.prefix
  this.postfix = !!conf.postfix
  this.binop = conf.binop || null
  this.updateContext = null
};

function binop(name, prec) {
  return new TokenType(name, {beforeExpr: true, binop: prec})
}
var beforeExpr = {beforeExpr: true};
var startsExpr = {startsExpr: true};
// Map keyword names to token types.

var keywordTypes = {}

// Succinct definitions of keyword token types
function kw(name, options) {
  if ( options === void 0 ) options = {};

  options.keyword = name
  return keywordTypes[name] = new TokenType(name, options)
}

var tt = {
  num: new TokenType("num", startsExpr),
  regexp: new TokenType("regexp", startsExpr),
  string: new TokenType("string", startsExpr),
  name: new TokenType("name", startsExpr),
  eof: new TokenType("eof"),

  // Punctuation token types.
  bracketL: new TokenType("[", {beforeExpr: true, startsExpr: true}),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{", {beforeExpr: true, startsExpr: true}),
  braceR: new TokenType("}"),
  parenL: new TokenType("(", {beforeExpr: true, startsExpr: true}),
  parenR: new TokenType(")"),
  comma: new TokenType(",", beforeExpr),
  semi: new TokenType(";", beforeExpr),
  colon: new TokenType(":", beforeExpr),
  dot: new TokenType("."),
  question: new TokenType("?", beforeExpr),
  arrow: new TokenType("=>", beforeExpr),
  template: new TokenType("template"),
  ellipsis: new TokenType("...", beforeExpr),
  backQuote: new TokenType("`", startsExpr),
  dollarBraceL: new TokenType("${", {beforeExpr: true, startsExpr: true}),

  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator.
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.

  eq: new TokenType("=", {beforeExpr: true, isAssign: true}),
  assign: new TokenType("_=", {beforeExpr: true, isAssign: true}),
  incDec: new TokenType("++/--", {prefix: true, postfix: true, startsExpr: true}),
  prefix: new TokenType("prefix", {beforeExpr: true, prefix: true, startsExpr: true}),
  logicalOR: binop("||", 1),
  logicalAND: binop("&&", 2),
  bitwiseOR: binop("|", 3),
  bitwiseXOR: binop("^", 4),
  bitwiseAND: binop("&", 5),
  equality: binop("==/!=", 6),
  relational: binop("</>", 7),
  bitShift: binop("<</>>", 8),
  plusMin: new TokenType("+/-", {beforeExpr: true, binop: 9, prefix: true, startsExpr: true}),
  modulo: binop("%", 10),
  star: binop("*", 10),
  slash: binop("/", 10),
  starstar: new TokenType("**", {beforeExpr: true}),

  // Keyword token types.
  _break: kw("break"),
  _case: kw("case", beforeExpr),
  _catch: kw("catch"),
  _continue: kw("continue"),
  _debugger: kw("debugger"),
  _default: kw("default", beforeExpr),
  _do: kw("do", {isLoop: true, beforeExpr: true}),
  _else: kw("else", beforeExpr),
  _finally: kw("finally"),
  _for: kw("for", {isLoop: true}),
  _function: kw("function", startsExpr),
  _if: kw("if"),
  _return: kw("return", beforeExpr),
  _switch: kw("switch"),
  _throw: kw("throw", beforeExpr),
  _try: kw("try"),
  _var: kw("var"),
  _const: kw("const"),
  _while: kw("while", {isLoop: true}),
  _with: kw("with"),
  _new: kw("new", {beforeExpr: true, startsExpr: true}),
  _this: kw("this", startsExpr),
  _super: kw("super", startsExpr),
  _class: kw("class"),
  _extends: kw("extends", beforeExpr),
  _export: kw("export"),
  _import: kw("import"),
  _null: kw("null", startsExpr),
  _true: kw("true", startsExpr),
  _false: kw("false", startsExpr),
  _in: kw("in", {beforeExpr: true, binop: 7}),
  _instanceof: kw("instanceof", {beforeExpr: true, binop: 7}),
  _typeof: kw("typeof", {beforeExpr: true, prefix: true, startsExpr: true}),
  _void: kw("void", {beforeExpr: true, prefix: true, startsExpr: true}),
  _delete: kw("delete", {beforeExpr: true, prefix: true, startsExpr: true})
}

// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.

var lineBreak = /\r\n?|\n|\u2028|\u2029/
var lineBreakG = new RegExp(lineBreak.source, "g")

function isNewLine(code) {
  return code === 10 || code === 13 || code === 0x2028 || code === 0x2029
}

var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/

var skipWhiteSpace = /(?:\s|\/\/.*|\/\*[^]*?\*\/)*/g

function isArray(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]"
}

// Checks if an object has a property.

function has(obj, propName) {
  return Object.prototype.hasOwnProperty.call(obj, propName)
}

// These are used when `options.locations` is on, for the
// `startLoc` and `endLoc` properties.

var Position = function Position(line, col) {
  this.line = line
  this.column = col
};

Position.prototype.offset = function offset (n) {
  return new Position(this.line, this.column + n)
};

var SourceLocation = function SourceLocation(p, start, end) {
  this.start = start
  this.end = end
  if (p.sourceFile !== null) this.source = p.sourceFile
};

// The `getLineInfo` function is mostly useful when the
// `locations` option is off (for performance reasons) and you
// want to find the line/column position for a given character
// offset. `input` should be the code string that the offset refers
// into.

function getLineInfo(input, offset) {
  for (var line = 1, cur = 0;;) {
    lineBreakG.lastIndex = cur
    var match = lineBreakG.exec(input)
    if (match && match.index < offset) {
      ++line
      cur = match.index + match[0].length
    } else {
      return new Position(line, offset - cur)
    }
  }
}

// A second optional argument can be given to further configure
// the parser process. These options are recognized:

var defaultOptions = {
  // `ecmaVersion` indicates the ECMAScript version to parse. Must
  // be either 3, 5, 6 (2015), 7 (2016), or 8 (2017). This influences support
  // for strict mode, the set of reserved words, and support for
  // new syntax features. The default is 7.
  ecmaVersion: 7,
  // `sourceType` indicates the mode the code should be parsed in.
  // Can be either `"script"` or `"module"`. This influences global
  // strict mode and parsing of `import` and `export` declarations.
  sourceType: "script",
  // `onInsertedSemicolon` can be a callback that will be called
  // when a semicolon is automatically inserted. It will be passed
  // th position of the comma as an offset, and if `locations` is
  // enabled, it is given the location as a `{line, column}` object
  // as second argument.
  onInsertedSemicolon: null,
  // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
  // trailing commas.
  onTrailingComma: null,
  // By default, reserved words are only enforced if ecmaVersion >= 5.
  // Set `allowReserved` to a boolean value to explicitly turn this on
  // an off. When this option has the value "never", reserved words
  // and keywords can also not be used as property names.
  allowReserved: null,
  // When enabled, a return at the top level is not considered an
  // error.
  allowReturnOutsideFunction: false,
  // When enabled, import/export statements are not constrained to
  // appearing at the top of the program.
  allowImportExportEverywhere: false,
  // When enabled, hashbang directive in the beginning of file
  // is allowed and treated as a line comment.
  allowHashBang: false,
  // When `locations` is on, `loc` properties holding objects with
  // `start` and `end` properties in `{line, column}` form (with
  // line being 1-based and column 0-based) will be attached to the
  // nodes.
  locations: false,
  // A function can be passed as `onToken` option, which will
  // cause Acorn to call that function with object in the same
  // format as tokens returned from `tokenizer().getToken()`. Note
  // that you are not allowed to call the parser from the
  // callback—that will corrupt its internal state.
  onToken: null,
  // A function can be passed as `onComment` option, which will
  // cause Acorn to call that function with `(block, text, start,
  // end)` parameters whenever a comment is skipped. `block` is a
  // boolean indicating whether this is a block (`/* */`) comment,
  // `text` is the content of the comment, and `start` and `end` are
  // character offsets that denote the start and end of the comment.
  // When the `locations` option is on, two more parameters are
  // passed, the full `{line, column}` locations of the start and
  // end of the comments. Note that you are not allowed to call the
  // parser from the callback—that will corrupt its internal state.
  onComment: null,
  // Nodes have their start and end characters offsets recorded in
  // `start` and `end` properties (directly on the node, rather than
  // the `loc` object, which holds line/column data. To also add a
  // [semi-standardized][range] `range` property holding a `[start,
  // end]` array with the same numbers, set the `ranges` option to
  // `true`.
  //
  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
  ranges: false,
  // It is possible to parse multiple files into a single AST by
  // passing the tree produced by parsing the first file as
  // `program` option in subsequent parses. This will add the
  // toplevel forms of the parsed file to the `Program` (top) node
  // of an existing parse tree.
  program: null,
  // When `locations` is on, you can pass this to record the source
  // file in every node's `loc` object.
  sourceFile: null,
  // This value, if given, is stored in every node, whether
  // `locations` is on or off.
  directSourceFile: null,
  // When enabled, parenthesized expressions are represented by
  // (non-standard) ParenthesizedExpression nodes
  preserveParens: false,
  plugins: {}
}

// Interpret and default an options object

function getOptions(opts) {
  var options = {}

  for (var opt in defaultOptions)
    options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt]

  if (options.ecmaVersion >= 2015)
    options.ecmaVersion -= 2009

  if (options.allowReserved == null)
    options.allowReserved = options.ecmaVersion < 5

  if (isArray(options.onToken)) {
    var tokens = options.onToken
    options.onToken = function (token) { return tokens.push(token); }
  }
  if (isArray(options.onComment))
    options.onComment = pushComment(options, options.onComment)

  return options
}

function pushComment(options, array) {
  return function (block, text, start, end, startLoc, endLoc) {
    var comment = {
      type: block ? 'Block' : 'Line',
      value: text,
      start: start,
      end: end
    }
    if (options.locations)
      comment.loc = new SourceLocation(this, startLoc, endLoc)
    if (options.ranges)
      comment.range = [start, end]
    array.push(comment)
  }
}

// Registered plugins
var plugins = {}

function keywordRegexp(words) {
  return new RegExp("^(" + words.replace(/ /g, "|") + ")$")
}

var Parser = function Parser(options, input, startPos) {
  this.options = options = getOptions(options)
  this.sourceFile = options.sourceFile
  this.keywords = keywordRegexp(keywords[options.ecmaVersion >= 6 ? 6 : 5])
  var reserved = ""
  if (!options.allowReserved) {
    for (var v = options.ecmaVersion;; v--)
      if (reserved = reservedWords[v]) break
    if (options.sourceType == "module") reserved += " await"
  }
  this.reservedWords = keywordRegexp(reserved)
  var reservedStrict = (reserved ? reserved + " " : "") + reservedWords.strict
  this.reservedWordsStrict = keywordRegexp(reservedStrict)
  this.reservedWordsStrictBind = keywordRegexp(reservedStrict + " " + reservedWords.strictBind)
  this.input = String(input)

  // Used to signal to callers of `readWord1` whether the word
  // contained any escape sequences. This is needed because words with
  // escape sequences must not be interpreted as keywords.
  this.containsEsc = false

  // Load plugins
  this.loadPlugins(options.plugins)

  // Set up token state

  // The current position of the tokenizer in the input.
  if (startPos) {
    this.pos = startPos
    this.lineStart = this.input.lastIndexOf("\n", startPos - 1) + 1
    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length
  } else {
    this.pos = this.lineStart = 0
    this.curLine = 1
  }

  // Properties of the current token:
  // Its type
  this.type = tt.eof
  // For tokens that include more information than their type, the value
  this.value = null
  // Its start and end offset
  this.start = this.end = this.pos
  // And, if locations are used, the {line, column} object
  // corresponding to those offsets
  this.startLoc = this.endLoc = this.curPosition()

  // Position information for the previous token
  this.lastTokEndLoc = this.lastTokStartLoc = null
  this.lastTokStart = this.lastTokEnd = this.pos

  // The context stack is used to superficially track syntactic
  // context to predict whether a regular expression is allowed in a
  // given position.
  this.context = this.initialContext()
  this.exprAllowed = true

  // Figure out if it's a module code.
  this.inModule = options.sourceType === "module"
  this.strict = this.inModule || this.strictDirective(this.pos)

  // Used to signify the start of a potential arrow function
  this.potentialArrowAt = -1

  // Flags to track whether we are in a function, a generator, an async function.
  this.inFunction = this.inGenerator = this.inAsync = false
  // Positions to delayed-check that yield/await does not exist in default parameters.
  this.yieldPos = this.awaitPos = 0
  // Labels in scope.
  this.labels = []

  // If enabled, skip leading hashbang line.
  if (this.pos === 0 && options.allowHashBang && this.input.slice(0, 2) === '#!')
    this.skipLineComment(2)
};

// DEPRECATED Kept for backwards compatibility until 3.0 in case a plugin uses them
Parser.prototype.isKeyword = function isKeyword (word) { return this.keywords.test(word) };
Parser.prototype.isReservedWord = function isReservedWord (word) { return this.reservedWords.test(word) };

Parser.prototype.extend = function extend (name, f) {
  this[name] = f(this[name])
};

Parser.prototype.loadPlugins = function loadPlugins (pluginConfigs) {
    var this$1 = this;

  for (var name in pluginConfigs) {
    var plugin = plugins[name]
    if (!plugin) throw new Error("Plugin '" + name + "' not found")
    plugin(this$1, pluginConfigs[name])
  }
};

Parser.prototype.parse = function parse () {
  var node = this.options.program || this.startNode()
  this.nextToken()
  return this.parseTopLevel(node)
};

var pp = Parser.prototype

// ## Parser utilities

var literal = /^(?:'((?:[^\']|\.)*)'|"((?:[^\"]|\.)*)"|;)/
pp.strictDirective = function(start) {
  var this$1 = this;

  for (;;) {
    skipWhiteSpace.lastIndex = start
    start += skipWhiteSpace.exec(this$1.input)[0].length
    var match = literal.exec(this$1.input.slice(start))
    if (!match) return false
    if ((match[1] || match[2]) == "use strict") return true
    start += match[0].length
  }
}

// Predicate that tests whether the next token is of the given
// type, and if yes, consumes it as a side effect.

pp.eat = function(type) {
  if (this.type === type) {
    this.next()
    return true
  } else {
    return false
  }
}

// Tests whether parsed token is a contextual keyword.

pp.isContextual = function(name) {
  return this.type === tt.name && this.value === name
}

// Consumes contextual keyword if possible.

pp.eatContextual = function(name) {
  return this.value === name && this.eat(tt.name)
}

// Asserts that following token is given contextual keyword.

pp.expectContextual = function(name) {
  if (!this.eatContextual(name)) this.unexpected()
}

// Test whether a semicolon can be inserted at the current position.

pp.canInsertSemicolon = function() {
  return this.type === tt.eof ||
    this.type === tt.braceR ||
    lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
}

pp.insertSemicolon = function() {
  if (this.canInsertSemicolon()) {
    if (this.options.onInsertedSemicolon)
      this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc)
    return true
  }
}

// Consume a semicolon, or, failing that, see if we are allowed to
// pretend that there is a semicolon at this position.

pp.semicolon = function() {
  if (!this.eat(tt.semi) && !this.insertSemicolon()) this.unexpected()
}

pp.afterTrailingComma = function(tokType, notNext) {
  if (this.type == tokType) {
    if (this.options.onTrailingComma)
      this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc)
    if (!notNext)
      this.next()
    return true
  }
}

// Expect a token of a given type. If found, consume it, otherwise,
// raise an unexpected token error.

pp.expect = function(type) {
  this.eat(type) || this.unexpected()
}

// Raise an unexpected token error.

pp.unexpected = function(pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token")
}

var DestructuringErrors = function DestructuringErrors() {
  this.shorthandAssign = this.trailingComma = this.parenthesizedAssign = this.parenthesizedBind = -1
};

pp.checkPatternErrors = function(refDestructuringErrors, isAssign) {
  if (!refDestructuringErrors) return
  if (refDestructuringErrors.trailingComma > -1)
    this.raiseRecoverable(refDestructuringErrors.trailingComma, "Comma is not permitted after the rest element")
  var parens = isAssign ? refDestructuringErrors.parenthesizedAssign : refDestructuringErrors.parenthesizedBind
  if (parens > -1) this.raiseRecoverable(parens, "Parenthesized pattern")
}

pp.checkExpressionErrors = function(refDestructuringErrors, andThrow) {
  var pos = refDestructuringErrors ? refDestructuringErrors.shorthandAssign : -1
  if (!andThrow) return pos >= 0
  if (pos > -1) this.raise(pos, "Shorthand property assignments are valid only in destructuring patterns")
}

pp.checkYieldAwaitInDefaultParams = function() {
  if (this.yieldPos && (!this.awaitPos || this.yieldPos < this.awaitPos))
    this.raise(this.yieldPos, "Yield expression cannot be a default value")
  if (this.awaitPos)
    this.raise(this.awaitPos, "Await expression cannot be a default value")
}

pp.isSimpleAssignTarget = function(expr) {
  if (expr.type === "ParenthesizedExpression")
    return this.isSimpleAssignTarget(expr.expression)
  return expr.type === "Identifier" || expr.type === "MemberExpression"
}

var pp$1 = Parser.prototype

// ### Statement parsing

// Parse a program. Initializes the parser, reads any number of
// statements, and wraps them in a Program node.  Optionally takes a
// `program` argument.  If present, the statements will be appended
// to its body instead of creating a new node.

pp$1.parseTopLevel = function(node) {
  var this$1 = this;

  var exports = {}
  if (!node.body) node.body = []
  while (this.type !== tt.eof) {
    var stmt = this$1.parseStatement(true, true, exports)
    node.body.push(stmt)
  }
  this.next()
  if (this.options.ecmaVersion >= 6) {
    node.sourceType = this.options.sourceType
  }
  return this.finishNode(node, "Program")
}

var loopLabel = {kind: "loop"};
var switchLabel = {kind: "switch"};
pp$1.isLet = function() {
  if (this.type !== tt.name || this.options.ecmaVersion < 6 || this.value != "let") return false
  skipWhiteSpace.lastIndex = this.pos
  var skip = skipWhiteSpace.exec(this.input)
  var next = this.pos + skip[0].length, nextCh = this.input.charCodeAt(next)
  if (nextCh === 91 || nextCh == 123) return true // '{' and '['
  if (isIdentifierStart(nextCh, true)) {
    for (var pos = next + 1; isIdentifierChar(this.input.charCodeAt(pos), true); ++pos) {}
    var ident = this.input.slice(next, pos)
    if (!this.isKeyword(ident)) return true
  }
  return false
}

// check 'async [no LineTerminator here] function'
// - 'async /*foo*/ function' is OK.
// - 'async /*\n*/ function' is invalid.
pp$1.isAsyncFunction = function() {
  if (this.type !== tt.name || this.options.ecmaVersion < 8 || this.value != "async")
    return false

  skipWhiteSpace.lastIndex = this.pos
  var skip = skipWhiteSpace.exec(this.input)
  var next = this.pos + skip[0].length
  return !lineBreak.test(this.input.slice(this.pos, next)) &&
    this.input.slice(next, next + 8) === "function" &&
    (next + 8 == this.input.length || !isIdentifierChar(this.input.charAt(next + 8)))
}

// Parse a single statement.
//
// If expecting a statement and finding a slash operator, parse a
// regular expression literal. This is to handle cases like
// `if (foo) /blah/.exec(foo)`, where looking at the previous token
// does not help.

pp$1.parseStatement = function(declaration, topLevel, exports) {
  var starttype = this.type, node = this.startNode(), kind

  if (this.isLet()) {
    starttype = tt._var
    kind = "let"
  }

  // Most types of statements are recognized by the keyword they
  // start with. Many are trivial to parse, some require a bit of
  // complexity.

  switch (starttype) {
  case tt._break: case tt._continue: return this.parseBreakContinueStatement(node, starttype.keyword)
  case tt._debugger: return this.parseDebuggerStatement(node)
  case tt._do: return this.parseDoStatement(node)
  case tt._for: return this.parseForStatement(node)
  case tt._function:
    if (!declaration && this.options.ecmaVersion >= 6) this.unexpected()
    return this.parseFunctionStatement(node, false)
  case tt._class:
    if (!declaration) this.unexpected()
    return this.parseClass(node, true)
  case tt._if: return this.parseIfStatement(node)
  case tt._return: return this.parseReturnStatement(node)
  case tt._switch: return this.parseSwitchStatement(node)
  case tt._throw: return this.parseThrowStatement(node)
  case tt._try: return this.parseTryStatement(node)
  case tt._const: case tt._var:
    kind = kind || this.value
    if (!declaration && kind != "var") this.unexpected()
    return this.parseVarStatement(node, kind)
  case tt._while: return this.parseWhileStatement(node)
  case tt._with: return this.parseWithStatement(node)
  case tt.braceL: return this.parseBlock()
  case tt.semi: return this.parseEmptyStatement(node)
  case tt._export:
  case tt._import:
    if (!this.options.allowImportExportEverywhere) {
      if (!topLevel)
        this.raise(this.start, "'import' and 'export' may only appear at the top level")
      if (!this.inModule)
        this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'")
    }
    return starttype === tt._import ? this.parseImport(node) : this.parseExport(node, exports)

    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
  default:
    if (this.isAsyncFunction() && declaration) {
      this.next()
      return this.parseFunctionStatement(node, true)
    }

    var maybeName = this.value, expr = this.parseExpression()
    if (starttype === tt.name && expr.type === "Identifier" && this.eat(tt.colon))
      return this.parseLabeledStatement(node, maybeName, expr)
    else return this.parseExpressionStatement(node, expr)
  }
}

pp$1.parseBreakContinueStatement = function(node, keyword) {
  var this$1 = this;

  var isBreak = keyword == "break"
  this.next()
  if (this.eat(tt.semi) || this.insertSemicolon()) node.label = null
  else if (this.type !== tt.name) this.unexpected()
  else {
    node.label = this.parseIdent()
    this.semicolon()
  }

  // Verify that there is an actual destination to break or
  // continue to.
  for (var i = 0; i < this.labels.length; ++i) {
    var lab = this$1.labels[i]
    if (node.label == null || lab.name === node.label.name) {
      if (lab.kind != null && (isBreak || lab.kind === "loop")) break
      if (node.label && isBreak) break
    }
  }
  if (i === this.labels.length) this.raise(node.start, "Unsyntactic " + keyword)
  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement")
}

pp$1.parseDebuggerStatement = function(node) {
  this.next()
  this.semicolon()
  return this.finishNode(node, "DebuggerStatement")
}

pp$1.parseDoStatement = function(node) {
  this.next()
  this.labels.push(loopLabel)
  node.body = this.parseStatement(false)
  this.labels.pop()
  this.expect(tt._while)
  node.test = this.parseParenExpression()
  if (this.options.ecmaVersion >= 6)
    this.eat(tt.semi)
  else
    this.semicolon()
  return this.finishNode(node, "DoWhileStatement")
}

// Disambiguating between a `for` and a `for`/`in` or `for`/`of`
// loop is non-trivial. Basically, we have to parse the init `var`
// statement or expression, disallowing the `in` operator (see
// the second parameter to `parseExpression`), and then check
// whether the next token is `in` or `of`. When there is no init
// part (semicolon immediately after the opening parenthesis), it
// is a regular `for` loop.

pp$1.parseForStatement = function(node) {
  this.next()
  this.labels.push(loopLabel)
  this.expect(tt.parenL)
  if (this.type === tt.semi) return this.parseFor(node, null)
  var isLet = this.isLet()
  if (this.type === tt._var || this.type === tt._const || isLet) {
    var init$1 = this.startNode(), kind = isLet ? "let" : this.value
    this.next()
    this.parseVar(init$1, true, kind)
    this.finishNode(init$1, "VariableDeclaration")
    if ((this.type === tt._in || (this.options.ecmaVersion >= 6 && this.isContextual("of"))) && init$1.declarations.length === 1 &&
        !(kind !== "var" && init$1.declarations[0].init))
      return this.parseForIn(node, init$1)
    return this.parseFor(node, init$1)
  }
  var refDestructuringErrors = new DestructuringErrors
  var init = this.parseExpression(true, refDestructuringErrors)
  if (this.type === tt._in || (this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
    this.toAssignable(init)
    this.checkLVal(init)
    this.checkPatternErrors(refDestructuringErrors, true)
    return this.parseForIn(node, init)
  } else {
    this.checkExpressionErrors(refDestructuringErrors, true)
  }
  return this.parseFor(node, init)
}

pp$1.parseFunctionStatement = function(node, isAsync) {
  this.next()
  return this.parseFunction(node, true, false, isAsync)
}

pp$1.isFunction = function() {
  return this.type === tt._function || this.isAsyncFunction()
}

pp$1.parseIfStatement = function(node) {
  this.next()
  node.test = this.parseParenExpression()
  // allow function declarations in branches, but only in non-strict mode
  node.consequent = this.parseStatement(!this.strict && this.isFunction())
  node.alternate = this.eat(tt._else) ? this.parseStatement(!this.strict && this.isFunction()) : null
  return this.finishNode(node, "IfStatement")
}

pp$1.parseReturnStatement = function(node) {
  if (!this.inFunction && !this.options.allowReturnOutsideFunction)
    this.raise(this.start, "'return' outside of function")
  this.next()

  // In `return` (and `break`/`continue`), the keywords with
  // optional arguments, we eagerly look for a semicolon or the
  // possibility to insert one.

  if (this.eat(tt.semi) || this.insertSemicolon()) node.argument = null
  else { node.argument = this.parseExpression(); this.semicolon() }
  return this.finishNode(node, "ReturnStatement")
}

pp$1.parseSwitchStatement = function(node) {
  var this$1 = this;

  this.next()
  node.discriminant = this.parseParenExpression()
  node.cases = []
  this.expect(tt.braceL)
  this.labels.push(switchLabel)

  // Statements under must be grouped (by label) in SwitchCase
  // nodes. `cur` is used to keep the node that we are currently
  // adding statements to.

  for (var cur, sawDefault = false; this.type != tt.braceR;) {
    if (this$1.type === tt._case || this$1.type === tt._default) {
      var isCase = this$1.type === tt._case
      if (cur) this$1.finishNode(cur, "SwitchCase")
      node.cases.push(cur = this$1.startNode())
      cur.consequent = []
      this$1.next()
      if (isCase) {
        cur.test = this$1.parseExpression()
      } else {
        if (sawDefault) this$1.raiseRecoverable(this$1.lastTokStart, "Multiple default clauses")
        sawDefault = true
        cur.test = null
      }
      this$1.expect(tt.colon)
    } else {
      if (!cur) this$1.unexpected()
      cur.consequent.push(this$1.parseStatement(true))
    }
  }
  if (cur) this.finishNode(cur, "SwitchCase")
  this.next() // Closing brace
  this.labels.pop()
  return this.finishNode(node, "SwitchStatement")
}

pp$1.parseThrowStatement = function(node) {
  this.next()
  if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start)))
    this.raise(this.lastTokEnd, "Illegal newline after throw")
  node.argument = this.parseExpression()
  this.semicolon()
  return this.finishNode(node, "ThrowStatement")
}

// Reused empty array added for node fields that are always empty.

var empty = []

pp$1.parseTryStatement = function(node) {
  this.next()
  node.block = this.parseBlock()
  node.handler = null
  if (this.type === tt._catch) {
    var clause = this.startNode()
    this.next()
    this.expect(tt.parenL)
    clause.param = this.parseBindingAtom()
    this.checkLVal(clause.param, true)
    this.expect(tt.parenR)
    clause.body = this.parseBlock()
    node.handler = this.finishNode(clause, "CatchClause")
  }
  node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null
  if (!node.handler && !node.finalizer)
    this.raise(node.start, "Missing catch or finally clause")
  return this.finishNode(node, "TryStatement")
}

pp$1.parseVarStatement = function(node, kind) {
  this.next()
  this.parseVar(node, false, kind)
  this.semicolon()
  return this.finishNode(node, "VariableDeclaration")
}

pp$1.parseWhileStatement = function(node) {
  this.next()
  node.test = this.parseParenExpression()
  this.labels.push(loopLabel)
  node.body = this.parseStatement(false)
  this.labels.pop()
  return this.finishNode(node, "WhileStatement")
}

pp$1.parseWithStatement = function(node) {
  if (this.strict) this.raise(this.start, "'with' in strict mode")
  this.next()
  node.object = this.parseParenExpression()
  node.body = this.parseStatement(false)
  return this.finishNode(node, "WithStatement")
}

pp$1.parseEmptyStatement = function(node) {
  this.next()
  return this.finishNode(node, "EmptyStatement")
}

pp$1.parseLabeledStatement = function(node, maybeName, expr) {
  var this$1 = this;

  for (var i = 0; i < this.labels.length; ++i)
    if (this$1.labels[i].name === maybeName) this$1.raise(expr.start, "Label '" + maybeName + "' is already declared")
  var kind = this.type.isLoop ? "loop" : this.type === tt._switch ? "switch" : null
  for (var i$1 = this.labels.length - 1; i$1 >= 0; i$1--) {
    var label = this$1.labels[i$1]
    if (label.statementStart == node.start) {
      label.statementStart = this$1.start
      label.kind = kind
    } else break
  }
  this.labels.push({name: maybeName, kind: kind, statementStart: this.start})
  node.body = this.parseStatement(true)
  if (node.body.type == "ClassDeclaration" ||
      node.body.type == "VariableDeclaration" && (this.strict || node.body.kind != "var") ||
      node.body.type == "FunctionDeclaration" && (this.strict || node.body.generator))
    this.raiseRecoverable(node.body.start, "Invalid labeled declaration")
  this.labels.pop()
  node.label = expr
  return this.finishNode(node, "LabeledStatement")
}

pp$1.parseExpressionStatement = function(node, expr) {
  node.expression = expr
  this.semicolon()
  return this.finishNode(node, "ExpressionStatement")
}

// Parse a semicolon-enclosed block of statements, handling `"use
// strict"` declarations when `allowStrict` is true (used for
// function bodies).

pp$1.parseBlock = function() {
  var this$1 = this;

  var node = this.startNode()
  node.body = []
  this.expect(tt.braceL)
  while (!this.eat(tt.braceR)) {
    var stmt = this$1.parseStatement(true)
    node.body.push(stmt)
  }
  return this.finishNode(node, "BlockStatement")
}

// Parse a regular `for` loop. The disambiguation code in
// `parseStatement` will already have parsed the init statement or
// expression.

pp$1.parseFor = function(node, init) {
  node.init = init
  this.expect(tt.semi)
  node.test = this.type === tt.semi ? null : this.parseExpression()
  this.expect(tt.semi)
  node.update = this.type === tt.parenR ? null : this.parseExpression()
  this.expect(tt.parenR)
  node.body = this.parseStatement(false)
  this.labels.pop()
  return this.finishNode(node, "ForStatement")
}

// Parse a `for`/`in` and `for`/`of` loop, which are almost
// same from parser's perspective.

pp$1.parseForIn = function(node, init) {
  var type = this.type === tt._in ? "ForInStatement" : "ForOfStatement"
  this.next()
  node.left = init
  node.right = this.parseExpression()
  this.expect(tt.parenR)
  node.body = this.parseStatement(false)
  this.labels.pop()
  return this.finishNode(node, type)
}

// Parse a list of variable declarations.

pp$1.parseVar = function(node, isFor, kind) {
  var this$1 = this;

  node.declarations = []
  node.kind = kind
  for (;;) {
    var decl = this$1.startNode()
    this$1.parseVarId(decl)
    if (this$1.eat(tt.eq)) {
      decl.init = this$1.parseMaybeAssign(isFor)
    } else if (kind === "const" && !(this$1.type === tt._in || (this$1.options.ecmaVersion >= 6 && this$1.isContextual("of")))) {
      this$1.unexpected()
    } else if (decl.id.type != "Identifier" && !(isFor && (this$1.type === tt._in || this$1.isContextual("of")))) {
      this$1.raise(this$1.lastTokEnd, "Complex binding patterns require an initialization value")
    } else {
      decl.init = null
    }
    node.declarations.push(this$1.finishNode(decl, "VariableDeclarator"))
    if (!this$1.eat(tt.comma)) break
  }
  return node
}

pp$1.parseVarId = function(decl) {
  decl.id = this.parseBindingAtom()
  this.checkLVal(decl.id, true)
}

// Parse a function declaration or literal (depending on the
// `isStatement` parameter).

pp$1.parseFunction = function(node, isStatement, allowExpressionBody, isAsync) {
  this.initFunction(node)
  if (this.options.ecmaVersion >= 6 && !isAsync)
    node.generator = this.eat(tt.star)
  if (this.options.ecmaVersion >= 8)
    node.async = !!isAsync

  if (isStatement == null)
    isStatement = this.type == tt.name
  if (isStatement)
    node.id = this.parseIdent()

  var oldInGen = this.inGenerator, oldInAsync = this.inAsync,
      oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldInFunc = this.inFunction
  this.inGenerator = node.generator
  this.inAsync = node.async
  this.yieldPos = 0
  this.awaitPos = 0
  this.inFunction = true

  if (!isStatement && this.type === tt.name)
    node.id = this.parseIdent()
  this.parseFunctionParams(node)
  this.parseFunctionBody(node, allowExpressionBody)

  this.inGenerator = oldInGen
  this.inAsync = oldInAsync
  this.yieldPos = oldYieldPos
  this.awaitPos = oldAwaitPos
  this.inFunction = oldInFunc
  return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression")
}

pp$1.parseFunctionParams = function(node) {
  this.expect(tt.parenL)
  node.params = this.parseBindingList(tt.parenR, false, this.options.ecmaVersion >= 8, true)
  this.checkYieldAwaitInDefaultParams()
}

// Parse a class declaration or literal (depending on the
// `isStatement` parameter).

pp$1.parseClass = function(node, isStatement) {
  var this$1 = this;

  this.next()
  if (isStatement == null) isStatement = this.type === tt.name
  this.parseClassId(node, isStatement)
  this.parseClassSuper(node)
  var classBody = this.startNode()
  var hadConstructor = false
  classBody.body = []
  this.expect(tt.braceL)
  while (!this.eat(tt.braceR)) {
    if (this$1.eat(tt.semi)) continue
    var method = this$1.startNode()
    var isGenerator = this$1.eat(tt.star)
    var isAsync = false
    var isMaybeStatic = this$1.type === tt.name && this$1.value === "static"
    this$1.parsePropertyName(method)
    method.static = isMaybeStatic && this$1.type !== tt.parenL
    if (method.static) {
      if (isGenerator) this$1.unexpected()
      isGenerator = this$1.eat(tt.star)
      this$1.parsePropertyName(method)
    }
    if (this$1.options.ecmaVersion >= 8 && !isGenerator && !method.computed &&
        method.key.type === "Identifier" && method.key.name === "async" && this$1.type !== tt.parenL &&
        !this$1.canInsertSemicolon()) {
      isAsync = true
      this$1.parsePropertyName(method)
    }
    method.kind = "method"
    var isGetSet = false
    if (!method.computed) {
      var key = method.key;
      if (!isGenerator && !isAsync && key.type === "Identifier" && this$1.type !== tt.parenL && (key.name === "get" || key.name === "set")) {
        isGetSet = true
        method.kind = key.name
        key = this$1.parsePropertyName(method)
      }
      if (!method.static && (key.type === "Identifier" && key.name === "constructor" ||
          key.type === "Literal" && key.value === "constructor")) {
        if (hadConstructor) this$1.raise(key.start, "Duplicate constructor in the same class")
        if (isGetSet) this$1.raise(key.start, "Constructor can't have get/set modifier")
        if (isGenerator) this$1.raise(key.start, "Constructor can't be a generator")
        if (isAsync) this$1.raise(key.start, "Constructor can't be an async method")
        method.kind = "constructor"
        hadConstructor = true
      }
    }
    this$1.parseClassMethod(classBody, method, isGenerator, isAsync)
    if (isGetSet) {
      var paramCount = method.kind === "get" ? 0 : 1
      if (method.value.params.length !== paramCount) {
        var start = method.value.start
        if (method.kind === "get")
          this$1.raiseRecoverable(start, "getter should have no params")
        else
          this$1.raiseRecoverable(start, "setter should have exactly one param")
      } else {
        if (method.kind === "set" && method.value.params[0].type === "RestElement")
          this$1.raiseRecoverable(method.value.params[0].start, "Setter cannot use rest params")
      }
    }
  }
  node.body = this.finishNode(classBody, "ClassBody")
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression")
}

pp$1.parseClassMethod = function(classBody, method, isGenerator, isAsync) {
  method.value = this.parseMethod(isGenerator, isAsync)
  classBody.body.push(this.finishNode(method, "MethodDefinition"))
}

pp$1.parseClassId = function(node, isStatement) {
  node.id = this.type === tt.name ? this.parseIdent() : isStatement ? this.unexpected() : null
}

pp$1.parseClassSuper = function(node) {
  node.superClass = this.eat(tt._extends) ? this.parseExprSubscripts() : null
}

// Parses module export declaration.

pp$1.parseExport = function(node, exports) {
  var this$1 = this;

  this.next()
  // export * from '...'
  if (this.eat(tt.star)) {
    this.expectContextual("from")
    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected()
    this.semicolon()
    return this.finishNode(node, "ExportAllDeclaration")
  }
  if (this.eat(tt._default)) { // export default ...
    this.checkExport(exports, "default", this.lastTokStart)
    var isAsync
    if (this.type === tt._function || (isAsync = this.isAsyncFunction())) {
      var fNode = this.startNode()
      this.next()
      if (isAsync) this.next()
      node.declaration = this.parseFunction(fNode, null, false, isAsync)
    } else if (this.type === tt._class) {
      var cNode = this.startNode()
      node.declaration = this.parseClass(cNode, null)
    } else {
      node.declaration = this.parseMaybeAssign()
      this.semicolon()
    }
    return this.finishNode(node, "ExportDefaultDeclaration")
  }
  // export var|const|let|function|class ...
  if (this.shouldParseExportStatement()) {
    node.declaration = this.parseStatement(true)
    if (node.declaration.type === "VariableDeclaration")
      this.checkVariableExport(exports, node.declaration.declarations)
    else
      this.checkExport(exports, node.declaration.id.name, node.declaration.id.start)
    node.specifiers = []
    node.source = null
  } else { // export { x, y as z } [from '...']
    node.declaration = null
    node.specifiers = this.parseExportSpecifiers(exports)
    if (this.eatContextual("from")) {
      node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected()
    } else {
      // check for keywords used as local names
      for (var i = 0; i < node.specifiers.length; i++) {
        if (this$1.keywords.test(node.specifiers[i].local.name) || this$1.reservedWords.test(node.specifiers[i].local.name)) {
          this$1.unexpected(node.specifiers[i].local.start)
        }
      }

      node.source = null
    }
    this.semicolon()
  }
  return this.finishNode(node, "ExportNamedDeclaration")
}

pp$1.checkExport = function(exports, name, pos) {
  if (!exports) return
  if (Object.prototype.hasOwnProperty.call(exports, name))
    this.raiseRecoverable(pos, "Duplicate export '" + name + "'")
  exports[name] = true
}

pp$1.checkPatternExport = function(exports, pat) {
  var this$1 = this;

  var type = pat.type
  if (type == "Identifier")
    this.checkExport(exports, pat.name, pat.start)
  else if (type == "ObjectPattern")
    for (var i = 0; i < pat.properties.length; ++i)
      this$1.checkPatternExport(exports, pat.properties[i].value)
  else if (type == "ArrayPattern")
    for (var i$1 = 0; i$1 < pat.elements.length; ++i$1) {
      var elt = pat.elements[i$1]
      if (elt) this$1.checkPatternExport(exports, elt)
    }
  else if (type == "AssignmentPattern")
    this.checkPatternExport(exports, pat.left)
  else if (type == "ParenthesizedExpression")
    this.checkPatternExport(exports, pat.expression)
}

pp$1.checkVariableExport = function(exports, decls) {
  var this$1 = this;

  if (!exports) return
  for (var i = 0; i < decls.length; i++)
    this$1.checkPatternExport(exports, decls[i].id)
}

pp$1.shouldParseExportStatement = function() {
  return this.type.keyword === "var"
    || this.type.keyword === "const"
    || this.type.keyword === "class"
    || this.type.keyword === "function"
    || this.isLet()
    || this.isAsyncFunction()
}

// Parses a comma-separated list of module exports.

pp$1.parseExportSpecifiers = function(exports) {
  var this$1 = this;

  var nodes = [], first = true
  // export { x, y as z } [from '...']
  this.expect(tt.braceL)
  while (!this.eat(tt.braceR)) {
    if (!first) {
      this$1.expect(tt.comma)
      if (this$1.afterTrailingComma(tt.braceR)) break
    } else first = false

    var node = this$1.startNode()
    node.local = this$1.parseIdent(true)
    node.exported = this$1.eatContextual("as") ? this$1.parseIdent(true) : node.local
    this$1.checkExport(exports, node.exported.name, node.exported.start)
    nodes.push(this$1.finishNode(node, "ExportSpecifier"))
  }
  return nodes
}

// Parses import declaration.

pp$1.parseImport = function(node) {
  this.next()
  // import '...'
  if (this.type === tt.string) {
    node.specifiers = empty
    node.source = this.parseExprAtom()
  } else {
    node.specifiers = this.parseImportSpecifiers()
    this.expectContextual("from")
    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected()
  }
  this.semicolon()
  return this.finishNode(node, "ImportDeclaration")
}

// Parses a comma-separated list of module imports.

pp$1.parseImportSpecifiers = function() {
  var this$1 = this;

  var nodes = [], first = true
  if (this.type === tt.name) {
    // import defaultObj, { x, y as z } from '...'
    var node = this.startNode()
    node.local = this.parseIdent()
    this.checkLVal(node.local, true)
    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"))
    if (!this.eat(tt.comma)) return nodes
  }
  if (this.type === tt.star) {
    var node$1 = this.startNode()
    this.next()
    this.expectContextual("as")
    node$1.local = this.parseIdent()
    this.checkLVal(node$1.local, true)
    nodes.push(this.finishNode(node$1, "ImportNamespaceSpecifier"))
    return nodes
  }
  this.expect(tt.braceL)
  while (!this.eat(tt.braceR)) {
    if (!first) {
      this$1.expect(tt.comma)
      if (this$1.afterTrailingComma(tt.braceR)) break
    } else first = false

    var node$2 = this$1.startNode()
    node$2.imported = this$1.parseIdent(true)
    if (this$1.eatContextual("as")) {
      node$2.local = this$1.parseIdent()
    } else {
      node$2.local = node$2.imported
      if (this$1.isKeyword(node$2.local.name)) this$1.unexpected(node$2.local.start)
      if (this$1.reservedWordsStrict.test(node$2.local.name)) this$1.raiseRecoverable(node$2.local.start, "The keyword '" + node$2.local.name + "' is reserved")
    }
    this$1.checkLVal(node$2.local, true)
    nodes.push(this$1.finishNode(node$2, "ImportSpecifier"))
  }
  return nodes
}

var pp$2 = Parser.prototype

// Convert existing expression atom to assignable pattern
// if possible.

pp$2.toAssignable = function(node, isBinding) {
  var this$1 = this;

  if (this.options.ecmaVersion >= 6 && node) {
    switch (node.type) {
      case "Identifier":
      if (this.inAsync && node.name === "await")
        this.raise(node.start, "Can not use 'await' as identifier inside an async function")
      break

    case "ObjectPattern":
    case "ArrayPattern":
      break

    case "ObjectExpression":
      node.type = "ObjectPattern"
      for (var i = 0; i < node.properties.length; i++) {
        var prop = node.properties[i]
        if (prop.kind !== "init") this$1.raise(prop.key.start, "Object pattern can't contain getter or setter")
        this$1.toAssignable(prop.value, isBinding)
      }
      break

    case "ArrayExpression":
      node.type = "ArrayPattern"
      this.toAssignableList(node.elements, isBinding)
      break

    case "AssignmentExpression":
      if (node.operator === "=") {
        node.type = "AssignmentPattern"
        delete node.operator
        this.toAssignable(node.left, isBinding)
        // falls through to AssignmentPattern
      } else {
        this.raise(node.left.end, "Only '=' operator can be used for specifying default value.")
        break
      }

    case "AssignmentPattern":
      break

    case "ParenthesizedExpression":
      node.expression = this.toAssignable(node.expression, isBinding)
      break

    case "MemberExpression":
      if (!isBinding) break

    default:
      this.raise(node.start, "Assigning to rvalue")
    }
  }
  return node
}

// Convert list of expression atoms to binding list.

pp$2.toAssignableList = function(exprList, isBinding) {
  var this$1 = this;

  var end = exprList.length
  if (end) {
    var last = exprList[end - 1]
    if (last && last.type == "RestElement") {
      --end
    } else if (last && last.type == "SpreadElement") {
      last.type = "RestElement"
      var arg = last.argument
      this.toAssignable(arg, isBinding)
      if (arg.type !== "Identifier" && arg.type !== "MemberExpression" && arg.type !== "ArrayPattern")
        this.unexpected(arg.start)
      --end
    }

    if (isBinding && last && last.type === "RestElement" && last.argument.type !== "Identifier")
      this.unexpected(last.argument.start)
  }
  for (var i = 0; i < end; i++) {
    var elt = exprList[i]
    if (elt) this$1.toAssignable(elt, isBinding)
  }
  return exprList
}

// Parses spread element.

pp$2.parseSpread = function(refDestructuringErrors) {
  var node = this.startNode()
  this.next()
  node.argument = this.parseMaybeAssign(false, refDestructuringErrors)
  return this.finishNode(node, "SpreadElement")
}

pp$2.parseRest = function(allowNonIdent) {
  var node = this.startNode()
  this.next()

  // RestElement inside of a function parameter must be an identifier
  if (allowNonIdent) node.argument = this.type === tt.name ? this.parseIdent() : this.unexpected()
  else node.argument = this.type === tt.name || this.type === tt.bracketL ? this.parseBindingAtom() : this.unexpected()

  return this.finishNode(node, "RestElement")
}

// Parses lvalue (assignable) atom.

pp$2.parseBindingAtom = function() {
  if (this.options.ecmaVersion < 6) return this.parseIdent()
  switch (this.type) {
  case tt.name:
    return this.parseIdent()

  case tt.bracketL:
    var node = this.startNode()
    this.next()
    node.elements = this.parseBindingList(tt.bracketR, true, true)
    return this.finishNode(node, "ArrayPattern")

  case tt.braceL:
    return this.parseObj(true)

  default:
    this.unexpected()
  }
}

pp$2.parseBindingList = function(close, allowEmpty, allowTrailingComma, allowNonIdent) {
  var this$1 = this;

  var elts = [], first = true
  while (!this.eat(close)) {
    if (first) first = false
    else this$1.expect(tt.comma)
    if (allowEmpty && this$1.type === tt.comma) {
      elts.push(null)
    } else if (allowTrailingComma && this$1.afterTrailingComma(close)) {
      break
    } else if (this$1.type === tt.ellipsis) {
      var rest = this$1.parseRest(allowNonIdent)
      this$1.parseBindingListItem(rest)
      elts.push(rest)
      if (this$1.type === tt.comma) this$1.raise(this$1.start, "Comma is not permitted after the rest element")
      this$1.expect(close)
      break
    } else {
      var elem = this$1.parseMaybeDefault(this$1.start, this$1.startLoc)
      this$1.parseBindingListItem(elem)
      elts.push(elem)
    }
  }
  return elts
}

pp$2.parseBindingListItem = function(param) {
  return param
}

// Parses assignment pattern around given atom if possible.

pp$2.parseMaybeDefault = function(startPos, startLoc, left) {
  left = left || this.parseBindingAtom()
  if (this.options.ecmaVersion < 6 || !this.eat(tt.eq)) return left
  var node = this.startNodeAt(startPos, startLoc)
  node.left = left
  node.right = this.parseMaybeAssign()
  return this.finishNode(node, "AssignmentPattern")
}

// Verify that a node is an lval — something that can be assigned
// to.

pp$2.checkLVal = function(expr, isBinding, checkClashes) {
  var this$1 = this;

  switch (expr.type) {
  case "Identifier":
    if (this.strict && this.reservedWordsStrictBind.test(expr.name))
      this.raiseRecoverable(expr.start, (isBinding ? "Binding " : "Assigning to ") + expr.name + " in strict mode")
    if (checkClashes) {
      if (has(checkClashes, expr.name))
        this.raiseRecoverable(expr.start, "Argument name clash")
      checkClashes[expr.name] = true
    }
    break

  case "MemberExpression":
    if (isBinding) this.raiseRecoverable(expr.start, (isBinding ? "Binding" : "Assigning to") + " member expression")
    break

  case "ObjectPattern":
    for (var i = 0; i < expr.properties.length; i++)
      this$1.checkLVal(expr.properties[i].value, isBinding, checkClashes)
    break

  case "ArrayPattern":
    for (var i$1 = 0; i$1 < expr.elements.length; i$1++) {
      var elem = expr.elements[i$1]
      if (elem) this$1.checkLVal(elem, isBinding, checkClashes)
    }
    break

  case "AssignmentPattern":
    this.checkLVal(expr.left, isBinding, checkClashes)
    break

  case "RestElement":
    this.checkLVal(expr.argument, isBinding, checkClashes)
    break

  case "ParenthesizedExpression":
    this.checkLVal(expr.expression, isBinding, checkClashes)
    break

  default:
    this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " rvalue")
  }
}

// A recursive descent parser operates by defining functions for all
// syntactic elements, and recursively calling those, each function
// advancing the input stream and returning an AST node. Precedence
// of constructs (for example, the fact that `!x[1]` means `!(x[1])`
// instead of `(!x)[1]` is handled by the fact that the parser
// function that parses unary prefix operators is called first, and
// in turn calls the function that parses `[]` subscripts — that
// way, it'll receive the node for `x[1]` already parsed, and wraps
// *that* in the unary operator node.
//
// Acorn uses an [operator precedence parser][opp] to handle binary
// operator precedence, because it is much more compact than using
// the technique outlined above, which uses different, nesting
// functions to specify precedence, for all of the ten binary
// precedence levels that JavaScript defines.
//
// [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

var pp$3 = Parser.prototype

// Check if property name clashes with already added.
// Object/class getters and setters are not allowed to clash —
// either with each other or with an init property — and in
// strict mode, init properties are also not allowed to be repeated.

pp$3.checkPropClash = function(prop, propHash) {
  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand))
    return
  var key = prop.key;
  var name
  switch (key.type) {
  case "Identifier": name = key.name; break
  case "Literal": name = String(key.value); break
  default: return
  }
  var kind = prop.kind;
  if (this.options.ecmaVersion >= 6) {
    if (name === "__proto__" && kind === "init") {
      if (propHash.proto) this.raiseRecoverable(key.start, "Redefinition of __proto__ property")
      propHash.proto = true
    }
    return
  }
  name = "$" + name
  var other = propHash[name]
  if (other) {
    var isGetSet = kind !== "init"
    if ((this.strict || isGetSet) && other[kind] || !(isGetSet ^ other.init))
      this.raiseRecoverable(key.start, "Redefinition of property")
  } else {
    other = propHash[name] = {
      init: false,
      get: false,
      set: false
    }
  }
  other[kind] = true
}

// ### Expression parsing

// These nest, from the most general expression type at the top to
// 'atomic', nondivisible expression types at the bottom. Most of
// the functions will simply let the function(s) below them parse,
// and, *if* the syntactic construct they handle is present, wrap
// the AST node that the inner parser gave them in another node.

// Parse a full expression. The optional arguments are used to
// forbid the `in` operator (in for loops initalization expressions)
// and provide reference for storing '=' operator inside shorthand
// property assignment in contexts where both object expression
// and object pattern might appear (so it's possible to raise
// delayed syntax error at correct position).

pp$3.parseExpression = function(noIn, refDestructuringErrors) {
  var this$1 = this;

  var startPos = this.start, startLoc = this.startLoc
  var expr = this.parseMaybeAssign(noIn, refDestructuringErrors)
  if (this.type === tt.comma) {
    var node = this.startNodeAt(startPos, startLoc)
    node.expressions = [expr]
    while (this.eat(tt.comma)) node.expressions.push(this$1.parseMaybeAssign(noIn, refDestructuringErrors))
    return this.finishNode(node, "SequenceExpression")
  }
  return expr
}

// Parse an assignment expression. This includes applications of
// operators like `+=`.

pp$3.parseMaybeAssign = function(noIn, refDestructuringErrors, afterLeftParse) {
  if (this.inGenerator && this.isContextual("yield")) return this.parseYield()

  var ownDestructuringErrors = false, oldParenAssign = -1
  if (refDestructuringErrors) {
    oldParenAssign = refDestructuringErrors.parenthesizedAssign
    refDestructuringErrors.parenthesizedAssign = -1
  } else {
    refDestructuringErrors = new DestructuringErrors
    ownDestructuringErrors = true
  }

  var startPos = this.start, startLoc = this.startLoc
  if (this.type == tt.parenL || this.type == tt.name)
    this.potentialArrowAt = this.start
  var left = this.parseMaybeConditional(noIn, refDestructuringErrors)
  if (afterLeftParse) left = afterLeftParse.call(this, left, startPos, startLoc)
  if (this.type.isAssign) {
    this.checkPatternErrors(refDestructuringErrors, true)
    if (!ownDestructuringErrors) DestructuringErrors.call(refDestructuringErrors)
    var node = this.startNodeAt(startPos, startLoc)
    node.operator = this.value
    node.left = this.type === tt.eq ? this.toAssignable(left) : left
    refDestructuringErrors.shorthandAssign = -1 // reset because shorthand default was used correctly
    this.checkLVal(left)
    this.next()
    node.right = this.parseMaybeAssign(noIn)
    return this.finishNode(node, "AssignmentExpression")
  } else {
    if (ownDestructuringErrors) this.checkExpressionErrors(refDestructuringErrors, true)
  }
  if (oldParenAssign > -1) refDestructuringErrors.parenthesizedAssign = oldParenAssign
  return left
}

// Parse a ternary conditional (`?:`) operator.

pp$3.parseMaybeConditional = function(noIn, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc
  var expr = this.parseExprOps(noIn, refDestructuringErrors)
  if (this.checkExpressionErrors(refDestructuringErrors)) return expr
  if (this.eat(tt.question)) {
    var node = this.startNodeAt(startPos, startLoc)
    node.test = expr
    node.consequent = this.parseMaybeAssign()
    this.expect(tt.colon)
    node.alternate = this.parseMaybeAssign(noIn)
    return this.finishNode(node, "ConditionalExpression")
  }
  return expr
}

// Start the precedence parser.

pp$3.parseExprOps = function(noIn, refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc
  var expr = this.parseMaybeUnary(refDestructuringErrors, false)
  if (this.checkExpressionErrors(refDestructuringErrors)) return expr
  return this.parseExprOp(expr, startPos, startLoc, -1, noIn)
}

// Parse binary operators with the operator precedence parsing
// algorithm. `left` is the left-hand side of the operator.
// `minPrec` provides context that allows the function to stop and
// defer further parser to one of its callers when it encounters an
// operator that has a lower precedence than the set it is parsing.

pp$3.parseExprOp = function(left, leftStartPos, leftStartLoc, minPrec, noIn) {
  var prec = this.type.binop
  if (prec != null && (!noIn || this.type !== tt._in)) {
    if (prec > minPrec) {
      var logical = this.type === tt.logicalOR || this.type === tt.logicalAND
      var op = this.value
      this.next()
      var startPos = this.start, startLoc = this.startLoc
      var right = this.parseExprOp(this.parseMaybeUnary(null, false), startPos, startLoc, prec, noIn)
      var node = this.buildBinary(leftStartPos, leftStartLoc, left, right, op, logical)
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn)
    }
  }
  return left
}

pp$3.buildBinary = function(startPos, startLoc, left, right, op, logical) {
  var node = this.startNodeAt(startPos, startLoc)
  node.left = left
  node.operator = op
  node.right = right
  return this.finishNode(node, logical ? "LogicalExpression" : "BinaryExpression")
}

// Parse unary operators, both prefix and postfix.

pp$3.parseMaybeUnary = function(refDestructuringErrors, sawUnary) {
  var this$1 = this;

  var startPos = this.start, startLoc = this.startLoc, expr
  if (this.inAsync && this.isContextual("await")) {
    expr = this.parseAwait(refDestructuringErrors)
    sawUnary = true
  } else if (this.type.prefix) {
    var node = this.startNode(), update = this.type === tt.incDec
    node.operator = this.value
    node.prefix = true
    this.next()
    node.argument = this.parseMaybeUnary(null, true)
    this.checkExpressionErrors(refDestructuringErrors, true)
    if (update) this.checkLVal(node.argument)
    else if (this.strict && node.operator === "delete" &&
             node.argument.type === "Identifier")
      this.raiseRecoverable(node.start, "Deleting local variable in strict mode")
    else sawUnary = true
    expr = this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression")
  } else {
    expr = this.parseExprSubscripts(refDestructuringErrors)
    if (this.checkExpressionErrors(refDestructuringErrors)) return expr
    while (this.type.postfix && !this.canInsertSemicolon()) {
      var node$1 = this$1.startNodeAt(startPos, startLoc)
      node$1.operator = this$1.value
      node$1.prefix = false
      node$1.argument = expr
      this$1.checkLVal(expr)
      this$1.next()
      expr = this$1.finishNode(node$1, "UpdateExpression")
    }
  }

  if (!sawUnary && this.eat(tt.starstar))
    return this.buildBinary(startPos, startLoc, expr, this.parseMaybeUnary(null, false), "**", false)
  else
    return expr
}

// Parse call, dot, and `[]`-subscript expressions.

pp$3.parseExprSubscripts = function(refDestructuringErrors) {
  var startPos = this.start, startLoc = this.startLoc
  var expr = this.parseExprAtom(refDestructuringErrors)
  var skipArrowSubscripts = expr.type === "ArrowFunctionExpression" && this.input.slice(this.lastTokStart, this.lastTokEnd) !== ")"
  if (this.checkExpressionErrors(refDestructuringErrors) || skipArrowSubscripts) return expr
  var result = this.parseSubscripts(expr, startPos, startLoc)
  if (refDestructuringErrors && result.type === "MemberExpression") {
    if (refDestructuringErrors.parenthesizedAssign >= result.start) refDestructuringErrors.parenthesizedAssign = -1
    if (refDestructuringErrors.parenthesizedBind >= result.start) refDestructuringErrors.parenthesizedBind = -1
  }
  return result
}

pp$3.parseSubscripts = function(base, startPos, startLoc, noCalls) {
  var this$1 = this;

  var maybeAsyncArrow = this.options.ecmaVersion >= 8 && base.type === "Identifier" && base.name === "async" &&
      this.lastTokEnd == base.end && !this.canInsertSemicolon()
  for (var computed;;) {
    if ((computed = this$1.eat(tt.bracketL)) || this$1.eat(tt.dot)) {
      var node = this$1.startNodeAt(startPos, startLoc)
      node.object = base
      node.property = computed ? this$1.parseExpression() : this$1.parseIdent(true)
      node.computed = !!computed
      if (computed) this$1.expect(tt.bracketR)
      base = this$1.finishNode(node, "MemberExpression")
    } else if (!noCalls && this$1.eat(tt.parenL)) {
      var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this$1.yieldPos, oldAwaitPos = this$1.awaitPos
      this$1.yieldPos = 0
      this$1.awaitPos = 0
      var exprList = this$1.parseExprList(tt.parenR, this$1.options.ecmaVersion >= 8, false, refDestructuringErrors)
      if (maybeAsyncArrow && !this$1.canInsertSemicolon() && this$1.eat(tt.arrow)) {
        this$1.checkPatternErrors(refDestructuringErrors, false)
        this$1.checkYieldAwaitInDefaultParams()
        this$1.yieldPos = oldYieldPos
        this$1.awaitPos = oldAwaitPos
        return this$1.parseArrowExpression(this$1.startNodeAt(startPos, startLoc), exprList, true)
      }
      this$1.checkExpressionErrors(refDestructuringErrors, true)
      this$1.yieldPos = oldYieldPos || this$1.yieldPos
      this$1.awaitPos = oldAwaitPos || this$1.awaitPos
      var node$1 = this$1.startNodeAt(startPos, startLoc)
      node$1.callee = base
      node$1.arguments = exprList
      base = this$1.finishNode(node$1, "CallExpression")
    } else if (this$1.type === tt.backQuote) {
      var node$2 = this$1.startNodeAt(startPos, startLoc)
      node$2.tag = base
      node$2.quasi = this$1.parseTemplate()
      base = this$1.finishNode(node$2, "TaggedTemplateExpression")
    } else {
      return base
    }
  }
}

// Parse an atomic expression — either a single token that is an
// expression, an expression started by a keyword like `function` or
// `new`, or an expression wrapped in punctuation like `()`, `[]`,
// or `{}`.

pp$3.parseExprAtom = function(refDestructuringErrors) {
  var node, canBeArrow = this.potentialArrowAt == this.start
  switch (this.type) {
  case tt._super:
    if (!this.inFunction)
      this.raise(this.start, "'super' outside of function or class")

  case tt._this:
    var type = this.type === tt._this ? "ThisExpression" : "Super"
    node = this.startNode()
    this.next()
    return this.finishNode(node, type)

  case tt.name:
    var startPos = this.start, startLoc = this.startLoc
    var id = this.parseIdent(this.type !== tt.name)
    if (this.options.ecmaVersion >= 8 && id.name === "async" && !this.canInsertSemicolon() && this.eat(tt._function))
      return this.parseFunction(this.startNodeAt(startPos, startLoc), false, false, true)
    if (canBeArrow && !this.canInsertSemicolon()) {
      if (this.eat(tt.arrow))
        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], false)
      if (this.options.ecmaVersion >= 8 && id.name === "async" && this.type === tt.name) {
        id = this.parseIdent()
        if (this.canInsertSemicolon() || !this.eat(tt.arrow))
          this.unexpected()
        return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id], true)
      }
    }
    return id

  case tt.regexp:
    var value = this.value
    node = this.parseLiteral(value.value)
    node.regex = {pattern: value.pattern, flags: value.flags}
    return node

  case tt.num: case tt.string:
    return this.parseLiteral(this.value)

  case tt._null: case tt._true: case tt._false:
    node = this.startNode()
    node.value = this.type === tt._null ? null : this.type === tt._true
    node.raw = this.type.keyword
    this.next()
    return this.finishNode(node, "Literal")

  case tt.parenL:
    var start = this.start, expr = this.parseParenAndDistinguishExpression(canBeArrow)
    if (refDestructuringErrors) {
      if (refDestructuringErrors.parenthesizedAssign < 0 && !this.isSimpleAssignTarget(expr))
        refDestructuringErrors.parenthesizedAssign = start
      if (refDestructuringErrors.parenthesizedBind < 0)
        refDestructuringErrors.parenthesizedBind = start
    }
    return expr

  case tt.bracketL:
    node = this.startNode()
    this.next()
    node.elements = this.parseExprList(tt.bracketR, true, true, refDestructuringErrors)
    return this.finishNode(node, "ArrayExpression")

  case tt.braceL:
    return this.parseObj(false, refDestructuringErrors)

  case tt._function:
    node = this.startNode()
    this.next()
    return this.parseFunction(node, false)

  case tt._class:
    return this.parseClass(this.startNode(), false)

  case tt._new:
    return this.parseNew()

  case tt.backQuote:
    return this.parseTemplate()

  default:
    this.unexpected()
  }
}

pp$3.parseLiteral = function(value) {
  var node = this.startNode()
  node.value = value
  node.raw = this.input.slice(this.start, this.end)
  this.next()
  return this.finishNode(node, "Literal")
}

pp$3.parseParenExpression = function() {
  this.expect(tt.parenL)
  var val = this.parseExpression()
  this.expect(tt.parenR)
  return val
}

pp$3.parseParenAndDistinguishExpression = function(canBeArrow) {
  var this$1 = this;

  var startPos = this.start, startLoc = this.startLoc, val, allowTrailingComma = this.options.ecmaVersion >= 8
  if (this.options.ecmaVersion >= 6) {
    this.next()

    var innerStartPos = this.start, innerStartLoc = this.startLoc
    var exprList = [], first = true, lastIsComma = false
    var refDestructuringErrors = new DestructuringErrors, oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, spreadStart, innerParenStart
    this.yieldPos = 0
    this.awaitPos = 0
    while (this.type !== tt.parenR) {
      first ? first = false : this$1.expect(tt.comma)
      if (allowTrailingComma && this$1.afterTrailingComma(tt.parenR, true)) {
        lastIsComma = true
        break
      } else if (this$1.type === tt.ellipsis) {
        spreadStart = this$1.start
        exprList.push(this$1.parseParenItem(this$1.parseRest()))
        if (this$1.type === tt.comma) this$1.raise(this$1.start, "Comma is not permitted after the rest element")
        break
      } else {
        if (this$1.type === tt.parenL && !innerParenStart) {
          innerParenStart = this$1.start
        }
        exprList.push(this$1.parseMaybeAssign(false, refDestructuringErrors, this$1.parseParenItem))
      }
    }
    var innerEndPos = this.start, innerEndLoc = this.startLoc
    this.expect(tt.parenR)

    if (canBeArrow && !this.canInsertSemicolon() && this.eat(tt.arrow)) {
      this.checkPatternErrors(refDestructuringErrors, false)
      this.checkYieldAwaitInDefaultParams()
      if (innerParenStart) this.unexpected(innerParenStart)
      this.yieldPos = oldYieldPos
      this.awaitPos = oldAwaitPos
      return this.parseParenArrowList(startPos, startLoc, exprList)
    }

    if (!exprList.length || lastIsComma) this.unexpected(this.lastTokStart)
    if (spreadStart) this.unexpected(spreadStart)
    this.checkExpressionErrors(refDestructuringErrors, true)
    this.yieldPos = oldYieldPos || this.yieldPos
    this.awaitPos = oldAwaitPos || this.awaitPos

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc)
      val.expressions = exprList
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc)
    } else {
      val = exprList[0]
    }
  } else {
    val = this.parseParenExpression()
  }

  if (this.options.preserveParens) {
    var par = this.startNodeAt(startPos, startLoc)
    par.expression = val
    return this.finishNode(par, "ParenthesizedExpression")
  } else {
    return val
  }
}

pp$3.parseParenItem = function(item) {
  return item
}

pp$3.parseParenArrowList = function(startPos, startLoc, exprList) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList)
}

// New's precedence is slightly tricky. It must allow its argument to
// be a `[]` or dot subscript expression, but not a call — at least,
// not without wrapping it in parentheses. Thus, it uses the noCalls
// argument to parseSubscripts to prevent it from consuming the
// argument list.

var empty$1 = []

pp$3.parseNew = function() {
  var node = this.startNode()
  var meta = this.parseIdent(true)
  if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
    node.meta = meta
    node.property = this.parseIdent(true)
    if (node.property.name !== "target")
      this.raiseRecoverable(node.property.start, "The only valid meta property for new is new.target")
    if (!this.inFunction)
      this.raiseRecoverable(node.start, "new.target can only be used in functions")
    return this.finishNode(node, "MetaProperty")
  }
  var startPos = this.start, startLoc = this.startLoc
  node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true)
  if (this.eat(tt.parenL)) node.arguments = this.parseExprList(tt.parenR, this.options.ecmaVersion >= 8, false)
  else node.arguments = empty$1
  return this.finishNode(node, "NewExpression")
}

// Parse template expression.

pp$3.parseTemplateElement = function() {
  var elem = this.startNode()
  elem.value = {
    raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, '\n'),
    cooked: this.value
  }
  this.next()
  elem.tail = this.type === tt.backQuote
  return this.finishNode(elem, "TemplateElement")
}

pp$3.parseTemplate = function() {
  var this$1 = this;

  var node = this.startNode()
  this.next()
  node.expressions = []
  var curElt = this.parseTemplateElement()
  node.quasis = [curElt]
  while (!curElt.tail) {
    this$1.expect(tt.dollarBraceL)
    node.expressions.push(this$1.parseExpression())
    this$1.expect(tt.braceR)
    node.quasis.push(curElt = this$1.parseTemplateElement())
  }
  this.next()
  return this.finishNode(node, "TemplateLiteral")
}

// Parse an object literal or binding pattern.

pp$3.parseObj = function(isPattern, refDestructuringErrors) {
  var this$1 = this;

  var node = this.startNode(), first = true, propHash = {}
  node.properties = []
  this.next()
  while (!this.eat(tt.braceR)) {
    if (!first) {
      this$1.expect(tt.comma)
      if (this$1.afterTrailingComma(tt.braceR)) break
    } else first = false

    var prop = this$1.startNode(), isGenerator, isAsync, startPos, startLoc
    if (this$1.options.ecmaVersion >= 6) {
      prop.method = false
      prop.shorthand = false
      if (isPattern || refDestructuringErrors) {
        startPos = this$1.start
        startLoc = this$1.startLoc
      }
      if (!isPattern)
        isGenerator = this$1.eat(tt.star)
    }
    this$1.parsePropertyName(prop)
    if (!isPattern && this$1.options.ecmaVersion >= 8 && !isGenerator && !prop.computed &&
        prop.key.type === "Identifier" && prop.key.name === "async" && this$1.type !== tt.parenL &&
        this$1.type !== tt.colon && !this$1.canInsertSemicolon()) {
      isAsync = true
      this$1.parsePropertyName(prop, refDestructuringErrors)
    } else {
      isAsync = false
    }
    this$1.parsePropertyValue(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors)
    this$1.checkPropClash(prop, propHash)
    node.properties.push(this$1.finishNode(prop, "Property"))
  }
  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression")
}

pp$3.parsePropertyValue = function(prop, isPattern, isGenerator, isAsync, startPos, startLoc, refDestructuringErrors) {
  if ((isGenerator || isAsync) && this.type === tt.colon)
    this.unexpected()

  if (this.eat(tt.colon)) {
    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refDestructuringErrors)
    prop.kind = "init"
  } else if (this.options.ecmaVersion >= 6 && this.type === tt.parenL) {
    if (isPattern) this.unexpected()
    prop.kind = "init"
    prop.method = true
    prop.value = this.parseMethod(isGenerator, isAsync)
  } else if (this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" &&
             (prop.key.name === "get" || prop.key.name === "set") &&
             (this.type != tt.comma && this.type != tt.braceR)) {
    if (isGenerator || isAsync || isPattern) this.unexpected()
    prop.kind = prop.key.name
    this.parsePropertyName(prop)
    prop.value = this.parseMethod(false)
    var paramCount = prop.kind === "get" ? 0 : 1
    if (prop.value.params.length !== paramCount) {
      var start = prop.value.start
      if (prop.kind === "get")
        this.raiseRecoverable(start, "getter should have no params")
      else
        this.raiseRecoverable(start, "setter should have exactly one param")
    } else {
      if (prop.kind === "set" && prop.value.params[0].type === "RestElement")
        this.raiseRecoverable(prop.value.params[0].start, "Setter cannot use rest params")
    }
  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
    if (this.keywords.test(prop.key.name) ||
        (this.strict ? this.reservedWordsStrict : this.reservedWords).test(prop.key.name) ||
        (this.inGenerator && prop.key.name == "yield") ||
        (this.inAsync && prop.key.name == "await"))
      this.raiseRecoverable(prop.key.start, "'" + prop.key.name + "' can not be used as shorthand property")
    prop.kind = "init"
    if (isPattern) {
      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key)
    } else if (this.type === tt.eq && refDestructuringErrors) {
      if (refDestructuringErrors.shorthandAssign < 0)
        refDestructuringErrors.shorthandAssign = this.start
      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key)
    } else {
      prop.value = prop.key
    }
    prop.shorthand = true
  } else this.unexpected()
}

pp$3.parsePropertyName = function(prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(tt.bracketL)) {
      prop.computed = true
      prop.key = this.parseMaybeAssign()
      this.expect(tt.bracketR)
      return prop.key
    } else {
      prop.computed = false
    }
  }
  return prop.key = this.type === tt.num || this.type === tt.string ? this.parseExprAtom() : this.parseIdent(true)
}

// Initialize empty function node.

pp$3.initFunction = function(node) {
  node.id = null
  if (this.options.ecmaVersion >= 6) {
    node.generator = false
    node.expression = false
  }
  if (this.options.ecmaVersion >= 8)
    node.async = false
}

// Parse object or class method.

pp$3.parseMethod = function(isGenerator, isAsync) {
  var node = this.startNode(), oldInGen = this.inGenerator, oldInAsync = this.inAsync,
      oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldInFunc = this.inFunction

  this.initFunction(node)
  if (this.options.ecmaVersion >= 6)
    node.generator = isGenerator
  if (this.options.ecmaVersion >= 8)
    node.async = !!isAsync

  this.inGenerator = node.generator
  this.inAsync = node.async
  this.yieldPos = 0
  this.awaitPos = 0
  this.inFunction = true

  this.expect(tt.parenL)
  node.params = this.parseBindingList(tt.parenR, false, this.options.ecmaVersion >= 8)
  this.checkYieldAwaitInDefaultParams()
  this.parseFunctionBody(node, false)

  this.inGenerator = oldInGen
  this.inAsync = oldInAsync
  this.yieldPos = oldYieldPos
  this.awaitPos = oldAwaitPos
  this.inFunction = oldInFunc
  return this.finishNode(node, "FunctionExpression")
}

// Parse arrow function expression with given parameters.

pp$3.parseArrowExpression = function(node, params, isAsync) {
  var oldInGen = this.inGenerator, oldInAsync = this.inAsync,
      oldYieldPos = this.yieldPos, oldAwaitPos = this.awaitPos, oldInFunc = this.inFunction

  this.initFunction(node)
  if (this.options.ecmaVersion >= 8)
    node.async = !!isAsync

  this.inGenerator = false
  this.inAsync = node.async
  this.yieldPos = 0
  this.awaitPos = 0
  this.inFunction = true

  node.params = this.toAssignableList(params, true)
  this.parseFunctionBody(node, true)

  this.inGenerator = oldInGen
  this.inAsync = oldInAsync
  this.yieldPos = oldYieldPos
  this.awaitPos = oldAwaitPos
  this.inFunction = oldInFunc
  return this.finishNode(node, "ArrowFunctionExpression")
}

// Parse function body and check parameters.

pp$3.parseFunctionBody = function(node, isArrowFunction) {
  var isExpression = isArrowFunction && this.type !== tt.braceL
  var oldStrict = this.strict, useStrict = false

  if (isExpression) {
    node.body = this.parseMaybeAssign()
    node.expression = true
  } else {
    var nonSimple = this.options.ecmaVersion >= 7 && !this.isSimpleParamList(node.params)
    if (!oldStrict || nonSimple) {
      useStrict = this.strictDirective(this.end)
      // If this is a strict mode function, verify that argument names
      // are not repeated, and it does not try to bind the words `eval`
      // or `arguments`.
      if (useStrict && nonSimple)
        this.raiseRecoverable(node.start, "Illegal 'use strict' directive in function with non-simple parameter list")
    }
    // Start a new scope with regard to labels and the `inFunction`
    // flag (restore them to their old value afterwards).
    var oldLabels = this.labels
    this.labels = []
    if (useStrict) this.strict = true
    node.body = this.parseBlock(true)
    node.expression = false
    this.labels = oldLabels
  }

  if (oldStrict || useStrict) {
    this.strict = true
    if (node.id)
      this.checkLVal(node.id, true)
    this.checkParams(node)
    this.strict = oldStrict
  } else if (isArrowFunction || !this.isSimpleParamList(node.params)) {
    this.checkParams(node)
  }
}

pp$3.isSimpleParamList = function(params) {
  for (var i = 0; i < params.length; i++)
    if (params[i].type !== "Identifier") return false
  return true
}

// Checks function params for various disallowed patterns such as using "eval"
// or "arguments" and duplicate parameters.

pp$3.checkParams = function(node) {
  var this$1 = this;

  var nameHash = {}
  for (var i = 0; i < node.params.length; i++) this$1.checkLVal(node.params[i], true, nameHash)
}

// Parses a comma-separated list of expressions, and returns them as
// an array. `close` is the token type that ends the list, and
// `allowEmpty` can be turned on to allow subsequent commas with
// nothing in between them to be parsed as `null` (which is needed
// for array literals).

pp$3.parseExprList = function(close, allowTrailingComma, allowEmpty, refDestructuringErrors) {
  var this$1 = this;

  var elts = [], first = true
  while (!this.eat(close)) {
    if (!first) {
      this$1.expect(tt.comma)
      if (allowTrailingComma && this$1.afterTrailingComma(close)) break
    } else first = false

    var elt
    if (allowEmpty && this$1.type === tt.comma)
      elt = null
    else if (this$1.type === tt.ellipsis) {
      elt = this$1.parseSpread(refDestructuringErrors)
      if (refDestructuringErrors && this$1.type === tt.comma && refDestructuringErrors.trailingComma < 0)
        refDestructuringErrors.trailingComma = this$1.start
    } else {
      elt = this$1.parseMaybeAssign(false, refDestructuringErrors)
    }
    elts.push(elt)
  }
  return elts
}

// Parse the next token as an identifier. If `liberal` is true (used
// when parsing properties), it will also convert keywords into
// identifiers.

pp$3.parseIdent = function(liberal) {
  var node = this.startNode()
  if (liberal && this.options.allowReserved == "never") liberal = false
  if (this.type === tt.name) {
    if (!liberal && (this.strict ? this.reservedWordsStrict : this.reservedWords).test(this.value) &&
        (this.options.ecmaVersion >= 6 ||
         this.input.slice(this.start, this.end).indexOf("\\") == -1))
      this.raiseRecoverable(this.start, "The keyword '" + this.value + "' is reserved")
    if (this.inGenerator && this.value === "yield")
      this.raiseRecoverable(this.start, "Can not use 'yield' as identifier inside a generator")
    if (this.inAsync && this.value === "await")
      this.raiseRecoverable(this.start, "Can not use 'await' as identifier inside an async function")
    node.name = this.value
  } else if (liberal && this.type.keyword) {
    node.name = this.type.keyword
  } else {
    this.unexpected()
  }
  this.next()
  return this.finishNode(node, "Identifier")
}

// Parses yield expression inside generator.

pp$3.parseYield = function() {
  if (!this.yieldPos) this.yieldPos = this.start

  var node = this.startNode()
  this.next()
  if (this.type == tt.semi || this.canInsertSemicolon() || (this.type != tt.star && !this.type.startsExpr)) {
    node.delegate = false
    node.argument = null
  } else {
    node.delegate = this.eat(tt.star)
    node.argument = this.parseMaybeAssign()
  }
  return this.finishNode(node, "YieldExpression")
}

pp$3.parseAwait = function() {
  if (!this.awaitPos) this.awaitPos = this.start

  var node = this.startNode()
  this.next()
  node.argument = this.parseMaybeUnary(null, true)
  return this.finishNode(node, "AwaitExpression")
}

var pp$4 = Parser.prototype

// This function is used to raise exceptions on parse errors. It
// takes an offset integer (into the current `input`) to indicate
// the location of the error, attaches the position to the end
// of the error message, and then raises a `SyntaxError` with that
// message.

pp$4.raise = function(pos, message) {
  var loc = getLineInfo(this.input, pos)
  message += " (" + loc.line + ":" + loc.column + ")"
  var err = new SyntaxError(message)
  err.pos = pos; err.loc = loc; err.raisedAt = this.pos
  throw err
}

pp$4.raiseRecoverable = pp$4.raise

pp$4.curPosition = function() {
  if (this.options.locations) {
    return new Position(this.curLine, this.pos - this.lineStart)
  }
}

var Node = function Node(parser, pos, loc) {
  this.type = ""
  this.start = pos
  this.end = 0
  if (parser.options.locations)
    this.loc = new SourceLocation(parser, loc)
  if (parser.options.directSourceFile)
    this.sourceFile = parser.options.directSourceFile
  if (parser.options.ranges)
    this.range = [pos, 0]
};

// Start an AST node, attaching a start offset.

var pp$5 = Parser.prototype

pp$5.startNode = function() {
  return new Node(this, this.start, this.startLoc)
}

pp$5.startNodeAt = function(pos, loc) {
  return new Node(this, pos, loc)
}

// Finish an AST node, adding `type` and `end` properties.

function finishNodeAt(node, type, pos, loc) {
  node.type = type
  node.end = pos
  if (this.options.locations)
    node.loc.end = loc
  if (this.options.ranges)
    node.range[1] = pos
  return node
}

pp$5.finishNode = function(node, type) {
  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc)
}

// Finish node at given position

pp$5.finishNodeAt = function(node, type, pos, loc) {
  return finishNodeAt.call(this, node, type, pos, loc)
}

// The algorithm used to determine whether a regexp can appear at a
// given point in the program is loosely based on sweet.js' approach.
// See https://github.com/mozilla/sweet.js/wiki/design

var TokContext = function TokContext(token, isExpr, preserveSpace, override) {
  this.token = token
  this.isExpr = !!isExpr
  this.preserveSpace = !!preserveSpace
  this.override = override
};

var types = {
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  b_tmpl: new TokContext("${", true),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  q_tmpl: new TokContext("`", true, true, function (p) { return p.readTmplToken(); }),
  f_expr: new TokContext("function", true)
}

var pp$6 = Parser.prototype

pp$6.initialContext = function() {
  return [types.b_stat]
}

pp$6.braceIsBlock = function(prevType) {
  if (prevType === tt.colon) {
    var parent = this.curContext()
    if (parent === types.b_stat || parent === types.b_expr)
      return !parent.isExpr
  }
  if (prevType === tt._return)
    return lineBreak.test(this.input.slice(this.lastTokEnd, this.start))
  if (prevType === tt._else || prevType === tt.semi || prevType === tt.eof || prevType === tt.parenR)
    return true
  if (prevType == tt.braceL)
    return this.curContext() === types.b_stat
  return !this.exprAllowed
}

pp$6.updateContext = function(prevType) {
  var update, type = this.type
  if (type.keyword && prevType == tt.dot)
    this.exprAllowed = false
  else if (update = type.updateContext)
    update.call(this, prevType)
  else
    this.exprAllowed = type.beforeExpr
}

// Token-specific context update code

tt.parenR.updateContext = tt.braceR.updateContext = function() {
  if (this.context.length == 1) {
    this.exprAllowed = true
    return
  }
  var out = this.context.pop()
  if (out === types.b_stat && this.curContext() === types.f_expr) {
    this.context.pop()
    this.exprAllowed = false
  } else if (out === types.b_tmpl) {
    this.exprAllowed = true
  } else {
    this.exprAllowed = !out.isExpr
  }
}

tt.braceL.updateContext = function(prevType) {
  this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr)
  this.exprAllowed = true
}

tt.dollarBraceL.updateContext = function() {
  this.context.push(types.b_tmpl)
  this.exprAllowed = true
}

tt.parenL.updateContext = function(prevType) {
  var statementParens = prevType === tt._if || prevType === tt._for || prevType === tt._with || prevType === tt._while
  this.context.push(statementParens ? types.p_stat : types.p_expr)
  this.exprAllowed = true
}

tt.incDec.updateContext = function() {
  // tokExprAllowed stays unchanged
}

tt._function.updateContext = function(prevType) {
  if (prevType.beforeExpr && prevType !== tt.semi && prevType !== tt._else &&
      !((prevType === tt.colon || prevType === tt.braceL) && this.curContext() === types.b_stat))
    this.context.push(types.f_expr)
  this.exprAllowed = false
}

tt.backQuote.updateContext = function() {
  if (this.curContext() === types.q_tmpl)
    this.context.pop()
  else
    this.context.push(types.q_tmpl)
  this.exprAllowed = false
}

// Object type used to represent tokens. Note that normally, tokens
// simply exist as properties on the parser object. This is only
// used for the onToken callback and the external tokenizer.

var Token = function Token(p) {
  this.type = p.type
  this.value = p.value
  this.start = p.start
  this.end = p.end
  if (p.options.locations)
    this.loc = new SourceLocation(p, p.startLoc, p.endLoc)
  if (p.options.ranges)
    this.range = [p.start, p.end]
};

// ## Tokenizer

var pp$7 = Parser.prototype

// Are we running under Rhino?
var isRhino = typeof Packages == "object" && Object.prototype.toString.call(Packages) == "[object JavaPackage]"

// Move to the next token

pp$7.next = function() {
  if (this.options.onToken)
    this.options.onToken(new Token(this))

  this.lastTokEnd = this.end
  this.lastTokStart = this.start
  this.lastTokEndLoc = this.endLoc
  this.lastTokStartLoc = this.startLoc
  this.nextToken()
}

pp$7.getToken = function() {
  this.next()
  return new Token(this)
}

// If we're in an ES6 environment, make parsers iterable
if (typeof Symbol !== "undefined")
  pp$7[Symbol.iterator] = function () {
    var self = this
    return {next: function () {
      var token = self.getToken()
      return {
        done: token.type === tt.eof,
        value: token
      }
    }}
  }

// Toggle strict mode. Re-reads the next number or string to please
// pedantic tests (`"use strict"; 010;` should fail).

pp$7.curContext = function() {
  return this.context[this.context.length - 1]
}

// Read a single token, updating the parser object's token-related
// properties.

pp$7.nextToken = function() {
  var curContext = this.curContext()
  if (!curContext || !curContext.preserveSpace) this.skipSpace()

  this.start = this.pos
  if (this.options.locations) this.startLoc = this.curPosition()
  if (this.pos >= this.input.length) return this.finishToken(tt.eof)

  if (curContext.override) return curContext.override(this)
  else this.readToken(this.fullCharCodeAtPos())
}

pp$7.readToken = function(code) {
  // Identifier or keyword. '\uXXXX' sequences are allowed in
  // identifiers, so '\' also dispatches to that.
  if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */)
    return this.readWord()

  return this.getTokenFromCode(code)
}

pp$7.fullCharCodeAtPos = function() {
  var code = this.input.charCodeAt(this.pos)
  if (code <= 0xd7ff || code >= 0xe000) return code
  var next = this.input.charCodeAt(this.pos + 1)
  return (code << 10) + next - 0x35fdc00
}

pp$7.skipBlockComment = function() {
  var this$1 = this;

  var startLoc = this.options.onComment && this.curPosition()
  var start = this.pos, end = this.input.indexOf("*/", this.pos += 2)
  if (end === -1) this.raise(this.pos - 2, "Unterminated comment")
  this.pos = end + 2
  if (this.options.locations) {
    lineBreakG.lastIndex = start
    var match
    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
      ++this$1.curLine
      this$1.lineStart = match.index + match[0].length
    }
  }
  if (this.options.onComment)
    this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos,
                           startLoc, this.curPosition())
}

pp$7.skipLineComment = function(startSkip) {
  var this$1 = this;

  var start = this.pos
  var startLoc = this.options.onComment && this.curPosition()
  var ch = this.input.charCodeAt(this.pos+=startSkip)
  while (this.pos < this.input.length && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
    ++this$1.pos
    ch = this$1.input.charCodeAt(this$1.pos)
  }
  if (this.options.onComment)
    this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos,
                           startLoc, this.curPosition())
}

// Called at the start of the parse and after every token. Skips
// whitespace and comments, and.

pp$7.skipSpace = function() {
  var this$1 = this;

  loop: while (this.pos < this.input.length) {
    var ch = this$1.input.charCodeAt(this$1.pos)
    switch (ch) {
      case 32: case 160: // ' '
        ++this$1.pos
        break
      case 13:
        if (this$1.input.charCodeAt(this$1.pos + 1) === 10) {
          ++this$1.pos
        }
      case 10: case 8232: case 8233:
        ++this$1.pos
        if (this$1.options.locations) {
          ++this$1.curLine
          this$1.lineStart = this$1.pos
        }
        break
      case 47: // '/'
        switch (this$1.input.charCodeAt(this$1.pos + 1)) {
          case 42: // '*'
            this$1.skipBlockComment()
            break
          case 47:
            this$1.skipLineComment(2)
            break
          default:
            break loop
        }
        break
      default:
        if (ch > 8 && ch < 14 || ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
          ++this$1.pos
        } else {
          break loop
        }
    }
  }
}

// Called at the end of every token. Sets `end`, `val`, and
// maintains `context` and `exprAllowed`, and skips the space after
// the token, so that the next one's `start` will point at the
// right position.

pp$7.finishToken = function(type, val) {
  this.end = this.pos
  if (this.options.locations) this.endLoc = this.curPosition()
  var prevType = this.type
  this.type = type
  this.value = val

  this.updateContext(prevType)
}

// ### Token reading

// This is the function that is called to fetch the next token. It
// is somewhat obscure, because it works in character codes rather
// than characters, and because operator parsing has been inlined
// into it.
//
// All in the name of speed.
//
pp$7.readToken_dot = function() {
  var next = this.input.charCodeAt(this.pos + 1)
  if (next >= 48 && next <= 57) return this.readNumber(true)
  var next2 = this.input.charCodeAt(this.pos + 2)
  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) { // 46 = dot '.'
    this.pos += 3
    return this.finishToken(tt.ellipsis)
  } else {
    ++this.pos
    return this.finishToken(tt.dot)
  }
}

pp$7.readToken_slash = function() { // '/'
  var next = this.input.charCodeAt(this.pos + 1)
  if (this.exprAllowed) {++this.pos; return this.readRegexp()}
  if (next === 61) return this.finishOp(tt.assign, 2)
  return this.finishOp(tt.slash, 1)
}

pp$7.readToken_mult_modulo_exp = function(code) { // '%*'
  var next = this.input.charCodeAt(this.pos + 1)
  var size = 1
  var tokentype = code === 42 ? tt.star : tt.modulo

  // exponentiation operator ** and **=
  if (this.options.ecmaVersion >= 7 && next === 42) {
    ++size
    tokentype = tt.starstar
    next = this.input.charCodeAt(this.pos + 2)
  }

  if (next === 61) return this.finishOp(tt.assign, size + 1)
  return this.finishOp(tokentype, size)
}

pp$7.readToken_pipe_amp = function(code) { // '|&'
  var next = this.input.charCodeAt(this.pos + 1)
  if (next === code) return this.finishOp(code === 124 ? tt.logicalOR : tt.logicalAND, 2)
  if (next === 61) return this.finishOp(tt.assign, 2)
  return this.finishOp(code === 124 ? tt.bitwiseOR : tt.bitwiseAND, 1)
}

pp$7.readToken_caret = function() { // '^'
  var next = this.input.charCodeAt(this.pos + 1)
  if (next === 61) return this.finishOp(tt.assign, 2)
  return this.finishOp(tt.bitwiseXOR, 1)
}

pp$7.readToken_plus_min = function(code) { // '+-'
  var next = this.input.charCodeAt(this.pos + 1)
  if (next === code) {
    if (next == 45 && this.input.charCodeAt(this.pos + 2) == 62 &&
        lineBreak.test(this.input.slice(this.lastTokEnd, this.pos))) {
      // A `-->` line comment
      this.skipLineComment(3)
      this.skipSpace()
      return this.nextToken()
    }
    return this.finishOp(tt.incDec, 2)
  }
  if (next === 61) return this.finishOp(tt.assign, 2)
  return this.finishOp(tt.plusMin, 1)
}

pp$7.readToken_lt_gt = function(code) { // '<>'
  var next = this.input.charCodeAt(this.pos + 1)
  var size = 1
  if (next === code) {
    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2
    if (this.input.charCodeAt(this.pos + size) === 61) return this.finishOp(tt.assign, size + 1)
    return this.finishOp(tt.bitShift, size)
  }
  if (next == 33 && code == 60 && this.input.charCodeAt(this.pos + 2) == 45 &&
      this.input.charCodeAt(this.pos + 3) == 45) {
    if (this.inModule) this.unexpected()
    // `<!--`, an XML-style comment that should be interpreted as a line comment
    this.skipLineComment(4)
    this.skipSpace()
    return this.nextToken()
  }
  if (next === 61) size = 2
  return this.finishOp(tt.relational, size)
}

pp$7.readToken_eq_excl = function(code) { // '=!'
  var next = this.input.charCodeAt(this.pos + 1)
  if (next === 61) return this.finishOp(tt.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2)
  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) { // '=>'
    this.pos += 2
    return this.finishToken(tt.arrow)
  }
  return this.finishOp(code === 61 ? tt.eq : tt.prefix, 1)
}

pp$7.getTokenFromCode = function(code) {
  switch (code) {
    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.
  case 46: // '.'
    return this.readToken_dot()

    // Punctuation tokens.
  case 40: ++this.pos; return this.finishToken(tt.parenL)
  case 41: ++this.pos; return this.finishToken(tt.parenR)
  case 59: ++this.pos; return this.finishToken(tt.semi)
  case 44: ++this.pos; return this.finishToken(tt.comma)
  case 91: ++this.pos; return this.finishToken(tt.bracketL)
  case 93: ++this.pos; return this.finishToken(tt.bracketR)
  case 123: ++this.pos; return this.finishToken(tt.braceL)
  case 125: ++this.pos; return this.finishToken(tt.braceR)
  case 58: ++this.pos; return this.finishToken(tt.colon)
  case 63: ++this.pos; return this.finishToken(tt.question)

  case 96: // '`'
    if (this.options.ecmaVersion < 6) break
    ++this.pos
    return this.finishToken(tt.backQuote)

  case 48: // '0'
    var next = this.input.charCodeAt(this.pos + 1)
    if (next === 120 || next === 88) return this.readRadixNumber(16) // '0x', '0X' - hex number
    if (this.options.ecmaVersion >= 6) {
      if (next === 111 || next === 79) return this.readRadixNumber(8) // '0o', '0O' - octal number
      if (next === 98 || next === 66) return this.readRadixNumber(2) // '0b', '0B' - binary number
    }
    // Anything else beginning with a digit is an integer, octal
    // number, or float.
  case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
    return this.readNumber(false)

    // Quotes produce strings.
  case 34: case 39: // '"', "'"
    return this.readString(code)

    // Operators are parsed inline in tiny state machines. '=' (61) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.

  case 47: // '/'
    return this.readToken_slash()

  case 37: case 42: // '%*'
    return this.readToken_mult_modulo_exp(code)

  case 124: case 38: // '|&'
    return this.readToken_pipe_amp(code)

  case 94: // '^'
    return this.readToken_caret()

  case 43: case 45: // '+-'
    return this.readToken_plus_min(code)

  case 60: case 62: // '<>'
    return this.readToken_lt_gt(code)

  case 61: case 33: // '=!'
    return this.readToken_eq_excl(code)

  case 126: // '~'
    return this.finishOp(tt.prefix, 1)
  }

  this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'")
}

pp$7.finishOp = function(type, size) {
  var str = this.input.slice(this.pos, this.pos + size)
  this.pos += size
  return this.finishToken(type, str)
}

// Parse a regular expression. Some context-awareness is necessary,
// since a '/' inside a '[]' set does not end the expression.

function tryCreateRegexp(src, flags, throwErrorAt, parser) {
  try {
    return new RegExp(src, flags)
  } catch (e) {
    if (throwErrorAt !== undefined) {
      if (e instanceof SyntaxError) parser.raise(throwErrorAt, "Error parsing regular expression: " + e.message)
      throw e
    }
  }
}

var regexpUnicodeSupport = !!tryCreateRegexp("\uffff", "u")

pp$7.readRegexp = function() {
  var this$1 = this;

  var escaped, inClass, start = this.pos
  for (;;) {
    if (this$1.pos >= this$1.input.length) this$1.raise(start, "Unterminated regular expression")
    var ch = this$1.input.charAt(this$1.pos)
    if (lineBreak.test(ch)) this$1.raise(start, "Unterminated regular expression")
    if (!escaped) {
      if (ch === "[") inClass = true
      else if (ch === "]" && inClass) inClass = false
      else if (ch === "/" && !inClass) break
      escaped = ch === "\\"
    } else escaped = false
    ++this$1.pos
  }
  var content = this.input.slice(start, this.pos)
  ++this.pos
  // Need to use `readWord1` because '\uXXXX' sequences are allowed
  // here (don't ask).
  var mods = this.readWord1()
  var tmp = content, tmpFlags = ""
  if (mods) {
    var validFlags = /^[gim]*$/
    if (this.options.ecmaVersion >= 6) validFlags = /^[gimuy]*$/
    if (!validFlags.test(mods)) this.raise(start, "Invalid regular expression flag")
    if (mods.indexOf("u") >= 0) {
      if (regexpUnicodeSupport) {
        tmpFlags = "u"
      } else {
        // Replace each astral symbol and every Unicode escape sequence that
        // possibly represents an astral symbol or a paired surrogate with a
        // single ASCII symbol to avoid throwing on regular expressions that
        // are only valid in combination with the `/u` flag.
        // Note: replacing with the ASCII symbol `x` might cause false
        // negatives in unlikely scenarios. For example, `[\u{61}-b]` is a
        // perfectly valid pattern that is equivalent to `[a-b]`, but it would
        // be replaced by `[x-b]` which throws an error.
        tmp = tmp.replace(/\\u\{([0-9a-fA-F]+)\}/g, function (_match, code, offset) {
          code = Number("0x" + code)
          if (code > 0x10FFFF) this$1.raise(start + offset + 3, "Code point out of bounds")
          return "x"
        })
        tmp = tmp.replace(/\\u([a-fA-F0-9]{4})|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x")
        tmpFlags = tmpFlags.replace("u", "")
      }
    }
  }
  // Detect invalid regular expressions.
  var value = null
  // Rhino's regular expression parser is flaky and throws uncatchable exceptions,
  // so don't do detection if we are running under Rhino
  if (!isRhino) {
    tryCreateRegexp(tmp, tmpFlags, start, this)
    // Get a regular expression object for this pattern-flag pair, or `null` in
    // case the current environment doesn't support the flags it uses.
    value = tryCreateRegexp(content, mods)
  }
  return this.finishToken(tt.regexp, {pattern: content, flags: mods, value: value})
}

// Read an integer in the given radix. Return null if zero digits
// were read, the integer value otherwise. When `len` is given, this
// will return `null` unless the integer has exactly `len` digits.

pp$7.readInt = function(radix, len) {
  var this$1 = this;

  var start = this.pos, total = 0
  for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
    var code = this$1.input.charCodeAt(this$1.pos), val
    if (code >= 97) val = code - 97 + 10 // a
    else if (code >= 65) val = code - 65 + 10 // A
    else if (code >= 48 && code <= 57) val = code - 48 // 0-9
    else val = Infinity
    if (val >= radix) break
    ++this$1.pos
    total = total * radix + val
  }
  if (this.pos === start || len != null && this.pos - start !== len) return null

  return total
}

pp$7.readRadixNumber = function(radix) {
  this.pos += 2 // 0x
  var val = this.readInt(radix)
  if (val == null) this.raise(this.start + 2, "Expected number in radix " + radix)
  if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number")
  return this.finishToken(tt.num, val)
}

// Read an integer, octal integer, or floating-point number.

pp$7.readNumber = function(startsWithDot) {
  var start = this.pos, isFloat = false, octal = this.input.charCodeAt(this.pos) === 48
  if (!startsWithDot && this.readInt(10) === null) this.raise(start, "Invalid number")
  if (octal && this.pos == start + 1) octal = false
  var next = this.input.charCodeAt(this.pos)
  if (next === 46 && !octal) { // '.'
    ++this.pos
    this.readInt(10)
    isFloat = true
    next = this.input.charCodeAt(this.pos)
  }
  if ((next === 69 || next === 101) && !octal) { // 'eE'
    next = this.input.charCodeAt(++this.pos)
    if (next === 43 || next === 45) ++this.pos // '+-'
    if (this.readInt(10) === null) this.raise(start, "Invalid number")
    isFloat = true
  }
  if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number")

  var str = this.input.slice(start, this.pos), val
  if (isFloat) val = parseFloat(str)
  else if (!octal || str.length === 1) val = parseInt(str, 10)
  else if (/[89]/.test(str) || this.strict) this.raise(start, "Invalid number")
  else val = parseInt(str, 8)
  return this.finishToken(tt.num, val)
}

// Read a string value, interpreting backslash-escapes.

pp$7.readCodePoint = function() {
  var ch = this.input.charCodeAt(this.pos), code

  if (ch === 123) {
    if (this.options.ecmaVersion < 6) this.unexpected()
    var codePos = ++this.pos
    code = this.readHexChar(this.input.indexOf('}', this.pos) - this.pos)
    ++this.pos
    if (code > 0x10FFFF) this.raise(codePos, "Code point out of bounds")
  } else {
    code = this.readHexChar(4)
  }
  return code
}

function codePointToString(code) {
  // UTF-16 Decoding
  if (code <= 0xFFFF) return String.fromCharCode(code)
  code -= 0x10000
  return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00)
}

pp$7.readString = function(quote) {
  var this$1 = this;

  var out = "", chunkStart = ++this.pos
  for (;;) {
    if (this$1.pos >= this$1.input.length) this$1.raise(this$1.start, "Unterminated string constant")
    var ch = this$1.input.charCodeAt(this$1.pos)
    if (ch === quote) break
    if (ch === 92) { // '\'
      out += this$1.input.slice(chunkStart, this$1.pos)
      out += this$1.readEscapedChar(false)
      chunkStart = this$1.pos
    } else {
      if (isNewLine(ch)) this$1.raise(this$1.start, "Unterminated string constant")
      ++this$1.pos
    }
  }
  out += this.input.slice(chunkStart, this.pos++)
  return this.finishToken(tt.string, out)
}

// Reads template string tokens.

pp$7.readTmplToken = function() {
  var this$1 = this;

  var out = "", chunkStart = this.pos
  for (;;) {
    if (this$1.pos >= this$1.input.length) this$1.raise(this$1.start, "Unterminated template")
    var ch = this$1.input.charCodeAt(this$1.pos)
    if (ch === 96 || ch === 36 && this$1.input.charCodeAt(this$1.pos + 1) === 123) { // '`', '${'
      if (this$1.pos === this$1.start && this$1.type === tt.template) {
        if (ch === 36) {
          this$1.pos += 2
          return this$1.finishToken(tt.dollarBraceL)
        } else {
          ++this$1.pos
          return this$1.finishToken(tt.backQuote)
        }
      }
      out += this$1.input.slice(chunkStart, this$1.pos)
      return this$1.finishToken(tt.template, out)
    }
    if (ch === 92) { // '\'
      out += this$1.input.slice(chunkStart, this$1.pos)
      out += this$1.readEscapedChar(true)
      chunkStart = this$1.pos
    } else if (isNewLine(ch)) {
      out += this$1.input.slice(chunkStart, this$1.pos)
      ++this$1.pos
      switch (ch) {
        case 13:
          if (this$1.input.charCodeAt(this$1.pos) === 10) ++this$1.pos
        case 10:
          out += "\n"
          break
        default:
          out += String.fromCharCode(ch)
          break
      }
      if (this$1.options.locations) {
        ++this$1.curLine
        this$1.lineStart = this$1.pos
      }
      chunkStart = this$1.pos
    } else {
      ++this$1.pos
    }
  }
}

// Used to read escaped characters

pp$7.readEscapedChar = function(inTemplate) {
  var ch = this.input.charCodeAt(++this.pos)
  ++this.pos
  switch (ch) {
  case 110: return "\n" // 'n' -> '\n'
  case 114: return "\r" // 'r' -> '\r'
  case 120: return String.fromCharCode(this.readHexChar(2)) // 'x'
  case 117: return codePointToString(this.readCodePoint()) // 'u'
  case 116: return "\t" // 't' -> '\t'
  case 98: return "\b" // 'b' -> '\b'
  case 118: return "\u000b" // 'v' -> '\u000b'
  case 102: return "\f" // 'f' -> '\f'
  case 13: if (this.input.charCodeAt(this.pos) === 10) ++this.pos // '\r\n'
  case 10: // ' \n'
    if (this.options.locations) { this.lineStart = this.pos; ++this.curLine }
    return ""
  default:
    if (ch >= 48 && ch <= 55) {
      var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0]
      var octal = parseInt(octalStr, 8)
      if (octal > 255) {
        octalStr = octalStr.slice(0, -1)
        octal = parseInt(octalStr, 8)
      }
      if (octalStr !== "0" && (this.strict || inTemplate)) {
        this.raise(this.pos - 2, "Octal literal in strict mode")
      }
      this.pos += octalStr.length - 1
      return String.fromCharCode(octal)
    }
    return String.fromCharCode(ch)
  }
}

// Used to read character escape sequences ('\x', '\u', '\U').

pp$7.readHexChar = function(len) {
  var codePos = this.pos
  var n = this.readInt(16, len)
  if (n === null) this.raise(codePos, "Bad character escape sequence")
  return n
}

// Read an identifier, and return it as a string. Sets `this.containsEsc`
// to whether the word contained a '\u' escape.
//
// Incrementally adds only escaped chars, adding other chunks as-is
// as a micro-optimization.

pp$7.readWord1 = function() {
  var this$1 = this;

  this.containsEsc = false
  var word = "", first = true, chunkStart = this.pos
  var astral = this.options.ecmaVersion >= 6
  while (this.pos < this.input.length) {
    var ch = this$1.fullCharCodeAtPos()
    if (isIdentifierChar(ch, astral)) {
      this$1.pos += ch <= 0xffff ? 1 : 2
    } else if (ch === 92) { // "\"
      this$1.containsEsc = true
      word += this$1.input.slice(chunkStart, this$1.pos)
      var escStart = this$1.pos
      if (this$1.input.charCodeAt(++this$1.pos) != 117) // "u"
        this$1.raise(this$1.pos, "Expecting Unicode escape sequence \\uXXXX")
      ++this$1.pos
      var esc = this$1.readCodePoint()
      if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral))
        this$1.raise(escStart, "Invalid Unicode escape")
      word += codePointToString(esc)
      chunkStart = this$1.pos
    } else {
      break
    }
    first = false
  }
  return word + this.input.slice(chunkStart, this.pos)
}

// Read an identifier or keyword token. Will check for reserved
// words when necessary.

pp$7.readWord = function() {
  var word = this.readWord1()
  var type = tt.name
  if (this.keywords.test(word)) {
    if (this.containsEsc) this.raiseRecoverable(this.start, "Escape sequence in keyword " + word)
    type = keywordTypes[word]
  }
  return this.finishToken(type, word)
}

// Acorn is a tiny, fast JavaScript parser written in JavaScript.
//
// Acorn was written by Marijn Haverbeke, Ingvar Stepanyan, and
// various contributors and released under an MIT license.
//
// Git repositories for Acorn are available at
//
//     http://marijnhaverbeke.nl/git/acorn
//     https://github.com/ternjs/acorn.git
//
// Please use the [github bug tracker][ghbt] to report issues.
//
// [ghbt]: https://github.com/ternjs/acorn/issues
//
// This file defines the main parser interface. The library also comes
// with a [error-tolerant parser][dammit] and an
// [abstract syntax tree walker][walk], defined in other files.
//
// [dammit]: acorn_loose.js
// [walk]: util/walk.js

var version = "4.0.11"

// The main exported interface (under `self.acorn` when in the
// browser) is a `parse` function that takes a code string and
// returns an abstract syntax tree as specified by [Mozilla parser
// API][api].
//
// [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

function parse(input, options) {
  return new Parser(options, input).parse()
}

// This function tries to parse a single expression at a given
// offset in a string. Useful for parsing mixed-language formats
// that embed JavaScript expressions.

function parseExpressionAt(input, pos, options) {
  var p = new Parser(options, input, pos)
  p.nextToken()
  return p.parseExpression()
}

// Acorn is organized as a tokenizer and a recursive-descent parser.
// The `tokenizer` export provides an interface to the tokenizer.

function tokenizer(input, options) {
  return new Parser(options, input)
}

// This is a terrible kludge to support the existing, pre-ES6
// interface where the loose parser module retroactively adds exports
// to this module.
function addLooseExports(parse, Parser, plugins) {
  exports.parse_dammit = parse
  exports.LooseParser = Parser
  exports.pluginsLoose = plugins
}

exports.version = version;
exports.parse = parse;
exports.parseExpressionAt = parseExpressionAt;
exports.tokenizer = tokenizer;
exports.addLooseExports = addLooseExports;
exports.Parser = Parser;
exports.plugins = plugins;
exports.defaultOptions = defaultOptions;
exports.Position = Position;
exports.SourceLocation = SourceLocation;
exports.getLineInfo = getLineInfo;
exports.Node = Node;
exports.TokenType = TokenType;
exports.tokTypes = tt;
exports.keywordTypes = keywordTypes;
exports.TokContext = TokContext;
exports.tokContexts = types;
exports.isIdentifierChar = isIdentifierChar;
exports.isIdentifierStart = isIdentifierStart;
exports.Token = Token;
exports.isNewLine = isNewLine;
exports.lineBreak = lineBreak;
exports.lineBreakG = lineBreakG;

Object.defineProperty(exports, '__esModule', { value: true });

})));
},{}],11:[function(require,module,exports){

},{}],12:[function(require,module,exports){
/*
 * Cookies.js - 1.2.3
 * https://github.com/ScottHamper/Cookies
 *
 * This is free and unencumbered software released into the public domain.
 */
(function (global, undefined) {
    'use strict';

    var factory = function (window) {
        if (typeof window.document !== 'object') {
            throw new Error('Cookies.js requires a `window` with a `document` object');
        }

        var Cookies = function (key, value, options) {
            return arguments.length === 1 ?
                Cookies.get(key) : Cookies.set(key, value, options);
        };

        // Allows for setter injection in unit tests
        Cookies._document = window.document;

        // Used to ensure cookie keys do not collide with
        // built-in `Object` properties
        Cookies._cacheKeyPrefix = 'cookey.'; // Hurr hurr, :)
        
        Cookies._maxExpireDate = new Date('Fri, 31 Dec 9999 23:59:59 UTC');

        Cookies.defaults = {
            path: '/',
            secure: false
        };

        Cookies.get = function (key) {
            if (Cookies._cachedDocumentCookie !== Cookies._document.cookie) {
                Cookies._renewCache();
            }
            
            var value = Cookies._cache[Cookies._cacheKeyPrefix + key];

            return value === undefined ? undefined : decodeURIComponent(value);
        };

        Cookies.set = function (key, value, options) {
            options = Cookies._getExtendedOptions(options);
            options.expires = Cookies._getExpiresDate(value === undefined ? -1 : options.expires);

            Cookies._document.cookie = Cookies._generateCookieString(key, value, options);

            return Cookies;
        };

        Cookies.expire = function (key, options) {
            return Cookies.set(key, undefined, options);
        };

        Cookies._getExtendedOptions = function (options) {
            return {
                path: options && options.path || Cookies.defaults.path,
                domain: options && options.domain || Cookies.defaults.domain,
                expires: options && options.expires || Cookies.defaults.expires,
                secure: options && options.secure !== undefined ?  options.secure : Cookies.defaults.secure
            };
        };

        Cookies._isValidDate = function (date) {
            return Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());
        };

        Cookies._getExpiresDate = function (expires, now) {
            now = now || new Date();

            if (typeof expires === 'number') {
                expires = expires === Infinity ?
                    Cookies._maxExpireDate : new Date(now.getTime() + expires * 1000);
            } else if (typeof expires === 'string') {
                expires = new Date(expires);
            }

            if (expires && !Cookies._isValidDate(expires)) {
                throw new Error('`expires` parameter cannot be converted to a valid Date instance');
            }

            return expires;
        };

        Cookies._generateCookieString = function (key, value, options) {
            key = key.replace(/[^#$&+\^`|]/g, encodeURIComponent);
            key = key.replace(/\(/g, '%28').replace(/\)/g, '%29');
            value = (value + '').replace(/[^!#$&-+\--:<-\[\]-~]/g, encodeURIComponent);
            options = options || {};

            var cookieString = key + '=' + value;
            cookieString += options.path ? ';path=' + options.path : '';
            cookieString += options.domain ? ';domain=' + options.domain : '';
            cookieString += options.expires ? ';expires=' + options.expires.toUTCString() : '';
            cookieString += options.secure ? ';secure' : '';

            return cookieString;
        };

        Cookies._getCacheFromString = function (documentCookie) {
            var cookieCache = {};
            var cookiesArray = documentCookie ? documentCookie.split('; ') : [];

            for (var i = 0; i < cookiesArray.length; i++) {
                var cookieKvp = Cookies._getKeyValuePairFromCookieString(cookiesArray[i]);

                if (cookieCache[Cookies._cacheKeyPrefix + cookieKvp.key] === undefined) {
                    cookieCache[Cookies._cacheKeyPrefix + cookieKvp.key] = cookieKvp.value;
                }
            }

            return cookieCache;
        };

        Cookies._getKeyValuePairFromCookieString = function (cookieString) {
            // "=" is a valid character in a cookie value according to RFC6265, so cannot `split('=')`
            var separatorIndex = cookieString.indexOf('=');

            // IE omits the "=" when the cookie value is an empty string
            separatorIndex = separatorIndex < 0 ? cookieString.length : separatorIndex;

            var key = cookieString.substr(0, separatorIndex);
            var decodedKey;
            try {
                decodedKey = decodeURIComponent(key);
            } catch (e) {
                if (console && typeof console.error === 'function') {
                    console.error('Could not decode cookie with key "' + key + '"', e);
                }
            }
            
            return {
                key: decodedKey,
                value: cookieString.substr(separatorIndex + 1) // Defer decoding value until accessed
            };
        };

        Cookies._renewCache = function () {
            Cookies._cache = Cookies._getCacheFromString(Cookies._document.cookie);
            Cookies._cachedDocumentCookie = Cookies._document.cookie;
        };

        Cookies._areEnabled = function () {
            var testKey = 'cookies.js';
            var areEnabled = Cookies.set(testKey, 1).get(testKey) === '1';
            Cookies.expire(testKey);
            return areEnabled;
        };

        Cookies.enabled = Cookies._areEnabled();

        return Cookies;
    };
    var cookiesExport = (global && typeof global.document === 'object') ? factory(global) : factory;

    // AMD support
    if (typeof define === 'function' && define.amd) {
        define(function () { return cookiesExport; });
    // CommonJS/Node.js support
    } else if (typeof exports === 'object') {
        // Support Node.js specific `module.exports` (which can be a function)
        if (typeof module === 'object' && typeof module.exports === 'object') {
            exports = module.exports = cookiesExport;
        }
        // But always support CommonJS module 1.1.1 spec (`exports` cannot be a function)
        exports.Cookies = cookiesExport;
    } else {
        global.Cookies = cookiesExport;
    }
})(typeof window === 'undefined' ? this : window);
},{}],13:[function(require,module,exports){
(function (global){
module.exports = false;

// Only Node.JS has a process variable that is of [[Class]] process
try {
 module.exports = Object.prototype.toString.call(global.process) === '[object process]' 
} catch(e) {}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],14:[function(require,module,exports){
(function (global){
/**
* matter-js 0.13.0 by @liabru 2017-07-06
* http://brm.io/matter-js/
* License MIT
*/

/**
 * The MIT License (MIT)
 * 
 * Copyright (c) Liam Brummitt and contributors.
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Matter = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
/**
* The `Matter.Body` module contains methods for creating and manipulating body models.
* A `Matter.Body` is a rigid body that can be simulated by a `Matter.Engine`.
* Factories for commonly used body configurations (such as rectangles, circles and other polygons) can be found in the module `Matter.Bodies`.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).

* @class Body
*/

var Body = {};

module.exports = Body;

var Vertices = _dereq_('../geometry/Vertices');
var Vector = _dereq_('../geometry/Vector');
var Sleeping = _dereq_('../core/Sleeping');
var Render = _dereq_('../render/Render');
var Common = _dereq_('../core/Common');
var Bounds = _dereq_('../geometry/Bounds');
var Axes = _dereq_('../geometry/Axes');

(function() {

    Body._inertiaScale = 4;
    Body._nextCollidingGroupId = 1;
    Body._nextNonCollidingGroupId = -1;
    Body._nextCategory = 0x0001;

    /**
     * Creates a new rigid body model. The options parameter is an object that specifies any properties you wish to override the defaults.
     * All properties have default values, and many are pre-calculated automatically based on other properties.
     * Vertices must be specified in clockwise order.
     * See the properties section below for detailed information on what you can pass via the `options` object.
     * @method create
     * @param {} options
     * @return {body} body
     */
    Body.create = function(options) {
        var defaults = {
            id: Common.nextId(),
            type: 'body',
            label: 'Body',
            parts: [],
            plugin: {},
            angle: 0,
            vertices: Vertices.fromPath('L 0 0 L 40 0 L 40 40 L 0 40'),
            position: { x: 0, y: 0 },
            force: { x: 0, y: 0 },
            torque: 0,
            positionImpulse: { x: 0, y: 0 },
            constraintImpulse: { x: 0, y: 0, angle: 0 },
            totalContacts: 0,
            speed: 0,
            angularSpeed: 0,
            velocity: { x: 0, y: 0 },
            angularVelocity: 0,
            isSensor: false,
            isStatic: false,
            isSleeping: false,
            motion: 0,
            sleepThreshold: 60,
            density: 0.001,
            restitution: 0,
            friction: 0.1,
            frictionStatic: 0.5,
            frictionAir: 0.01,
            collisionFilter: {
                category: 0x0001,
                mask: 0xFFFFFFFF,
                group: 0
            },
            slop: 0.05,
            timeScale: 1,
            render: {
                visible: true,
                opacity: 1,
                sprite: {
                    xScale: 1,
                    yScale: 1,
                    xOffset: 0,
                    yOffset: 0
                },
                lineWidth: 0
            }
        };

        var body = Common.extend(defaults, options);

        _initProperties(body, options);

        return body;
    };

    /**
     * Returns the next unique group index for which bodies will collide.
     * If `isNonColliding` is `true`, returns the next unique group index for which bodies will _not_ collide.
     * See `body.collisionFilter` for more information.
     * @method nextGroup
     * @param {bool} [isNonColliding=false]
     * @return {Number} Unique group index
     */
    Body.nextGroup = function(isNonColliding) {
        if (isNonColliding)
            return Body._nextNonCollidingGroupId--;

        return Body._nextCollidingGroupId++;
    };

    /**
     * Returns the next unique category bitfield (starting after the initial default category `0x0001`).
     * There are 32 available. See `body.collisionFilter` for more information.
     * @method nextCategory
     * @return {Number} Unique category bitfield
     */
    Body.nextCategory = function() {
        Body._nextCategory = Body._nextCategory << 1;
        return Body._nextCategory;
    };

    /**
     * Initialises body properties.
     * @method _initProperties
     * @private
     * @param {body} body
     * @param {} [options]
     */
    var _initProperties = function(body, options) {
        options = options || {};

        // init required properties (order is important)
        Body.set(body, {
            bounds: body.bounds || Bounds.create(body.vertices),
            positionPrev: body.positionPrev || Vector.clone(body.position),
            anglePrev: body.anglePrev || body.angle,
            vertices: body.vertices,
            parts: body.parts || [body],
            isStatic: body.isStatic,
            isSleeping: body.isSleeping,
            parent: body.parent || body
        });

        Vertices.rotate(body.vertices, body.angle, body.position);
        Axes.rotate(body.axes, body.angle);
        Bounds.update(body.bounds, body.vertices, body.velocity);

        // allow options to override the automatically calculated properties
        Body.set(body, {
            axes: options.axes || body.axes,
            area: options.area || body.area,
            mass: options.mass || body.mass,
            inertia: options.inertia || body.inertia
        });

        // render properties
        var defaultFillStyle = (body.isStatic ? '#2e2b44' : Common.choose(['#006BA6', '#0496FF', '#FFBC42', '#D81159', '#8F2D56'])),
            defaultStrokeStyle = '#000';
        body.render.fillStyle = body.render.fillStyle || defaultFillStyle;
        body.render.strokeStyle = body.render.strokeStyle || defaultStrokeStyle;
        body.render.sprite.xOffset += -(body.bounds.min.x - body.position.x) / (body.bounds.max.x - body.bounds.min.x);
        body.render.sprite.yOffset += -(body.bounds.min.y - body.position.y) / (body.bounds.max.y - body.bounds.min.y);
    };

    /**
     * Given a property and a value (or map of), sets the property(s) on the body, using the appropriate setter functions if they exist.
     * Prefer to use the actual setter functions in performance critical situations.
     * @method set
     * @param {body} body
     * @param {} settings A property name (or map of properties and values) to set on the body.
     * @param {} value The value to set if `settings` is a single property name.
     */
    Body.set = function(body, settings, value) {
        var property;

        if (typeof settings === 'string') {
            property = settings;
            settings = {};
            settings[property] = value;
        }

        for (property in settings) {
            value = settings[property];

            if (!settings.hasOwnProperty(property))
                continue;

            switch (property) {

            case 'isStatic':
                Body.setStatic(body, value);
                break;
            case 'isSleeping':
                Sleeping.set(body, value);
                break;
            case 'mass':
                Body.setMass(body, value);
                break;
            case 'density':
                Body.setDensity(body, value);
                break;
            case 'inertia':
                Body.setInertia(body, value);
                break;
            case 'vertices':
                Body.setVertices(body, value);
                break;
            case 'position':
                Body.setPosition(body, value);
                break;
            case 'angle':
                Body.setAngle(body, value);
                break;
            case 'velocity':
                Body.setVelocity(body, value);
                break;
            case 'angularVelocity':
                Body.setAngularVelocity(body, value);
                break;
            case 'parts':
                Body.setParts(body, value);
                break;
            default:
                body[property] = value;

            }
        }
    };

    /**
     * Sets the body as static, including isStatic flag and setting mass and inertia to Infinity.
     * @method setStatic
     * @param {body} body
     * @param {bool} isStatic
     */
    Body.setStatic = function(body, isStatic) {
        for (var i = 0; i < body.parts.length; i++) {
            var part = body.parts[i];
            part.isStatic = isStatic;

            if (isStatic) {
                part._original = {
                    restitution: part.restitution,
                    friction: part.friction,
                    mass: part.mass,
                    inertia: part.inertia,
                    density: part.density,
                    inverseMass: part.inverseMass,
                    inverseInertia: part.inverseInertia
                };

                part.restitution = 0;
                part.friction = 1;
                part.mass = part.inertia = part.density = Infinity;
                part.inverseMass = part.inverseInertia = 0;

                part.positionPrev.x = part.position.x;
                part.positionPrev.y = part.position.y;
                part.anglePrev = part.angle;
                part.angularVelocity = 0;
                part.speed = 0;
                part.angularSpeed = 0;
                part.motion = 0;
            } else if (part._original) {
                part.restitution = part._original.restitution;
                part.friction = part._original.friction;
                part.mass = part._original.mass;
                part.inertia = part._original.inertia;
                part.density = part._original.density;
                part.inverseMass = part._original.inverseMass;
                part.inverseInertia = part._original.inverseInertia;

                delete part._original;
            }
        }
    };

    /**
     * Sets the mass of the body. Inverse mass and density are automatically updated to reflect the change.
     * @method setMass
     * @param {body} body
     * @param {number} mass
     */
    Body.setMass = function(body, mass) {
        body.mass = mass;
        body.inverseMass = 1 / body.mass;
        body.density = body.mass / body.area;
    };

    /**
     * Sets the density of the body. Mass is automatically updated to reflect the change.
     * @method setDensity
     * @param {body} body
     * @param {number} density
     */
    Body.setDensity = function(body, density) {
        Body.setMass(body, density * body.area);
        body.density = density;
    };

    /**
     * Sets the moment of inertia (i.e. second moment of area) of the body of the body. 
     * Inverse inertia is automatically updated to reflect the change. Mass is not changed.
     * @method setInertia
     * @param {body} body
     * @param {number} inertia
     */
    Body.setInertia = function(body, inertia) {
        body.inertia = inertia;
        body.inverseInertia = 1 / body.inertia;
    };

    /**
     * Sets the body's vertices and updates body properties accordingly, including inertia, area and mass (with respect to `body.density`).
     * Vertices will be automatically transformed to be orientated around their centre of mass as the origin.
     * They are then automatically translated to world space based on `body.position`.
     *
     * The `vertices` argument should be passed as an array of `Matter.Vector` points (or a `Matter.Vertices` array).
     * Vertices must form a convex hull, concave hulls are not supported.
     *
     * @method setVertices
     * @param {body} body
     * @param {vector[]} vertices
     */
    Body.setVertices = function(body, vertices) {
        // change vertices
        if (vertices[0].body === body) {
            body.vertices = vertices;
        } else {
            body.vertices = Vertices.create(vertices, body);
        }

        // update properties
        body.axes = Axes.fromVertices(body.vertices);
        body.area = Vertices.area(body.vertices);
        Body.setMass(body, body.density * body.area);

        // orient vertices around the centre of mass at origin (0, 0)
        var centre = Vertices.centre(body.vertices);
        Vertices.translate(body.vertices, centre, -1);

        // update inertia while vertices are at origin (0, 0)
        Body.setInertia(body, Body._inertiaScale * Vertices.inertia(body.vertices, body.mass));

        // update geometry
        Vertices.translate(body.vertices, body.position);
        Bounds.update(body.bounds, body.vertices, body.velocity);
    };

    /**
     * Sets the parts of the `body` and updates mass, inertia and centroid.
     * Each part will have its parent set to `body`.
     * By default the convex hull will be automatically computed and set on `body`, unless `autoHull` is set to `false.`
     * Note that this method will ensure that the first part in `body.parts` will always be the `body`.
     * @method setParts
     * @param {body} body
     * @param [body] parts
     * @param {bool} [autoHull=true]
     */
    Body.setParts = function(body, parts, autoHull) {
        var i;

        // add all the parts, ensuring that the first part is always the parent body
        parts = parts.slice(0);
        body.parts.length = 0;
        body.parts.push(body);
        body.parent = body;

        for (i = 0; i < parts.length; i++) {
            var part = parts[i];
            if (part !== body) {
                part.parent = body;
                body.parts.push(part);
            }
        }

        if (body.parts.length === 1)
            return;

        autoHull = typeof autoHull !== 'undefined' ? autoHull : true;

        // find the convex hull of all parts to set on the parent body
        if (autoHull) {
            var vertices = [];
            for (i = 0; i < parts.length; i++) {
                vertices = vertices.concat(parts[i].vertices);
            }

            Vertices.clockwiseSort(vertices);

            var hull = Vertices.hull(vertices),
                hullCentre = Vertices.centre(hull);

            Body.setVertices(body, hull);
            Vertices.translate(body.vertices, hullCentre);
        }

        // sum the properties of all compound parts of the parent body
        var total = _totalProperties(body);

        body.area = total.area;
        body.parent = body;
        body.position.x = total.centre.x;
        body.position.y = total.centre.y;
        body.positionPrev.x = total.centre.x;
        body.positionPrev.y = total.centre.y;

        Body.setMass(body, total.mass);
        Body.setInertia(body, total.inertia);
        Body.setPosition(body, total.centre);
    };

    /**
     * Sets the position of the body instantly. Velocity, angle, force etc. are unchanged.
     * @method setPosition
     * @param {body} body
     * @param {vector} position
     */
    Body.setPosition = function(body, position) {
        var delta = Vector.sub(position, body.position);
        body.positionPrev.x += delta.x;
        body.positionPrev.y += delta.y;

        for (var i = 0; i < body.parts.length; i++) {
            var part = body.parts[i];
            part.position.x += delta.x;
            part.position.y += delta.y;
            Vertices.translate(part.vertices, delta);
            Bounds.update(part.bounds, part.vertices, body.velocity);
        }
    };

    /**
     * Sets the angle of the body instantly. Angular velocity, position, force etc. are unchanged.
     * @method setAngle
     * @param {body} body
     * @param {number} angle
     */
    Body.setAngle = function(body, angle) {
        var delta = angle - body.angle;
        body.anglePrev += delta;

        for (var i = 0; i < body.parts.length; i++) {
            var part = body.parts[i];
            part.angle += delta;
            Vertices.rotate(part.vertices, delta, body.position);
            Axes.rotate(part.axes, delta);
            Bounds.update(part.bounds, part.vertices, body.velocity);
            if (i > 0) {
                Vector.rotateAbout(part.position, delta, body.position, part.position);
            }
        }
    };

    /**
     * Sets the linear velocity of the body instantly. Position, angle, force etc. are unchanged. See also `Body.applyForce`.
     * @method setVelocity
     * @param {body} body
     * @param {vector} velocity
     */
    Body.setVelocity = function(body, velocity) {
        body.positionPrev.x = body.position.x - velocity.x;
        body.positionPrev.y = body.position.y - velocity.y;
        body.velocity.x = velocity.x;
        body.velocity.y = velocity.y;
        body.speed = Vector.magnitude(body.velocity);
    };

    /**
     * Sets the angular velocity of the body instantly. Position, angle, force etc. are unchanged. See also `Body.applyForce`.
     * @method setAngularVelocity
     * @param {body} body
     * @param {number} velocity
     */
    Body.setAngularVelocity = function(body, velocity) {
        body.anglePrev = body.angle - velocity;
        body.angularVelocity = velocity;
        body.angularSpeed = Math.abs(body.angularVelocity);
    };

    /**
     * Moves a body by a given vector relative to its current position, without imparting any velocity.
     * @method translate
     * @param {body} body
     * @param {vector} translation
     */
    Body.translate = function(body, translation) {
        Body.setPosition(body, Vector.add(body.position, translation));
    };

    /**
     * Rotates a body by a given angle relative to its current angle, without imparting any angular velocity.
     * @method rotate
     * @param {body} body
     * @param {number} rotation
     * @param {vector} [point]
     */
    Body.rotate = function(body, rotation, point) {
        if (!point) {
            Body.setAngle(body, body.angle + rotation);
        } else {
            var cos = Math.cos(rotation),
                sin = Math.sin(rotation),
                dx = body.position.x - point.x,
                dy = body.position.y - point.y;
                
            Body.setPosition(body, {
                x: point.x + (dx * cos - dy * sin),
                y: point.y + (dx * sin + dy * cos)
            });

            Body.setAngle(body, body.angle + rotation);
        }
    };

    /**
     * Scales the body, including updating physical properties (mass, area, axes, inertia), from a world-space point (default is body centre).
     * @method scale
     * @param {body} body
     * @param {number} scaleX
     * @param {number} scaleY
     * @param {vector} [point]
     */
    Body.scale = function(body, scaleX, scaleY, point) {
        for (var i = 0; i < body.parts.length; i++) {
            var part = body.parts[i];

            // scale vertices
            Vertices.scale(part.vertices, scaleX, scaleY, body.position);

            // update properties
            part.axes = Axes.fromVertices(part.vertices);

            if (!body.isStatic) {
                part.area = Vertices.area(part.vertices);
                Body.setMass(part, body.density * part.area);

                // update inertia (requires vertices to be at origin)
                Vertices.translate(part.vertices, { x: -part.position.x, y: -part.position.y });
                Body.setInertia(part, Vertices.inertia(part.vertices, part.mass));
                Vertices.translate(part.vertices, { x: part.position.x, y: part.position.y });
            }

            // update bounds
            Bounds.update(part.bounds, part.vertices, body.velocity);
        }

        // handle circles
        if (body.circleRadius) { 
            if (scaleX === scaleY) {
                body.circleRadius *= scaleX;
            } else {
                // body is no longer a circle
                body.circleRadius = null;
            }
        }

        if (!body.isStatic) {
            var total = _totalProperties(body);
            body.area = total.area;
            Body.setMass(body, total.mass);
            Body.setInertia(body, total.inertia);
        }
    };

    /**
     * Performs a simulation step for the given `body`, including updating position and angle using Verlet integration.
     * @method update
     * @param {body} body
     * @param {number} deltaTime
     * @param {number} timeScale
     * @param {number} correction
     */
    Body.update = function(body, deltaTime, timeScale, correction) {
        var deltaTimeSquared = Math.pow(deltaTime * timeScale * body.timeScale, 2);

        // from the previous step
        var frictionAir = 1 - body.frictionAir * timeScale * body.timeScale,
            velocityPrevX = body.position.x - body.positionPrev.x,
            velocityPrevY = body.position.y - body.positionPrev.y;

        // update velocity with Verlet integration
        body.velocity.x = (velocityPrevX * frictionAir * correction) + (body.force.x / body.mass) * deltaTimeSquared;
        body.velocity.y = (velocityPrevY * frictionAir * correction) + (body.force.y / body.mass) * deltaTimeSquared;

        body.positionPrev.x = body.position.x;
        body.positionPrev.y = body.position.y;
        body.position.x += body.velocity.x;
        body.position.y += body.velocity.y;

        // update angular velocity with Verlet integration
        body.angularVelocity = ((body.angle - body.anglePrev) * frictionAir * correction) + (body.torque / body.inertia) * deltaTimeSquared;
        body.anglePrev = body.angle;
        body.angle += body.angularVelocity;

        // track speed and acceleration
        body.speed = Vector.magnitude(body.velocity);
        body.angularSpeed = Math.abs(body.angularVelocity);

        // transform the body geometry
        for (var i = 0; i < body.parts.length; i++) {
            var part = body.parts[i];

            Vertices.translate(part.vertices, body.velocity);
            
            if (i > 0) {
                part.position.x += body.velocity.x;
                part.position.y += body.velocity.y;
            }

            if (body.angularVelocity !== 0) {
                Vertices.rotate(part.vertices, body.angularVelocity, body.position);
                Axes.rotate(part.axes, body.angularVelocity);
                if (i > 0) {
                    Vector.rotateAbout(part.position, body.angularVelocity, body.position, part.position);
                }
            }

            Bounds.update(part.bounds, part.vertices, body.velocity);
        }
    };

    /**
     * Applies a force to a body from a given world-space position, including resulting torque.
     * @method applyForce
     * @param {body} body
     * @param {vector} position
     * @param {vector} force
     */
    Body.applyForce = function(body, position, force) {
        body.force.x += force.x;
        body.force.y += force.y;
        var offset = { x: position.x - body.position.x, y: position.y - body.position.y };
        body.torque += offset.x * force.y - offset.y * force.x;
    };

    /**
     * Returns the sums of the properties of all compound parts of the parent body.
     * @method _totalProperties
     * @private
     * @param {body} body
     * @return {}
     */
    var _totalProperties = function(body) {
        // from equations at:
        // https://ecourses.ou.edu/cgi-bin/ebook.cgi?doc=&topic=st&chap_sec=07.2&page=theory
        // http://output.to/sideway/default.asp?qno=121100087

        var properties = {
            mass: 0,
            area: 0,
            inertia: 0,
            centre: { x: 0, y: 0 }
        };

        // sum the properties of all compound parts of the parent body
        for (var i = body.parts.length === 1 ? 0 : 1; i < body.parts.length; i++) {
            var part = body.parts[i];
            properties.mass += part.mass;
            properties.area += part.area;
            properties.inertia += part.inertia;
            properties.centre = Vector.add(properties.centre, 
                                           Vector.mult(part.position, part.mass !== Infinity ? part.mass : 1));
        }

        properties.centre = Vector.div(properties.centre, 
                                       properties.mass !== Infinity ? properties.mass : body.parts.length);

        return properties;
    };

    /*
    *
    *  Events Documentation
    *
    */

    /**
    * Fired when a body starts sleeping (where `this` is the body).
    *
    * @event sleepStart
    * @this {body} The body that has started sleeping
    * @param {} event An event object
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when a body ends sleeping (where `this` is the body).
    *
    * @event sleepEnd
    * @this {body} The body that has ended sleeping
    * @param {} event An event object
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * An integer `Number` uniquely identifying number generated in `Body.create` by `Common.nextId`.
     *
     * @property id
     * @type number
     */

    /**
     * A `String` denoting the type of object.
     *
     * @property type
     * @type string
     * @default "body"
     * @readOnly
     */

    /**
     * An arbitrary `String` name to help the user identify and manage bodies.
     *
     * @property label
     * @type string
     * @default "Body"
     */

    /**
     * An array of bodies that make up this body. 
     * The first body in the array must always be a self reference to the current body instance.
     * All bodies in the `parts` array together form a single rigid compound body.
     * Parts are allowed to overlap, have gaps or holes or even form concave bodies.
     * Parts themselves should never be added to a `World`, only the parent body should be.
     * Use `Body.setParts` when setting parts to ensure correct updates of all properties.
     *
     * @property parts
     * @type body[]
     */

    /**
     * An object reserved for storing plugin-specific properties.
     *
     * @property plugin
     * @type {}
     */

    /**
     * A self reference if the body is _not_ a part of another body.
     * Otherwise this is a reference to the body that this is a part of.
     * See `body.parts`.
     *
     * @property parent
     * @type body
     */

    /**
     * A `Number` specifying the angle of the body, in radians.
     *
     * @property angle
     * @type number
     * @default 0
     */

    /**
     * An array of `Vector` objects that specify the convex hull of the rigid body.
     * These should be provided about the origin `(0, 0)`. E.g.
     *
     *     [{ x: 0, y: 0 }, { x: 25, y: 50 }, { x: 50, y: 0 }]
     *
     * When passed via `Body.create`, the vertices are translated relative to `body.position` (i.e. world-space, and constantly updated by `Body.update` during simulation).
     * The `Vector` objects are also augmented with additional properties required for efficient collision detection. 
     *
     * Other properties such as `inertia` and `bounds` are automatically calculated from the passed vertices (unless provided via `options`).
     * Concave hulls are not currently supported. The module `Matter.Vertices` contains useful methods for working with vertices.
     *
     * @property vertices
     * @type vector[]
     */

    /**
     * A `Vector` that specifies the current world-space position of the body.
     *
     * @property position
     * @type vector
     * @default { x: 0, y: 0 }
     */

    /**
     * A `Vector` that specifies the force to apply in the current step. It is zeroed after every `Body.update`. See also `Body.applyForce`.
     *
     * @property force
     * @type vector
     * @default { x: 0, y: 0 }
     */

    /**
     * A `Number` that specifies the torque (turning force) to apply in the current step. It is zeroed after every `Body.update`.
     *
     * @property torque
     * @type number
     * @default 0
     */

    /**
     * A `Number` that _measures_ the current speed of the body after the last `Body.update`. It is read-only and always positive (it's the magnitude of `body.velocity`).
     *
     * @readOnly
     * @property speed
     * @type number
     * @default 0
     */

    /**
     * A `Number` that _measures_ the current angular speed of the body after the last `Body.update`. It is read-only and always positive (it's the magnitude of `body.angularVelocity`).
     *
     * @readOnly
     * @property angularSpeed
     * @type number
     * @default 0
     */

    /**
     * A `Vector` that _measures_ the current velocity of the body after the last `Body.update`. It is read-only. 
     * If you need to modify a body's velocity directly, you should either apply a force or simply change the body's `position` (as the engine uses position-Verlet integration).
     *
     * @readOnly
     * @property velocity
     * @type vector
     * @default { x: 0, y: 0 }
     */

    /**
     * A `Number` that _measures_ the current angular velocity of the body after the last `Body.update`. It is read-only. 
     * If you need to modify a body's angular velocity directly, you should apply a torque or simply change the body's `angle` (as the engine uses position-Verlet integration).
     *
     * @readOnly
     * @property angularVelocity
     * @type number
     * @default 0
     */

    /**
     * A flag that indicates whether a body is considered static. A static body can never change position or angle and is completely fixed.
     * If you need to set a body as static after its creation, you should use `Body.setStatic` as this requires more than just setting this flag.
     *
     * @property isStatic
     * @type boolean
     * @default false
     */

    /**
     * A flag that indicates whether a body is a sensor. Sensor triggers collision events, but doesn't react with colliding body physically.
     *
     * @property isSensor
     * @type boolean
     * @default false
     */

    /**
     * A flag that indicates whether the body is considered sleeping. A sleeping body acts similar to a static body, except it is only temporary and can be awoken.
     * If you need to set a body as sleeping, you should use `Sleeping.set` as this requires more than just setting this flag.
     *
     * @property isSleeping
     * @type boolean
     * @default false
     */

    /**
     * A `Number` that _measures_ the amount of movement a body currently has (a combination of `speed` and `angularSpeed`). It is read-only and always positive.
     * It is used and updated by the `Matter.Sleeping` module during simulation to decide if a body has come to rest.
     *
     * @readOnly
     * @property motion
     * @type number
     * @default 0
     */

    /**
     * A `Number` that defines the number of updates in which this body must have near-zero velocity before it is set as sleeping by the `Matter.Sleeping` module (if sleeping is enabled by the engine).
     *
     * @property sleepThreshold
     * @type number
     * @default 60
     */

    /**
     * A `Number` that defines the density of the body, that is its mass per unit area.
     * If you pass the density via `Body.create` the `mass` property is automatically calculated for you based on the size (area) of the object.
     * This is generally preferable to simply setting mass and allows for more intuitive definition of materials (e.g. rock has a higher density than wood).
     *
     * @property density
     * @type number
     * @default 0.001
     */

    /**
     * A `Number` that defines the mass of the body, although it may be more appropriate to specify the `density` property instead.
     * If you modify this value, you must also modify the `body.inverseMass` property (`1 / mass`).
     *
     * @property mass
     * @type number
     */

    /**
     * A `Number` that defines the inverse mass of the body (`1 / mass`).
     * If you modify this value, you must also modify the `body.mass` property.
     *
     * @property inverseMass
     * @type number
     */

    /**
     * A `Number` that defines the moment of inertia (i.e. second moment of area) of the body.
     * It is automatically calculated from the given convex hull (`vertices` array) and density in `Body.create`.
     * If you modify this value, you must also modify the `body.inverseInertia` property (`1 / inertia`).
     *
     * @property inertia
     * @type number
     */

    /**
     * A `Number` that defines the inverse moment of inertia of the body (`1 / inertia`).
     * If you modify this value, you must also modify the `body.inertia` property.
     *
     * @property inverseInertia
     * @type number
     */

    /**
     * A `Number` that defines the restitution (elasticity) of the body. The value is always positive and is in the range `(0, 1)`.
     * A value of `0` means collisions may be perfectly inelastic and no bouncing may occur. 
     * A value of `0.8` means the body may bounce back with approximately 80% of its kinetic energy.
     * Note that collision response is based on _pairs_ of bodies, and that `restitution` values are _combined_ with the following formula:
     *
     *     Math.max(bodyA.restitution, bodyB.restitution)
     *
     * @property restitution
     * @type number
     * @default 0
     */

    /**
     * A `Number` that defines the friction of the body. The value is always positive and is in the range `(0, 1)`.
     * A value of `0` means that the body may slide indefinitely.
     * A value of `1` means the body may come to a stop almost instantly after a force is applied.
     *
     * The effects of the value may be non-linear. 
     * High values may be unstable depending on the body.
     * The engine uses a Coulomb friction model including static and kinetic friction.
     * Note that collision response is based on _pairs_ of bodies, and that `friction` values are _combined_ with the following formula:
     *
     *     Math.min(bodyA.friction, bodyB.friction)
     *
     * @property friction
     * @type number
     * @default 0.1
     */

    /**
     * A `Number` that defines the static friction of the body (in the Coulomb friction model). 
     * A value of `0` means the body will never 'stick' when it is nearly stationary and only dynamic `friction` is used.
     * The higher the value (e.g. `10`), the more force it will take to initially get the body moving when nearly stationary.
     * This value is multiplied with the `friction` property to make it easier to change `friction` and maintain an appropriate amount of static friction.
     *
     * @property frictionStatic
     * @type number
     * @default 0.5
     */

    /**
     * A `Number` that defines the air friction of the body (air resistance). 
     * A value of `0` means the body will never slow as it moves through space.
     * The higher the value, the faster a body slows when moving through space.
     * The effects of the value are non-linear. 
     *
     * @property frictionAir
     * @type number
     * @default 0.01
     */

    /**
     * An `Object` that specifies the collision filtering properties of this body.
     *
     * Collisions between two bodies will obey the following rules:
     * - If the two bodies have the same non-zero value of `collisionFilter.group`,
     *   they will always collide if the value is positive, and they will never collide
     *   if the value is negative.
     * - If the two bodies have different values of `collisionFilter.group` or if one
     *   (or both) of the bodies has a value of 0, then the category/mask rules apply as follows:
     *
     * Each body belongs to a collision category, given by `collisionFilter.category`. This
     * value is used as a bit field and the category should have only one bit set, meaning that
     * the value of this property is a power of two in the range [1, 2^31]. Thus, there are 32
     * different collision categories available.
     *
     * Each body also defines a collision bitmask, given by `collisionFilter.mask` which specifies
     * the categories it collides with (the value is the bitwise AND value of all these categories).
     *
     * Using the category/mask rules, two bodies `A` and `B` collide if each includes the other's
     * category in its mask, i.e. `(categoryA & maskB) !== 0` and `(categoryB & maskA) !== 0`
     * are both true.
     *
     * @property collisionFilter
     * @type object
     */

    /**
     * An Integer `Number`, that specifies the collision group this body belongs to.
     * See `body.collisionFilter` for more information.
     *
     * @property collisionFilter.group
     * @type object
     * @default 0
     */

    /**
     * A bit field that specifies the collision category this body belongs to.
     * The category value should have only one bit set, for example `0x0001`.
     * This means there are up to 32 unique collision categories available.
     * See `body.collisionFilter` for more information.
     *
     * @property collisionFilter.category
     * @type object
     * @default 1
     */

    /**
     * A bit mask that specifies the collision categories this body may collide with.
     * See `body.collisionFilter` for more information.
     *
     * @property collisionFilter.mask
     * @type object
     * @default -1
     */

    /**
     * A `Number` that specifies a tolerance on how far a body is allowed to 'sink' or rotate into other bodies.
     * Avoid changing this value unless you understand the purpose of `slop` in physics engines.
     * The default should generally suffice, although very large bodies may require larger values for stable stacking.
     *
     * @property slop
     * @type number
     * @default 0.05
     */

    /**
     * A `Number` that allows per-body time scaling, e.g. a force-field where bodies inside are in slow-motion, while others are at full speed.
     *
     * @property timeScale
     * @type number
     * @default 1
     */

    /**
     * An `Object` that defines the rendering properties to be consumed by the module `Matter.Render`.
     *
     * @property render
     * @type object
     */

    /**
     * A flag that indicates if the body should be rendered.
     *
     * @property render.visible
     * @type boolean
     * @default true
     */

    /**
     * Sets the opacity to use when rendering.
     *
     * @property render.opacity
     * @type number
     * @default 1
    */

    /**
     * An `Object` that defines the sprite properties to use when rendering, if any.
     *
     * @property render.sprite
     * @type object
     */

    /**
     * An `String` that defines the path to the image to use as the sprite texture, if any.
     *
     * @property render.sprite.texture
     * @type string
     */
     
    /**
     * A `Number` that defines the scaling in the x-axis for the sprite, if any.
     *
     * @property render.sprite.xScale
     * @type number
     * @default 1
     */

    /**
     * A `Number` that defines the scaling in the y-axis for the sprite, if any.
     *
     * @property render.sprite.yScale
     * @type number
     * @default 1
     */

     /**
      * A `Number` that defines the offset in the x-axis for the sprite (normalised by texture width).
      *
      * @property render.sprite.xOffset
      * @type number
      * @default 0
      */

     /**
      * A `Number` that defines the offset in the y-axis for the sprite (normalised by texture height).
      *
      * @property render.sprite.yOffset
      * @type number
      * @default 0
      */

    /**
     * A `Number` that defines the line width to use when rendering the body outline (if a sprite is not defined).
     * A value of `0` means no outline will be rendered.
     *
     * @property render.lineWidth
     * @type number
     * @default 0
     */

    /**
     * A `String` that defines the fill style to use when rendering the body (if a sprite is not defined).
     * It is the same as when using a canvas, so it accepts CSS style property values.
     *
     * @property render.fillStyle
     * @type string
     * @default a random colour
     */

    /**
     * A `String` that defines the stroke style to use when rendering the body outline (if a sprite is not defined).
     * It is the same as when using a canvas, so it accepts CSS style property values.
     *
     * @property render.strokeStyle
     * @type string
     * @default a random colour
     */

    /**
     * An array of unique axis vectors (edge normals) used for collision detection.
     * These are automatically calculated from the given convex hull (`vertices` array) in `Body.create`.
     * They are constantly updated by `Body.update` during the simulation.
     *
     * @property axes
     * @type vector[]
     */
     
    /**
     * A `Number` that _measures_ the area of the body's convex hull, calculated at creation by `Body.create`.
     *
     * @property area
     * @type string
     * @default 
     */

    /**
     * A `Bounds` object that defines the AABB region for the body.
     * It is automatically calculated from the given convex hull (`vertices` array) in `Body.create` and constantly updated by `Body.update` during simulation.
     *
     * @property bounds
     * @type bounds
     */

})();

},{"../core/Common":14,"../core/Sleeping":22,"../geometry/Axes":25,"../geometry/Bounds":26,"../geometry/Vector":28,"../geometry/Vertices":29,"../render/Render":31}],2:[function(_dereq_,module,exports){
/**
* The `Matter.Composite` module contains methods for creating and manipulating composite bodies.
* A composite body is a collection of `Matter.Body`, `Matter.Constraint` and other `Matter.Composite`, therefore composites form a tree structure.
* It is important to use the functions in this module to modify composites, rather than directly modifying their properties.
* Note that the `Matter.World` object is also a type of `Matter.Composite` and as such all composite methods here can also operate on a `Matter.World`.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Composite
*/

var Composite = {};

module.exports = Composite;

var Events = _dereq_('../core/Events');
var Common = _dereq_('../core/Common');
var Body = _dereq_('./Body');

(function() {

    /**
     * Creates a new composite. The options parameter is an object that specifies any properties you wish to override the defaults.
     * See the properites section below for detailed information on what you can pass via the `options` object.
     * @method create
     * @param {} [options]
     * @return {composite} A new composite
     */
    Composite.create = function(options) {
        return Common.extend({ 
            id: Common.nextId(),
            type: 'composite',
            parent: null,
            isModified: false,
            bodies: [], 
            constraints: [], 
            composites: [],
            label: 'Composite',
            plugin: {}
        }, options);
    };

    /**
     * Sets the composite's `isModified` flag. 
     * If `updateParents` is true, all parents will be set (default: false).
     * If `updateChildren` is true, all children will be set (default: false).
     * @method setModified
     * @param {composite} composite
     * @param {boolean} isModified
     * @param {boolean} [updateParents=false]
     * @param {boolean} [updateChildren=false]
     */
    Composite.setModified = function(composite, isModified, updateParents, updateChildren) {
        composite.isModified = isModified;

        if (updateParents && composite.parent) {
            Composite.setModified(composite.parent, isModified, updateParents, updateChildren);
        }

        if (updateChildren) {
            for(var i = 0; i < composite.composites.length; i++) {
                var childComposite = composite.composites[i];
                Composite.setModified(childComposite, isModified, updateParents, updateChildren);
            }
        }
    };

    /**
     * Generic add function. Adds one or many body(s), constraint(s) or a composite(s) to the given composite.
     * Triggers `beforeAdd` and `afterAdd` events on the `composite`.
     * @method add
     * @param {composite} composite
     * @param {} object
     * @return {composite} The original composite with the objects added
     */
    Composite.add = function(composite, object) {
        var objects = [].concat(object);

        Events.trigger(composite, 'beforeAdd', { object: object });

        for (var i = 0; i < objects.length; i++) {
            var obj = objects[i];

            switch (obj.type) {

            case 'body':
                // skip adding compound parts
                if (obj.parent !== obj) {
                    Common.warn('Composite.add: skipped adding a compound body part (you must add its parent instead)');
                    break;
                }

                Composite.addBody(composite, obj);
                break;
            case 'constraint':
                Composite.addConstraint(composite, obj);
                break;
            case 'composite':
                Composite.addComposite(composite, obj);
                break;
            case 'mouseConstraint':
                Composite.addConstraint(composite, obj.constraint);
                break;

            }
        }

        Events.trigger(composite, 'afterAdd', { object: object });

        return composite;
    };

    /**
     * Generic remove function. Removes one or many body(s), constraint(s) or a composite(s) to the given composite.
     * Optionally searching its children recursively.
     * Triggers `beforeRemove` and `afterRemove` events on the `composite`.
     * @method remove
     * @param {composite} composite
     * @param {} object
     * @param {boolean} [deep=false]
     * @return {composite} The original composite with the objects removed
     */
    Composite.remove = function(composite, object, deep) {
        var objects = [].concat(object);

        Events.trigger(composite, 'beforeRemove', { object: object });

        for (var i = 0; i < objects.length; i++) {
            var obj = objects[i];

            switch (obj.type) {

            case 'body':
                Composite.removeBody(composite, obj, deep);
                break;
            case 'constraint':
                Composite.removeConstraint(composite, obj, deep);
                break;
            case 'composite':
                Composite.removeComposite(composite, obj, deep);
                break;
            case 'mouseConstraint':
                Composite.removeConstraint(composite, obj.constraint);
                break;

            }
        }

        Events.trigger(composite, 'afterRemove', { object: object });

        return composite;
    };

    /**
     * Adds a composite to the given composite.
     * @private
     * @method addComposite
     * @param {composite} compositeA
     * @param {composite} compositeB
     * @return {composite} The original compositeA with the objects from compositeB added
     */
    Composite.addComposite = function(compositeA, compositeB) {
        compositeA.composites.push(compositeB);
        compositeB.parent = compositeA;
        Composite.setModified(compositeA, true, true, false);
        return compositeA;
    };

    /**
     * Removes a composite from the given composite, and optionally searching its children recursively.
     * @private
     * @method removeComposite
     * @param {composite} compositeA
     * @param {composite} compositeB
     * @param {boolean} [deep=false]
     * @return {composite} The original compositeA with the composite removed
     */
    Composite.removeComposite = function(compositeA, compositeB, deep) {
        var position = Common.indexOf(compositeA.composites, compositeB);
        if (position !== -1) {
            Composite.removeCompositeAt(compositeA, position);
            Composite.setModified(compositeA, true, true, false);
        }

        if (deep) {
            for (var i = 0; i < compositeA.composites.length; i++){
                Composite.removeComposite(compositeA.composites[i], compositeB, true);
            }
        }

        return compositeA;
    };

    /**
     * Removes a composite from the given composite.
     * @private
     * @method removeCompositeAt
     * @param {composite} composite
     * @param {number} position
     * @return {composite} The original composite with the composite removed
     */
    Composite.removeCompositeAt = function(composite, position) {
        composite.composites.splice(position, 1);
        Composite.setModified(composite, true, true, false);
        return composite;
    };

    /**
     * Adds a body to the given composite.
     * @private
     * @method addBody
     * @param {composite} composite
     * @param {body} body
     * @return {composite} The original composite with the body added
     */
    Composite.addBody = function(composite, body) {
        composite.bodies.push(body);
        Composite.setModified(composite, true, true, false);
        return composite;
    };

    /**
     * Removes a body from the given composite, and optionally searching its children recursively.
     * @private
     * @method removeBody
     * @param {composite} composite
     * @param {body} body
     * @param {boolean} [deep=false]
     * @return {composite} The original composite with the body removed
     */
    Composite.removeBody = function(composite, body, deep) {
        var position = Common.indexOf(composite.bodies, body);
        if (position !== -1) {
            Composite.removeBodyAt(composite, position);
            Composite.setModified(composite, true, true, false);
        }

        if (deep) {
            for (var i = 0; i < composite.composites.length; i++){
                Composite.removeBody(composite.composites[i], body, true);
            }
        }

        return composite;
    };

    /**
     * Removes a body from the given composite.
     * @private
     * @method removeBodyAt
     * @param {composite} composite
     * @param {number} position
     * @return {composite} The original composite with the body removed
     */
    Composite.removeBodyAt = function(composite, position) {
        composite.bodies.splice(position, 1);
        Composite.setModified(composite, true, true, false);
        return composite;
    };

    /**
     * Adds a constraint to the given composite.
     * @private
     * @method addConstraint
     * @param {composite} composite
     * @param {constraint} constraint
     * @return {composite} The original composite with the constraint added
     */
    Composite.addConstraint = function(composite, constraint) {
        composite.constraints.push(constraint);
        Composite.setModified(composite, true, true, false);
        return composite;
    };

    /**
     * Removes a constraint from the given composite, and optionally searching its children recursively.
     * @private
     * @method removeConstraint
     * @param {composite} composite
     * @param {constraint} constraint
     * @param {boolean} [deep=false]
     * @return {composite} The original composite with the constraint removed
     */
    Composite.removeConstraint = function(composite, constraint, deep) {
        var position = Common.indexOf(composite.constraints, constraint);
        if (position !== -1) {
            Composite.removeConstraintAt(composite, position);
        }

        if (deep) {
            for (var i = 0; i < composite.composites.length; i++){
                Composite.removeConstraint(composite.composites[i], constraint, true);
            }
        }

        return composite;
    };

    /**
     * Removes a body from the given composite.
     * @private
     * @method removeConstraintAt
     * @param {composite} composite
     * @param {number} position
     * @return {composite} The original composite with the constraint removed
     */
    Composite.removeConstraintAt = function(composite, position) {
        composite.constraints.splice(position, 1);
        Composite.setModified(composite, true, true, false);
        return composite;
    };

    /**
     * Removes all bodies, constraints and composites from the given composite.
     * Optionally clearing its children recursively.
     * @method clear
     * @param {composite} composite
     * @param {boolean} keepStatic
     * @param {boolean} [deep=false]
     */
    Composite.clear = function(composite, keepStatic, deep) {
        if (deep) {
            for (var i = 0; i < composite.composites.length; i++){
                Composite.clear(composite.composites[i], keepStatic, true);
            }
        }
        
        if (keepStatic) {
            composite.bodies = composite.bodies.filter(function(body) { return body.isStatic; });
        } else {
            composite.bodies.length = 0;
        }

        composite.constraints.length = 0;
        composite.composites.length = 0;
        Composite.setModified(composite, true, true, false);

        return composite;
    };

    /**
     * Returns all bodies in the given composite, including all bodies in its children, recursively.
     * @method allBodies
     * @param {composite} composite
     * @return {body[]} All the bodies
     */
    Composite.allBodies = function(composite) {
        var bodies = [].concat(composite.bodies);

        for (var i = 0; i < composite.composites.length; i++)
            bodies = bodies.concat(Composite.allBodies(composite.composites[i]));

        return bodies;
    };

    /**
     * Returns all constraints in the given composite, including all constraints in its children, recursively.
     * @method allConstraints
     * @param {composite} composite
     * @return {constraint[]} All the constraints
     */
    Composite.allConstraints = function(composite) {
        var constraints = [].concat(composite.constraints);

        for (var i = 0; i < composite.composites.length; i++)
            constraints = constraints.concat(Composite.allConstraints(composite.composites[i]));

        return constraints;
    };

    /**
     * Returns all composites in the given composite, including all composites in its children, recursively.
     * @method allComposites
     * @param {composite} composite
     * @return {composite[]} All the composites
     */
    Composite.allComposites = function(composite) {
        var composites = [].concat(composite.composites);

        for (var i = 0; i < composite.composites.length; i++)
            composites = composites.concat(Composite.allComposites(composite.composites[i]));

        return composites;
    };

    /**
     * Searches the composite recursively for an object matching the type and id supplied, null if not found.
     * @method get
     * @param {composite} composite
     * @param {number} id
     * @param {string} type
     * @return {object} The requested object, if found
     */
    Composite.get = function(composite, id, type) {
        var objects,
            object;

        switch (type) {
        case 'body':
            objects = Composite.allBodies(composite);
            break;
        case 'constraint':
            objects = Composite.allConstraints(composite);
            break;
        case 'composite':
            objects = Composite.allComposites(composite).concat(composite);
            break;
        }

        if (!objects)
            return null;

        object = objects.filter(function(object) { 
            return object.id.toString() === id.toString(); 
        });

        return object.length === 0 ? null : object[0];
    };

    /**
     * Moves the given object(s) from compositeA to compositeB (equal to a remove followed by an add).
     * @method move
     * @param {compositeA} compositeA
     * @param {object[]} objects
     * @param {compositeB} compositeB
     * @return {composite} Returns compositeA
     */
    Composite.move = function(compositeA, objects, compositeB) {
        Composite.remove(compositeA, objects);
        Composite.add(compositeB, objects);
        return compositeA;
    };

    /**
     * Assigns new ids for all objects in the composite, recursively.
     * @method rebase
     * @param {composite} composite
     * @return {composite} Returns composite
     */
    Composite.rebase = function(composite) {
        var objects = Composite.allBodies(composite)
                        .concat(Composite.allConstraints(composite))
                        .concat(Composite.allComposites(composite));

        for (var i = 0; i < objects.length; i++) {
            objects[i].id = Common.nextId();
        }

        Composite.setModified(composite, true, true, false);

        return composite;
    };

    /**
     * Translates all children in the composite by a given vector relative to their current positions, 
     * without imparting any velocity.
     * @method translate
     * @param {composite} composite
     * @param {vector} translation
     * @param {bool} [recursive=true]
     */
    Composite.translate = function(composite, translation, recursive) {
        var bodies = recursive ? Composite.allBodies(composite) : composite.bodies;

        for (var i = 0; i < bodies.length; i++) {
            Body.translate(bodies[i], translation);
        }

        Composite.setModified(composite, true, true, false);

        return composite;
    };

    /**
     * Rotates all children in the composite by a given angle about the given point, without imparting any angular velocity.
     * @method rotate
     * @param {composite} composite
     * @param {number} rotation
     * @param {vector} point
     * @param {bool} [recursive=true]
     */
    Composite.rotate = function(composite, rotation, point, recursive) {
        var cos = Math.cos(rotation),
            sin = Math.sin(rotation),
            bodies = recursive ? Composite.allBodies(composite) : composite.bodies;

        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i],
                dx = body.position.x - point.x,
                dy = body.position.y - point.y;
                
            Body.setPosition(body, {
                x: point.x + (dx * cos - dy * sin),
                y: point.y + (dx * sin + dy * cos)
            });

            Body.rotate(body, rotation);
        }

        Composite.setModified(composite, true, true, false);

        return composite;
    };

    /**
     * Scales all children in the composite, including updating physical properties (mass, area, axes, inertia), from a world-space point.
     * @method scale
     * @param {composite} composite
     * @param {number} scaleX
     * @param {number} scaleY
     * @param {vector} point
     * @param {bool} [recursive=true]
     */
    Composite.scale = function(composite, scaleX, scaleY, point, recursive) {
        var bodies = recursive ? Composite.allBodies(composite) : composite.bodies;

        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i],
                dx = body.position.x - point.x,
                dy = body.position.y - point.y;
                
            Body.setPosition(body, {
                x: point.x + dx * scaleX,
                y: point.y + dy * scaleY
            });

            Body.scale(body, scaleX, scaleY);
        }

        Composite.setModified(composite, true, true, false);

        return composite;
    };

    /**
     * Returns the union of the bounds of all of the composite's bodies.
     * @method bounds
     * @param {composite} composite The composite.
     * @returns {bounds} The composite bounds.
     */
    Composite.bounds = function(composite) {
        var bodies = Matter.Composite.allBodies(composite),
            vertices = [];

        for (var i = 0; i < bodies.length; i += 1) {
            var body = bodies[i];
            vertices.push(body.bounds.min, body.bounds.max);
        }

        return Matter.Bounds.create(vertices);
    };

    /*
    *
    *  Events Documentation
    *
    */

    /**
    * Fired when a call to `Composite.add` is made, before objects have been added.
    *
    * @event beforeAdd
    * @param {} event An event object
    * @param {} event.object The object(s) to be added (may be a single body, constraint, composite or a mixed array of these)
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when a call to `Composite.add` is made, after objects have been added.
    *
    * @event afterAdd
    * @param {} event An event object
    * @param {} event.object The object(s) that have been added (may be a single body, constraint, composite or a mixed array of these)
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when a call to `Composite.remove` is made, before objects have been removed.
    *
    * @event beforeRemove
    * @param {} event An event object
    * @param {} event.object The object(s) to be removed (may be a single body, constraint, composite or a mixed array of these)
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when a call to `Composite.remove` is made, after objects have been removed.
    *
    * @event afterRemove
    * @param {} event An event object
    * @param {} event.object The object(s) that have been removed (may be a single body, constraint, composite or a mixed array of these)
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * An integer `Number` uniquely identifying number generated in `Composite.create` by `Common.nextId`.
     *
     * @property id
     * @type number
     */

    /**
     * A `String` denoting the type of object.
     *
     * @property type
     * @type string
     * @default "composite"
     * @readOnly
     */

    /**
     * An arbitrary `String` name to help the user identify and manage composites.
     *
     * @property label
     * @type string
     * @default "Composite"
     */

    /**
     * A flag that specifies whether the composite has been modified during the current step.
     * Most `Matter.Composite` methods will automatically set this flag to `true` to inform the engine of changes to be handled.
     * If you need to change it manually, you should use the `Composite.setModified` method.
     *
     * @property isModified
     * @type boolean
     * @default false
     */

    /**
     * The `Composite` that is the parent of this composite. It is automatically managed by the `Matter.Composite` methods.
     *
     * @property parent
     * @type composite
     * @default null
     */

    /**
     * An array of `Body` that are _direct_ children of this composite.
     * To add or remove bodies you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allBodies` method.
     *
     * @property bodies
     * @type body[]
     * @default []
     */

    /**
     * An array of `Constraint` that are _direct_ children of this composite.
     * To add or remove constraints you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allConstraints` method.
     *
     * @property constraints
     * @type constraint[]
     * @default []
     */

    /**
     * An array of `Composite` that are _direct_ children of this composite.
     * To add or remove composites you should use `Composite.add` and `Composite.remove` methods rather than directly modifying this property.
     * If you wish to recursively find all descendants, you should use the `Composite.allComposites` method.
     *
     * @property composites
     * @type composite[]
     * @default []
     */

    /**
     * An object reserved for storing plugin-specific properties.
     *
     * @property plugin
     * @type {}
     */

})();

},{"../core/Common":14,"../core/Events":16,"./Body":1}],3:[function(_dereq_,module,exports){
/**
* The `Matter.World` module contains methods for creating and manipulating the world composite.
* A `Matter.World` is a `Matter.Composite` body, which is a collection of `Matter.Body`, `Matter.Constraint` and other `Matter.Composite`.
* A `Matter.World` has a few additional properties including `gravity` and `bounds`.
* It is important to use the functions in the `Matter.Composite` module to modify the world composite, rather than directly modifying its properties.
* There are also a few methods here that alias those in `Matter.Composite` for easier readability.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class World
* @extends Composite
*/

var World = {};

module.exports = World;

var Composite = _dereq_('./Composite');
var Constraint = _dereq_('../constraint/Constraint');
var Common = _dereq_('../core/Common');

(function() {

    /**
     * Creates a new world composite. The options parameter is an object that specifies any properties you wish to override the defaults.
     * See the properties section below for detailed information on what you can pass via the `options` object.
     * @method create
     * @constructor
     * @param {} options
     * @return {world} A new world
     */
    World.create = function(options) {
        var composite = Composite.create();

        var defaults = {
            label: 'World',
            gravity: {
                x: 0,
                y: 1,
                scale: 0.001
            },
            bounds: { 
                min: { x: -Infinity, y: -Infinity }, 
                max: { x: Infinity, y: Infinity } 
            }
        };
        
        return Common.extend(composite, defaults, options);
    };

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * The gravity to apply on the world.
     *
     * @property gravity
     * @type object
     */

    /**
     * The gravity x component.
     *
     * @property gravity.x
     * @type object
     * @default 0
     */

    /**
     * The gravity y component.
     *
     * @property gravity.y
     * @type object
     * @default 1
     */

    /**
     * The gravity scale factor.
     *
     * @property gravity.scale
     * @type object
     * @default 0.001
     */

    /**
     * A `Bounds` object that defines the world bounds for collision detection.
     *
     * @property bounds
     * @type bounds
     * @default { min: { x: -Infinity, y: -Infinity }, max: { x: Infinity, y: Infinity } }
     */

    // World is a Composite body
    // see src/module/Outro.js for these aliases:
    
    /**
     * An alias for Composite.clear
     * @method clear
     * @param {world} world
     * @param {boolean} keepStatic
     */

    /**
     * An alias for Composite.add
     * @method addComposite
     * @param {world} world
     * @param {composite} composite
     * @return {world} The original world with the objects from composite added
     */
    
     /**
      * An alias for Composite.addBody
      * @method addBody
      * @param {world} world
      * @param {body} body
      * @return {world} The original world with the body added
      */

     /**
      * An alias for Composite.addConstraint
      * @method addConstraint
      * @param {world} world
      * @param {constraint} constraint
      * @return {world} The original world with the constraint added
      */

})();

},{"../constraint/Constraint":12,"../core/Common":14,"./Composite":2}],4:[function(_dereq_,module,exports){
/**
* The `Matter.Contact` module contains methods for creating and manipulating collision contacts.
*
* @class Contact
*/

var Contact = {};

module.exports = Contact;

(function() {

    /**
     * Creates a new contact.
     * @method create
     * @param {vertex} vertex
     * @return {contact} A new contact
     */
    Contact.create = function(vertex) {
        return {
            id: Contact.id(vertex),
            vertex: vertex,
            normalImpulse: 0,
            tangentImpulse: 0
        };
    };
    
    /**
     * Generates a contact id.
     * @method id
     * @param {vertex} vertex
     * @return {string} Unique contactID
     */
    Contact.id = function(vertex) {
        return vertex.body.id + '_' + vertex.index;
    };

})();

},{}],5:[function(_dereq_,module,exports){
/**
* The `Matter.Detector` module contains methods for detecting collisions given a set of pairs.
*
* @class Detector
*/

// TODO: speculative contacts

var Detector = {};

module.exports = Detector;

var SAT = _dereq_('./SAT');
var Pair = _dereq_('./Pair');
var Bounds = _dereq_('../geometry/Bounds');

(function() {

    /**
     * Finds all collisions given a list of pairs.
     * @method collisions
     * @param {pair[]} broadphasePairs
     * @param {engine} engine
     * @return {array} collisions
     */
    Detector.collisions = function(broadphasePairs, engine) {
        var collisions = [],
            pairsTable = engine.pairs.table;

        
        for (var i = 0; i < broadphasePairs.length; i++) {
            var bodyA = broadphasePairs[i][0], 
                bodyB = broadphasePairs[i][1];

            if ((bodyA.isStatic || bodyA.isSleeping) && (bodyB.isStatic || bodyB.isSleeping))
                continue;
            
            if (!Detector.canCollide(bodyA.collisionFilter, bodyB.collisionFilter))
                continue;


            // mid phase
            if (Bounds.overlaps(bodyA.bounds, bodyB.bounds)) {
                for (var j = bodyA.parts.length > 1 ? 1 : 0; j < bodyA.parts.length; j++) {
                    var partA = bodyA.parts[j];

                    for (var k = bodyB.parts.length > 1 ? 1 : 0; k < bodyB.parts.length; k++) {
                        var partB = bodyB.parts[k];

                        if ((partA === bodyA && partB === bodyB) || Bounds.overlaps(partA.bounds, partB.bounds)) {
                            // find a previous collision we could reuse
                            var pairId = Pair.id(partA, partB),
                                pair = pairsTable[pairId],
                                previousCollision;

                            if (pair && pair.isActive) {
                                previousCollision = pair.collision;
                            } else {
                                previousCollision = null;
                            }

                            // narrow phase
                            var collision = SAT.collides(partA, partB, previousCollision);


                            if (collision.collided) {
                                collisions.push(collision);
                            }
                        }
                    }
                }
            }
        }

        return collisions;
    };

    /**
     * Returns `true` if both supplied collision filters will allow a collision to occur.
     * See `body.collisionFilter` for more information.
     * @method canCollide
     * @param {} filterA
     * @param {} filterB
     * @return {bool} `true` if collision can occur
     */
    Detector.canCollide = function(filterA, filterB) {
        if (filterA.group === filterB.group && filterA.group !== 0)
            return filterA.group > 0;

        return (filterA.mask & filterB.category) !== 0 && (filterB.mask & filterA.category) !== 0;
    };

})();

},{"../geometry/Bounds":26,"./Pair":7,"./SAT":11}],6:[function(_dereq_,module,exports){
/**
* The `Matter.Grid` module contains methods for creating and manipulating collision broadphase grid structures.
*
* @class Grid
*/

var Grid = {};

module.exports = Grid;

var Pair = _dereq_('./Pair');
var Detector = _dereq_('./Detector');
var Common = _dereq_('../core/Common');

(function() {

    /**
     * Creates a new grid.
     * @method create
     * @param {} options
     * @return {grid} A new grid
     */
    Grid.create = function(options) {
        var defaults = {
            controller: Grid,
            detector: Detector.collisions,
            buckets: {},
            pairs: {},
            pairsList: [],
            bucketWidth: 48,
            bucketHeight: 48
        };

        return Common.extend(defaults, options);
    };

    /**
     * The width of a single grid bucket.
     *
     * @property bucketWidth
     * @type number
     * @default 48
     */

    /**
     * The height of a single grid bucket.
     *
     * @property bucketHeight
     * @type number
     * @default 48
     */

    /**
     * Updates the grid.
     * @method update
     * @param {grid} grid
     * @param {body[]} bodies
     * @param {engine} engine
     * @param {boolean} forceUpdate
     */
    Grid.update = function(grid, bodies, engine, forceUpdate) {
        var i, col, row,
            world = engine.world,
            buckets = grid.buckets,
            bucket,
            bucketId,
            gridChanged = false;


        for (i = 0; i < bodies.length; i++) {
            var body = bodies[i];

            if (body.isSleeping && !forceUpdate)
                continue;

            // don't update out of world bodies
            if (body.bounds.max.x < world.bounds.min.x || body.bounds.min.x > world.bounds.max.x
                || body.bounds.max.y < world.bounds.min.y || body.bounds.min.y > world.bounds.max.y)
                continue;

            var newRegion = _getRegion(grid, body);

            // if the body has changed grid region
            if (!body.region || newRegion.id !== body.region.id || forceUpdate) {


                if (!body.region || forceUpdate)
                    body.region = newRegion;

                var union = _regionUnion(newRegion, body.region);

                // update grid buckets affected by region change
                // iterate over the union of both regions
                for (col = union.startCol; col <= union.endCol; col++) {
                    for (row = union.startRow; row <= union.endRow; row++) {
                        bucketId = _getBucketId(col, row);
                        bucket = buckets[bucketId];

                        var isInsideNewRegion = (col >= newRegion.startCol && col <= newRegion.endCol
                                                && row >= newRegion.startRow && row <= newRegion.endRow);

                        var isInsideOldRegion = (col >= body.region.startCol && col <= body.region.endCol
                                                && row >= body.region.startRow && row <= body.region.endRow);

                        // remove from old region buckets
                        if (!isInsideNewRegion && isInsideOldRegion) {
                            if (isInsideOldRegion) {
                                if (bucket)
                                    _bucketRemoveBody(grid, bucket, body);
                            }
                        }

                        // add to new region buckets
                        if (body.region === newRegion || (isInsideNewRegion && !isInsideOldRegion) || forceUpdate) {
                            if (!bucket)
                                bucket = _createBucket(buckets, bucketId);
                            _bucketAddBody(grid, bucket, body);
                        }
                    }
                }

                // set the new region
                body.region = newRegion;

                // flag changes so we can update pairs
                gridChanged = true;
            }
        }

        // update pairs list only if pairs changed (i.e. a body changed region)
        if (gridChanged)
            grid.pairsList = _createActivePairsList(grid);
    };

    /**
     * Clears the grid.
     * @method clear
     * @param {grid} grid
     */
    Grid.clear = function(grid) {
        grid.buckets = {};
        grid.pairs = {};
        grid.pairsList = [];
    };

    /**
     * Finds the union of two regions.
     * @method _regionUnion
     * @private
     * @param {} regionA
     * @param {} regionB
     * @return {} region
     */
    var _regionUnion = function(regionA, regionB) {
        var startCol = Math.min(regionA.startCol, regionB.startCol),
            endCol = Math.max(regionA.endCol, regionB.endCol),
            startRow = Math.min(regionA.startRow, regionB.startRow),
            endRow = Math.max(regionA.endRow, regionB.endRow);

        return _createRegion(startCol, endCol, startRow, endRow);
    };

    /**
     * Gets the region a given body falls in for a given grid.
     * @method _getRegion
     * @private
     * @param {} grid
     * @param {} body
     * @return {} region
     */
    var _getRegion = function(grid, body) {
        var bounds = body.bounds,
            startCol = Math.floor(bounds.min.x / grid.bucketWidth),
            endCol = Math.floor(bounds.max.x / grid.bucketWidth),
            startRow = Math.floor(bounds.min.y / grid.bucketHeight),
            endRow = Math.floor(bounds.max.y / grid.bucketHeight);

        return _createRegion(startCol, endCol, startRow, endRow);
    };

    /**
     * Creates a region.
     * @method _createRegion
     * @private
     * @param {} startCol
     * @param {} endCol
     * @param {} startRow
     * @param {} endRow
     * @return {} region
     */
    var _createRegion = function(startCol, endCol, startRow, endRow) {
        return { 
            id: startCol + ',' + endCol + ',' + startRow + ',' + endRow,
            startCol: startCol, 
            endCol: endCol, 
            startRow: startRow, 
            endRow: endRow 
        };
    };

    /**
     * Gets the bucket id at the given position.
     * @method _getBucketId
     * @private
     * @param {} column
     * @param {} row
     * @return {string} bucket id
     */
    var _getBucketId = function(column, row) {
        return 'C' + column + 'R' + row;
    };

    /**
     * Creates a bucket.
     * @method _createBucket
     * @private
     * @param {} buckets
     * @param {} bucketId
     * @return {} bucket
     */
    var _createBucket = function(buckets, bucketId) {
        var bucket = buckets[bucketId] = [];
        return bucket;
    };

    /**
     * Adds a body to a bucket.
     * @method _bucketAddBody
     * @private
     * @param {} grid
     * @param {} bucket
     * @param {} body
     */
    var _bucketAddBody = function(grid, bucket, body) {
        // add new pairs
        for (var i = 0; i < bucket.length; i++) {
            var bodyB = bucket[i];

            if (body.id === bodyB.id || (body.isStatic && bodyB.isStatic))
                continue;

            // keep track of the number of buckets the pair exists in
            // important for Grid.update to work
            var pairId = Pair.id(body, bodyB),
                pair = grid.pairs[pairId];

            if (pair) {
                pair[2] += 1;
            } else {
                grid.pairs[pairId] = [body, bodyB, 1];
            }
        }

        // add to bodies (after pairs, otherwise pairs with self)
        bucket.push(body);
    };

    /**
     * Removes a body from a bucket.
     * @method _bucketRemoveBody
     * @private
     * @param {} grid
     * @param {} bucket
     * @param {} body
     */
    var _bucketRemoveBody = function(grid, bucket, body) {
        // remove from bucket
        bucket.splice(Common.indexOf(bucket, body), 1);

        // update pair counts
        for (var i = 0; i < bucket.length; i++) {
            // keep track of the number of buckets the pair exists in
            // important for _createActivePairsList to work
            var bodyB = bucket[i],
                pairId = Pair.id(body, bodyB),
                pair = grid.pairs[pairId];

            if (pair)
                pair[2] -= 1;
        }
    };

    /**
     * Generates a list of the active pairs in the grid.
     * @method _createActivePairsList
     * @private
     * @param {} grid
     * @return [] pairs
     */
    var _createActivePairsList = function(grid) {
        var pairKeys,
            pair,
            pairs = [];

        // grid.pairs is used as a hashmap
        pairKeys = Common.keys(grid.pairs);

        // iterate over grid.pairs
        for (var k = 0; k < pairKeys.length; k++) {
            pair = grid.pairs[pairKeys[k]];

            // if pair exists in at least one bucket
            // it is a pair that needs further collision testing so push it
            if (pair[2] > 0) {
                pairs.push(pair);
            } else {
                delete grid.pairs[pairKeys[k]];
            }
        }

        return pairs;
    };
    
})();

},{"../core/Common":14,"./Detector":5,"./Pair":7}],7:[function(_dereq_,module,exports){
/**
* The `Matter.Pair` module contains methods for creating and manipulating collision pairs.
*
* @class Pair
*/

var Pair = {};

module.exports = Pair;

var Contact = _dereq_('./Contact');

(function() {
    
    /**
     * Creates a pair.
     * @method create
     * @param {collision} collision
     * @param {number} timestamp
     * @return {pair} A new pair
     */
    Pair.create = function(collision, timestamp) {
        var bodyA = collision.bodyA,
            bodyB = collision.bodyB,
            parentA = collision.parentA,
            parentB = collision.parentB;

        var pair = {
            id: Pair.id(bodyA, bodyB),
            bodyA: bodyA,
            bodyB: bodyB,
            contacts: {},
            activeContacts: [],
            separation: 0,
            isActive: true,
            isSensor: bodyA.isSensor || bodyB.isSensor,
            timeCreated: timestamp,
            timeUpdated: timestamp,
            inverseMass: parentA.inverseMass + parentB.inverseMass,
            friction: Math.min(parentA.friction, parentB.friction),
            frictionStatic: Math.max(parentA.frictionStatic, parentB.frictionStatic),
            restitution: Math.max(parentA.restitution, parentB.restitution),
            slop: Math.max(parentA.slop, parentB.slop)
        };

        Pair.update(pair, collision, timestamp);

        return pair;
    };

    /**
     * Updates a pair given a collision.
     * @method update
     * @param {pair} pair
     * @param {collision} collision
     * @param {number} timestamp
     */
    Pair.update = function(pair, collision, timestamp) {
        var contacts = pair.contacts,
            supports = collision.supports,
            activeContacts = pair.activeContacts,
            parentA = collision.parentA,
            parentB = collision.parentB;
        
        pair.collision = collision;
        pair.inverseMass = parentA.inverseMass + parentB.inverseMass;
        pair.friction = Math.min(parentA.friction, parentB.friction);
        pair.frictionStatic = Math.max(parentA.frictionStatic, parentB.frictionStatic);
        pair.restitution = Math.max(parentA.restitution, parentB.restitution);
        pair.slop = Math.max(parentA.slop, parentB.slop);
        activeContacts.length = 0;
        
        if (collision.collided) {
            for (var i = 0; i < supports.length; i++) {
                var support = supports[i],
                    contactId = Contact.id(support),
                    contact = contacts[contactId];

                if (contact) {
                    activeContacts.push(contact);
                } else {
                    activeContacts.push(contacts[contactId] = Contact.create(support));
                }
            }

            pair.separation = collision.depth;
            Pair.setActive(pair, true, timestamp);
        } else {
            if (pair.isActive === true)
                Pair.setActive(pair, false, timestamp);
        }
    };
    
    /**
     * Set a pair as active or inactive.
     * @method setActive
     * @param {pair} pair
     * @param {bool} isActive
     * @param {number} timestamp
     */
    Pair.setActive = function(pair, isActive, timestamp) {
        if (isActive) {
            pair.isActive = true;
            pair.timeUpdated = timestamp;
        } else {
            pair.isActive = false;
            pair.activeContacts.length = 0;
        }
    };

    /**
     * Get the id for the given pair.
     * @method id
     * @param {body} bodyA
     * @param {body} bodyB
     * @return {string} Unique pairId
     */
    Pair.id = function(bodyA, bodyB) {
        if (bodyA.id < bodyB.id) {
            return 'A' + bodyA.id + 'B' + bodyB.id;
        } else {
            return 'A' + bodyB.id + 'B' + bodyA.id;
        }
    };

})();

},{"./Contact":4}],8:[function(_dereq_,module,exports){
/**
* The `Matter.Pairs` module contains methods for creating and manipulating collision pair sets.
*
* @class Pairs
*/

var Pairs = {};

module.exports = Pairs;

var Pair = _dereq_('./Pair');
var Common = _dereq_('../core/Common');

(function() {
    
    var _pairMaxIdleLife = 1000;

    /**
     * Creates a new pairs structure.
     * @method create
     * @param {object} options
     * @return {pairs} A new pairs structure
     */
    Pairs.create = function(options) {
        return Common.extend({ 
            table: {},
            list: [],
            collisionStart: [],
            collisionActive: [],
            collisionEnd: []
        }, options);
    };

    /**
     * Updates pairs given a list of collisions.
     * @method update
     * @param {object} pairs
     * @param {collision[]} collisions
     * @param {number} timestamp
     */
    Pairs.update = function(pairs, collisions, timestamp) {
        var pairsList = pairs.list,
            pairsTable = pairs.table,
            collisionStart = pairs.collisionStart,
            collisionEnd = pairs.collisionEnd,
            collisionActive = pairs.collisionActive,
            activePairIds = [],
            collision,
            pairId,
            pair,
            i;

        // clear collision state arrays, but maintain old reference
        collisionStart.length = 0;
        collisionEnd.length = 0;
        collisionActive.length = 0;

        for (i = 0; i < collisions.length; i++) {
            collision = collisions[i];

            if (collision.collided) {
                pairId = Pair.id(collision.bodyA, collision.bodyB);
                activePairIds.push(pairId);

                pair = pairsTable[pairId];
                
                if (pair) {
                    // pair already exists (but may or may not be active)
                    if (pair.isActive) {
                        // pair exists and is active
                        collisionActive.push(pair);
                    } else {
                        // pair exists but was inactive, so a collision has just started again
                        collisionStart.push(pair);
                    }

                    // update the pair
                    Pair.update(pair, collision, timestamp);
                } else {
                    // pair did not exist, create a new pair
                    pair = Pair.create(collision, timestamp);
                    pairsTable[pairId] = pair;

                    // push the new pair
                    collisionStart.push(pair);
                    pairsList.push(pair);
                }
            }
        }

        // deactivate previously active pairs that are now inactive
        for (i = 0; i < pairsList.length; i++) {
            pair = pairsList[i];
            if (pair.isActive && Common.indexOf(activePairIds, pair.id) === -1) {
                Pair.setActive(pair, false, timestamp);
                collisionEnd.push(pair);
            }
        }
    };
    
    /**
     * Finds and removes pairs that have been inactive for a set amount of time.
     * @method removeOld
     * @param {object} pairs
     * @param {number} timestamp
     */
    Pairs.removeOld = function(pairs, timestamp) {
        var pairsList = pairs.list,
            pairsTable = pairs.table,
            indexesToRemove = [],
            pair,
            collision,
            pairIndex,
            i;

        for (i = 0; i < pairsList.length; i++) {
            pair = pairsList[i];
            collision = pair.collision;
            
            // never remove sleeping pairs
            if (collision.bodyA.isSleeping || collision.bodyB.isSleeping) {
                pair.timeUpdated = timestamp;
                continue;
            }

            // if pair is inactive for too long, mark it to be removed
            if (timestamp - pair.timeUpdated > _pairMaxIdleLife) {
                indexesToRemove.push(i);
            }
        }

        // remove marked pairs
        for (i = 0; i < indexesToRemove.length; i++) {
            pairIndex = indexesToRemove[i] - i;
            pair = pairsList[pairIndex];
            delete pairsTable[pair.id];
            pairsList.splice(pairIndex, 1);
        }
    };

    /**
     * Clears the given pairs structure.
     * @method clear
     * @param {pairs} pairs
     * @return {pairs} pairs
     */
    Pairs.clear = function(pairs) {
        pairs.table = {};
        pairs.list.length = 0;
        pairs.collisionStart.length = 0;
        pairs.collisionActive.length = 0;
        pairs.collisionEnd.length = 0;
        return pairs;
    };

})();

},{"../core/Common":14,"./Pair":7}],9:[function(_dereq_,module,exports){
/**
* The `Matter.Query` module contains methods for performing collision queries.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Query
*/

var Query = {};

module.exports = Query;

var Vector = _dereq_('../geometry/Vector');
var SAT = _dereq_('./SAT');
var Bounds = _dereq_('../geometry/Bounds');
var Bodies = _dereq_('../factory/Bodies');
var Vertices = _dereq_('../geometry/Vertices');

(function() {

    /**
     * Casts a ray segment against a set of bodies and returns all collisions, ray width is optional. Intersection points are not provided.
     * @method ray
     * @param {body[]} bodies
     * @param {vector} startPoint
     * @param {vector} endPoint
     * @param {number} [rayWidth]
     * @return {object[]} Collisions
     */
    Query.ray = function(bodies, startPoint, endPoint, rayWidth) {
        rayWidth = rayWidth || 1e-100;

        var rayAngle = Vector.angle(startPoint, endPoint),
            rayLength = Vector.magnitude(Vector.sub(startPoint, endPoint)),
            rayX = (endPoint.x + startPoint.x) * 0.5,
            rayY = (endPoint.y + startPoint.y) * 0.5,
            ray = Bodies.rectangle(rayX, rayY, rayLength, rayWidth, { angle: rayAngle }),
            collisions = [];

        for (var i = 0; i < bodies.length; i++) {
            var bodyA = bodies[i];
            
            if (Bounds.overlaps(bodyA.bounds, ray.bounds)) {
                for (var j = bodyA.parts.length === 1 ? 0 : 1; j < bodyA.parts.length; j++) {
                    var part = bodyA.parts[j];

                    if (Bounds.overlaps(part.bounds, ray.bounds)) {
                        var collision = SAT.collides(part, ray);
                        if (collision.collided) {
                            collision.body = collision.bodyA = collision.bodyB = bodyA;
                            collisions.push(collision);
                            break;
                        }
                    }
                }
            }
        }

        return collisions;
    };

    /**
     * Returns all bodies whose bounds are inside (or outside if set) the given set of bounds, from the given set of bodies.
     * @method region
     * @param {body[]} bodies
     * @param {bounds} bounds
     * @param {bool} [outside=false]
     * @return {body[]} The bodies matching the query
     */
    Query.region = function(bodies, bounds, outside) {
        var result = [];

        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i],
                overlaps = Bounds.overlaps(body.bounds, bounds);
            if ((overlaps && !outside) || (!overlaps && outside))
                result.push(body);
        }

        return result;
    };

    /**
     * Returns all bodies whose vertices contain the given point, from the given set of bodies.
     * @method point
     * @param {body[]} bodies
     * @param {vector} point
     * @return {body[]} The bodies matching the query
     */
    Query.point = function(bodies, point) {
        var result = [];

        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];
            
            if (Bounds.contains(body.bounds, point)) {
                for (var j = body.parts.length === 1 ? 0 : 1; j < body.parts.length; j++) {
                    var part = body.parts[j];

                    if (Bounds.contains(part.bounds, point)
                        && Vertices.contains(part.vertices, point)) {
                        result.push(body);
                        break;
                    }
                }
            }
        }

        return result;
    };

})();

},{"../factory/Bodies":23,"../geometry/Bounds":26,"../geometry/Vector":28,"../geometry/Vertices":29,"./SAT":11}],10:[function(_dereq_,module,exports){
/**
* The `Matter.Resolver` module contains methods for resolving collision pairs.
*
* @class Resolver
*/

var Resolver = {};

module.exports = Resolver;

var Vertices = _dereq_('../geometry/Vertices');
var Vector = _dereq_('../geometry/Vector');
var Common = _dereq_('../core/Common');
var Bounds = _dereq_('../geometry/Bounds');

(function() {

    Resolver._restingThresh = 4;
    Resolver._restingThreshTangent = 6;
    Resolver._positionDampen = 0.9;
    Resolver._positionWarming = 0.8;
    Resolver._frictionNormalMultiplier = 5;

    /**
     * Prepare pairs for position solving.
     * @method preSolvePosition
     * @param {pair[]} pairs
     */
    Resolver.preSolvePosition = function(pairs) {
        var i,
            pair,
            activeCount;

        // find total contacts on each body
        for (i = 0; i < pairs.length; i++) {
            pair = pairs[i];
            
            if (!pair.isActive)
                continue;
            
            activeCount = pair.activeContacts.length;
            pair.collision.parentA.totalContacts += activeCount;
            pair.collision.parentB.totalContacts += activeCount;
        }
    };

    /**
     * Find a solution for pair positions.
     * @method solvePosition
     * @param {pair[]} pairs
     * @param {number} timeScale
     */
    Resolver.solvePosition = function(pairs, timeScale) {
        var i,
            pair,
            collision,
            bodyA,
            bodyB,
            normal,
            bodyBtoA,
            contactShare,
            positionImpulse,
            contactCount = {},
            tempA = Vector._temp[0],
            tempB = Vector._temp[1],
            tempC = Vector._temp[2],
            tempD = Vector._temp[3];

        // find impulses required to resolve penetration
        for (i = 0; i < pairs.length; i++) {
            pair = pairs[i];
            
            if (!pair.isActive || pair.isSensor)
                continue;

            collision = pair.collision;
            bodyA = collision.parentA;
            bodyB = collision.parentB;
            normal = collision.normal;

            // get current separation between body edges involved in collision
            bodyBtoA = Vector.sub(Vector.add(bodyB.positionImpulse, bodyB.position, tempA), 
                                    Vector.add(bodyA.positionImpulse, 
                                        Vector.sub(bodyB.position, collision.penetration, tempB), tempC), tempD);

            pair.separation = Vector.dot(normal, bodyBtoA);
        }
        
        for (i = 0; i < pairs.length; i++) {
            pair = pairs[i];

            if (!pair.isActive || pair.isSensor)
                continue;
            
            collision = pair.collision;
            bodyA = collision.parentA;
            bodyB = collision.parentB;
            normal = collision.normal;
            positionImpulse = (pair.separation - pair.slop) * timeScale;

            if (bodyA.isStatic || bodyB.isStatic)
                positionImpulse *= 2;
            
            if (!(bodyA.isStatic || bodyA.isSleeping)) {
                contactShare = Resolver._positionDampen / bodyA.totalContacts;
                bodyA.positionImpulse.x += normal.x * positionImpulse * contactShare;
                bodyA.positionImpulse.y += normal.y * positionImpulse * contactShare;
            }

            if (!(bodyB.isStatic || bodyB.isSleeping)) {
                contactShare = Resolver._positionDampen / bodyB.totalContacts;
                bodyB.positionImpulse.x -= normal.x * positionImpulse * contactShare;
                bodyB.positionImpulse.y -= normal.y * positionImpulse * contactShare;
            }
        }
    };

    /**
     * Apply position resolution.
     * @method postSolvePosition
     * @param {body[]} bodies
     */
    Resolver.postSolvePosition = function(bodies) {
        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];

            // reset contact count
            body.totalContacts = 0;

            if (body.positionImpulse.x !== 0 || body.positionImpulse.y !== 0) {
                // update body geometry
                for (var j = 0; j < body.parts.length; j++) {
                    var part = body.parts[j];
                    Vertices.translate(part.vertices, body.positionImpulse);
                    Bounds.update(part.bounds, part.vertices, body.velocity);
                    part.position.x += body.positionImpulse.x;
                    part.position.y += body.positionImpulse.y;
                }

                // move the body without changing velocity
                body.positionPrev.x += body.positionImpulse.x;
                body.positionPrev.y += body.positionImpulse.y;

                if (Vector.dot(body.positionImpulse, body.velocity) < 0) {
                    // reset cached impulse if the body has velocity along it
                    body.positionImpulse.x = 0;
                    body.positionImpulse.y = 0;
                } else {
                    // warm the next iteration
                    body.positionImpulse.x *= Resolver._positionWarming;
                    body.positionImpulse.y *= Resolver._positionWarming;
                }
            }
        }
    };

    /**
     * Prepare pairs for velocity solving.
     * @method preSolveVelocity
     * @param {pair[]} pairs
     */
    Resolver.preSolveVelocity = function(pairs) {
        var i,
            j,
            pair,
            contacts,
            collision,
            bodyA,
            bodyB,
            normal,
            tangent,
            contact,
            contactVertex,
            normalImpulse,
            tangentImpulse,
            offset,
            impulse = Vector._temp[0],
            tempA = Vector._temp[1];
        
        for (i = 0; i < pairs.length; i++) {
            pair = pairs[i];
            
            if (!pair.isActive || pair.isSensor)
                continue;
            
            contacts = pair.activeContacts;
            collision = pair.collision;
            bodyA = collision.parentA;
            bodyB = collision.parentB;
            normal = collision.normal;
            tangent = collision.tangent;

            // resolve each contact
            for (j = 0; j < contacts.length; j++) {
                contact = contacts[j];
                contactVertex = contact.vertex;
                normalImpulse = contact.normalImpulse;
                tangentImpulse = contact.tangentImpulse;

                if (normalImpulse !== 0 || tangentImpulse !== 0) {
                    // total impulse from contact
                    impulse.x = (normal.x * normalImpulse) + (tangent.x * tangentImpulse);
                    impulse.y = (normal.y * normalImpulse) + (tangent.y * tangentImpulse);
                    
                    // apply impulse from contact
                    if (!(bodyA.isStatic || bodyA.isSleeping)) {
                        offset = Vector.sub(contactVertex, bodyA.position, tempA);
                        bodyA.positionPrev.x += impulse.x * bodyA.inverseMass;
                        bodyA.positionPrev.y += impulse.y * bodyA.inverseMass;
                        bodyA.anglePrev += Vector.cross(offset, impulse) * bodyA.inverseInertia;
                    }

                    if (!(bodyB.isStatic || bodyB.isSleeping)) {
                        offset = Vector.sub(contactVertex, bodyB.position, tempA);
                        bodyB.positionPrev.x -= impulse.x * bodyB.inverseMass;
                        bodyB.positionPrev.y -= impulse.y * bodyB.inverseMass;
                        bodyB.anglePrev -= Vector.cross(offset, impulse) * bodyB.inverseInertia;
                    }
                }
            }
        }
    };

    /**
     * Find a solution for pair velocities.
     * @method solveVelocity
     * @param {pair[]} pairs
     * @param {number} timeScale
     */
    Resolver.solveVelocity = function(pairs, timeScale) {
        var timeScaleSquared = timeScale * timeScale,
            impulse = Vector._temp[0],
            tempA = Vector._temp[1],
            tempB = Vector._temp[2],
            tempC = Vector._temp[3],
            tempD = Vector._temp[4],
            tempE = Vector._temp[5];
        
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            
            if (!pair.isActive || pair.isSensor)
                continue;
            
            var collision = pair.collision,
                bodyA = collision.parentA,
                bodyB = collision.parentB,
                normal = collision.normal,
                tangent = collision.tangent,
                contacts = pair.activeContacts,
                contactShare = 1 / contacts.length;

            // update body velocities
            bodyA.velocity.x = bodyA.position.x - bodyA.positionPrev.x;
            bodyA.velocity.y = bodyA.position.y - bodyA.positionPrev.y;
            bodyB.velocity.x = bodyB.position.x - bodyB.positionPrev.x;
            bodyB.velocity.y = bodyB.position.y - bodyB.positionPrev.y;
            bodyA.angularVelocity = bodyA.angle - bodyA.anglePrev;
            bodyB.angularVelocity = bodyB.angle - bodyB.anglePrev;

            // resolve each contact
            for (var j = 0; j < contacts.length; j++) {
                var contact = contacts[j],
                    contactVertex = contact.vertex,
                    offsetA = Vector.sub(contactVertex, bodyA.position, tempA),
                    offsetB = Vector.sub(contactVertex, bodyB.position, tempB),
                    velocityPointA = Vector.add(bodyA.velocity, Vector.mult(Vector.perp(offsetA), bodyA.angularVelocity), tempC),
                    velocityPointB = Vector.add(bodyB.velocity, Vector.mult(Vector.perp(offsetB), bodyB.angularVelocity), tempD), 
                    relativeVelocity = Vector.sub(velocityPointA, velocityPointB, tempE),
                    normalVelocity = Vector.dot(normal, relativeVelocity);

                var tangentVelocity = Vector.dot(tangent, relativeVelocity),
                    tangentSpeed = Math.abs(tangentVelocity),
                    tangentVelocityDirection = Common.sign(tangentVelocity);

                // raw impulses
                var normalImpulse = (1 + pair.restitution) * normalVelocity,
                    normalForce = Common.clamp(pair.separation + normalVelocity, 0, 1) * Resolver._frictionNormalMultiplier;

                // coulomb friction
                var tangentImpulse = tangentVelocity,
                    maxFriction = Infinity;

                if (tangentSpeed > pair.friction * pair.frictionStatic * normalForce * timeScaleSquared) {
                    maxFriction = tangentSpeed;
                    tangentImpulse = Common.clamp(
                        pair.friction * tangentVelocityDirection * timeScaleSquared,
                        -maxFriction, maxFriction
                    );
                }

                // modify impulses accounting for mass, inertia and offset
                var oAcN = Vector.cross(offsetA, normal),
                    oBcN = Vector.cross(offsetB, normal),
                    share = contactShare / (bodyA.inverseMass + bodyB.inverseMass + bodyA.inverseInertia * oAcN * oAcN  + bodyB.inverseInertia * oBcN * oBcN);

                normalImpulse *= share;
                tangentImpulse *= share;

                // handle high velocity and resting collisions separately
                if (normalVelocity < 0 && normalVelocity * normalVelocity > Resolver._restingThresh * timeScaleSquared) {
                    // high normal velocity so clear cached contact normal impulse
                    contact.normalImpulse = 0;
                } else {
                    // solve resting collision constraints using Erin Catto's method (GDC08)
                    // impulse constraint tends to 0
                    var contactNormalImpulse = contact.normalImpulse;
                    contact.normalImpulse = Math.min(contact.normalImpulse + normalImpulse, 0);
                    normalImpulse = contact.normalImpulse - contactNormalImpulse;
                }

                // handle high velocity and resting collisions separately
                if (tangentVelocity * tangentVelocity > Resolver._restingThreshTangent * timeScaleSquared) {
                    // high tangent velocity so clear cached contact tangent impulse
                    contact.tangentImpulse = 0;
                } else {
                    // solve resting collision constraints using Erin Catto's method (GDC08)
                    // tangent impulse tends to -tangentSpeed or +tangentSpeed
                    var contactTangentImpulse = contact.tangentImpulse;
                    contact.tangentImpulse = Common.clamp(contact.tangentImpulse + tangentImpulse, -maxFriction, maxFriction);
                    tangentImpulse = contact.tangentImpulse - contactTangentImpulse;
                }

                // total impulse from contact
                impulse.x = (normal.x * normalImpulse) + (tangent.x * tangentImpulse);
                impulse.y = (normal.y * normalImpulse) + (tangent.y * tangentImpulse);
                
                // apply impulse from contact
                if (!(bodyA.isStatic || bodyA.isSleeping)) {
                    bodyA.positionPrev.x += impulse.x * bodyA.inverseMass;
                    bodyA.positionPrev.y += impulse.y * bodyA.inverseMass;
                    bodyA.anglePrev += Vector.cross(offsetA, impulse) * bodyA.inverseInertia;
                }

                if (!(bodyB.isStatic || bodyB.isSleeping)) {
                    bodyB.positionPrev.x -= impulse.x * bodyB.inverseMass;
                    bodyB.positionPrev.y -= impulse.y * bodyB.inverseMass;
                    bodyB.anglePrev -= Vector.cross(offsetB, impulse) * bodyB.inverseInertia;
                }
            }
        }
    };

})();

},{"../core/Common":14,"../geometry/Bounds":26,"../geometry/Vector":28,"../geometry/Vertices":29}],11:[function(_dereq_,module,exports){
/**
* The `Matter.SAT` module contains methods for detecting collisions using the Separating Axis Theorem.
*
* @class SAT
*/

// TODO: true circles and curves

var SAT = {};

module.exports = SAT;

var Vertices = _dereq_('../geometry/Vertices');
var Vector = _dereq_('../geometry/Vector');

(function() {

    /**
     * Detect collision between two bodies using the Separating Axis Theorem.
     * @method collides
     * @param {body} bodyA
     * @param {body} bodyB
     * @param {collision} previousCollision
     * @return {collision} collision
     */
    SAT.collides = function(bodyA, bodyB, previousCollision) {
        var overlapAB,
            overlapBA, 
            minOverlap,
            collision,
            canReusePrevCol = false;

        if (previousCollision) {
            // estimate total motion
            var parentA = bodyA.parent,
                parentB = bodyB.parent,
                motion = parentA.speed * parentA.speed + parentA.angularSpeed * parentA.angularSpeed
                       + parentB.speed * parentB.speed + parentB.angularSpeed * parentB.angularSpeed;

            // we may be able to (partially) reuse collision result 
            // but only safe if collision was resting
            canReusePrevCol = previousCollision && previousCollision.collided && motion < 0.2;

            // reuse collision object
            collision = previousCollision;
        } else {
            collision = { collided: false, bodyA: bodyA, bodyB: bodyB };
        }

        if (previousCollision && canReusePrevCol) {
            // if we can reuse the collision result
            // we only need to test the previously found axis
            var axisBodyA = collision.axisBody,
                axisBodyB = axisBodyA === bodyA ? bodyB : bodyA,
                axes = [axisBodyA.axes[previousCollision.axisNumber]];

            minOverlap = _overlapAxes(axisBodyA.vertices, axisBodyB.vertices, axes);
            collision.reused = true;

            if (minOverlap.overlap <= 0) {
                collision.collided = false;
                return collision;
            }
        } else {
            // if we can't reuse a result, perform a full SAT test

            overlapAB = _overlapAxes(bodyA.vertices, bodyB.vertices, bodyA.axes);

            if (overlapAB.overlap <= 0) {
                collision.collided = false;
                return collision;
            }

            overlapBA = _overlapAxes(bodyB.vertices, bodyA.vertices, bodyB.axes);

            if (overlapBA.overlap <= 0) {
                collision.collided = false;
                return collision;
            }

            if (overlapAB.overlap < overlapBA.overlap) {
                minOverlap = overlapAB;
                collision.axisBody = bodyA;
            } else {
                minOverlap = overlapBA;
                collision.axisBody = bodyB;
            }

            // important for reuse later
            collision.axisNumber = minOverlap.axisNumber;
        }

        collision.bodyA = bodyA.id < bodyB.id ? bodyA : bodyB;
        collision.bodyB = bodyA.id < bodyB.id ? bodyB : bodyA;
        collision.collided = true;
        collision.depth = minOverlap.overlap;
        collision.parentA = collision.bodyA.parent;
        collision.parentB = collision.bodyB.parent;
        
        bodyA = collision.bodyA;
        bodyB = collision.bodyB;

        // ensure normal is facing away from bodyA
        if (Vector.dot(minOverlap.axis, Vector.sub(bodyB.position, bodyA.position)) < 0) {
            collision.normal = {
                x: minOverlap.axis.x,
                y: minOverlap.axis.y
            };
        } else {
            collision.normal = {
                x: -minOverlap.axis.x,
                y: -minOverlap.axis.y
            };
        }

        collision.tangent = Vector.perp(collision.normal);

        collision.penetration = collision.penetration || {};
        collision.penetration.x = collision.normal.x * collision.depth;
        collision.penetration.y = collision.normal.y * collision.depth; 

        // find support points, there is always either exactly one or two
        var verticesB = _findSupports(bodyA, bodyB, collision.normal),
            supports = [];

        // find the supports from bodyB that are inside bodyA
        if (Vertices.contains(bodyA.vertices, verticesB[0]))
            supports.push(verticesB[0]);

        if (Vertices.contains(bodyA.vertices, verticesB[1]))
            supports.push(verticesB[1]);

        // find the supports from bodyA that are inside bodyB
        if (supports.length < 2) {
            var verticesA = _findSupports(bodyB, bodyA, Vector.neg(collision.normal));
                
            if (Vertices.contains(bodyB.vertices, verticesA[0]))
                supports.push(verticesA[0]);

            if (supports.length < 2 && Vertices.contains(bodyB.vertices, verticesA[1]))
                supports.push(verticesA[1]);
        }

        // account for the edge case of overlapping but no vertex containment
        if (supports.length < 1)
            supports = [verticesB[0]];
        
        collision.supports = supports;

        return collision;
    };

    /**
     * Find the overlap between two sets of vertices.
     * @method _overlapAxes
     * @private
     * @param {} verticesA
     * @param {} verticesB
     * @param {} axes
     * @return result
     */
    var _overlapAxes = function(verticesA, verticesB, axes) {
        var projectionA = Vector._temp[0], 
            projectionB = Vector._temp[1],
            result = { overlap: Number.MAX_VALUE },
            overlap,
            axis;

        for (var i = 0; i < axes.length; i++) {
            axis = axes[i];

            _projectToAxis(projectionA, verticesA, axis);
            _projectToAxis(projectionB, verticesB, axis);

            overlap = Math.min(projectionA.max - projectionB.min, projectionB.max - projectionA.min);

            if (overlap <= 0) {
                result.overlap = overlap;
                return result;
            }

            if (overlap < result.overlap) {
                result.overlap = overlap;
                result.axis = axis;
                result.axisNumber = i;
            }
        }

        return result;
    };

    /**
     * Projects vertices on an axis and returns an interval.
     * @method _projectToAxis
     * @private
     * @param {} projection
     * @param {} vertices
     * @param {} axis
     */
    var _projectToAxis = function(projection, vertices, axis) {
        var min = Vector.dot(vertices[0], axis),
            max = min;

        for (var i = 1; i < vertices.length; i += 1) {
            var dot = Vector.dot(vertices[i], axis);

            if (dot > max) { 
                max = dot; 
            } else if (dot < min) { 
                min = dot; 
            }
        }

        projection.min = min;
        projection.max = max;
    };
    
    /**
     * Finds supporting vertices given two bodies along a given direction using hill-climbing.
     * @method _findSupports
     * @private
     * @param {} bodyA
     * @param {} bodyB
     * @param {} normal
     * @return [vector]
     */
    var _findSupports = function(bodyA, bodyB, normal) {
        var nearestDistance = Number.MAX_VALUE,
            vertexToBody = Vector._temp[0],
            vertices = bodyB.vertices,
            bodyAPosition = bodyA.position,
            distance,
            vertex,
            vertexA,
            vertexB;

        // find closest vertex on bodyB
        for (var i = 0; i < vertices.length; i++) {
            vertex = vertices[i];
            vertexToBody.x = vertex.x - bodyAPosition.x;
            vertexToBody.y = vertex.y - bodyAPosition.y;
            distance = -Vector.dot(normal, vertexToBody);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                vertexA = vertex;
            }
        }

        // find next closest vertex using the two connected to it
        var prevIndex = vertexA.index - 1 >= 0 ? vertexA.index - 1 : vertices.length - 1;
        vertex = vertices[prevIndex];
        vertexToBody.x = vertex.x - bodyAPosition.x;
        vertexToBody.y = vertex.y - bodyAPosition.y;
        nearestDistance = -Vector.dot(normal, vertexToBody);
        vertexB = vertex;

        var nextIndex = (vertexA.index + 1) % vertices.length;
        vertex = vertices[nextIndex];
        vertexToBody.x = vertex.x - bodyAPosition.x;
        vertexToBody.y = vertex.y - bodyAPosition.y;
        distance = -Vector.dot(normal, vertexToBody);
        if (distance < nearestDistance) {
            vertexB = vertex;
        }

        return [vertexA, vertexB];
    };

})();

},{"../geometry/Vector":28,"../geometry/Vertices":29}],12:[function(_dereq_,module,exports){
/**
* The `Matter.Constraint` module contains methods for creating and manipulating constraints.
* Constraints are used for specifying that a fixed distance must be maintained between two bodies (or a body and a fixed world-space position).
* The stiffness of constraints can be modified to create springs or elastic.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Constraint
*/

var Constraint = {};

module.exports = Constraint;

var Vertices = _dereq_('../geometry/Vertices');
var Vector = _dereq_('../geometry/Vector');
var Sleeping = _dereq_('../core/Sleeping');
var Bounds = _dereq_('../geometry/Bounds');
var Axes = _dereq_('../geometry/Axes');
var Common = _dereq_('../core/Common');

(function() {

    Constraint._warming = 0.4;
    Constraint._torqueDampen = 1;
    Constraint._minLength = 0.000001;

    /**
     * Creates a new constraint.
     * All properties have default values, and many are pre-calculated automatically based on other properties.
     * To simulate a revolute constraint (or pin joint) set `length: 0` and a high `stiffness` value (e.g. `0.7` or above).
     * If the constraint is unstable, try lowering the `stiffness` value and / or increasing `engine.constraintIterations`.
     * See the properties section below for detailed information on what you can pass via the `options` object.
     * @method create
     * @param {} options
     * @return {constraint} constraint
     */
    Constraint.create = function(options) {
        var constraint = options;

        // if bodies defined but no points, use body centre
        if (constraint.bodyA && !constraint.pointA)
            constraint.pointA = { x: 0, y: 0 };
        if (constraint.bodyB && !constraint.pointB)
            constraint.pointB = { x: 0, y: 0 };

        // calculate static length using initial world space points
        var initialPointA = constraint.bodyA ? Vector.add(constraint.bodyA.position, constraint.pointA) : constraint.pointA,
            initialPointB = constraint.bodyB ? Vector.add(constraint.bodyB.position, constraint.pointB) : constraint.pointB,
            length = Vector.magnitude(Vector.sub(initialPointA, initialPointB));
    
        constraint.length = typeof constraint.length !== 'undefined' ? constraint.length : length;

        // option defaults
        constraint.id = constraint.id || Common.nextId();
        constraint.label = constraint.label || 'Constraint';
        constraint.type = 'constraint';
        constraint.stiffness = constraint.stiffness || (constraint.length > 0 ? 1 : 0.7);
        constraint.damping = constraint.damping || 0;
        constraint.angularStiffness = constraint.angularStiffness || 0;
        constraint.angleA = constraint.bodyA ? constraint.bodyA.angle : constraint.angleA;
        constraint.angleB = constraint.bodyB ? constraint.bodyB.angle : constraint.angleB;
        constraint.plugin = {};

        // render
        var render = {
            visible: true,
            lineWidth: 2,
            strokeStyle: '#ffffff',
            type: 'line',
            anchors: true
        };

        if (constraint.length === 0 && constraint.stiffness > 0.1) {
            render.type = 'pin';
            render.anchors = false;
        } else if (constraint.stiffness < 0.9) {
            render.type = 'spring';
        }

        constraint.render = Common.extend(render, constraint.render);

        return constraint;
    };

    /**
     * Prepares for solving by constraint warming.
     * @private
     * @method preSolveAll
     * @param {body[]} bodies
     */
    Constraint.preSolveAll = function(bodies) {
        for (var i = 0; i < bodies.length; i += 1) {
            var body = bodies[i],
                impulse = body.constraintImpulse;

            if (body.isStatic || (impulse.x === 0 && impulse.y === 0 && impulse.angle === 0)) {
                continue;
            }

            body.position.x += impulse.x;
            body.position.y += impulse.y;
            body.angle += impulse.angle;
        }
    };

    /**
     * Solves all constraints in a list of collisions.
     * @private
     * @method solveAll
     * @param {constraint[]} constraints
     * @param {number} timeScale
     */
    Constraint.solveAll = function(constraints, timeScale) {
        // Solve fixed constraints first.
        for (var i = 0; i < constraints.length; i += 1) {
            var constraint = constraints[i],
                fixedA = !constraint.bodyA || (constraint.bodyA && constraint.bodyA.isStatic),
                fixedB = !constraint.bodyB || (constraint.bodyB && constraint.bodyB.isStatic);

            if (fixedA || fixedB) {
                Constraint.solve(constraints[i], timeScale);
            }
        }

        // Solve free constraints last.
        for (i = 0; i < constraints.length; i += 1) {
            constraint = constraints[i];
            fixedA = !constraint.bodyA || (constraint.bodyA && constraint.bodyA.isStatic);
            fixedB = !constraint.bodyB || (constraint.bodyB && constraint.bodyB.isStatic);

            if (!fixedA && !fixedB) {
                Constraint.solve(constraints[i], timeScale);
            }
        }
    };

    /**
     * Solves a distance constraint with Gauss-Siedel method.
     * @private
     * @method solve
     * @param {constraint} constraint
     * @param {number} timeScale
     */
    Constraint.solve = function(constraint, timeScale) {
        var bodyA = constraint.bodyA,
            bodyB = constraint.bodyB,
            pointA = constraint.pointA,
            pointB = constraint.pointB;

        if (!bodyA && !bodyB)
            return;

        // update reference angle
        if (bodyA && !bodyA.isStatic) {
            Vector.rotate(pointA, bodyA.angle - constraint.angleA, pointA);
            constraint.angleA = bodyA.angle;
        }
        
        // update reference angle
        if (bodyB && !bodyB.isStatic) {
            Vector.rotate(pointB, bodyB.angle - constraint.angleB, pointB);
            constraint.angleB = bodyB.angle;
        }

        var pointAWorld = pointA,
            pointBWorld = pointB;

        if (bodyA) pointAWorld = Vector.add(bodyA.position, pointA);
        if (bodyB) pointBWorld = Vector.add(bodyB.position, pointB);

        if (!pointAWorld || !pointBWorld)
            return;

        var delta = Vector.sub(pointAWorld, pointBWorld),
            currentLength = Vector.magnitude(delta);

        // prevent singularity
        if (currentLength < Constraint._minLength) {
            currentLength = Constraint._minLength;
        }

        // solve distance constraint with Gauss-Siedel method
        var difference = (currentLength - constraint.length) / currentLength,
            stiffness = constraint.stiffness < 1 ? constraint.stiffness * timeScale : constraint.stiffness,
            force = Vector.mult(delta, difference * stiffness),
            massTotal = (bodyA ? bodyA.inverseMass : 0) + (bodyB ? bodyB.inverseMass : 0),
            inertiaTotal = (bodyA ? bodyA.inverseInertia : 0) + (bodyB ? bodyB.inverseInertia : 0),
            resistanceTotal = massTotal + inertiaTotal,
            torque,
            share,
            normal,
            normalVelocity,
            relativeVelocity;

        if (constraint.damping) {
            var zero = Vector.create();
            normal = Vector.div(delta, currentLength);

            relativeVelocity = Vector.sub(
                bodyB && Vector.sub(bodyB.position, bodyB.positionPrev) || zero,
                bodyA && Vector.sub(bodyA.position, bodyA.positionPrev) || zero
            );

            normalVelocity = Vector.dot(normal, relativeVelocity);
        }

        if (bodyA && !bodyA.isStatic) {
            share = bodyA.inverseMass / massTotal;

            // keep track of applied impulses for post solving
            bodyA.constraintImpulse.x -= force.x * share;
            bodyA.constraintImpulse.y -= force.y * share;

            // apply forces
            bodyA.position.x -= force.x * share;
            bodyA.position.y -= force.y * share;

            // apply damping
            if (constraint.damping) {
                bodyA.positionPrev.x -= constraint.damping * normal.x * normalVelocity * share;
                bodyA.positionPrev.y -= constraint.damping * normal.y * normalVelocity * share;
            }

            // apply torque
            torque = (Vector.cross(pointA, force) / resistanceTotal) * Constraint._torqueDampen * bodyA.inverseInertia * (1 - constraint.angularStiffness);
            bodyA.constraintImpulse.angle -= torque;
            bodyA.angle -= torque;
        }

        if (bodyB && !bodyB.isStatic) {
            share = bodyB.inverseMass / massTotal;

            // keep track of applied impulses for post solving
            bodyB.constraintImpulse.x += force.x * share;
            bodyB.constraintImpulse.y += force.y * share;
            
            // apply forces
            bodyB.position.x += force.x * share;
            bodyB.position.y += force.y * share;

            // apply damping
            if (constraint.damping) {
                bodyB.positionPrev.x += constraint.damping * normal.x * normalVelocity * share;
                bodyB.positionPrev.y += constraint.damping * normal.y * normalVelocity * share;
            }

            // apply torque
            torque = (Vector.cross(pointB, force) / resistanceTotal) * Constraint._torqueDampen * bodyB.inverseInertia * (1 - constraint.angularStiffness);
            bodyB.constraintImpulse.angle += torque;
            bodyB.angle += torque;
        }

    };

    /**
     * Performs body updates required after solving constraints.
     * @private
     * @method postSolveAll
     * @param {body[]} bodies
     */
    Constraint.postSolveAll = function(bodies) {
        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i],
                impulse = body.constraintImpulse;

            if (body.isStatic || (impulse.x === 0 && impulse.y === 0 && impulse.angle === 0)) {
                continue;
            }

            Sleeping.set(body, false);

            // update geometry and reset
            for (var j = 0; j < body.parts.length; j++) {
                var part = body.parts[j];
                
                Vertices.translate(part.vertices, impulse);

                if (j > 0) {
                    part.position.x += impulse.x;
                    part.position.y += impulse.y;
                }

                if (impulse.angle !== 0) {
                    Vertices.rotate(part.vertices, impulse.angle, body.position);
                    Axes.rotate(part.axes, impulse.angle);
                    if (j > 0) {
                        Vector.rotateAbout(part.position, impulse.angle, body.position, part.position);
                    }
                }

                Bounds.update(part.bounds, part.vertices, body.velocity);
            }

            // dampen the cached impulse for warming next step
            impulse.angle *= Constraint._warming;
            impulse.x *= Constraint._warming;
            impulse.y *= Constraint._warming;
        }
    };

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * An integer `Number` uniquely identifying number generated in `Composite.create` by `Common.nextId`.
     *
     * @property id
     * @type number
     */

    /**
     * A `String` denoting the type of object.
     *
     * @property type
     * @type string
     * @default "constraint"
     * @readOnly
     */

    /**
     * An arbitrary `String` name to help the user identify and manage bodies.
     *
     * @property label
     * @type string
     * @default "Constraint"
     */

    /**
     * An `Object` that defines the rendering properties to be consumed by the module `Matter.Render`.
     *
     * @property render
     * @type object
     */

    /**
     * A flag that indicates if the constraint should be rendered.
     *
     * @property render.visible
     * @type boolean
     * @default true
     */

    /**
     * A `Number` that defines the line width to use when rendering the constraint outline.
     * A value of `0` means no outline will be rendered.
     *
     * @property render.lineWidth
     * @type number
     * @default 2
     */

    /**
     * A `String` that defines the stroke style to use when rendering the constraint outline.
     * It is the same as when using a canvas, so it accepts CSS style property values.
     *
     * @property render.strokeStyle
     * @type string
     * @default a random colour
     */

    /**
     * A `String` that defines the constraint rendering type. 
     * The possible values are 'line', 'pin', 'spring'.
     * An appropriate render type will be automatically chosen unless one is given in options.
     *
     * @property render.type
     * @type string
     * @default 'line'
     */

    /**
     * A `Boolean` that defines if the constraint's anchor points should be rendered.
     *
     * @property render.anchors
     * @type boolean
     * @default true
     */

    /**
     * The first possible `Body` that this constraint is attached to.
     *
     * @property bodyA
     * @type body
     * @default null
     */

    /**
     * The second possible `Body` that this constraint is attached to.
     *
     * @property bodyB
     * @type body
     * @default null
     */

    /**
     * A `Vector` that specifies the offset of the constraint from center of the `constraint.bodyA` if defined, otherwise a world-space position.
     *
     * @property pointA
     * @type vector
     * @default { x: 0, y: 0 }
     */

    /**
     * A `Vector` that specifies the offset of the constraint from center of the `constraint.bodyA` if defined, otherwise a world-space position.
     *
     * @property pointB
     * @type vector
     * @default { x: 0, y: 0 }
     */

    /**
     * A `Number` that specifies the stiffness of the constraint, i.e. the rate at which it returns to its resting `constraint.length`.
     * A value of `1` means the constraint should be very stiff.
     * A value of `0.2` means the constraint acts like a soft spring.
     *
     * @property stiffness
     * @type number
     * @default 1
     */

    /**
     * A `Number` that specifies the damping of the constraint, 
     * i.e. the amount of resistance applied to each body based on their velocities to limit the amount of oscillation.
     * Damping will only be apparent when the constraint also has a very low `stiffness`.
     * A value of `0.1` means the constraint will apply heavy damping, resulting in little to no oscillation.
     * A value of `0` means the constraint will apply no damping.
     *
     * @property damping
     * @type number
     * @default 0
     */

    /**
     * A `Number` that specifies the target resting length of the constraint. 
     * It is calculated automatically in `Constraint.create` from initial positions of the `constraint.bodyA` and `constraint.bodyB`.
     *
     * @property length
     * @type number
     */

    /**
     * An object reserved for storing plugin-specific properties.
     *
     * @property plugin
     * @type {}
     */

})();

},{"../core/Common":14,"../core/Sleeping":22,"../geometry/Axes":25,"../geometry/Bounds":26,"../geometry/Vector":28,"../geometry/Vertices":29}],13:[function(_dereq_,module,exports){
/**
* The `Matter.MouseConstraint` module contains methods for creating mouse constraints.
* Mouse constraints are used for allowing user interaction, providing the ability to move bodies via the mouse or touch.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class MouseConstraint
*/

var MouseConstraint = {};

module.exports = MouseConstraint;

var Vertices = _dereq_('../geometry/Vertices');
var Sleeping = _dereq_('../core/Sleeping');
var Mouse = _dereq_('../core/Mouse');
var Events = _dereq_('../core/Events');
var Detector = _dereq_('../collision/Detector');
var Constraint = _dereq_('./Constraint');
var Composite = _dereq_('../body/Composite');
var Common = _dereq_('../core/Common');
var Bounds = _dereq_('../geometry/Bounds');

(function() {

    /**
     * Creates a new mouse constraint.
     * All properties have default values, and many are pre-calculated automatically based on other properties.
     * See the properties section below for detailed information on what you can pass via the `options` object.
     * @method create
     * @param {engine} engine
     * @param {} options
     * @return {MouseConstraint} A new MouseConstraint
     */
    MouseConstraint.create = function(engine, options) {
        var mouse = (engine ? engine.mouse : null) || (options ? options.mouse : null);

        if (!mouse) {
            if (engine && engine.render && engine.render.canvas) {
                mouse = Mouse.create(engine.render.canvas);
            } else if (options && options.element) {
                mouse = Mouse.create(options.element);
            } else {
                mouse = Mouse.create();
                Common.warn('MouseConstraint.create: options.mouse was undefined, options.element was undefined, may not function as expected');
            }
        }

        var constraint = Constraint.create({ 
            label: 'Mouse Constraint',
            pointA: mouse.position,
            pointB: { x: 0, y: 0 },
            length: 0.01, 
            stiffness: 0.1,
            angularStiffness: 1,
            render: {
                strokeStyle: '#90EE90',
                lineWidth: 3
            }
        });

        var defaults = {
            type: 'mouseConstraint',
            mouse: mouse,
            element: null,
            body: null,
            constraint: constraint,
            collisionFilter: {
                category: 0x0001,
                mask: 0xFFFFFFFF,
                group: 0
            }
        };

        var mouseConstraint = Common.extend(defaults, options);

        Events.on(engine, 'beforeUpdate', function() {
            var allBodies = Composite.allBodies(engine.world);
            MouseConstraint.update(mouseConstraint, allBodies);
            _triggerEvents(mouseConstraint);
        });

        return mouseConstraint;
    };

    /**
     * Updates the given mouse constraint.
     * @private
     * @method update
     * @param {MouseConstraint} mouseConstraint
     * @param {body[]} bodies
     */
    MouseConstraint.update = function(mouseConstraint, bodies) {
        var mouse = mouseConstraint.mouse,
            constraint = mouseConstraint.constraint,
            body = mouseConstraint.body;

        if (mouse.button === 0) {
            if (!constraint.bodyB) {
                for (var i = 0; i < bodies.length; i++) {
                    body = bodies[i];
                    if (Bounds.contains(body.bounds, mouse.position) 
                            && Detector.canCollide(body.collisionFilter, mouseConstraint.collisionFilter)) {
                        for (var j = body.parts.length > 1 ? 1 : 0; j < body.parts.length; j++) {
                            var part = body.parts[j];
                            if (Vertices.contains(part.vertices, mouse.position)) {
                                constraint.pointA = mouse.position;
                                constraint.bodyB = mouseConstraint.body = body;
                                constraint.pointB = { x: mouse.position.x - body.position.x, y: mouse.position.y - body.position.y };
                                constraint.angleB = body.angle;

                                Sleeping.set(body, false);
                                Events.trigger(mouseConstraint, 'startdrag', { mouse: mouse, body: body });

                                break;
                            }
                        }
                    }
                }
            } else {
                Sleeping.set(constraint.bodyB, false);
                constraint.pointA = mouse.position;
            }
        } else {
            constraint.bodyB = mouseConstraint.body = null;
            constraint.pointB = null;

            if (body)
                Events.trigger(mouseConstraint, 'enddrag', { mouse: mouse, body: body });
        }
    };

    /**
     * Triggers mouse constraint events.
     * @method _triggerEvents
     * @private
     * @param {mouse} mouseConstraint
     */
    var _triggerEvents = function(mouseConstraint) {
        var mouse = mouseConstraint.mouse,
            mouseEvents = mouse.sourceEvents;

        if (mouseEvents.mousemove)
            Events.trigger(mouseConstraint, 'mousemove', { mouse: mouse });

        if (mouseEvents.mousedown)
            Events.trigger(mouseConstraint, 'mousedown', { mouse: mouse });

        if (mouseEvents.mouseup)
            Events.trigger(mouseConstraint, 'mouseup', { mouse: mouse });

        // reset the mouse state ready for the next step
        Mouse.clearSourceEvents(mouse);
    };

    /*
    *
    *  Events Documentation
    *
    */

    /**
    * Fired when the mouse has moved (or a touch moves) during the last step
    *
    * @event mousemove
    * @param {} event An event object
    * @param {mouse} event.mouse The engine's mouse instance
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when the mouse is down (or a touch has started) during the last step
    *
    * @event mousedown
    * @param {} event An event object
    * @param {mouse} event.mouse The engine's mouse instance
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when the mouse is up (or a touch has ended) during the last step
    *
    * @event mouseup
    * @param {} event An event object
    * @param {mouse} event.mouse The engine's mouse instance
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when the user starts dragging a body
    *
    * @event startdrag
    * @param {} event An event object
    * @param {mouse} event.mouse The engine's mouse instance
    * @param {body} event.body The body being dragged
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired when the user ends dragging a body
    *
    * @event enddrag
    * @param {} event An event object
    * @param {mouse} event.mouse The engine's mouse instance
    * @param {body} event.body The body that has stopped being dragged
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * A `String` denoting the type of object.
     *
     * @property type
     * @type string
     * @default "constraint"
     * @readOnly
     */

    /**
     * The `Mouse` instance in use. If not supplied in `MouseConstraint.create`, one will be created.
     *
     * @property mouse
     * @type mouse
     * @default mouse
     */

    /**
     * The `Body` that is currently being moved by the user, or `null` if no body.
     *
     * @property body
     * @type body
     * @default null
     */

    /**
     * The `Constraint` object that is used to move the body during interaction.
     *
     * @property constraint
     * @type constraint
     */

    /**
     * An `Object` that specifies the collision filter properties.
     * The collision filter allows the user to define which types of body this mouse constraint can interact with.
     * See `body.collisionFilter` for more information.
     *
     * @property collisionFilter
     * @type object
     */

})();

},{"../body/Composite":2,"../collision/Detector":5,"../core/Common":14,"../core/Events":16,"../core/Mouse":19,"../core/Sleeping":22,"../geometry/Bounds":26,"../geometry/Vertices":29,"./Constraint":12}],14:[function(_dereq_,module,exports){
/**
* The `Matter.Common` module contains utility functions that are common to all modules.
*
* @class Common
*/

var Common = {};

module.exports = Common;

(function() {

    Common._nextId = 0;
    Common._seed = 0;
    Common._nowStartTime = +(new Date());

    /**
     * Extends the object in the first argument using the object in the second argument.
     * @method extend
     * @param {} obj
     * @param {boolean} deep
     * @return {} obj extended
     */
    Common.extend = function(obj, deep) {
        var argsStart,
            args,
            deepClone;

        if (typeof deep === 'boolean') {
            argsStart = 2;
            deepClone = deep;
        } else {
            argsStart = 1;
            deepClone = true;
        }

        for (var i = argsStart; i < arguments.length; i++) {
            var source = arguments[i];

            if (source) {
                for (var prop in source) {
                    if (deepClone && source[prop] && source[prop].constructor === Object) {
                        if (!obj[prop] || obj[prop].constructor === Object) {
                            obj[prop] = obj[prop] || {};
                            Common.extend(obj[prop], deepClone, source[prop]);
                        } else {
                            obj[prop] = source[prop];
                        }
                    } else {
                        obj[prop] = source[prop];
                    }
                }
            }
        }
        
        return obj;
    };

    /**
     * Creates a new clone of the object, if deep is true references will also be cloned.
     * @method clone
     * @param {} obj
     * @param {bool} deep
     * @return {} obj cloned
     */
    Common.clone = function(obj, deep) {
        return Common.extend({}, deep, obj);
    };

    /**
     * Returns the list of keys for the given object.
     * @method keys
     * @param {} obj
     * @return {string[]} keys
     */
    Common.keys = function(obj) {
        if (Object.keys)
            return Object.keys(obj);

        // avoid hasOwnProperty for performance
        var keys = [];
        for (var key in obj)
            keys.push(key);
        return keys;
    };

    /**
     * Returns the list of values for the given object.
     * @method values
     * @param {} obj
     * @return {array} Array of the objects property values
     */
    Common.values = function(obj) {
        var values = [];
        
        if (Object.keys) {
            var keys = Object.keys(obj);
            for (var i = 0; i < keys.length; i++) {
                values.push(obj[keys[i]]);
            }
            return values;
        }
        
        // avoid hasOwnProperty for performance
        for (var key in obj)
            values.push(obj[key]);
        return values;
    };

    /**
     * Gets a value from `base` relative to the `path` string.
     * @method get
     * @param {} obj The base object
     * @param {string} path The path relative to `base`, e.g. 'Foo.Bar.baz'
     * @param {number} [begin] Path slice begin
     * @param {number} [end] Path slice end
     * @return {} The object at the given path
     */
    Common.get = function(obj, path, begin, end) {
        path = path.split('.').slice(begin, end);

        for (var i = 0; i < path.length; i += 1) {
            obj = obj[path[i]];
        }

        return obj;
    };

    /**
     * Sets a value on `base` relative to the given `path` string.
     * @method set
     * @param {} obj The base object
     * @param {string} path The path relative to `base`, e.g. 'Foo.Bar.baz'
     * @param {} val The value to set
     * @param {number} [begin] Path slice begin
     * @param {number} [end] Path slice end
     * @return {} Pass through `val` for chaining
     */
    Common.set = function(obj, path, val, begin, end) {
        var parts = path.split('.').slice(begin, end);
        Common.get(obj, path, 0, -1)[parts[parts.length - 1]] = val;
        return val;
    };

    /**
     * Shuffles the given array in-place.
     * The function uses a seeded random generator.
     * @method shuffle
     * @param {array} array
     * @return {array} array shuffled randomly
     */
    Common.shuffle = function(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Common.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    };

    /**
     * Randomly chooses a value from a list with equal probability.
     * The function uses a seeded random generator.
     * @method choose
     * @param {array} choices
     * @return {object} A random choice object from the array
     */
    Common.choose = function(choices) {
        return choices[Math.floor(Common.random() * choices.length)];
    };

    /**
     * Returns true if the object is a HTMLElement, otherwise false.
     * @method isElement
     * @param {object} obj
     * @return {boolean} True if the object is a HTMLElement, otherwise false
     */
    Common.isElement = function(obj) {
        return obj instanceof HTMLElement;
    };

    /**
     * Returns true if the object is an array.
     * @method isArray
     * @param {object} obj
     * @return {boolean} True if the object is an array, otherwise false
     */
    Common.isArray = function(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    };

    /**
     * Returns true if the object is a function.
     * @method isFunction
     * @param {object} obj
     * @return {boolean} True if the object is a function, otherwise false
     */
    Common.isFunction = function(obj) {
        return typeof obj === "function";
    };

    /**
     * Returns true if the object is a plain object.
     * @method isPlainObject
     * @param {object} obj
     * @return {boolean} True if the object is a plain object, otherwise false
     */
    Common.isPlainObject = function(obj) {
        return typeof obj === 'object' && obj.constructor === Object;
    };

    /**
     * Returns true if the object is a string.
     * @method isString
     * @param {object} obj
     * @return {boolean} True if the object is a string, otherwise false
     */
    Common.isString = function(obj) {
        return toString.call(obj) === '[object String]';
    };
    
    /**
     * Returns the given value clamped between a minimum and maximum value.
     * @method clamp
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @return {number} The value clamped between min and max inclusive
     */
    Common.clamp = function(value, min, max) {
        if (value < min)
            return min;
        if (value > max)
            return max;
        return value;
    };
    
    /**
     * Returns the sign of the given value.
     * @method sign
     * @param {number} value
     * @return {number} -1 if negative, +1 if 0 or positive
     */
    Common.sign = function(value) {
        return value < 0 ? -1 : 1;
    };
    
    /**
     * Returns the current timestamp since the time origin (e.g. from page load).
     * The result will be high-resolution including decimal places if available.
     * @method now
     * @return {number} the current timestamp
     */
    Common.now = function() {
        if (window.performance) {
            if (window.performance.now) {
                return window.performance.now();
            } else if (window.performance.webkitNow) {
                return window.performance.webkitNow();
            }
        }

        return (new Date()) - Common._nowStartTime;
    };
    
    /**
     * Returns a random value between a minimum and a maximum value inclusive.
     * The function uses a seeded random generator.
     * @method random
     * @param {number} min
     * @param {number} max
     * @return {number} A random number between min and max inclusive
     */
    Common.random = function(min, max) {
        min = (typeof min !== "undefined") ? min : 0;
        max = (typeof max !== "undefined") ? max : 1;
        return min + _seededRandom() * (max - min);
    };

    var _seededRandom = function() {
        // https://en.wikipedia.org/wiki/Linear_congruential_generator
        Common._seed = (Common._seed * 9301 + 49297) % 233280;
        return Common._seed / 233280;
    };

    /**
     * Converts a CSS hex colour string into an integer.
     * @method colorToNumber
     * @param {string} colorString
     * @return {number} An integer representing the CSS hex string
     */
    Common.colorToNumber = function(colorString) {
        colorString = colorString.replace('#','');

        if (colorString.length == 3) {
            colorString = colorString.charAt(0) + colorString.charAt(0)
                        + colorString.charAt(1) + colorString.charAt(1)
                        + colorString.charAt(2) + colorString.charAt(2);
        }

        return parseInt(colorString, 16);
    };

    /**
     * The console logging level to use, where each level includes all levels above and excludes the levels below.
     * The default level is 'debug' which shows all console messages.  
     *
     * Possible level values are:
     * - 0 = None
     * - 1 = Debug
     * - 2 = Info
     * - 3 = Warn
     * - 4 = Error
     * @property Common.logLevel
     * @type {Number}
     * @default 1
     */
    Common.logLevel = 1;

    /**
     * Shows a `console.log` message only if the current `Common.logLevel` allows it.
     * The message will be prefixed with 'matter-js' to make it easily identifiable.
     * @method log
     * @param ...objs {} The objects to log.
     */
    Common.log = function() {
        if (console && Common.logLevel > 0 && Common.logLevel <= 3) {
            console.log.apply(console, ['matter-js:'].concat(Array.prototype.slice.call(arguments)));
        }
    };

    /**
     * Shows a `console.info` message only if the current `Common.logLevel` allows it.
     * The message will be prefixed with 'matter-js' to make it easily identifiable.
     * @method info
     * @param ...objs {} The objects to log.
     */
    Common.info = function() {
        if (console && Common.logLevel > 0 && Common.logLevel <= 2) {
            console.info.apply(console, ['matter-js:'].concat(Array.prototype.slice.call(arguments)));
        }
    };

    /**
     * Shows a `console.warn` message only if the current `Common.logLevel` allows it.
     * The message will be prefixed with 'matter-js' to make it easily identifiable.
     * @method warn
     * @param ...objs {} The objects to log.
     */
    Common.warn = function() {
        if (console && Common.logLevel > 0 && Common.logLevel <= 3) {
            console.warn.apply(console, ['matter-js:'].concat(Array.prototype.slice.call(arguments)));
        }
    };

    /**
     * Returns the next unique sequential ID.
     * @method nextId
     * @return {Number} Unique sequential ID
     */
    Common.nextId = function() {
        return Common._nextId++;
    };

    /**
     * A cross browser compatible indexOf implementation.
     * @method indexOf
     * @param {array} haystack
     * @param {object} needle
     * @return {number} The position of needle in haystack, otherwise -1.
     */
    Common.indexOf = function(haystack, needle) {
        if (haystack.indexOf)
            return haystack.indexOf(needle);

        for (var i = 0; i < haystack.length; i++) {
            if (haystack[i] === needle)
                return i;
        }

        return -1;
    };

    /**
     * A cross browser compatible array map implementation.
     * @method map
     * @param {array} list
     * @param {function} func
     * @return {array} Values from list transformed by func.
     */
    Common.map = function(list, func) {
        if (list.map) {
            return list.map(func);
        }

        var mapped = [];

        for (var i = 0; i < list.length; i += 1) {
            mapped.push(func(list[i]));
        }

        return mapped;
    };

    /**
     * Takes a directed graph and returns the partially ordered set of vertices in topological order.
     * Circular dependencies are allowed.
     * @method topologicalSort
     * @param {object} graph
     * @return {array} Partially ordered set of vertices in topological order.
     */
    Common.topologicalSort = function(graph) {
        // https://github.com/mgechev/javascript-algorithms
        // Copyright (c) Minko Gechev (MIT license)
        // Modifications: tidy formatting and naming
        var result = [],
            visited = [],
            temp = [];

        for (var node in graph) {
            if (!visited[node] && !temp[node]) {
                _topologicalSort(node, visited, temp, graph, result);
            }
        }

        return result;
    };

    var _topologicalSort = function(node, visited, temp, graph, result) {
        var neighbors = graph[node] || [];
        temp[node] = true;

        for (var i = 0; i < neighbors.length; i += 1) {
            var neighbor = neighbors[i];

            if (temp[neighbor]) {
                // skip circular dependencies
                continue;
            }

            if (!visited[neighbor]) {
                _topologicalSort(neighbor, visited, temp, graph, result);
            }
        }

        temp[node] = false;
        visited[node] = true;

        result.push(node);
    };

    /**
     * Takes _n_ functions as arguments and returns a new function that calls them in order.
     * The arguments applied when calling the new function will also be applied to every function passed.
     * The value of `this` refers to the last value returned in the chain that was not `undefined`.
     * Therefore if a passed function does not return a value, the previously returned value is maintained.
     * After all passed functions have been called the new function returns the last returned value (if any).
     * If any of the passed functions are a chain, then the chain will be flattened.
     * @method chain
     * @param ...funcs {function} The functions to chain.
     * @return {function} A new function that calls the passed functions in order.
     */
    Common.chain = function() {
        var funcs = [];

        for (var i = 0; i < arguments.length; i += 1) {
            var func = arguments[i];

            if (func._chained) {
                // flatten already chained functions
                funcs.push.apply(funcs, func._chained);
            } else {
                funcs.push(func);
            }
        }

        var chain = function() {
            // https://github.com/GoogleChrome/devtools-docs/issues/53#issuecomment-51941358
            var lastResult,
                args = new Array(arguments.length);

            for (var i = 0, l = arguments.length; i < l; i++) {
                args[i] = arguments[i];
            }

            for (i = 0; i < funcs.length; i += 1) {
                var result = funcs[i].apply(lastResult, args);

                if (typeof result !== 'undefined') {
                    lastResult = result;
                }
            }

            return lastResult;
        };

        chain._chained = funcs;

        return chain;
    };

    /**
     * Chains a function to excute before the original function on the given `path` relative to `base`.
     * See also docs for `Common.chain`.
     * @method chainPathBefore
     * @param {} base The base object
     * @param {string} path The path relative to `base`
     * @param {function} func The function to chain before the original
     * @return {function} The chained function that replaced the original
     */
    Common.chainPathBefore = function(base, path, func) {
        return Common.set(base, path, Common.chain(
            func,
            Common.get(base, path)
        ));
    };

    /**
     * Chains a function to excute after the original function on the given `path` relative to `base`.
     * See also docs for `Common.chain`.
     * @method chainPathAfter
     * @param {} base The base object
     * @param {string} path The path relative to `base`
     * @param {function} func The function to chain after the original
     * @return {function} The chained function that replaced the original
     */
    Common.chainPathAfter = function(base, path, func) {
        return Common.set(base, path, Common.chain(
            Common.get(base, path),
            func
        ));
    };

})();

},{}],15:[function(_dereq_,module,exports){
/**
* The `Matter.Engine` module contains methods for creating and manipulating engines.
* An engine is a controller that manages updating the simulation of the world.
* See `Matter.Runner` for an optional game loop utility.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Engine
*/

var Engine = {};

module.exports = Engine;

var World = _dereq_('../body/World');
var Sleeping = _dereq_('./Sleeping');
var Resolver = _dereq_('../collision/Resolver');
var Render = _dereq_('../render/Render');
var Pairs = _dereq_('../collision/Pairs');
var Metrics = _dereq_('./Metrics');
var Grid = _dereq_('../collision/Grid');
var Events = _dereq_('./Events');
var Composite = _dereq_('../body/Composite');
var Constraint = _dereq_('../constraint/Constraint');
var Common = _dereq_('./Common');
var Body = _dereq_('../body/Body');

(function() {

    /**
     * Creates a new engine. The options parameter is an object that specifies any properties you wish to override the defaults.
     * All properties have default values, and many are pre-calculated automatically based on other properties.
     * See the properties section below for detailed information on what you can pass via the `options` object.
     * @method create
     * @param {object} [options]
     * @return {engine} engine
     */
    Engine.create = function(element, options) {
        // options may be passed as the first (and only) argument
        options = Common.isElement(element) ? options : element;
        element = Common.isElement(element) ? element : null;
        options = options || {};

        if (element || options.render) {
            Common.warn('Engine.create: engine.render is deprecated (see docs)');
        }

        var defaults = {
            positionIterations: 6,
            velocityIterations: 4,
            constraintIterations: 2,
            enableSleeping: false,
            events: [],
            plugin: {},
            timing: {
                timestamp: 0,
                timeScale: 1
            },
            broadphase: {
                controller: Grid
            }
        };

        var engine = Common.extend(defaults, options);

        // @deprecated
        if (element || engine.render) {
            var renderDefaults = {
                element: element,
                controller: Render
            };
            
            engine.render = Common.extend(renderDefaults, engine.render);
        }

        // @deprecated
        if (engine.render && engine.render.controller) {
            engine.render = engine.render.controller.create(engine.render);
        }

        // @deprecated
        if (engine.render) {
            engine.render.engine = engine;
        }

        engine.world = options.world || World.create(engine.world);
        engine.pairs = Pairs.create();
        engine.broadphase = engine.broadphase.controller.create(engine.broadphase);
        engine.metrics = engine.metrics || { extended: false };


        return engine;
    };

    /**
     * Moves the simulation forward in time by `delta` ms.
     * The `correction` argument is an optional `Number` that specifies the time correction factor to apply to the update.
     * This can help improve the accuracy of the simulation in cases where `delta` is changing between updates.
     * The value of `correction` is defined as `delta / lastDelta`, i.e. the percentage change of `delta` over the last step.
     * Therefore the value is always `1` (no correction) when `delta` constant (or when no correction is desired, which is the default).
     * See the paper on <a href="http://lonesock.net/article/verlet.html">Time Corrected Verlet</a> for more information.
     *
     * Triggers `beforeUpdate` and `afterUpdate` events.
     * Triggers `collisionStart`, `collisionActive` and `collisionEnd` events.
     * @method update
     * @param {engine} engine
     * @param {number} [delta=16.666]
     * @param {number} [correction=1]
     */
    Engine.update = function(engine, delta, correction) {
        delta = delta || 1000 / 60;
        correction = correction || 1;

        var world = engine.world,
            timing = engine.timing,
            broadphase = engine.broadphase,
            broadphasePairs = [],
            i;

        // increment timestamp
        timing.timestamp += delta * timing.timeScale;

        // create an event object
        var event = {
            timestamp: timing.timestamp
        };

        Events.trigger(engine, 'beforeUpdate', event);

        // get lists of all bodies and constraints, no matter what composites they are in
        var allBodies = Composite.allBodies(world),
            allConstraints = Composite.allConstraints(world);


        // if sleeping enabled, call the sleeping controller
        if (engine.enableSleeping)
            Sleeping.update(allBodies, timing.timeScale);

        // applies gravity to all bodies
        _bodiesApplyGravity(allBodies, world.gravity);

        // update all body position and rotation by integration
        _bodiesUpdate(allBodies, delta, timing.timeScale, correction, world.bounds);

        // update all constraints (first pass)
        Constraint.preSolveAll(allBodies);
        for (i = 0; i < engine.constraintIterations; i++) {
            Constraint.solveAll(allConstraints, timing.timeScale);
        }
        Constraint.postSolveAll(allBodies);

        // broadphase pass: find potential collision pairs
        if (broadphase.controller) {
            // if world is dirty, we must flush the whole grid
            if (world.isModified)
                broadphase.controller.clear(broadphase);

            // update the grid buckets based on current bodies
            broadphase.controller.update(broadphase, allBodies, engine, world.isModified);
            broadphasePairs = broadphase.pairsList;
        } else {
            // if no broadphase set, we just pass all bodies
            broadphasePairs = allBodies;
        }

        // clear all composite modified flags
        if (world.isModified) {
            Composite.setModified(world, false, false, true);
        }

        // narrowphase pass: find actual collisions, then create or update collision pairs
        var collisions = broadphase.detector(broadphasePairs, engine);

        // update collision pairs
        var pairs = engine.pairs,
            timestamp = timing.timestamp;
        Pairs.update(pairs, collisions, timestamp);
        Pairs.removeOld(pairs, timestamp);

        // wake up bodies involved in collisions
        if (engine.enableSleeping)
            Sleeping.afterCollisions(pairs.list, timing.timeScale);

        // trigger collision events
        if (pairs.collisionStart.length > 0)
            Events.trigger(engine, 'collisionStart', { pairs: pairs.collisionStart });

        // iteratively resolve position between collisions
        Resolver.preSolvePosition(pairs.list);
        for (i = 0; i < engine.positionIterations; i++) {
            Resolver.solvePosition(pairs.list, timing.timeScale);
        }
        Resolver.postSolvePosition(allBodies);

        // update all constraints (second pass)
        Constraint.preSolveAll(allBodies);
        for (i = 0; i < engine.constraintIterations; i++) {
            Constraint.solveAll(allConstraints, timing.timeScale);
        }
        Constraint.postSolveAll(allBodies);

        // iteratively resolve velocity between collisions
        Resolver.preSolveVelocity(pairs.list);
        for (i = 0; i < engine.velocityIterations; i++) {
            Resolver.solveVelocity(pairs.list, timing.timeScale);
        }

        // trigger collision events
        if (pairs.collisionActive.length > 0)
            Events.trigger(engine, 'collisionActive', { pairs: pairs.collisionActive });

        if (pairs.collisionEnd.length > 0)
            Events.trigger(engine, 'collisionEnd', { pairs: pairs.collisionEnd });


        // clear force buffers
        _bodiesClearForces(allBodies);

        Events.trigger(engine, 'afterUpdate', event);

        return engine;
    };
    
    /**
     * Merges two engines by keeping the configuration of `engineA` but replacing the world with the one from `engineB`.
     * @method merge
     * @param {engine} engineA
     * @param {engine} engineB
     */
    Engine.merge = function(engineA, engineB) {
        Common.extend(engineA, engineB);
        
        if (engineB.world) {
            engineA.world = engineB.world;

            Engine.clear(engineA);

            var bodies = Composite.allBodies(engineA.world);

            for (var i = 0; i < bodies.length; i++) {
                var body = bodies[i];
                Sleeping.set(body, false);
                body.id = Common.nextId();
            }
        }
    };

    /**
     * Clears the engine including the world, pairs and broadphase.
     * @method clear
     * @param {engine} engine
     */
    Engine.clear = function(engine) {
        var world = engine.world;
        
        Pairs.clear(engine.pairs);

        var broadphase = engine.broadphase;
        if (broadphase.controller) {
            var bodies = Composite.allBodies(world);
            broadphase.controller.clear(broadphase);
            broadphase.controller.update(broadphase, bodies, engine, true);
        }
    };

    /**
     * Zeroes the `body.force` and `body.torque` force buffers.
     * @method bodiesClearForces
     * @private
     * @param {body[]} bodies
     */
    var _bodiesClearForces = function(bodies) {
        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];

            // reset force buffers
            body.force.x = 0;
            body.force.y = 0;
            body.torque = 0;
        }
    };

    /**
     * Applys a mass dependant force to all given bodies.
     * @method bodiesApplyGravity
     * @private
     * @param {body[]} bodies
     * @param {vector} gravity
     */
    var _bodiesApplyGravity = function(bodies, gravity) {
        var gravityScale = typeof gravity.scale !== 'undefined' ? gravity.scale : 0.001;

        if ((gravity.x === 0 && gravity.y === 0) || gravityScale === 0) {
            return;
        }
        
        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];

            if (body.isStatic || body.isSleeping)
                continue;

            // apply gravity
            body.force.y += body.mass * gravity.y * gravityScale;
            body.force.x += body.mass * gravity.x * gravityScale;
        }
    };

    /**
     * Applys `Body.update` to all given `bodies`.
     * @method updateAll
     * @private
     * @param {body[]} bodies
     * @param {number} deltaTime 
     * The amount of time elapsed between updates
     * @param {number} timeScale
     * @param {number} correction 
     * The Verlet correction factor (deltaTime / lastDeltaTime)
     * @param {bounds} worldBounds
     */
    var _bodiesUpdate = function(bodies, deltaTime, timeScale, correction, worldBounds) {
        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];

            if (body.isStatic || body.isSleeping)
                continue;

            Body.update(body, deltaTime, timeScale, correction);
        }
    };

    /**
     * An alias for `Runner.run`, see `Matter.Runner` for more information.
     * @method run
     * @param {engine} engine
     */

    /**
    * Fired just before an update
    *
    * @event beforeUpdate
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired after engine update and all collision events
    *
    * @event afterUpdate
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired after engine update, provides a list of all pairs that have started to collide in the current tick (if any)
    *
    * @event collisionStart
    * @param {} event An event object
    * @param {} event.pairs List of affected pairs
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired after engine update, provides a list of all pairs that are colliding in the current tick (if any)
    *
    * @event collisionActive
    * @param {} event An event object
    * @param {} event.pairs List of affected pairs
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired after engine update, provides a list of all pairs that have ended collision in the current tick (if any)
    *
    * @event collisionEnd
    * @param {} event An event object
    * @param {} event.pairs List of affected pairs
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * An integer `Number` that specifies the number of position iterations to perform each update.
     * The higher the value, the higher quality the simulation will be at the expense of performance.
     *
     * @property positionIterations
     * @type number
     * @default 6
     */

    /**
     * An integer `Number` that specifies the number of velocity iterations to perform each update.
     * The higher the value, the higher quality the simulation will be at the expense of performance.
     *
     * @property velocityIterations
     * @type number
     * @default 4
     */

    /**
     * An integer `Number` that specifies the number of constraint iterations to perform each update.
     * The higher the value, the higher quality the simulation will be at the expense of performance.
     * The default value of `2` is usually very adequate.
     *
     * @property constraintIterations
     * @type number
     * @default 2
     */

    /**
     * A flag that specifies whether the engine should allow sleeping via the `Matter.Sleeping` module.
     * Sleeping can improve stability and performance, but often at the expense of accuracy.
     *
     * @property enableSleeping
     * @type boolean
     * @default false
     */

    /**
     * An `Object` containing properties regarding the timing systems of the engine. 
     *
     * @property timing
     * @type object
     */

    /**
     * A `Number` that specifies the global scaling factor of time for all bodies.
     * A value of `0` freezes the simulation.
     * A value of `0.1` gives a slow-motion effect.
     * A value of `1.2` gives a speed-up effect.
     *
     * @property timing.timeScale
     * @type number
     * @default 1
     */

    /**
     * A `Number` that specifies the current simulation-time in milliseconds starting from `0`. 
     * It is incremented on every `Engine.update` by the given `delta` argument. 
     *
     * @property timing.timestamp
     * @type number
     * @default 0
     */

    /**
     * An instance of a `Render` controller. The default value is a `Matter.Render` instance created by `Engine.create`.
     * One may also develop a custom renderer module based on `Matter.Render` and pass an instance of it to `Engine.create` via `options.render`.
     *
     * A minimal custom renderer object must define at least three functions: `create`, `clear` and `world` (see `Matter.Render`).
     * It is also possible to instead pass the _module_ reference via `options.render.controller` and `Engine.create` will instantiate one for you.
     *
     * @property render
     * @type render
     * @deprecated see Demo.js for an example of creating a renderer
     * @default a Matter.Render instance
     */

    /**
     * An instance of a broadphase controller. The default value is a `Matter.Grid` instance created by `Engine.create`.
     *
     * @property broadphase
     * @type grid
     * @default a Matter.Grid instance
     */

    /**
     * A `World` composite object that will contain all simulated bodies and constraints.
     *
     * @property world
     * @type world
     * @default a Matter.World instance
     */

    /**
     * An object reserved for storing plugin-specific properties.
     *
     * @property plugin
     * @type {}
     */

})();

},{"../body/Body":1,"../body/Composite":2,"../body/World":3,"../collision/Grid":6,"../collision/Pairs":8,"../collision/Resolver":10,"../constraint/Constraint":12,"../render/Render":31,"./Common":14,"./Events":16,"./Metrics":18,"./Sleeping":22}],16:[function(_dereq_,module,exports){
/**
* The `Matter.Events` module contains methods to fire and listen to events on other objects.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Events
*/

var Events = {};

module.exports = Events;

var Common = _dereq_('./Common');

(function() {

    /**
     * Subscribes a callback function to the given object's `eventName`.
     * @method on
     * @param {} object
     * @param {string} eventNames
     * @param {function} callback
     */
    Events.on = function(object, eventNames, callback) {
        var names = eventNames.split(' '),
            name;

        for (var i = 0; i < names.length; i++) {
            name = names[i];
            object.events = object.events || {};
            object.events[name] = object.events[name] || [];
            object.events[name].push(callback);
        }

        return callback;
    };

    /**
     * Removes the given event callback. If no callback, clears all callbacks in `eventNames`. If no `eventNames`, clears all events.
     * @method off
     * @param {} object
     * @param {string} eventNames
     * @param {function} callback
     */
    Events.off = function(object, eventNames, callback) {
        if (!eventNames) {
            object.events = {};
            return;
        }

        // handle Events.off(object, callback)
        if (typeof eventNames === 'function') {
            callback = eventNames;
            eventNames = Common.keys(object.events).join(' ');
        }

        var names = eventNames.split(' ');

        for (var i = 0; i < names.length; i++) {
            var callbacks = object.events[names[i]],
                newCallbacks = [];

            if (callback && callbacks) {
                for (var j = 0; j < callbacks.length; j++) {
                    if (callbacks[j] !== callback)
                        newCallbacks.push(callbacks[j]);
                }
            }

            object.events[names[i]] = newCallbacks;
        }
    };

    /**
     * Fires all the callbacks subscribed to the given object's `eventName`, in the order they subscribed, if any.
     * @method trigger
     * @param {} object
     * @param {string} eventNames
     * @param {} event
     */
    Events.trigger = function(object, eventNames, event) {
        var names,
            name,
            callbacks,
            eventClone;

        if (object.events) {
            if (!event)
                event = {};

            names = eventNames.split(' ');

            for (var i = 0; i < names.length; i++) {
                name = names[i];
                callbacks = object.events[name];

                if (callbacks) {
                    eventClone = Common.clone(event, false);
                    eventClone.name = name;
                    eventClone.source = object;

                    for (var j = 0; j < callbacks.length; j++) {
                        callbacks[j].apply(object, [eventClone]);
                    }
                }
            }
        }
    };

})();

},{"./Common":14}],17:[function(_dereq_,module,exports){
/**
* The `Matter` module is the top level namespace. It also includes a function for installing plugins on top of the library.
*
* @class Matter
*/

var Matter = {};

module.exports = Matter;

var Plugin = _dereq_('./Plugin');
var Common = _dereq_('./Common');

(function() {

    /**
     * The library name.
     * @property name
     * @readOnly
     * @type {String}
     */
    Matter.name = 'matter-js';

    /**
     * The library version.
     * @property version
     * @readOnly
     * @type {String}
     */
    Matter.version = '0.13.0';

    /**
     * A list of plugin dependencies to be installed. These are normally set and installed through `Matter.use`.
     * Alternatively you may set `Matter.uses` manually and install them by calling `Plugin.use(Matter)`.
     * @property uses
     * @type {Array}
     */
    Matter.uses = [];

    /**
     * The plugins that have been installed through `Matter.Plugin.install`. Read only.
     * @property used
     * @readOnly
     * @type {Array}
     */
    Matter.used = [];

    /**
     * Installs the given plugins on the `Matter` namespace.
     * This is a short-hand for `Plugin.use`, see it for more information.
     * Call this function once at the start of your code, with all of the plugins you wish to install as arguments.
     * Avoid calling this function multiple times unless you intend to manually control installation order.
     * @method use
     * @param ...plugin {Function} The plugin(s) to install on `base` (multi-argument).
     */
    Matter.use = function() {
        Plugin.use(Matter, Array.prototype.slice.call(arguments));
    };

    /**
     * Chains a function to excute before the original function on the given `path` relative to `Matter`.
     * See also docs for `Common.chain`.
     * @method before
     * @param {string} path The path relative to `Matter`
     * @param {function} func The function to chain before the original
     * @return {function} The chained function that replaced the original
     */
    Matter.before = function(path, func) {
        path = path.replace(/^Matter./, '');
        return Common.chainPathBefore(Matter, path, func);
    };

    /**
     * Chains a function to excute after the original function on the given `path` relative to `Matter`.
     * See also docs for `Common.chain`.
     * @method after
     * @param {string} path The path relative to `Matter`
     * @param {function} func The function to chain after the original
     * @return {function} The chained function that replaced the original
     */
    Matter.after = function(path, func) {
        path = path.replace(/^Matter./, '');
        return Common.chainPathAfter(Matter, path, func);
    };

})();

},{"./Common":14,"./Plugin":20}],18:[function(_dereq_,module,exports){

},{"../body/Composite":2,"./Common":14}],19:[function(_dereq_,module,exports){
/**
* The `Matter.Mouse` module contains methods for creating and manipulating mouse inputs.
*
* @class Mouse
*/

var Mouse = {};

module.exports = Mouse;

var Common = _dereq_('../core/Common');

(function() {

    /**
     * Creates a mouse input.
     * @method create
     * @param {HTMLElement} element
     * @return {mouse} A new mouse
     */
    Mouse.create = function(element) {
        var mouse = {};

        if (!element) {
            Common.log('Mouse.create: element was undefined, defaulting to document.body', 'warn');
        }
        
        mouse.element = element || document.body;
        mouse.absolute = { x: 0, y: 0 };
        mouse.position = { x: 0, y: 0 };
        mouse.mousedownPosition = { x: 0, y: 0 };
        mouse.mouseupPosition = { x: 0, y: 0 };
        mouse.offset = { x: 0, y: 0 };
        mouse.scale = { x: 1, y: 1 };
        mouse.wheelDelta = 0;
        mouse.button = -1;
        mouse.pixelRatio = mouse.element.getAttribute('data-pixel-ratio') || 1;

        mouse.sourceEvents = {
            mousemove: null,
            mousedown: null,
            mouseup: null,
            mousewheel: null
        };
        
        mouse.mousemove = function(event) { 
            var position = _getRelativeMousePosition(event, mouse.element, mouse.pixelRatio),
                touches = event.changedTouches;

            if (touches) {
                mouse.button = 0;
                event.preventDefault();
            }

            mouse.absolute.x = position.x;
            mouse.absolute.y = position.y;
            mouse.position.x = mouse.absolute.x * mouse.scale.x + mouse.offset.x;
            mouse.position.y = mouse.absolute.y * mouse.scale.y + mouse.offset.y;
            mouse.sourceEvents.mousemove = event;
        };
        
        mouse.mousedown = function(event) {
            var position = _getRelativeMousePosition(event, mouse.element, mouse.pixelRatio),
                touches = event.changedTouches;

            if (touches) {
                mouse.button = 0;
                event.preventDefault();
            } else {
                mouse.button = event.button;
            }

            mouse.absolute.x = position.x;
            mouse.absolute.y = position.y;
            mouse.position.x = mouse.absolute.x * mouse.scale.x + mouse.offset.x;
            mouse.position.y = mouse.absolute.y * mouse.scale.y + mouse.offset.y;
            mouse.mousedownPosition.x = mouse.position.x;
            mouse.mousedownPosition.y = mouse.position.y;
            mouse.sourceEvents.mousedown = event;
        };
        
        mouse.mouseup = function(event) {
            var position = _getRelativeMousePosition(event, mouse.element, mouse.pixelRatio),
                touches = event.changedTouches;

            if (touches) {
                event.preventDefault();
            }
            
            mouse.button = -1;
            mouse.absolute.x = position.x;
            mouse.absolute.y = position.y;
            mouse.position.x = mouse.absolute.x * mouse.scale.x + mouse.offset.x;
            mouse.position.y = mouse.absolute.y * mouse.scale.y + mouse.offset.y;
            mouse.mouseupPosition.x = mouse.position.x;
            mouse.mouseupPosition.y = mouse.position.y;
            mouse.sourceEvents.mouseup = event;
        };

        mouse.mousewheel = function(event) {
            mouse.wheelDelta = Math.max(-1, Math.min(1, event.wheelDelta || -event.detail));
            event.preventDefault();
        };

        Mouse.setElement(mouse, mouse.element);

        return mouse;
    };

    /**
     * Sets the element the mouse is bound to (and relative to).
     * @method setElement
     * @param {mouse} mouse
     * @param {HTMLElement} element
     */
    Mouse.setElement = function(mouse, element) {
        mouse.element = element;

        element.addEventListener('mousemove', mouse.mousemove);
        element.addEventListener('mousedown', mouse.mousedown);
        element.addEventListener('mouseup', mouse.mouseup);
        
        element.addEventListener('mousewheel', mouse.mousewheel);
        element.addEventListener('DOMMouseScroll', mouse.mousewheel);

        element.addEventListener('touchmove', mouse.mousemove);
        element.addEventListener('touchstart', mouse.mousedown);
        element.addEventListener('touchend', mouse.mouseup);
    };

    /**
     * Clears all captured source events.
     * @method clearSourceEvents
     * @param {mouse} mouse
     */
    Mouse.clearSourceEvents = function(mouse) {
        mouse.sourceEvents.mousemove = null;
        mouse.sourceEvents.mousedown = null;
        mouse.sourceEvents.mouseup = null;
        mouse.sourceEvents.mousewheel = null;
        mouse.wheelDelta = 0;
    };

    /**
     * Sets the mouse position offset.
     * @method setOffset
     * @param {mouse} mouse
     * @param {vector} offset
     */
    Mouse.setOffset = function(mouse, offset) {
        mouse.offset.x = offset.x;
        mouse.offset.y = offset.y;
        mouse.position.x = mouse.absolute.x * mouse.scale.x + mouse.offset.x;
        mouse.position.y = mouse.absolute.y * mouse.scale.y + mouse.offset.y;
    };

    /**
     * Sets the mouse position scale.
     * @method setScale
     * @param {mouse} mouse
     * @param {vector} scale
     */
    Mouse.setScale = function(mouse, scale) {
        mouse.scale.x = scale.x;
        mouse.scale.y = scale.y;
        mouse.position.x = mouse.absolute.x * mouse.scale.x + mouse.offset.x;
        mouse.position.y = mouse.absolute.y * mouse.scale.y + mouse.offset.y;
    };
    
    /**
     * Gets the mouse position relative to an element given a screen pixel ratio.
     * @method _getRelativeMousePosition
     * @private
     * @param {} event
     * @param {} element
     * @param {number} pixelRatio
     * @return {}
     */
    var _getRelativeMousePosition = function(event, element, pixelRatio) {
        var elementBounds = element.getBoundingClientRect(),
            rootNode = (document.documentElement || document.body.parentNode || document.body),
            scrollX = (window.pageXOffset !== undefined) ? window.pageXOffset : rootNode.scrollLeft,
            scrollY = (window.pageYOffset !== undefined) ? window.pageYOffset : rootNode.scrollTop,
            touches = event.changedTouches,
            x, y;
        
        if (touches) {
            x = touches[0].pageX - elementBounds.left - scrollX;
            y = touches[0].pageY - elementBounds.top - scrollY;
        } else {
            x = event.pageX - elementBounds.left - scrollX;
            y = event.pageY - elementBounds.top - scrollY;
        }

        return { 
            x: x / (element.clientWidth / (element.width || element.clientWidth) * pixelRatio),
            y: y / (element.clientHeight / (element.height || element.clientHeight) * pixelRatio)
        };
    };

})();

},{"../core/Common":14}],20:[function(_dereq_,module,exports){
/**
* The `Matter.Plugin` module contains functions for registering and installing plugins on modules.
*
* @class Plugin
*/

var Plugin = {};

module.exports = Plugin;

var Common = _dereq_('./Common');

(function() {

    Plugin._registry = {};

    /**
     * Registers a plugin object so it can be resolved later by name.
     * @method register
     * @param plugin {} The plugin to register.
     * @return {object} The plugin.
     */
    Plugin.register = function(plugin) {
        if (!Plugin.isPlugin(plugin)) {
            Common.warn('Plugin.register:', Plugin.toString(plugin), 'does not implement all required fields.');
        }

        if (plugin.name in Plugin._registry) {
            var registered = Plugin._registry[plugin.name],
                pluginVersion = Plugin.versionParse(plugin.version).number,
                registeredVersion = Plugin.versionParse(registered.version).number;

            if (pluginVersion > registeredVersion) {
                Common.warn('Plugin.register:', Plugin.toString(registered), 'was upgraded to', Plugin.toString(plugin));
                Plugin._registry[plugin.name] = plugin;
            } else if (pluginVersion < registeredVersion) {
                Common.warn('Plugin.register:', Plugin.toString(registered), 'can not be downgraded to', Plugin.toString(plugin));
            } else if (plugin !== registered) {
                Common.warn('Plugin.register:', Plugin.toString(plugin), 'is already registered to different plugin object');
            }
        } else {
            Plugin._registry[plugin.name] = plugin;
        }

        return plugin;
    };

    /**
     * Resolves a dependency to a plugin object from the registry if it exists. 
     * The `dependency` may contain a version, but only the name matters when resolving.
     * @method resolve
     * @param dependency {string} The dependency.
     * @return {object} The plugin if resolved, otherwise `undefined`.
     */
    Plugin.resolve = function(dependency) {
        return Plugin._registry[Plugin.dependencyParse(dependency).name];
    };

    /**
     * Returns a pretty printed plugin name and version.
     * @method toString
     * @param plugin {} The plugin.
     * @return {string} Pretty printed plugin name and version.
     */
    Plugin.toString = function(plugin) {
        return typeof plugin === 'string' ? plugin : (plugin.name || 'anonymous') + '@' + (plugin.version || plugin.range || '0.0.0');
    };

    /**
     * Returns `true` if the object meets the minimum standard to be considered a plugin.
     * This means it must define the following properties:
     * - `name`
     * - `version`
     * - `install`
     * @method isPlugin
     * @param obj {} The obj to test.
     * @return {boolean} `true` if the object can be considered a plugin otherwise `false`.
     */
    Plugin.isPlugin = function(obj) {
        return obj && obj.name && obj.version && obj.install;
    };

    /**
     * Returns `true` if a plugin with the given `name` been installed on `module`.
     * @method isUsed
     * @param module {} The module.
     * @param name {string} The plugin name.
     * @return {boolean} `true` if a plugin with the given `name` been installed on `module`, otherwise `false`.
     */
    Plugin.isUsed = function(module, name) {
        return module.used.indexOf(name) > -1;
    };

    /**
     * Returns `true` if `plugin.for` is applicable to `module` by comparing against `module.name` and `module.version`.
     * If `plugin.for` is not specified then it is assumed to be applicable.
     * The value of `plugin.for` is a string of the format `'module-name'` or `'module-name@version'`.
     * @method isFor
     * @param plugin {} The plugin.
     * @param module {} The module.
     * @return {boolean} `true` if `plugin.for` is applicable to `module`, otherwise `false`.
     */
    Plugin.isFor = function(plugin, module) {
        var parsed = plugin.for && Plugin.dependencyParse(plugin.for);
        return !plugin.for || (module.name === parsed.name && Plugin.versionSatisfies(module.version, parsed.range));
    };

    /**
     * Installs the plugins by calling `plugin.install` on each plugin specified in `plugins` if passed, otherwise `module.uses`.
     * For installing plugins on `Matter` see the convenience function `Matter.use`.
     * Plugins may be specified either by their name or a reference to the plugin object.
     * Plugins themselves may specify further dependencies, but each plugin is installed only once.
     * Order is important, a topological sort is performed to find the best resulting order of installation.
     * This sorting attempts to satisfy every dependency's requested ordering, but may not be exact in all cases.
     * This function logs the resulting status of each dependency in the console, along with any warnings.
     * - A green tick ✅ indicates a dependency was resolved and installed.
     * - An orange diamond 🔶 indicates a dependency was resolved but a warning was thrown for it or one if its dependencies.
     * - A red cross ❌ indicates a dependency could not be resolved.
     * Avoid calling this function multiple times on the same module unless you intend to manually control installation order.
     * @method use
     * @param module {} The module install plugins on.
     * @param [plugins=module.uses] {} The plugins to install on module (optional, defaults to `module.uses`).
     */
    Plugin.use = function(module, plugins) {
        module.uses = (module.uses || []).concat(plugins || []);

        if (module.uses.length === 0) {
            Common.warn('Plugin.use:', Plugin.toString(module), 'does not specify any dependencies to install.');
            return;
        }

        var dependencies = Plugin.dependencies(module),
            sortedDependencies = Common.topologicalSort(dependencies),
            status = [];

        for (var i = 0; i < sortedDependencies.length; i += 1) {
            if (sortedDependencies[i] === module.name) {
                continue;
            }

            var plugin = Plugin.resolve(sortedDependencies[i]);

            if (!plugin) {
                status.push('❌ ' + sortedDependencies[i]);
                continue;
            }

            if (Plugin.isUsed(module, plugin.name)) {
                continue;
            }

            if (!Plugin.isFor(plugin, module)) {
                Common.warn('Plugin.use:', Plugin.toString(plugin), 'is for', plugin.for, 'but installed on', Plugin.toString(module) + '.');
                plugin._warned = true;
            }

            if (plugin.install) {
                plugin.install(module);
            } else {
                Common.warn('Plugin.use:', Plugin.toString(plugin), 'does not specify an install function.');
                plugin._warned = true;
            }

            if (plugin._warned) {
                status.push('🔶 ' + Plugin.toString(plugin));
                delete plugin._warned;
            } else {
                status.push('✅ ' + Plugin.toString(plugin));
            }

            module.used.push(plugin.name);
        }

        if (status.length > 0) {
            Common.info(status.join('  '));
        }
    };

    /**
     * Recursively finds all of a module's dependencies and returns a flat dependency graph.
     * @method dependencies
     * @param module {} The module.
     * @return {object} A dependency graph.
     */
    Plugin.dependencies = function(module, tracked) {
        var parsedBase = Plugin.dependencyParse(module),
            name = parsedBase.name;

        tracked = tracked || {};

        if (name in tracked) {
            return;
        }

        module = Plugin.resolve(module) || module;

        tracked[name] = Common.map(module.uses || [], function(dependency) {
            if (Plugin.isPlugin(dependency)) {
                Plugin.register(dependency);
            }

            var parsed = Plugin.dependencyParse(dependency),
                resolved = Plugin.resolve(dependency);

            if (resolved && !Plugin.versionSatisfies(resolved.version, parsed.range)) {
                Common.warn(
                    'Plugin.dependencies:', Plugin.toString(resolved), 'does not satisfy',
                    Plugin.toString(parsed), 'used by', Plugin.toString(parsedBase) + '.'
                );

                resolved._warned = true;
                module._warned = true;
            } else if (!resolved) {
                Common.warn(
                    'Plugin.dependencies:', Plugin.toString(dependency), 'used by',
                    Plugin.toString(parsedBase), 'could not be resolved.'
                );

                module._warned = true;
            }

            return parsed.name;
        });

        for (var i = 0; i < tracked[name].length; i += 1) {
            Plugin.dependencies(tracked[name][i], tracked);
        }

        return tracked;
    };

    /**
     * Parses a dependency string into its components.
     * The `dependency` is a string of the format `'module-name'` or `'module-name@version'`.
     * See documentation for `Plugin.versionParse` for a description of the format.
     * This function can also handle dependencies that are already resolved (e.g. a module object).
     * @method dependencyParse
     * @param dependency {string} The dependency of the format `'module-name'` or `'module-name@version'`.
     * @return {object} The dependency parsed into its components.
     */
    Plugin.dependencyParse = function(dependency) {
        if (Common.isString(dependency)) {
            var pattern = /^[\w-]+(@(\*|[\^~]?\d+\.\d+\.\d+(-[0-9A-Za-z-]+)?))?$/;

            if (!pattern.test(dependency)) {
                Common.warn('Plugin.dependencyParse:', dependency, 'is not a valid dependency string.');
            }

            return {
                name: dependency.split('@')[0],
                range: dependency.split('@')[1] || '*'
            };
        }

        return {
            name: dependency.name,
            range: dependency.range || dependency.version
        };
    };

    /**
     * Parses a version string into its components.  
     * Versions are strictly of the format `x.y.z` (as in [semver](http://semver.org/)).
     * Versions may optionally have a prerelease tag in the format `x.y.z-alpha`.
     * Ranges are a strict subset of [npm ranges](https://docs.npmjs.com/misc/semver#advanced-range-syntax).
     * Only the following range types are supported:
     * - Tilde ranges e.g. `~1.2.3`
     * - Caret ranges e.g. `^1.2.3`
     * - Exact version e.g. `1.2.3`
     * - Any version `*`
     * @method versionParse
     * @param range {string} The version string.
     * @return {object} The version range parsed into its components.
     */
    Plugin.versionParse = function(range) {
        var pattern = /^\*|[\^~]?\d+\.\d+\.\d+(-[0-9A-Za-z-]+)?$/;

        if (!pattern.test(range)) {
            Common.warn('Plugin.versionParse:', range, 'is not a valid version or range.');
        }

        var identifiers = range.split('-');
        range = identifiers[0];

        var isRange = isNaN(Number(range[0])),
            version = isRange ? range.substr(1) : range,
            parts = Common.map(version.split('.'), function(part) {
                return Number(part);
            });

        return {
            isRange: isRange,
            version: version,
            range: range,
            operator: isRange ? range[0] : '',
            parts: parts,
            prerelease: identifiers[1],
            number: parts[0] * 1e8 + parts[1] * 1e4 + parts[2]
        };
    };

    /**
     * Returns `true` if `version` satisfies the given `range`.
     * See documentation for `Plugin.versionParse` for a description of the format.
     * If a version or range is not specified, then any version (`*`) is assumed to satisfy.
     * @method versionSatisfies
     * @param version {string} The version string.
     * @param range {string} The range string.
     * @return {boolean} `true` if `version` satisfies `range`, otherwise `false`.
     */
    Plugin.versionSatisfies = function(version, range) {
        range = range || '*';

        var rangeParsed = Plugin.versionParse(range),
            rangeParts = rangeParsed.parts,
            versionParsed = Plugin.versionParse(version),
            versionParts = versionParsed.parts;

        if (rangeParsed.isRange) {
            if (rangeParsed.operator === '*' || version === '*') {
                return true;
            }

            if (rangeParsed.operator === '~') {
                return versionParts[0] === rangeParts[0] && versionParts[1] === rangeParts[1] && versionParts[2] >= rangeParts[2];
            }

            if (rangeParsed.operator === '^') {
                if (rangeParts[0] > 0) {
                    return versionParts[0] === rangeParts[0] && versionParsed.number >= rangeParsed.number;
                }

                if (rangeParts[1] > 0) {
                    return versionParts[1] === rangeParts[1] && versionParts[2] >= rangeParts[2];
                }

                return versionParts[2] === rangeParts[2];
            }
        }

        return version === range || version === '*';
    };

})();

},{"./Common":14}],21:[function(_dereq_,module,exports){
/**
* The `Matter.Runner` module is an optional utility which provides a game loop, 
* that handles continuously updating a `Matter.Engine` for you within a browser.
* It is intended for development and debugging purposes, but may also be suitable for simple games.
* If you are using your own game loop instead, then you do not need the `Matter.Runner` module.
* Instead just call `Engine.update(engine, delta)` in your own loop.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Runner
*/

var Runner = {};

module.exports = Runner;

var Events = _dereq_('./Events');
var Engine = _dereq_('./Engine');
var Common = _dereq_('./Common');

(function() {

    var _requestAnimationFrame,
        _cancelAnimationFrame;

    if (typeof window !== 'undefined') {
        _requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame
                                      || window.mozRequestAnimationFrame || window.msRequestAnimationFrame;
   
        _cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame 
                                      || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;
    }

    if (!_requestAnimationFrame) {
        var _frameTimeout;

        _requestAnimationFrame = function(callback){ 
            _frameTimeout = setTimeout(function() { 
                callback(Common.now()); 
            }, 1000 / 60);
        };

        _cancelAnimationFrame = function() {
            clearTimeout(_frameTimeout);
        };
    }

    /**
     * Creates a new Runner. The options parameter is an object that specifies any properties you wish to override the defaults.
     * @method create
     * @param {} options
     */
    Runner.create = function(options) {
        var defaults = {
            fps: 60,
            correction: 1,
            deltaSampleSize: 60,
            counterTimestamp: 0,
            frameCounter: 0,
            deltaHistory: [],
            timePrev: null,
            timeScalePrev: 1,
            frameRequestId: null,
            isFixed: false,
            enabled: true
        };

        var runner = Common.extend(defaults, options);

        runner.delta = runner.delta || 1000 / runner.fps;
        runner.deltaMin = runner.deltaMin || 1000 / runner.fps;
        runner.deltaMax = runner.deltaMax || 1000 / (runner.fps * 0.5);
        runner.fps = 1000 / runner.delta;

        return runner;
    };

    /**
     * Continuously ticks a `Matter.Engine` by calling `Runner.tick` on the `requestAnimationFrame` event.
     * @method run
     * @param {engine} engine
     */
    Runner.run = function(runner, engine) {
        // create runner if engine is first argument
        if (typeof runner.positionIterations !== 'undefined') {
            engine = runner;
            runner = Runner.create();
        }

        (function render(time){
            runner.frameRequestId = _requestAnimationFrame(render);

            if (time && runner.enabled) {
                Runner.tick(runner, engine, time);
            }
        })();

        return runner;
    };

    /**
     * A game loop utility that updates the engine and renderer by one step (a 'tick').
     * Features delta smoothing, time correction and fixed or dynamic timing.
     * Triggers `beforeTick`, `tick` and `afterTick` events on the engine.
     * Consider just `Engine.update(engine, delta)` if you're using your own loop.
     * @method tick
     * @param {runner} runner
     * @param {engine} engine
     * @param {number} time
     */
    Runner.tick = function(runner, engine, time) {
        var timing = engine.timing,
            correction = 1,
            delta;

        // create an event object
        var event = {
            timestamp: timing.timestamp
        };

        Events.trigger(runner, 'beforeTick', event);
        Events.trigger(engine, 'beforeTick', event); // @deprecated

        if (runner.isFixed) {
            // fixed timestep
            delta = runner.delta;
        } else {
            // dynamic timestep based on wall clock between calls
            delta = (time - runner.timePrev) || runner.delta;
            runner.timePrev = time;

            // optimistically filter delta over a few frames, to improve stability
            runner.deltaHistory.push(delta);
            runner.deltaHistory = runner.deltaHistory.slice(-runner.deltaSampleSize);
            delta = Math.min.apply(null, runner.deltaHistory);
            
            // limit delta
            delta = delta < runner.deltaMin ? runner.deltaMin : delta;
            delta = delta > runner.deltaMax ? runner.deltaMax : delta;

            // correction for delta
            correction = delta / runner.delta;

            // update engine timing object
            runner.delta = delta;
        }

        // time correction for time scaling
        if (runner.timeScalePrev !== 0)
            correction *= timing.timeScale / runner.timeScalePrev;

        if (timing.timeScale === 0)
            correction = 0;

        runner.timeScalePrev = timing.timeScale;
        runner.correction = correction;

        // fps counter
        runner.frameCounter += 1;
        if (time - runner.counterTimestamp >= 1000) {
            runner.fps = runner.frameCounter * ((time - runner.counterTimestamp) / 1000);
            runner.counterTimestamp = time;
            runner.frameCounter = 0;
        }

        Events.trigger(runner, 'tick', event);
        Events.trigger(engine, 'tick', event); // @deprecated

        // if world has been modified, clear the render scene graph
        if (engine.world.isModified 
            && engine.render
            && engine.render.controller
            && engine.render.controller.clear) {
            engine.render.controller.clear(engine.render); // @deprecated
        }

        // update
        Events.trigger(runner, 'beforeUpdate', event);
        Engine.update(engine, delta, correction);
        Events.trigger(runner, 'afterUpdate', event);

        // render
        // @deprecated
        if (engine.render && engine.render.controller) {
            Events.trigger(runner, 'beforeRender', event);
            Events.trigger(engine, 'beforeRender', event); // @deprecated

            engine.render.controller.world(engine.render);

            Events.trigger(runner, 'afterRender', event);
            Events.trigger(engine, 'afterRender', event); // @deprecated
        }

        Events.trigger(runner, 'afterTick', event);
        Events.trigger(engine, 'afterTick', event); // @deprecated
    };

    /**
     * Ends execution of `Runner.run` on the given `runner`, by canceling the animation frame request event loop.
     * If you wish to only temporarily pause the engine, see `engine.enabled` instead.
     * @method stop
     * @param {runner} runner
     */
    Runner.stop = function(runner) {
        _cancelAnimationFrame(runner.frameRequestId);
    };

    /**
     * Alias for `Runner.run`.
     * @method start
     * @param {runner} runner
     * @param {engine} engine
     */
    Runner.start = function(runner, engine) {
        Runner.run(runner, engine);
    };

    /*
    *
    *  Events Documentation
    *
    */

    /**
    * Fired at the start of a tick, before any updates to the engine or timing
    *
    * @event beforeTick
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired after engine timing updated, but just before update
    *
    * @event tick
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired at the end of a tick, after engine update and after rendering
    *
    * @event afterTick
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired before update
    *
    * @event beforeUpdate
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired after update
    *
    * @event afterUpdate
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired before rendering
    *
    * @event beforeRender
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    * @deprecated
    */

    /**
    * Fired after rendering
    *
    * @event afterRender
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    * @deprecated
    */

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * A flag that specifies whether the runner is running or not.
     *
     * @property enabled
     * @type boolean
     * @default true
     */

    /**
     * A `Boolean` that specifies if the runner should use a fixed timestep (otherwise it is variable).
     * If timing is fixed, then the apparent simulation speed will change depending on the frame rate (but behaviour will be deterministic).
     * If the timing is variable, then the apparent simulation speed will be constant (approximately, but at the cost of determininism).
     *
     * @property isFixed
     * @type boolean
     * @default false
     */

    /**
     * A `Number` that specifies the time step between updates in milliseconds.
     * If `engine.timing.isFixed` is set to `true`, then `delta` is fixed.
     * If it is `false`, then `delta` can dynamically change to maintain the correct apparent simulation speed.
     *
     * @property delta
     * @type number
     * @default 1000 / 60
     */

})();

},{"./Common":14,"./Engine":15,"./Events":16}],22:[function(_dereq_,module,exports){
/**
* The `Matter.Sleeping` module contains methods to manage the sleeping state of bodies.
*
* @class Sleeping
*/

var Sleeping = {};

module.exports = Sleeping;

var Events = _dereq_('./Events');

(function() {

    Sleeping._motionWakeThreshold = 0.18;
    Sleeping._motionSleepThreshold = 0.08;
    Sleeping._minBias = 0.9;

    /**
     * Puts bodies to sleep or wakes them up depending on their motion.
     * @method update
     * @param {body[]} bodies
     * @param {number} timeScale
     */
    Sleeping.update = function(bodies, timeScale) {
        var timeFactor = timeScale * timeScale * timeScale;

        // update bodies sleeping status
        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i],
                motion = body.speed * body.speed + body.angularSpeed * body.angularSpeed;

            // wake up bodies if they have a force applied
            if (body.force.x !== 0 || body.force.y !== 0) {
                Sleeping.set(body, false);
                continue;
            }

            var minMotion = Math.min(body.motion, motion),
                maxMotion = Math.max(body.motion, motion);
        
            // biased average motion estimation between frames
            body.motion = Sleeping._minBias * minMotion + (1 - Sleeping._minBias) * maxMotion;
            
            if (body.sleepThreshold > 0 && body.motion < Sleeping._motionSleepThreshold * timeFactor) {
                body.sleepCounter += 1;
                
                if (body.sleepCounter >= body.sleepThreshold)
                    Sleeping.set(body, true);
            } else if (body.sleepCounter > 0) {
                body.sleepCounter -= 1;
            }
        }
    };

    /**
     * Given a set of colliding pairs, wakes the sleeping bodies involved.
     * @method afterCollisions
     * @param {pair[]} pairs
     * @param {number} timeScale
     */
    Sleeping.afterCollisions = function(pairs, timeScale) {
        var timeFactor = timeScale * timeScale * timeScale;

        // wake up bodies involved in collisions
        for (var i = 0; i < pairs.length; i++) {
            var pair = pairs[i];
            
            // don't wake inactive pairs
            if (!pair.isActive)
                continue;

            var collision = pair.collision,
                bodyA = collision.bodyA.parent, 
                bodyB = collision.bodyB.parent;
        
            // don't wake if at least one body is static
            if ((bodyA.isSleeping && bodyB.isSleeping) || bodyA.isStatic || bodyB.isStatic)
                continue;
        
            if (bodyA.isSleeping || bodyB.isSleeping) {
                var sleepingBody = (bodyA.isSleeping && !bodyA.isStatic) ? bodyA : bodyB,
                    movingBody = sleepingBody === bodyA ? bodyB : bodyA;

                if (!sleepingBody.isStatic && movingBody.motion > Sleeping._motionWakeThreshold * timeFactor) {
                    Sleeping.set(sleepingBody, false);
                }
            }
        }
    };
  
    /**
     * Set a body as sleeping or awake.
     * @method set
     * @param {body} body
     * @param {boolean} isSleeping
     */
    Sleeping.set = function(body, isSleeping) {
        var wasSleeping = body.isSleeping;

        if (isSleeping) {
            body.isSleeping = true;
            body.sleepCounter = body.sleepThreshold;

            body.positionImpulse.x = 0;
            body.positionImpulse.y = 0;

            body.positionPrev.x = body.position.x;
            body.positionPrev.y = body.position.y;

            body.anglePrev = body.angle;
            body.speed = 0;
            body.angularSpeed = 0;
            body.motion = 0;

            if (!wasSleeping) {
                Events.trigger(body, 'sleepStart');
            }
        } else {
            body.isSleeping = false;
            body.sleepCounter = 0;

            if (wasSleeping) {
                Events.trigger(body, 'sleepEnd');
            }
        }
    };

})();

},{"./Events":16}],23:[function(_dereq_,module,exports){
(function (global){
/**
* The `Matter.Bodies` module contains factory methods for creating rigid body models 
* with commonly used body configurations (such as rectangles, circles and other polygons).
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Bodies
*/

// TODO: true circle bodies

var Bodies = {};

module.exports = Bodies;

var Vertices = _dereq_('../geometry/Vertices');
var Common = _dereq_('../core/Common');
var Body = _dereq_('../body/Body');
var Bounds = _dereq_('../geometry/Bounds');
var Vector = _dereq_('../geometry/Vector');
var decomp = (typeof window !== "undefined" ? window['decomp'] : typeof global !== "undefined" ? global['decomp'] : null);

(function() {

    /**
     * Creates a new rigid body model with a rectangle hull. 
     * The options parameter is an object that specifies any properties you wish to override the defaults.
     * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
     * @method rectangle
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {object} [options]
     * @return {body} A new rectangle body
     */
    Bodies.rectangle = function(x, y, width, height, options) {
        options = options || {};

        var rectangle = { 
            label: 'Rectangle Body',
            position: { x: x, y: y },
            vertices: Vertices.fromPath('L 0 0 L ' + width + ' 0 L ' + width + ' ' + height + ' L 0 ' + height)
        };

        if (options.chamfer) {
            var chamfer = options.chamfer;
            rectangle.vertices = Vertices.chamfer(rectangle.vertices, chamfer.radius, 
                                    chamfer.quality, chamfer.qualityMin, chamfer.qualityMax);
            delete options.chamfer;
        }

        return Body.create(Common.extend({}, rectangle, options));
    };
    
    /**
     * Creates a new rigid body model with a trapezoid hull. 
     * The options parameter is an object that specifies any properties you wish to override the defaults.
     * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
     * @method trapezoid
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} slope
     * @param {object} [options]
     * @return {body} A new trapezoid body
     */
    Bodies.trapezoid = function(x, y, width, height, slope, options) {
        options = options || {};

        slope *= 0.5;
        var roof = (1 - (slope * 2)) * width;
        
        var x1 = width * slope,
            x2 = x1 + roof,
            x3 = x2 + x1,
            verticesPath;

        if (slope < 0.5) {
            verticesPath = 'L 0 0 L ' + x1 + ' ' + (-height) + ' L ' + x2 + ' ' + (-height) + ' L ' + x3 + ' 0';
        } else {
            verticesPath = 'L 0 0 L ' + x2 + ' ' + (-height) + ' L ' + x3 + ' 0';
        }

        var trapezoid = { 
            label: 'Trapezoid Body',
            position: { x: x, y: y },
            vertices: Vertices.fromPath(verticesPath)
        };

        if (options.chamfer) {
            var chamfer = options.chamfer;
            trapezoid.vertices = Vertices.chamfer(trapezoid.vertices, chamfer.radius, 
                                    chamfer.quality, chamfer.qualityMin, chamfer.qualityMax);
            delete options.chamfer;
        }

        return Body.create(Common.extend({}, trapezoid, options));
    };

    /**
     * Creates a new rigid body model with a circle hull. 
     * The options parameter is an object that specifies any properties you wish to override the defaults.
     * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
     * @method circle
     * @param {number} x
     * @param {number} y
     * @param {number} radius
     * @param {object} [options]
     * @param {number} [maxSides]
     * @return {body} A new circle body
     */
    Bodies.circle = function(x, y, radius, options, maxSides) {
        options = options || {};

        var circle = {
            label: 'Circle Body',
            circleRadius: radius
        };
        
        // approximate circles with polygons until true circles implemented in SAT
        maxSides = maxSides || 25;
        var sides = Math.ceil(Math.max(10, Math.min(maxSides, radius)));

        // optimisation: always use even number of sides (half the number of unique axes)
        if (sides % 2 === 1)
            sides += 1;

        return Bodies.polygon(x, y, sides, radius, Common.extend({}, circle, options));
    };

    /**
     * Creates a new rigid body model with a regular polygon hull with the given number of sides. 
     * The options parameter is an object that specifies any properties you wish to override the defaults.
     * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
     * @method polygon
     * @param {number} x
     * @param {number} y
     * @param {number} sides
     * @param {number} radius
     * @param {object} [options]
     * @return {body} A new regular polygon body
     */
    Bodies.polygon = function(x, y, sides, radius, options) {
        options = options || {};

        if (sides < 3)
            return Bodies.circle(x, y, radius, options);

        var theta = 2 * Math.PI / sides,
            path = '',
            offset = theta * 0.5;

        for (var i = 0; i < sides; i += 1) {
            var angle = offset + (i * theta),
                xx = Math.cos(angle) * radius,
                yy = Math.sin(angle) * radius;

            path += 'L ' + xx.toFixed(3) + ' ' + yy.toFixed(3) + ' ';
        }

        var polygon = { 
            label: 'Polygon Body',
            position: { x: x, y: y },
            vertices: Vertices.fromPath(path)
        };

        if (options.chamfer) {
            var chamfer = options.chamfer;
            polygon.vertices = Vertices.chamfer(polygon.vertices, chamfer.radius, 
                                    chamfer.quality, chamfer.qualityMin, chamfer.qualityMax);
            delete options.chamfer;
        }

        return Body.create(Common.extend({}, polygon, options));
    };

    /**
     * Creates a body using the supplied vertices (or an array containing multiple sets of vertices).
     * If the vertices are convex, they will pass through as supplied.
     * Otherwise if the vertices are concave, they will be decomposed if [poly-decomp.js](https://github.com/schteppe/poly-decomp.js) is available.
     * Note that this process is not guaranteed to support complex sets of vertices (e.g. those with holes may fail).
     * By default the decomposition will discard collinear edges (to improve performance).
     * It can also optionally discard any parts that have an area less than `minimumArea`.
     * If the vertices can not be decomposed, the result will fall back to using the convex hull.
     * The options parameter is an object that specifies any `Matter.Body` properties you wish to override the defaults.
     * See the properties section of the `Matter.Body` module for detailed information on what you can pass via the `options` object.
     * @method fromVertices
     * @param {number} x
     * @param {number} y
     * @param [[vector]] vertexSets
     * @param {object} [options]
     * @param {bool} [flagInternal=false]
     * @param {number} [removeCollinear=0.01]
     * @param {number} [minimumArea=10]
     * @return {body}
     */
    Bodies.fromVertices = function(x, y, vertexSets, options, flagInternal, removeCollinear, minimumArea) {
        var body,
            parts,
            isConvex,
            vertices,
            i,
            j,
            k,
            v,
            z;

        options = options || {};
        parts = [];

        flagInternal = typeof flagInternal !== 'undefined' ? flagInternal : false;
        removeCollinear = typeof removeCollinear !== 'undefined' ? removeCollinear : 0.01;
        minimumArea = typeof minimumArea !== 'undefined' ? minimumArea : 10;

        if (!decomp) {
            Common.warn('Bodies.fromVertices: poly-decomp.js required. Could not decompose vertices. Fallback to convex hull.');
        }

        // ensure vertexSets is an array of arrays
        if (!Common.isArray(vertexSets[0])) {
            vertexSets = [vertexSets];
        }

        for (v = 0; v < vertexSets.length; v += 1) {
            vertices = vertexSets[v];
            isConvex = Vertices.isConvex(vertices);

            if (isConvex || !decomp) {
                if (isConvex) {
                    vertices = Vertices.clockwiseSort(vertices);
                } else {
                    // fallback to convex hull when decomposition is not possible
                    vertices = Vertices.hull(vertices);
                }

                parts.push({
                    position: { x: x, y: y },
                    vertices: vertices
                });
            } else {
                // initialise a decomposition
                var concave = vertices.map(function(vertex) {
                    return [vertex.x, vertex.y];
                });

                // vertices are concave and simple, we can decompose into parts
                decomp.makeCCW(concave);
                if (removeCollinear !== false)
                    decomp.removeCollinearPoints(concave, removeCollinear);

                // use the quick decomposition algorithm (Bayazit)
                var decomposed = decomp.quickDecomp(concave);

                // for each decomposed chunk
                for (i = 0; i < decomposed.length; i++) {
                    var chunk = decomposed[i];

                    // convert vertices into the correct structure
                    var chunkVertices = chunk.map(function(vertices) {
                        return {
                            x: vertices[0],
                            y: vertices[1]
                        };
                    });

                    // skip small chunks
                    if (minimumArea > 0 && Vertices.area(chunkVertices) < minimumArea)
                        continue;

                    // create a compound part
                    parts.push({
                        position: Vertices.centre(chunkVertices),
                        vertices: chunkVertices
                    });
                }
            }
        }

        // create body parts
        for (i = 0; i < parts.length; i++) {
            parts[i] = Body.create(Common.extend(parts[i], options));
        }

        // flag internal edges (coincident part edges)
        if (flagInternal) {
            var coincident_max_dist = 5;

            for (i = 0; i < parts.length; i++) {
                var partA = parts[i];

                for (j = i + 1; j < parts.length; j++) {
                    var partB = parts[j];

                    if (Bounds.overlaps(partA.bounds, partB.bounds)) {
                        var pav = partA.vertices,
                            pbv = partB.vertices;

                        // iterate vertices of both parts
                        for (k = 0; k < partA.vertices.length; k++) {
                            for (z = 0; z < partB.vertices.length; z++) {
                                // find distances between the vertices
                                var da = Vector.magnitudeSquared(Vector.sub(pav[(k + 1) % pav.length], pbv[z])),
                                    db = Vector.magnitudeSquared(Vector.sub(pav[k], pbv[(z + 1) % pbv.length]));

                                // if both vertices are very close, consider the edge concident (internal)
                                if (da < coincident_max_dist && db < coincident_max_dist) {
                                    pav[k].isInternal = true;
                                    pbv[z].isInternal = true;
                                }
                            }
                        }

                    }
                }
            }
        }

        if (parts.length > 1) {
            // create the parent body to be returned, that contains generated compound parts
            body = Body.create(Common.extend({ parts: parts.slice(0) }, options));
            Body.setPosition(body, { x: x, y: y });

            return body;
        } else {
            return parts[0];
        }
    };

})();

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"../body/Body":1,"../core/Common":14,"../geometry/Bounds":26,"../geometry/Vector":28,"../geometry/Vertices":29}],24:[function(_dereq_,module,exports){
/**
* The `Matter.Composites` module contains factory methods for creating composite bodies
* with commonly used configurations (such as stacks and chains).
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Composites
*/

var Composites = {};

module.exports = Composites;

var Composite = _dereq_('../body/Composite');
var Constraint = _dereq_('../constraint/Constraint');
var Common = _dereq_('../core/Common');
var Body = _dereq_('../body/Body');
var Bodies = _dereq_('./Bodies');

(function() {

    /**
     * Create a new composite containing bodies created in the callback in a grid arrangement.
     * This function uses the body's bounds to prevent overlaps.
     * @method stack
     * @param {number} xx
     * @param {number} yy
     * @param {number} columns
     * @param {number} rows
     * @param {number} columnGap
     * @param {number} rowGap
     * @param {function} callback
     * @return {composite} A new composite containing objects created in the callback
     */
    Composites.stack = function(xx, yy, columns, rows, columnGap, rowGap, callback) {
        var stack = Composite.create({ label: 'Stack' }),
            x = xx,
            y = yy,
            lastBody,
            i = 0;

        for (var row = 0; row < rows; row++) {
            var maxHeight = 0;
            
            for (var column = 0; column < columns; column++) {
                var body = callback(x, y, column, row, lastBody, i);
                    
                if (body) {
                    var bodyHeight = body.bounds.max.y - body.bounds.min.y,
                        bodyWidth = body.bounds.max.x - body.bounds.min.x; 

                    if (bodyHeight > maxHeight)
                        maxHeight = bodyHeight;
                    
                    Body.translate(body, { x: bodyWidth * 0.5, y: bodyHeight * 0.5 });

                    x = body.bounds.max.x + columnGap;

                    Composite.addBody(stack, body);
                    
                    lastBody = body;
                    i += 1;
                } else {
                    x += columnGap;
                }
            }
            
            y += maxHeight + rowGap;
            x = xx;
        }

        return stack;
    };
    
    /**
     * Chains all bodies in the given composite together using constraints.
     * @method chain
     * @param {composite} composite
     * @param {number} xOffsetA
     * @param {number} yOffsetA
     * @param {number} xOffsetB
     * @param {number} yOffsetB
     * @param {object} options
     * @return {composite} A new composite containing objects chained together with constraints
     */
    Composites.chain = function(composite, xOffsetA, yOffsetA, xOffsetB, yOffsetB, options) {
        var bodies = composite.bodies;
        
        for (var i = 1; i < bodies.length; i++) {
            var bodyA = bodies[i - 1],
                bodyB = bodies[i],
                bodyAHeight = bodyA.bounds.max.y - bodyA.bounds.min.y,
                bodyAWidth = bodyA.bounds.max.x - bodyA.bounds.min.x, 
                bodyBHeight = bodyB.bounds.max.y - bodyB.bounds.min.y,
                bodyBWidth = bodyB.bounds.max.x - bodyB.bounds.min.x;
        
            var defaults = {
                bodyA: bodyA,
                pointA: { x: bodyAWidth * xOffsetA, y: bodyAHeight * yOffsetA },
                bodyB: bodyB,
                pointB: { x: bodyBWidth * xOffsetB, y: bodyBHeight * yOffsetB }
            };
            
            var constraint = Common.extend(defaults, options);
        
            Composite.addConstraint(composite, Constraint.create(constraint));
        }

        composite.label += ' Chain';
        
        return composite;
    };

    /**
     * Connects bodies in the composite with constraints in a grid pattern, with optional cross braces.
     * @method mesh
     * @param {composite} composite
     * @param {number} columns
     * @param {number} rows
     * @param {boolean} crossBrace
     * @param {object} options
     * @return {composite} The composite containing objects meshed together with constraints
     */
    Composites.mesh = function(composite, columns, rows, crossBrace, options) {
        var bodies = composite.bodies,
            row,
            col,
            bodyA,
            bodyB,
            bodyC;
        
        for (row = 0; row < rows; row++) {
            for (col = 1; col < columns; col++) {
                bodyA = bodies[(col - 1) + (row * columns)];
                bodyB = bodies[col + (row * columns)];
                Composite.addConstraint(composite, Constraint.create(Common.extend({ bodyA: bodyA, bodyB: bodyB }, options)));
            }

            if (row > 0) {
                for (col = 0; col < columns; col++) {
                    bodyA = bodies[col + ((row - 1) * columns)];
                    bodyB = bodies[col + (row * columns)];
                    Composite.addConstraint(composite, Constraint.create(Common.extend({ bodyA: bodyA, bodyB: bodyB }, options)));

                    if (crossBrace && col > 0) {
                        bodyC = bodies[(col - 1) + ((row - 1) * columns)];
                        Composite.addConstraint(composite, Constraint.create(Common.extend({ bodyA: bodyC, bodyB: bodyB }, options)));
                    }

                    if (crossBrace && col < columns - 1) {
                        bodyC = bodies[(col + 1) + ((row - 1) * columns)];
                        Composite.addConstraint(composite, Constraint.create(Common.extend({ bodyA: bodyC, bodyB: bodyB }, options)));
                    }
                }
            }
        }

        composite.label += ' Mesh';
        
        return composite;
    };
    
    /**
     * Create a new composite containing bodies created in the callback in a pyramid arrangement.
     * This function uses the body's bounds to prevent overlaps.
     * @method pyramid
     * @param {number} xx
     * @param {number} yy
     * @param {number} columns
     * @param {number} rows
     * @param {number} columnGap
     * @param {number} rowGap
     * @param {function} callback
     * @return {composite} A new composite containing objects created in the callback
     */
    Composites.pyramid = function(xx, yy, columns, rows, columnGap, rowGap, callback) {
        return Composites.stack(xx, yy, columns, rows, columnGap, rowGap, function(x, y, column, row, lastBody, i) {
            var actualRows = Math.min(rows, Math.ceil(columns / 2)),
                lastBodyWidth = lastBody ? lastBody.bounds.max.x - lastBody.bounds.min.x : 0;
            
            if (row > actualRows)
                return;
            
            // reverse row order
            row = actualRows - row;
            
            var start = row,
                end = columns - 1 - row;

            if (column < start || column > end)
                return;
            
            // retroactively fix the first body's position, since width was unknown
            if (i === 1) {
                Body.translate(lastBody, { x: (column + (columns % 2 === 1 ? 1 : -1)) * lastBodyWidth, y: 0 });
            }

            var xOffset = lastBody ? column * lastBodyWidth : 0;
            
            return callback(xx + xOffset + column * columnGap, y, column, row, lastBody, i);
        });
    };

    /**
     * Creates a composite with a Newton's Cradle setup of bodies and constraints.
     * @method newtonsCradle
     * @param {number} xx
     * @param {number} yy
     * @param {number} number
     * @param {number} size
     * @param {number} length
     * @return {composite} A new composite newtonsCradle body
     */
    Composites.newtonsCradle = function(xx, yy, number, size, length) {
        var newtonsCradle = Composite.create({ label: 'Newtons Cradle' });

        for (var i = 0; i < number; i++) {
            var separation = 1.9,
                circle = Bodies.circle(xx + i * (size * separation), yy + length, size, 
                            { inertia: Infinity, restitution: 1, friction: 0, frictionAir: 0.0001, slop: 1 }),
                constraint = Constraint.create({ pointA: { x: xx + i * (size * separation), y: yy }, bodyB: circle });

            Composite.addBody(newtonsCradle, circle);
            Composite.addConstraint(newtonsCradle, constraint);
        }

        return newtonsCradle;
    };
    
    /**
     * Creates a composite with simple car setup of bodies and constraints.
     * @method car
     * @param {number} xx
     * @param {number} yy
     * @param {number} width
     * @param {number} height
     * @param {number} wheelSize
     * @return {composite} A new composite car body
     */
    Composites.car = function(xx, yy, width, height, wheelSize) {
        var group = Body.nextGroup(true),
            wheelBase = 20,
            wheelAOffset = -width * 0.5 + wheelBase,
            wheelBOffset = width * 0.5 - wheelBase,
            wheelYOffset = 0;
    
        var car = Composite.create({ label: 'Car' }),
            body = Bodies.rectangle(xx, yy, width, height, { 
                collisionFilter: {
                    group: group
                },
                chamfer: {
                    radius: height * 0.5
                },
                density: 0.0002
            });
    
        var wheelA = Bodies.circle(xx + wheelAOffset, yy + wheelYOffset, wheelSize, { 
            collisionFilter: {
                group: group
            },
            friction: 0.8
        });
                    
        var wheelB = Bodies.circle(xx + wheelBOffset, yy + wheelYOffset, wheelSize, { 
            collisionFilter: {
                group: group
            },
            friction: 0.8
        });
                    
        var axelA = Constraint.create({
            bodyB: body,
            pointB: { x: wheelAOffset, y: wheelYOffset },
            bodyA: wheelA,
            stiffness: 1,
            length: 0
        });
                        
        var axelB = Constraint.create({
            bodyB: body,
            pointB: { x: wheelBOffset, y: wheelYOffset },
            bodyA: wheelB,
            stiffness: 1,
            length: 0
        });
        
        Composite.addBody(car, body);
        Composite.addBody(car, wheelA);
        Composite.addBody(car, wheelB);
        Composite.addConstraint(car, axelA);
        Composite.addConstraint(car, axelB);

        return car;
    };

    /**
     * Creates a simple soft body like object.
     * @method softBody
     * @param {number} xx
     * @param {number} yy
     * @param {number} columns
     * @param {number} rows
     * @param {number} columnGap
     * @param {number} rowGap
     * @param {boolean} crossBrace
     * @param {number} particleRadius
     * @param {} particleOptions
     * @param {} constraintOptions
     * @return {composite} A new composite softBody
     */
    Composites.softBody = function(xx, yy, columns, rows, columnGap, rowGap, crossBrace, particleRadius, particleOptions, constraintOptions) {
        particleOptions = Common.extend({ inertia: Infinity }, particleOptions);
        constraintOptions = Common.extend({ stiffness: 0.2, render: { type: 'line', anchors: false } }, constraintOptions);

        var softBody = Composites.stack(xx, yy, columns, rows, columnGap, rowGap, function(x, y) {
            return Bodies.circle(x, y, particleRadius, particleOptions);
        });

        Composites.mesh(softBody, columns, rows, crossBrace, constraintOptions);

        softBody.label = 'Soft Body';

        return softBody;
    };

})();

},{"../body/Body":1,"../body/Composite":2,"../constraint/Constraint":12,"../core/Common":14,"./Bodies":23}],25:[function(_dereq_,module,exports){
/**
* The `Matter.Axes` module contains methods for creating and manipulating sets of axes.
*
* @class Axes
*/

var Axes = {};

module.exports = Axes;

var Vector = _dereq_('../geometry/Vector');
var Common = _dereq_('../core/Common');

(function() {

    /**
     * Creates a new set of axes from the given vertices.
     * @method fromVertices
     * @param {vertices} vertices
     * @return {axes} A new axes from the given vertices
     */
    Axes.fromVertices = function(vertices) {
        var axes = {};

        // find the unique axes, using edge normal gradients
        for (var i = 0; i < vertices.length; i++) {
            var j = (i + 1) % vertices.length, 
                normal = Vector.normalise({ 
                    x: vertices[j].y - vertices[i].y, 
                    y: vertices[i].x - vertices[j].x
                }),
                gradient = (normal.y === 0) ? Infinity : (normal.x / normal.y);
            
            // limit precision
            gradient = gradient.toFixed(3).toString();
            axes[gradient] = normal;
        }

        return Common.values(axes);
    };

    /**
     * Rotates a set of axes by the given angle.
     * @method rotate
     * @param {axes} axes
     * @param {number} angle
     */
    Axes.rotate = function(axes, angle) {
        if (angle === 0)
            return;
        
        var cos = Math.cos(angle),
            sin = Math.sin(angle);

        for (var i = 0; i < axes.length; i++) {
            var axis = axes[i],
                xx;
            xx = axis.x * cos - axis.y * sin;
            axis.y = axis.x * sin + axis.y * cos;
            axis.x = xx;
        }
    };

})();

},{"../core/Common":14,"../geometry/Vector":28}],26:[function(_dereq_,module,exports){
/**
* The `Matter.Bounds` module contains methods for creating and manipulating axis-aligned bounding boxes (AABB).
*
* @class Bounds
*/

var Bounds = {};

module.exports = Bounds;

(function() {

    /**
     * Creates a new axis-aligned bounding box (AABB) for the given vertices.
     * @method create
     * @param {vertices} vertices
     * @return {bounds} A new bounds object
     */
    Bounds.create = function(vertices) {
        var bounds = { 
            min: { x: 0, y: 0 }, 
            max: { x: 0, y: 0 }
        };

        if (vertices)
            Bounds.update(bounds, vertices);
        
        return bounds;
    };

    /**
     * Updates bounds using the given vertices and extends the bounds given a velocity.
     * @method update
     * @param {bounds} bounds
     * @param {vertices} vertices
     * @param {vector} velocity
     */
    Bounds.update = function(bounds, vertices, velocity) {
        bounds.min.x = Infinity;
        bounds.max.x = -Infinity;
        bounds.min.y = Infinity;
        bounds.max.y = -Infinity;

        for (var i = 0; i < vertices.length; i++) {
            var vertex = vertices[i];
            if (vertex.x > bounds.max.x) bounds.max.x = vertex.x;
            if (vertex.x < bounds.min.x) bounds.min.x = vertex.x;
            if (vertex.y > bounds.max.y) bounds.max.y = vertex.y;
            if (vertex.y < bounds.min.y) bounds.min.y = vertex.y;
        }
        
        if (velocity) {
            if (velocity.x > 0) {
                bounds.max.x += velocity.x;
            } else {
                bounds.min.x += velocity.x;
            }
            
            if (velocity.y > 0) {
                bounds.max.y += velocity.y;
            } else {
                bounds.min.y += velocity.y;
            }
        }
    };

    /**
     * Returns true if the bounds contains the given point.
     * @method contains
     * @param {bounds} bounds
     * @param {vector} point
     * @return {boolean} True if the bounds contain the point, otherwise false
     */
    Bounds.contains = function(bounds, point) {
        return point.x >= bounds.min.x && point.x <= bounds.max.x 
               && point.y >= bounds.min.y && point.y <= bounds.max.y;
    };

    /**
     * Returns true if the two bounds intersect.
     * @method overlaps
     * @param {bounds} boundsA
     * @param {bounds} boundsB
     * @return {boolean} True if the bounds overlap, otherwise false
     */
    Bounds.overlaps = function(boundsA, boundsB) {
        return (boundsA.min.x <= boundsB.max.x && boundsA.max.x >= boundsB.min.x
                && boundsA.max.y >= boundsB.min.y && boundsA.min.y <= boundsB.max.y);
    };

    /**
     * Translates the bounds by the given vector.
     * @method translate
     * @param {bounds} bounds
     * @param {vector} vector
     */
    Bounds.translate = function(bounds, vector) {
        bounds.min.x += vector.x;
        bounds.max.x += vector.x;
        bounds.min.y += vector.y;
        bounds.max.y += vector.y;
    };

    /**
     * Shifts the bounds to the given position.
     * @method shift
     * @param {bounds} bounds
     * @param {vector} position
     */
    Bounds.shift = function(bounds, position) {
        var deltaX = bounds.max.x - bounds.min.x,
            deltaY = bounds.max.y - bounds.min.y;
            
        bounds.min.x = position.x;
        bounds.max.x = position.x + deltaX;
        bounds.min.y = position.y;
        bounds.max.y = position.y + deltaY;
    };
    
})();

},{}],27:[function(_dereq_,module,exports){
/**
* The `Matter.Svg` module contains methods for converting SVG images into an array of vector points.
*
* To use this module you also need the SVGPathSeg polyfill: https://github.com/progers/pathseg
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Svg
*/

var Svg = {};

module.exports = Svg;

var Bounds = _dereq_('../geometry/Bounds');

(function() {

    /**
     * Converts an SVG path into an array of vector points.
     * If the input path forms a concave shape, you must decompose the result into convex parts before use.
     * See `Bodies.fromVertices` which provides support for this.
     * Note that this function is not guaranteed to support complex paths (such as those with holes).
     * @method pathToVertices
     * @param {SVGPathElement} path
     * @param {Number} [sampleLength=15]
     * @return {Vector[]} points
     */
    Svg.pathToVertices = function(path, sampleLength) {
        // https://github.com/wout/svg.topoly.js/blob/master/svg.topoly.js
        var i, il, total, point, segment, segments, 
            segmentsQueue, lastSegment, 
            lastPoint, segmentIndex, points = [],
            lx, ly, length = 0, x = 0, y = 0;

        sampleLength = sampleLength || 15;

        var addPoint = function(px, py, pathSegType) {
            // all odd-numbered path types are relative except PATHSEG_CLOSEPATH (1)
            var isRelative = pathSegType % 2 === 1 && pathSegType > 1;

            // when the last point doesn't equal the current point add the current point
            if (!lastPoint || px != lastPoint.x || py != lastPoint.y) {
                if (lastPoint && isRelative) {
                    lx = lastPoint.x;
                    ly = lastPoint.y;
                } else {
                    lx = 0;
                    ly = 0;
                }

                var point = {
                    x: lx + px,
                    y: ly + py
                };

                // set last point
                if (isRelative || !lastPoint) {
                    lastPoint = point;
                }

                points.push(point);

                x = lx + px;
                y = ly + py;
            }
        };

        var addSegmentPoint = function(segment) {
            var segType = segment.pathSegTypeAsLetter.toUpperCase();

            // skip path ends
            if (segType === 'Z') 
                return;

            // map segment to x and y
            switch (segType) {

            case 'M':
            case 'L':
            case 'T':
            case 'C':
            case 'S':
            case 'Q':
                x = segment.x;
                y = segment.y;
                break;
            case 'H':
                x = segment.x;
                break;
            case 'V':
                y = segment.y;
                break;
            }

            addPoint(x, y, segment.pathSegType);
        };

        // ensure path is absolute
        _svgPathToAbsolute(path);

        // get total length
        total = path.getTotalLength();

        // queue segments
        segments = [];
        for (i = 0; i < path.pathSegList.numberOfItems; i += 1)
            segments.push(path.pathSegList.getItem(i));

        segmentsQueue = segments.concat();

        // sample through path
        while (length < total) {
            // get segment at position
            segmentIndex = path.getPathSegAtLength(length);
            segment = segments[segmentIndex];

            // new segment
            if (segment != lastSegment) {
                while (segmentsQueue.length && segmentsQueue[0] != segment)
                    addSegmentPoint(segmentsQueue.shift());

                lastSegment = segment;
            }

            // add points in between when curving
            // TODO: adaptive sampling
            switch (segment.pathSegTypeAsLetter.toUpperCase()) {

            case 'C':
            case 'T':
            case 'S':
            case 'Q':
            case 'A':
                point = path.getPointAtLength(length);
                addPoint(point.x, point.y, 0);
                break;

            }

            // increment by sample value
            length += sampleLength;
        }

        // add remaining segments not passed by sampling
        for (i = 0, il = segmentsQueue.length; i < il; ++i)
            addSegmentPoint(segmentsQueue[i]);

        return points;
    };

    var _svgPathToAbsolute = function(path) {
        // http://phrogz.net/convert-svg-path-to-all-absolute-commands
        // Copyright (c) Gavin Kistner
        // http://phrogz.net/js/_ReuseLicense.txt
        // Modifications: tidy formatting and naming
        var x0, y0, x1, y1, x2, y2, segs = path.pathSegList,
            x = 0, y = 0, len = segs.numberOfItems;

        for (var i = 0; i < len; ++i) {
            var seg = segs.getItem(i),
                segType = seg.pathSegTypeAsLetter;

            if (/[MLHVCSQTA]/.test(segType)) {
                if ('x' in seg) x = seg.x;
                if ('y' in seg) y = seg.y;
            } else {
                if ('x1' in seg) x1 = x + seg.x1;
                if ('x2' in seg) x2 = x + seg.x2;
                if ('y1' in seg) y1 = y + seg.y1;
                if ('y2' in seg) y2 = y + seg.y2;
                if ('x' in seg) x += seg.x;
                if ('y' in seg) y += seg.y;

                switch (segType) {

                case 'm':
                    segs.replaceItem(path.createSVGPathSegMovetoAbs(x, y), i);
                    break;
                case 'l':
                    segs.replaceItem(path.createSVGPathSegLinetoAbs(x, y), i);
                    break;
                case 'h':
                    segs.replaceItem(path.createSVGPathSegLinetoHorizontalAbs(x), i);
                    break;
                case 'v':
                    segs.replaceItem(path.createSVGPathSegLinetoVerticalAbs(y), i);
                    break;
                case 'c':
                    segs.replaceItem(path.createSVGPathSegCurvetoCubicAbs(x, y, x1, y1, x2, y2), i);
                    break;
                case 's':
                    segs.replaceItem(path.createSVGPathSegCurvetoCubicSmoothAbs(x, y, x2, y2), i);
                    break;
                case 'q':
                    segs.replaceItem(path.createSVGPathSegCurvetoQuadraticAbs(x, y, x1, y1), i);
                    break;
                case 't':
                    segs.replaceItem(path.createSVGPathSegCurvetoQuadraticSmoothAbs(x, y), i);
                    break;
                case 'a':
                    segs.replaceItem(path.createSVGPathSegArcAbs(x, y, seg.r1, seg.r2, seg.angle, seg.largeArcFlag, seg.sweepFlag), i);
                    break;
                case 'z':
                case 'Z':
                    x = x0;
                    y = y0;
                    break;

                }
            }

            if (segType == 'M' || segType == 'm') {
                x0 = x;
                y0 = y;
            }
        }
    };

})();
},{"../geometry/Bounds":26}],28:[function(_dereq_,module,exports){
/**
* The `Matter.Vector` module contains methods for creating and manipulating vectors.
* Vectors are the basis of all the geometry related operations in the engine.
* A `Matter.Vector` object is of the form `{ x: 0, y: 0 }`.
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Vector
*/

// TODO: consider params for reusing vector objects

var Vector = {};

module.exports = Vector;

(function() {

    /**
     * Creates a new vector.
     * @method create
     * @param {number} x
     * @param {number} y
     * @return {vector} A new vector
     */
    Vector.create = function(x, y) {
        return { x: x || 0, y: y || 0 };
    };

    /**
     * Returns a new vector with `x` and `y` copied from the given `vector`.
     * @method clone
     * @param {vector} vector
     * @return {vector} A new cloned vector
     */
    Vector.clone = function(vector) {
        return { x: vector.x, y: vector.y };
    };

    /**
     * Returns the magnitude (length) of a vector.
     * @method magnitude
     * @param {vector} vector
     * @return {number} The magnitude of the vector
     */
    Vector.magnitude = function(vector) {
        return Math.sqrt((vector.x * vector.x) + (vector.y * vector.y));
    };

    /**
     * Returns the magnitude (length) of a vector (therefore saving a `sqrt` operation).
     * @method magnitudeSquared
     * @param {vector} vector
     * @return {number} The squared magnitude of the vector
     */
    Vector.magnitudeSquared = function(vector) {
        return (vector.x * vector.x) + (vector.y * vector.y);
    };

    /**
     * Rotates the vector about (0, 0) by specified angle.
     * @method rotate
     * @param {vector} vector
     * @param {number} angle
     * @param {vector} [output]
     * @return {vector} The vector rotated about (0, 0)
     */
    Vector.rotate = function(vector, angle, output) {
        var cos = Math.cos(angle), sin = Math.sin(angle);
        if (!output) output = {};
        var x = vector.x * cos - vector.y * sin;
        output.y = vector.x * sin + vector.y * cos;
        output.x = x;
        return output;
    };

    /**
     * Rotates the vector about a specified point by specified angle.
     * @method rotateAbout
     * @param {vector} vector
     * @param {number} angle
     * @param {vector} point
     * @param {vector} [output]
     * @return {vector} A new vector rotated about the point
     */
    Vector.rotateAbout = function(vector, angle, point, output) {
        var cos = Math.cos(angle), sin = Math.sin(angle);
        if (!output) output = {};
        var x = point.x + ((vector.x - point.x) * cos - (vector.y - point.y) * sin);
        output.y = point.y + ((vector.x - point.x) * sin + (vector.y - point.y) * cos);
        output.x = x;
        return output;
    };

    /**
     * Normalises a vector (such that its magnitude is `1`).
     * @method normalise
     * @param {vector} vector
     * @return {vector} A new vector normalised
     */
    Vector.normalise = function(vector) {
        var magnitude = Vector.magnitude(vector);
        if (magnitude === 0)
            return { x: 0, y: 0 };
        return { x: vector.x / magnitude, y: vector.y / magnitude };
    };

    /**
     * Returns the dot-product of two vectors.
     * @method dot
     * @param {vector} vectorA
     * @param {vector} vectorB
     * @return {number} The dot product of the two vectors
     */
    Vector.dot = function(vectorA, vectorB) {
        return (vectorA.x * vectorB.x) + (vectorA.y * vectorB.y);
    };

    /**
     * Returns the cross-product of two vectors.
     * @method cross
     * @param {vector} vectorA
     * @param {vector} vectorB
     * @return {number} The cross product of the two vectors
     */
    Vector.cross = function(vectorA, vectorB) {
        return (vectorA.x * vectorB.y) - (vectorA.y * vectorB.x);
    };

    /**
     * Returns the cross-product of three vectors.
     * @method cross3
     * @param {vector} vectorA
     * @param {vector} vectorB
     * @param {vector} vectorC
     * @return {number} The cross product of the three vectors
     */
    Vector.cross3 = function(vectorA, vectorB, vectorC) {
        return (vectorB.x - vectorA.x) * (vectorC.y - vectorA.y) - (vectorB.y - vectorA.y) * (vectorC.x - vectorA.x);
    };

    /**
     * Adds the two vectors.
     * @method add
     * @param {vector} vectorA
     * @param {vector} vectorB
     * @param {vector} [output]
     * @return {vector} A new vector of vectorA and vectorB added
     */
    Vector.add = function(vectorA, vectorB, output) {
        if (!output) output = {};
        output.x = vectorA.x + vectorB.x;
        output.y = vectorA.y + vectorB.y;
        return output;
    };

    /**
     * Subtracts the two vectors.
     * @method sub
     * @param {vector} vectorA
     * @param {vector} vectorB
     * @param {vector} [output]
     * @return {vector} A new vector of vectorA and vectorB subtracted
     */
    Vector.sub = function(vectorA, vectorB, output) {
        if (!output) output = {};
        output.x = vectorA.x - vectorB.x;
        output.y = vectorA.y - vectorB.y;
        return output;
    };

    /**
     * Multiplies a vector and a scalar.
     * @method mult
     * @param {vector} vector
     * @param {number} scalar
     * @return {vector} A new vector multiplied by scalar
     */
    Vector.mult = function(vector, scalar) {
        return { x: vector.x * scalar, y: vector.y * scalar };
    };

    /**
     * Divides a vector and a scalar.
     * @method div
     * @param {vector} vector
     * @param {number} scalar
     * @return {vector} A new vector divided by scalar
     */
    Vector.div = function(vector, scalar) {
        return { x: vector.x / scalar, y: vector.y / scalar };
    };

    /**
     * Returns the perpendicular vector. Set `negate` to true for the perpendicular in the opposite direction.
     * @method perp
     * @param {vector} vector
     * @param {bool} [negate=false]
     * @return {vector} The perpendicular vector
     */
    Vector.perp = function(vector, negate) {
        negate = negate === true ? -1 : 1;
        return { x: negate * -vector.y, y: negate * vector.x };
    };

    /**
     * Negates both components of a vector such that it points in the opposite direction.
     * @method neg
     * @param {vector} vector
     * @return {vector} The negated vector
     */
    Vector.neg = function(vector) {
        return { x: -vector.x, y: -vector.y };
    };

    /**
     * Returns the angle in radians between the two vectors relative to the x-axis.
     * @method angle
     * @param {vector} vectorA
     * @param {vector} vectorB
     * @return {number} The angle in radians
     */
    Vector.angle = function(vectorA, vectorB) {
        return Math.atan2(vectorB.y - vectorA.y, vectorB.x - vectorA.x);
    };

    /**
     * Temporary vector pool (not thread-safe).
     * @property _temp
     * @type {vector[]}
     * @private
     */
    Vector._temp = [
        Vector.create(), Vector.create(), 
        Vector.create(), Vector.create(), 
        Vector.create(), Vector.create()
    ];

})();
},{}],29:[function(_dereq_,module,exports){
/**
* The `Matter.Vertices` module contains methods for creating and manipulating sets of vertices.
* A set of vertices is an array of `Matter.Vector` with additional indexing properties inserted by `Vertices.create`.
* A `Matter.Body` maintains a set of vertices to represent the shape of the object (its convex hull).
*
* See the included usage [examples](https://github.com/liabru/matter-js/tree/master/examples).
*
* @class Vertices
*/

var Vertices = {};

module.exports = Vertices;

var Vector = _dereq_('../geometry/Vector');
var Common = _dereq_('../core/Common');

(function() {

    /**
     * Creates a new set of `Matter.Body` compatible vertices.
     * The `points` argument accepts an array of `Matter.Vector` points orientated around the origin `(0, 0)`, for example:
     *
     *     [{ x: 0, y: 0 }, { x: 25, y: 50 }, { x: 50, y: 0 }]
     *
     * The `Vertices.create` method returns a new array of vertices, which are similar to Matter.Vector objects,
     * but with some additional references required for efficient collision detection routines.
     *
     * Vertices must be specified in clockwise order.
     *
     * Note that the `body` argument is not optional, a `Matter.Body` reference must be provided.
     *
     * @method create
     * @param {vector[]} points
     * @param {body} body
     */
    Vertices.create = function(points, body) {
        var vertices = [];

        for (var i = 0; i < points.length; i++) {
            var point = points[i],
                vertex = {
                    x: point.x,
                    y: point.y,
                    index: i,
                    body: body,
                    isInternal: false
                };

            vertices.push(vertex);
        }

        return vertices;
    };

    /**
     * Parses a string containing ordered x y pairs separated by spaces (and optionally commas), 
     * into a `Matter.Vertices` object for the given `Matter.Body`.
     * For parsing SVG paths, see `Svg.pathToVertices`.
     * @method fromPath
     * @param {string} path
     * @param {body} body
     * @return {vertices} vertices
     */
    Vertices.fromPath = function(path, body) {
        var pathPattern = /L?\s*([\-\d\.e]+)[\s,]*([\-\d\.e]+)*/ig,
            points = [];

        path.replace(pathPattern, function(match, x, y) {
            points.push({ x: parseFloat(x), y: parseFloat(y) });
        });

        return Vertices.create(points, body);
    };

    /**
     * Returns the centre (centroid) of the set of vertices.
     * @method centre
     * @param {vertices} vertices
     * @return {vector} The centre point
     */
    Vertices.centre = function(vertices) {
        var area = Vertices.area(vertices, true),
            centre = { x: 0, y: 0 },
            cross,
            temp,
            j;

        for (var i = 0; i < vertices.length; i++) {
            j = (i + 1) % vertices.length;
            cross = Vector.cross(vertices[i], vertices[j]);
            temp = Vector.mult(Vector.add(vertices[i], vertices[j]), cross);
            centre = Vector.add(centre, temp);
        }

        return Vector.div(centre, 6 * area);
    };

    /**
     * Returns the average (mean) of the set of vertices.
     * @method mean
     * @param {vertices} vertices
     * @return {vector} The average point
     */
    Vertices.mean = function(vertices) {
        var average = { x: 0, y: 0 };

        for (var i = 0; i < vertices.length; i++) {
            average.x += vertices[i].x;
            average.y += vertices[i].y;
        }

        return Vector.div(average, vertices.length);
    };

    /**
     * Returns the area of the set of vertices.
     * @method area
     * @param {vertices} vertices
     * @param {bool} signed
     * @return {number} The area
     */
    Vertices.area = function(vertices, signed) {
        var area = 0,
            j = vertices.length - 1;

        for (var i = 0; i < vertices.length; i++) {
            area += (vertices[j].x - vertices[i].x) * (vertices[j].y + vertices[i].y);
            j = i;
        }

        if (signed)
            return area / 2;

        return Math.abs(area) / 2;
    };

    /**
     * Returns the moment of inertia (second moment of area) of the set of vertices given the total mass.
     * @method inertia
     * @param {vertices} vertices
     * @param {number} mass
     * @return {number} The polygon's moment of inertia
     */
    Vertices.inertia = function(vertices, mass) {
        var numerator = 0,
            denominator = 0,
            v = vertices,
            cross,
            j;

        // find the polygon's moment of inertia, using second moment of area
        // from equations at http://www.physicsforums.com/showthread.php?t=25293
        for (var n = 0; n < v.length; n++) {
            j = (n + 1) % v.length;
            cross = Math.abs(Vector.cross(v[j], v[n]));
            numerator += cross * (Vector.dot(v[j], v[j]) + Vector.dot(v[j], v[n]) + Vector.dot(v[n], v[n]));
            denominator += cross;
        }

        return (mass / 6) * (numerator / denominator);
    };

    /**
     * Translates the set of vertices in-place.
     * @method translate
     * @param {vertices} vertices
     * @param {vector} vector
     * @param {number} scalar
     */
    Vertices.translate = function(vertices, vector, scalar) {
        var i;
        if (scalar) {
            for (i = 0; i < vertices.length; i++) {
                vertices[i].x += vector.x * scalar;
                vertices[i].y += vector.y * scalar;
            }
        } else {
            for (i = 0; i < vertices.length; i++) {
                vertices[i].x += vector.x;
                vertices[i].y += vector.y;
            }
        }

        return vertices;
    };

    /**
     * Rotates the set of vertices in-place.
     * @method rotate
     * @param {vertices} vertices
     * @param {number} angle
     * @param {vector} point
     */
    Vertices.rotate = function(vertices, angle, point) {
        if (angle === 0)
            return;

        var cos = Math.cos(angle),
            sin = Math.sin(angle);

        for (var i = 0; i < vertices.length; i++) {
            var vertice = vertices[i],
                dx = vertice.x - point.x,
                dy = vertice.y - point.y;
                
            vertice.x = point.x + (dx * cos - dy * sin);
            vertice.y = point.y + (dx * sin + dy * cos);
        }

        return vertices;
    };

    /**
     * Returns `true` if the `point` is inside the set of `vertices`.
     * @method contains
     * @param {vertices} vertices
     * @param {vector} point
     * @return {boolean} True if the vertices contains point, otherwise false
     */
    Vertices.contains = function(vertices, point) {
        for (var i = 0; i < vertices.length; i++) {
            var vertice = vertices[i],
                nextVertice = vertices[(i + 1) % vertices.length];
            if ((point.x - vertice.x) * (nextVertice.y - vertice.y) + (point.y - vertice.y) * (vertice.x - nextVertice.x) > 0) {
                return false;
            }
        }

        return true;
    };

    /**
     * Scales the vertices from a point (default is centre) in-place.
     * @method scale
     * @param {vertices} vertices
     * @param {number} scaleX
     * @param {number} scaleY
     * @param {vector} point
     */
    Vertices.scale = function(vertices, scaleX, scaleY, point) {
        if (scaleX === 1 && scaleY === 1)
            return vertices;

        point = point || Vertices.centre(vertices);

        var vertex,
            delta;

        for (var i = 0; i < vertices.length; i++) {
            vertex = vertices[i];
            delta = Vector.sub(vertex, point);
            vertices[i].x = point.x + delta.x * scaleX;
            vertices[i].y = point.y + delta.y * scaleY;
        }

        return vertices;
    };

    /**
     * Chamfers a set of vertices by giving them rounded corners, returns a new set of vertices.
     * The radius parameter is a single number or an array to specify the radius for each vertex.
     * @method chamfer
     * @param {vertices} vertices
     * @param {number[]} radius
     * @param {number} quality
     * @param {number} qualityMin
     * @param {number} qualityMax
     */
    Vertices.chamfer = function(vertices, radius, quality, qualityMin, qualityMax) {
        radius = radius || [8];

        if (!radius.length)
            radius = [radius];

        // quality defaults to -1, which is auto
        quality = (typeof quality !== 'undefined') ? quality : -1;
        qualityMin = qualityMin || 2;
        qualityMax = qualityMax || 14;

        var newVertices = [];

        for (var i = 0; i < vertices.length; i++) {
            var prevVertex = vertices[i - 1 >= 0 ? i - 1 : vertices.length - 1],
                vertex = vertices[i],
                nextVertex = vertices[(i + 1) % vertices.length],
                currentRadius = radius[i < radius.length ? i : radius.length - 1];

            if (currentRadius === 0) {
                newVertices.push(vertex);
                continue;
            }

            var prevNormal = Vector.normalise({ 
                x: vertex.y - prevVertex.y, 
                y: prevVertex.x - vertex.x
            });

            var nextNormal = Vector.normalise({ 
                x: nextVertex.y - vertex.y, 
                y: vertex.x - nextVertex.x
            });

            var diagonalRadius = Math.sqrt(2 * Math.pow(currentRadius, 2)),
                radiusVector = Vector.mult(Common.clone(prevNormal), currentRadius),
                midNormal = Vector.normalise(Vector.mult(Vector.add(prevNormal, nextNormal), 0.5)),
                scaledVertex = Vector.sub(vertex, Vector.mult(midNormal, diagonalRadius));

            var precision = quality;

            if (quality === -1) {
                // automatically decide precision
                precision = Math.pow(currentRadius, 0.32) * 1.75;
            }

            precision = Common.clamp(precision, qualityMin, qualityMax);

            // use an even value for precision, more likely to reduce axes by using symmetry
            if (precision % 2 === 1)
                precision += 1;

            var alpha = Math.acos(Vector.dot(prevNormal, nextNormal)),
                theta = alpha / precision;

            for (var j = 0; j < precision; j++) {
                newVertices.push(Vector.add(Vector.rotate(radiusVector, theta * j), scaledVertex));
            }
        }

        return newVertices;
    };

    /**
     * Sorts the input vertices into clockwise order in place.
     * @method clockwiseSort
     * @param {vertices} vertices
     * @return {vertices} vertices
     */
    Vertices.clockwiseSort = function(vertices) {
        var centre = Vertices.mean(vertices);

        vertices.sort(function(vertexA, vertexB) {
            return Vector.angle(centre, vertexA) - Vector.angle(centre, vertexB);
        });

        return vertices;
    };

    /**
     * Returns true if the vertices form a convex shape (vertices must be in clockwise order).
     * @method isConvex
     * @param {vertices} vertices
     * @return {bool} `true` if the `vertices` are convex, `false` if not (or `null` if not computable).
     */
    Vertices.isConvex = function(vertices) {
        // http://paulbourke.net/geometry/polygonmesh/
        // Copyright (c) Paul Bourke (use permitted)

        var flag = 0,
            n = vertices.length,
            i,
            j,
            k,
            z;

        if (n < 3)
            return null;

        for (i = 0; i < n; i++) {
            j = (i + 1) % n;
            k = (i + 2) % n;
            z = (vertices[j].x - vertices[i].x) * (vertices[k].y - vertices[j].y);
            z -= (vertices[j].y - vertices[i].y) * (vertices[k].x - vertices[j].x);

            if (z < 0) {
                flag |= 1;
            } else if (z > 0) {
                flag |= 2;
            }

            if (flag === 3) {
                return false;
            }
        }

        if (flag !== 0){
            return true;
        } else {
            return null;
        }
    };

    /**
     * Returns the convex hull of the input vertices as a new array of points.
     * @method hull
     * @param {vertices} vertices
     * @return [vertex] vertices
     */
    Vertices.hull = function(vertices) {
        // http://geomalgorithms.com/a10-_hull-1.html

        var upper = [],
            lower = [], 
            vertex,
            i;

        // sort vertices on x-axis (y-axis for ties)
        vertices = vertices.slice(0);
        vertices.sort(function(vertexA, vertexB) {
            var dx = vertexA.x - vertexB.x;
            return dx !== 0 ? dx : vertexA.y - vertexB.y;
        });

        // build lower hull
        for (i = 0; i < vertices.length; i += 1) {
            vertex = vertices[i];

            while (lower.length >= 2 
                   && Vector.cross3(lower[lower.length - 2], lower[lower.length - 1], vertex) <= 0) {
                lower.pop();
            }

            lower.push(vertex);
        }

        // build upper hull
        for (i = vertices.length - 1; i >= 0; i -= 1) {
            vertex = vertices[i];

            while (upper.length >= 2 
                   && Vector.cross3(upper[upper.length - 2], upper[upper.length - 1], vertex) <= 0) {
                upper.pop();
            }

            upper.push(vertex);
        }

        // concatenation of the lower and upper hulls gives the convex hull
        // omit last points because they are repeated at the beginning of the other list
        upper.pop();
        lower.pop();

        return upper.concat(lower);
    };

})();

},{"../core/Common":14,"../geometry/Vector":28}],30:[function(_dereq_,module,exports){
var Matter = module.exports = _dereq_('../core/Matter');

Matter.Body = _dereq_('../body/Body');
Matter.Composite = _dereq_('../body/Composite');
Matter.World = _dereq_('../body/World');

Matter.Contact = _dereq_('../collision/Contact');
Matter.Detector = _dereq_('../collision/Detector');
Matter.Grid = _dereq_('../collision/Grid');
Matter.Pairs = _dereq_('../collision/Pairs');
Matter.Pair = _dereq_('../collision/Pair');
Matter.Query = _dereq_('../collision/Query');
Matter.Resolver = _dereq_('../collision/Resolver');
Matter.SAT = _dereq_('../collision/SAT');

Matter.Constraint = _dereq_('../constraint/Constraint');
Matter.MouseConstraint = _dereq_('../constraint/MouseConstraint');

Matter.Common = _dereq_('../core/Common');
Matter.Engine = _dereq_('../core/Engine');
Matter.Events = _dereq_('../core/Events');
Matter.Mouse = _dereq_('../core/Mouse');
Matter.Runner = _dereq_('../core/Runner');
Matter.Sleeping = _dereq_('../core/Sleeping');
Matter.Plugin = _dereq_('../core/Plugin');


Matter.Bodies = _dereq_('../factory/Bodies');
Matter.Composites = _dereq_('../factory/Composites');

Matter.Axes = _dereq_('../geometry/Axes');
Matter.Bounds = _dereq_('../geometry/Bounds');
Matter.Svg = _dereq_('../geometry/Svg');
Matter.Vector = _dereq_('../geometry/Vector');
Matter.Vertices = _dereq_('../geometry/Vertices');

Matter.Render = _dereq_('../render/Render');
Matter.RenderPixi = _dereq_('../render/RenderPixi');

// aliases

Matter.World.add = Matter.Composite.add;
Matter.World.remove = Matter.Composite.remove;
Matter.World.addComposite = Matter.Composite.addComposite;
Matter.World.addBody = Matter.Composite.addBody;
Matter.World.addConstraint = Matter.Composite.addConstraint;
Matter.World.clear = Matter.Composite.clear;
Matter.Engine.run = Matter.Runner.run;

},{"../body/Body":1,"../body/Composite":2,"../body/World":3,"../collision/Contact":4,"../collision/Detector":5,"../collision/Grid":6,"../collision/Pair":7,"../collision/Pairs":8,"../collision/Query":9,"../collision/Resolver":10,"../collision/SAT":11,"../constraint/Constraint":12,"../constraint/MouseConstraint":13,"../core/Common":14,"../core/Engine":15,"../core/Events":16,"../core/Matter":17,"../core/Metrics":18,"../core/Mouse":19,"../core/Plugin":20,"../core/Runner":21,"../core/Sleeping":22,"../factory/Bodies":23,"../factory/Composites":24,"../geometry/Axes":25,"../geometry/Bounds":26,"../geometry/Svg":27,"../geometry/Vector":28,"../geometry/Vertices":29,"../render/Render":31,"../render/RenderPixi":32}],31:[function(_dereq_,module,exports){
/**
* The `Matter.Render` module is a simple HTML5 canvas based renderer for visualising instances of `Matter.Engine`.
* It is intended for development and debugging purposes, but may also be suitable for simple games.
* It includes a number of drawing options including wireframe, vector with support for sprites and viewports.
*
* @class Render
*/

var Render = {};

module.exports = Render;

var Common = _dereq_('../core/Common');
var Composite = _dereq_('../body/Composite');
var Bounds = _dereq_('../geometry/Bounds');
var Events = _dereq_('../core/Events');
var Grid = _dereq_('../collision/Grid');
var Vector = _dereq_('../geometry/Vector');
var Mouse = _dereq_('../core/Mouse');

(function() {
    
    var _requestAnimationFrame,
        _cancelAnimationFrame;

    if (typeof window !== 'undefined') {
        _requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame
                                      || window.mozRequestAnimationFrame || window.msRequestAnimationFrame 
                                      || function(callback){ window.setTimeout(function() { callback(Common.now()); }, 1000 / 60); };
   
        _cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame 
                                      || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;
    }

    /**
     * Creates a new renderer. The options parameter is an object that specifies any properties you wish to override the defaults.
     * All properties have default values, and many are pre-calculated automatically based on other properties.
     * See the properties section below for detailed information on what you can pass via the `options` object.
     * @method create
     * @param {object} [options]
     * @return {render} A new renderer
     */
    Render.create = function(options) {
        var defaults = {
            controller: Render,
            engine: null,
            element: null,
            canvas: null,
            mouse: null,
            frameRequestId: null,
            options: {
                width: 800,
                height: 600,
                pixelRatio: 1,
                background: '#18181d',
                wireframeBackground: '#0f0f13',
                hasBounds: !!options.bounds,
                enabled: true,
                wireframes: true,
                showSleeping: true,
                showDebug: false,
                showBroadphase: false,
                showBounds: false,
                showVelocity: false,
                showCollisions: false,
                showSeparations: false,
                showAxes: false,
                showPositions: false,
                showAngleIndicator: false,
                showIds: false,
                showShadows: false,
                showVertexNumbers: false,
                showConvexHulls: false,
                showInternalEdges: false,
                showMousePosition: false
            }
        };

        var render = Common.extend(defaults, options);

        if (render.canvas) {
            render.canvas.width = render.options.width || render.canvas.width;
            render.canvas.height = render.options.height || render.canvas.height;
        }

        render.mouse = options.mouse;
        render.engine = options.engine;
        render.canvas = render.canvas || _createCanvas(render.options.width, render.options.height);
        render.context = render.canvas.getContext('2d');
        render.textures = {};

        render.bounds = render.bounds || { 
            min: { 
                x: 0,
                y: 0
            }, 
            max: { 
                x: render.canvas.width,
                y: render.canvas.height
            }
        };

        if (render.options.pixelRatio !== 1) {
            Render.setPixelRatio(render, render.options.pixelRatio);
        }

        if (Common.isElement(render.element)) {
            render.element.appendChild(render.canvas);
        } else {
            Common.log('Render.create: options.element was undefined, render.canvas was created but not appended', 'warn');
        }

        return render;
    };

    /**
     * Continuously updates the render canvas on the `requestAnimationFrame` event.
     * @method run
     * @param {render} render
     */
    Render.run = function(render) {
        (function loop(time){
            render.frameRequestId = _requestAnimationFrame(loop);
            Render.world(render);
        })();
    };

    /**
     * Ends execution of `Render.run` on the given `render`, by canceling the animation frame request event loop.
     * @method stop
     * @param {render} render
     */
    Render.stop = function(render) {
        _cancelAnimationFrame(render.frameRequestId);
    };

    /**
     * Sets the pixel ratio of the renderer and updates the canvas.
     * To automatically detect the correct ratio, pass the string `'auto'` for `pixelRatio`.
     * @method setPixelRatio
     * @param {render} render
     * @param {number} pixelRatio
     */
    Render.setPixelRatio = function(render, pixelRatio) {
        var options = render.options,
            canvas = render.canvas;

        if (pixelRatio === 'auto') {
            pixelRatio = _getPixelRatio(canvas);
        }

        options.pixelRatio = pixelRatio;
        canvas.setAttribute('data-pixel-ratio', pixelRatio);
        canvas.width = options.width * pixelRatio;
        canvas.height = options.height * pixelRatio;
        canvas.style.width = options.width + 'px';
        canvas.style.height = options.height + 'px';
        render.context.scale(pixelRatio, pixelRatio);
    };

    /**
     * Positions and sizes the viewport around the given object bounds.
     * Objects must have at least one of the following properties:
     * - `object.bounds`
     * - `object.position`
     * - `object.min` and `object.max`
     * - `object.x` and `object.y`
     * @method lookAt
     * @param {render} render
     * @param {object[]} objects
     * @param {vector} [padding]
     * @param {bool} [center=true]
     */
    Render.lookAt = function(render, objects, padding, center) {
        center = typeof center !== 'undefined' ? center : true;
        objects = Common.isArray(objects) ? objects : [objects];
        padding = padding || {
            x: 0,
            y: 0
        };

        // find bounds of all objects
        var bounds = {
            min: { x: Infinity, y: Infinity },
            max: { x: -Infinity, y: -Infinity }
        };

        for (var i = 0; i < objects.length; i += 1) {
            var object = objects[i],
                min = object.bounds ? object.bounds.min : (object.min || object.position || object),
                max = object.bounds ? object.bounds.max : (object.max || object.position || object); 

            if (min && max) { 
                if (min.x < bounds.min.x) 
                    bounds.min.x = min.x;
                    
                if (max.x > bounds.max.x) 
                    bounds.max.x = max.x;

                if (min.y < bounds.min.y) 
                    bounds.min.y = min.y;

                if (max.y > bounds.max.y) 
                    bounds.max.y = max.y;
            }
        }

        // find ratios
        var width = (bounds.max.x - bounds.min.x) + 2 * padding.x,
            height = (bounds.max.y - bounds.min.y) + 2 * padding.y,
            viewHeight = render.canvas.height,
            viewWidth = render.canvas.width,
            outerRatio = viewWidth / viewHeight,
            innerRatio = width / height,
            scaleX = 1,
            scaleY = 1;

        // find scale factor
        if (innerRatio > outerRatio) {
            scaleY = innerRatio / outerRatio;
        } else {
            scaleX = outerRatio / innerRatio;
        }

        // enable bounds
        render.options.hasBounds = true;

        // position and size
        render.bounds.min.x = bounds.min.x;
        render.bounds.max.x = bounds.min.x + width * scaleX;
        render.bounds.min.y = bounds.min.y;
        render.bounds.max.y = bounds.min.y + height * scaleY;

        // center
        if (center) {
            render.bounds.min.x += width * 0.5 - (width * scaleX) * 0.5;
            render.bounds.max.x += width * 0.5 - (width * scaleX) * 0.5;
            render.bounds.min.y += height * 0.5 - (height * scaleY) * 0.5;
            render.bounds.max.y += height * 0.5 - (height * scaleY) * 0.5;
        }

        // padding
        render.bounds.min.x -= padding.x;
        render.bounds.max.x -= padding.x;
        render.bounds.min.y -= padding.y;
        render.bounds.max.y -= padding.y;

        // update mouse
        if (render.mouse) {
            Mouse.setScale(render.mouse, {
                x: (render.bounds.max.x - render.bounds.min.x) / render.canvas.width,
                y: (render.bounds.max.y - render.bounds.min.y) / render.canvas.height
            });

            Mouse.setOffset(render.mouse, render.bounds.min);
        }
    };

    /**
     * Applies viewport transforms based on `render.bounds` to a render context.
     * @method startViewTransform
     * @param {render} render
     */
    Render.startViewTransform = function(render) {
        var boundsWidth = render.bounds.max.x - render.bounds.min.x,
            boundsHeight = render.bounds.max.y - render.bounds.min.y,
            boundsScaleX = boundsWidth / render.options.width,
            boundsScaleY = boundsHeight / render.options.height;

        render.context.scale(1 / boundsScaleX, 1 / boundsScaleY);
        render.context.translate(-render.bounds.min.x, -render.bounds.min.y);
    };

    /**
     * Resets all transforms on the render context.
     * @method endViewTransform
     * @param {render} render
     */
    Render.endViewTransform = function(render) {
        render.context.setTransform(render.options.pixelRatio, 0, 0, render.options.pixelRatio, 0, 0);
    };

    /**
     * Renders the given `engine`'s `Matter.World` object.
     * This is the entry point for all rendering and should be called every time the scene changes.
     * @method world
     * @param {render} render
     */
    Render.world = function(render) {
        var engine = render.engine,
            world = engine.world,
            canvas = render.canvas,
            context = render.context,
            options = render.options,
            allBodies = Composite.allBodies(world),
            allConstraints = Composite.allConstraints(world),
            background = options.wireframes ? options.wireframeBackground : options.background,
            bodies = [],
            constraints = [],
            i;

        var event = {
            timestamp: engine.timing.timestamp
        };

        Events.trigger(render, 'beforeRender', event);

        // apply background if it has changed
        if (render.currentBackground !== background)
            _applyBackground(render, background);

        // clear the canvas with a transparent fill, to allow the canvas background to show
        context.globalCompositeOperation = 'source-in';
        context.fillStyle = "transparent";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.globalCompositeOperation = 'source-over';

        // handle bounds
        if (options.hasBounds) {
            // filter out bodies that are not in view
            for (i = 0; i < allBodies.length; i++) {
                var body = allBodies[i];
                if (Bounds.overlaps(body.bounds, render.bounds))
                    bodies.push(body);
            }

            // filter out constraints that are not in view
            for (i = 0; i < allConstraints.length; i++) {
                var constraint = allConstraints[i],
                    bodyA = constraint.bodyA,
                    bodyB = constraint.bodyB,
                    pointAWorld = constraint.pointA,
                    pointBWorld = constraint.pointB;

                if (bodyA) pointAWorld = Vector.add(bodyA.position, constraint.pointA);
                if (bodyB) pointBWorld = Vector.add(bodyB.position, constraint.pointB);

                if (!pointAWorld || !pointBWorld)
                    continue;

                if (Bounds.contains(render.bounds, pointAWorld) || Bounds.contains(render.bounds, pointBWorld))
                    constraints.push(constraint);
            }

            // transform the view
            Render.startViewTransform(render);

            // update mouse
            if (render.mouse) {
                Mouse.setScale(render.mouse, {
                    x: (render.bounds.max.x - render.bounds.min.x) / render.canvas.width,
                    y: (render.bounds.max.y - render.bounds.min.y) / render.canvas.height
                });

                Mouse.setOffset(render.mouse, render.bounds.min);
            }
        } else {
            constraints = allConstraints;
            bodies = allBodies;
        }

        if (!options.wireframes || (engine.enableSleeping && options.showSleeping)) {
            // fully featured rendering of bodies
            Render.bodies(render, bodies, context);
        } else {
            if (options.showConvexHulls)
                Render.bodyConvexHulls(render, bodies, context);

            // optimised method for wireframes only
            Render.bodyWireframes(render, bodies, context);
        }

        if (options.showBounds)
            Render.bodyBounds(render, bodies, context);

        if (options.showAxes || options.showAngleIndicator)
            Render.bodyAxes(render, bodies, context);
        
        if (options.showPositions)
            Render.bodyPositions(render, bodies, context);

        if (options.showVelocity)
            Render.bodyVelocity(render, bodies, context);

        if (options.showIds)
            Render.bodyIds(render, bodies, context);

        if (options.showSeparations)
            Render.separations(render, engine.pairs.list, context);

        if (options.showCollisions)
            Render.collisions(render, engine.pairs.list, context);

        if (options.showVertexNumbers)
            Render.vertexNumbers(render, bodies, context);

        if (options.showMousePosition)
            Render.mousePosition(render, render.mouse, context);

        Render.constraints(constraints, context);

        if (options.showBroadphase && engine.broadphase.controller === Grid)
            Render.grid(render, engine.broadphase, context);

        if (options.showDebug)
            Render.debug(render, context);

        if (options.hasBounds) {
            // revert view transforms
            Render.endViewTransform(render);
        }

        Events.trigger(render, 'afterRender', event);
    };

    /**
     * Description
     * @private
     * @method debug
     * @param {render} render
     * @param {RenderingContext} context
     */
    Render.debug = function(render, context) {
        var c = context,
            engine = render.engine,
            world = engine.world,
            metrics = engine.metrics,
            options = render.options,
            bodies = Composite.allBodies(world),
            space = "    ";

        if (engine.timing.timestamp - (render.debugTimestamp || 0) >= 500) {
            var text = "";

            if (metrics.timing) {
                text += "fps: " + Math.round(metrics.timing.fps) + space;
            }


            render.debugString = text;
            render.debugTimestamp = engine.timing.timestamp;
        }

        if (render.debugString) {
            c.font = "12px Arial";

            if (options.wireframes) {
                c.fillStyle = 'rgba(255,255,255,0.5)';
            } else {
                c.fillStyle = 'rgba(0,0,0,0.5)';
            }

            var split = render.debugString.split('\n');

            for (var i = 0; i < split.length; i++) {
                c.fillText(split[i], 50, 50 + i * 18);
            }
        }
    };

    /**
     * Description
     * @private
     * @method constraints
     * @param {constraint[]} constraints
     * @param {RenderingContext} context
     */
    Render.constraints = function(constraints, context) {
        var c = context;

        for (var i = 0; i < constraints.length; i++) {
            var constraint = constraints[i];

            if (!constraint.render.visible || !constraint.pointA || !constraint.pointB)
                continue;

            var bodyA = constraint.bodyA,
                bodyB = constraint.bodyB,
                start,
                end;

            if (bodyA) {
                start = Vector.add(bodyA.position, constraint.pointA);
            } else {
                start = constraint.pointA;
            }

            if (constraint.render.type === 'pin') {
                c.beginPath();
                c.arc(start.x, start.y, 3, 0, 2 * Math.PI);
                c.closePath();
            } else {
                if (bodyB) {
                    end = Vector.add(bodyB.position, constraint.pointB);
                } else {
                    end = constraint.pointB;
                }

                c.beginPath();
                c.moveTo(start.x, start.y);

                if (constraint.render.type === 'spring') {
                    var delta = Vector.sub(end, start),
                        normal = Vector.perp(Vector.normalise(delta)),
                        coils = Math.ceil(Common.clamp(constraint.length / 5, 12, 20)),
                        offset;

                    for (var j = 1; j < coils; j += 1) {
                        offset = j % 2 === 0 ? 1 : -1;

                        c.lineTo(
                            start.x + delta.x * (j / coils) + normal.x * offset * 4,
                            start.y + delta.y * (j / coils) + normal.y * offset * 4
                        );
                    }
                }

                c.lineTo(end.x, end.y);
            }

            if (constraint.render.lineWidth) {
                c.lineWidth = constraint.render.lineWidth;
                c.strokeStyle = constraint.render.strokeStyle;
                c.stroke();
            }

            if (constraint.render.anchors) {
                c.fillStyle = constraint.render.strokeStyle;
                c.beginPath();
                c.arc(start.x, start.y, 3, 0, 2 * Math.PI);
                c.arc(end.x, end.y, 3, 0, 2 * Math.PI);
                c.closePath();
                c.fill();
            }
        }
    };
    
    /**
     * Description
     * @private
     * @method bodyShadows
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodyShadows = function(render, bodies, context) {
        var c = context,
            engine = render.engine;

        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];

            if (!body.render.visible)
                continue;

            if (body.circleRadius) {
                c.beginPath();
                c.arc(body.position.x, body.position.y, body.circleRadius, 0, 2 * Math.PI);
                c.closePath();
            } else {
                c.beginPath();
                c.moveTo(body.vertices[0].x, body.vertices[0].y);
                for (var j = 1; j < body.vertices.length; j++) {
                    c.lineTo(body.vertices[j].x, body.vertices[j].y);
                }
                c.closePath();
            }

            var distanceX = body.position.x - render.options.width * 0.5,
                distanceY = body.position.y - render.options.height * 0.2,
                distance = Math.abs(distanceX) + Math.abs(distanceY);

            c.shadowColor = 'rgba(0,0,0,0.15)';
            c.shadowOffsetX = 0.05 * distanceX;
            c.shadowOffsetY = 0.05 * distanceY;
            c.shadowBlur = 1 + 12 * Math.min(1, distance / 1000);

            c.fill();

            c.shadowColor = null;
            c.shadowOffsetX = null;
            c.shadowOffsetY = null;
            c.shadowBlur = null;
        }
    };

    /**
     * Description
     * @private
     * @method bodies
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodies = function(render, bodies, context) {
        var c = context,
            engine = render.engine,
            options = render.options,
            showInternalEdges = options.showInternalEdges || !options.wireframes,
            body,
            part,
            i,
            k;

        for (i = 0; i < bodies.length; i++) {
            body = bodies[i];

            if (!body.render.visible)
                continue;

            // handle compound parts
            for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
                part = body.parts[k];

                if (!part.render.visible)
                    continue;

                if (options.showSleeping && body.isSleeping) {
                    c.globalAlpha = 0.5 * part.render.opacity;
                } else if (part.render.opacity !== 1) {
                    c.globalAlpha = part.render.opacity;
                }

                if (part.render.sprite && part.render.sprite.texture && !options.wireframes) {
                    // part sprite
                    var sprite = part.render.sprite,
                        texture = _getTexture(render, sprite.texture);

                    c.translate(part.position.x, part.position.y); 
                    c.rotate(part.angle);

                    c.drawImage(
                        texture,
                        texture.width * -sprite.xOffset * sprite.xScale, 
                        texture.height * -sprite.yOffset * sprite.yScale, 
                        texture.width * sprite.xScale, 
                        texture.height * sprite.yScale
                    );

                    // revert translation, hopefully faster than save / restore
                    c.rotate(-part.angle);
                    c.translate(-part.position.x, -part.position.y); 
                } else {
                    // part polygon
                    if (part.circleRadius) {
                        c.beginPath();
                        c.arc(part.position.x, part.position.y, part.circleRadius, 0, 2 * Math.PI);
                    } else {
                        c.beginPath();
                        c.moveTo(part.vertices[0].x, part.vertices[0].y);

                        for (var j = 1; j < part.vertices.length; j++) {
                            if (!part.vertices[j - 1].isInternal || showInternalEdges) {
                                c.lineTo(part.vertices[j].x, part.vertices[j].y);
                            } else {
                                c.moveTo(part.vertices[j].x, part.vertices[j].y);
                            }

                            if (part.vertices[j].isInternal && !showInternalEdges) {
                                c.moveTo(part.vertices[(j + 1) % part.vertices.length].x, part.vertices[(j + 1) % part.vertices.length].y);
                            }
                        }
                        
                        c.lineTo(part.vertices[0].x, part.vertices[0].y);
                        c.closePath();
                    }

                    if (!options.wireframes) {
                        c.fillStyle = part.render.fillStyle;

                        if (part.render.lineWidth) {
                            c.lineWidth = part.render.lineWidth;
                            c.strokeStyle = part.render.strokeStyle;
                            c.stroke();
                        }

                        c.fill();
                    } else {
                        c.lineWidth = 1;
                        c.strokeStyle = '#bbb';
                        c.stroke();
                    }
                }

                c.globalAlpha = 1;
            }
        }
    };

    /**
     * Optimised method for drawing body wireframes in one pass
     * @private
     * @method bodyWireframes
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodyWireframes = function(render, bodies, context) {
        var c = context,
            showInternalEdges = render.options.showInternalEdges,
            body,
            part,
            i,
            j,
            k;

        c.beginPath();

        // render all bodies
        for (i = 0; i < bodies.length; i++) {
            body = bodies[i];

            if (!body.render.visible)
                continue;

            // handle compound parts
            for (k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
                part = body.parts[k];

                c.moveTo(part.vertices[0].x, part.vertices[0].y);

                for (j = 1; j < part.vertices.length; j++) {
                    if (!part.vertices[j - 1].isInternal || showInternalEdges) {
                        c.lineTo(part.vertices[j].x, part.vertices[j].y);
                    } else {
                        c.moveTo(part.vertices[j].x, part.vertices[j].y);
                    }

                    if (part.vertices[j].isInternal && !showInternalEdges) {
                        c.moveTo(part.vertices[(j + 1) % part.vertices.length].x, part.vertices[(j + 1) % part.vertices.length].y);
                    }
                }
                
                c.lineTo(part.vertices[0].x, part.vertices[0].y);
            }
        }

        c.lineWidth = 1;
        c.strokeStyle = '#bbb';
        c.stroke();
    };

    /**
     * Optimised method for drawing body convex hull wireframes in one pass
     * @private
     * @method bodyConvexHulls
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodyConvexHulls = function(render, bodies, context) {
        var c = context,
            body,
            part,
            i,
            j,
            k;

        c.beginPath();

        // render convex hulls
        for (i = 0; i < bodies.length; i++) {
            body = bodies[i];

            if (!body.render.visible || body.parts.length === 1)
                continue;

            c.moveTo(body.vertices[0].x, body.vertices[0].y);

            for (j = 1; j < body.vertices.length; j++) {
                c.lineTo(body.vertices[j].x, body.vertices[j].y);
            }
            
            c.lineTo(body.vertices[0].x, body.vertices[0].y);
        }

        c.lineWidth = 1;
        c.strokeStyle = 'rgba(255,255,255,0.2)';
        c.stroke();
    };

    /**
     * Renders body vertex numbers.
     * @private
     * @method vertexNumbers
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.vertexNumbers = function(render, bodies, context) {
        var c = context,
            i,
            j,
            k;

        for (i = 0; i < bodies.length; i++) {
            var parts = bodies[i].parts;
            for (k = parts.length > 1 ? 1 : 0; k < parts.length; k++) {
                var part = parts[k];
                for (j = 0; j < part.vertices.length; j++) {
                    c.fillStyle = 'rgba(255,255,255,0.2)';
                    c.fillText(i + '_' + j, part.position.x + (part.vertices[j].x - part.position.x) * 0.8, part.position.y + (part.vertices[j].y - part.position.y) * 0.8);
                }
            }
        }
    };

    /**
     * Renders mouse position.
     * @private
     * @method mousePosition
     * @param {render} render
     * @param {mouse} mouse
     * @param {RenderingContext} context
     */
    Render.mousePosition = function(render, mouse, context) {
        var c = context;
        c.fillStyle = 'rgba(255,255,255,0.8)';
        c.fillText(mouse.position.x + '  ' + mouse.position.y, mouse.position.x + 5, mouse.position.y - 5);
    };

    /**
     * Draws body bounds
     * @private
     * @method bodyBounds
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodyBounds = function(render, bodies, context) {
        var c = context,
            engine = render.engine,
            options = render.options;

        c.beginPath();

        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];

            if (body.render.visible) {
                var parts = bodies[i].parts;
                for (var j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
                    var part = parts[j];
                    c.rect(part.bounds.min.x, part.bounds.min.y, part.bounds.max.x - part.bounds.min.x, part.bounds.max.y - part.bounds.min.y);
                }
            }
        }

        if (options.wireframes) {
            c.strokeStyle = 'rgba(255,255,255,0.08)';
        } else {
            c.strokeStyle = 'rgba(0,0,0,0.1)';
        }

        c.lineWidth = 1;
        c.stroke();
    };

    /**
     * Draws body angle indicators and axes
     * @private
     * @method bodyAxes
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodyAxes = function(render, bodies, context) {
        var c = context,
            engine = render.engine,
            options = render.options,
            part,
            i,
            j,
            k;

        c.beginPath();

        for (i = 0; i < bodies.length; i++) {
            var body = bodies[i],
                parts = body.parts;

            if (!body.render.visible)
                continue;

            if (options.showAxes) {
                // render all axes
                for (j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
                    part = parts[j];
                    for (k = 0; k < part.axes.length; k++) {
                        var axis = part.axes[k];
                        c.moveTo(part.position.x, part.position.y);
                        c.lineTo(part.position.x + axis.x * 20, part.position.y + axis.y * 20);
                    }
                }
            } else {
                for (j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
                    part = parts[j];
                    for (k = 0; k < part.axes.length; k++) {
                        // render a single axis indicator
                        c.moveTo(part.position.x, part.position.y);
                        c.lineTo((part.vertices[0].x + part.vertices[part.vertices.length-1].x) / 2, 
                                 (part.vertices[0].y + part.vertices[part.vertices.length-1].y) / 2);
                    }
                }
            }
        }

        if (options.wireframes) {
            c.strokeStyle = 'indianred';
            c.lineWidth = 1;
        } else {
            c.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            c.globalCompositeOperation = 'overlay';
            c.lineWidth = 2;
        }

        c.stroke();
        c.globalCompositeOperation = 'source-over';
    };

    /**
     * Draws body positions
     * @private
     * @method bodyPositions
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodyPositions = function(render, bodies, context) {
        var c = context,
            engine = render.engine,
            options = render.options,
            body,
            part,
            i,
            k;

        c.beginPath();

        // render current positions
        for (i = 0; i < bodies.length; i++) {
            body = bodies[i];

            if (!body.render.visible)
                continue;

            // handle compound parts
            for (k = 0; k < body.parts.length; k++) {
                part = body.parts[k];
                c.arc(part.position.x, part.position.y, 3, 0, 2 * Math.PI, false);
                c.closePath();
            }
        }

        if (options.wireframes) {
            c.fillStyle = 'indianred';
        } else {
            c.fillStyle = 'rgba(0,0,0,0.5)';
        }
        c.fill();

        c.beginPath();

        // render previous positions
        for (i = 0; i < bodies.length; i++) {
            body = bodies[i];
            if (body.render.visible) {
                c.arc(body.positionPrev.x, body.positionPrev.y, 2, 0, 2 * Math.PI, false);
                c.closePath();
            }
        }

        c.fillStyle = 'rgba(255,165,0,0.8)';
        c.fill();
    };

    /**
     * Draws body velocity
     * @private
     * @method bodyVelocity
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodyVelocity = function(render, bodies, context) {
        var c = context;

        c.beginPath();

        for (var i = 0; i < bodies.length; i++) {
            var body = bodies[i];

            if (!body.render.visible)
                continue;

            c.moveTo(body.position.x, body.position.y);
            c.lineTo(body.position.x + (body.position.x - body.positionPrev.x) * 2, body.position.y + (body.position.y - body.positionPrev.y) * 2);
        }

        c.lineWidth = 3;
        c.strokeStyle = 'cornflowerblue';
        c.stroke();
    };

    /**
     * Draws body ids
     * @private
     * @method bodyIds
     * @param {render} render
     * @param {body[]} bodies
     * @param {RenderingContext} context
     */
    Render.bodyIds = function(render, bodies, context) {
        var c = context,
            i,
            j;

        for (i = 0; i < bodies.length; i++) {
            if (!bodies[i].render.visible)
                continue;

            var parts = bodies[i].parts;
            for (j = parts.length > 1 ? 1 : 0; j < parts.length; j++) {
                var part = parts[j];
                c.font = "12px Arial";
                c.fillStyle = 'rgba(255,255,255,0.5)';
                c.fillText(part.id, part.position.x + 10, part.position.y - 10);
            }
        }
    };

    /**
     * Description
     * @private
     * @method collisions
     * @param {render} render
     * @param {pair[]} pairs
     * @param {RenderingContext} context
     */
    Render.collisions = function(render, pairs, context) {
        var c = context,
            options = render.options,
            pair,
            collision,
            corrected,
            bodyA,
            bodyB,
            i,
            j;

        c.beginPath();

        // render collision positions
        for (i = 0; i < pairs.length; i++) {
            pair = pairs[i];

            if (!pair.isActive)
                continue;

            collision = pair.collision;
            for (j = 0; j < pair.activeContacts.length; j++) {
                var contact = pair.activeContacts[j],
                    vertex = contact.vertex;
                c.rect(vertex.x - 1.5, vertex.y - 1.5, 3.5, 3.5);
            }
        }

        if (options.wireframes) {
            c.fillStyle = 'rgba(255,255,255,0.7)';
        } else {
            c.fillStyle = 'orange';
        }
        c.fill();

        c.beginPath();
            
        // render collision normals
        for (i = 0; i < pairs.length; i++) {
            pair = pairs[i];

            if (!pair.isActive)
                continue;

            collision = pair.collision;

            if (pair.activeContacts.length > 0) {
                var normalPosX = pair.activeContacts[0].vertex.x,
                    normalPosY = pair.activeContacts[0].vertex.y;

                if (pair.activeContacts.length === 2) {
                    normalPosX = (pair.activeContacts[0].vertex.x + pair.activeContacts[1].vertex.x) / 2;
                    normalPosY = (pair.activeContacts[0].vertex.y + pair.activeContacts[1].vertex.y) / 2;
                }
                
                if (collision.bodyB === collision.supports[0].body || collision.bodyA.isStatic === true) {
                    c.moveTo(normalPosX - collision.normal.x * 8, normalPosY - collision.normal.y * 8);
                } else {
                    c.moveTo(normalPosX + collision.normal.x * 8, normalPosY + collision.normal.y * 8);
                }

                c.lineTo(normalPosX, normalPosY);
            }
        }

        if (options.wireframes) {
            c.strokeStyle = 'rgba(255,165,0,0.7)';
        } else {
            c.strokeStyle = 'orange';
        }

        c.lineWidth = 1;
        c.stroke();
    };

    /**
     * Description
     * @private
     * @method separations
     * @param {render} render
     * @param {pair[]} pairs
     * @param {RenderingContext} context
     */
    Render.separations = function(render, pairs, context) {
        var c = context,
            options = render.options,
            pair,
            collision,
            corrected,
            bodyA,
            bodyB,
            i,
            j;

        c.beginPath();

        // render separations
        for (i = 0; i < pairs.length; i++) {
            pair = pairs[i];

            if (!pair.isActive)
                continue;

            collision = pair.collision;
            bodyA = collision.bodyA;
            bodyB = collision.bodyB;

            var k = 1;

            if (!bodyB.isStatic && !bodyA.isStatic) k = 0.5;
            if (bodyB.isStatic) k = 0;

            c.moveTo(bodyB.position.x, bodyB.position.y);
            c.lineTo(bodyB.position.x - collision.penetration.x * k, bodyB.position.y - collision.penetration.y * k);

            k = 1;

            if (!bodyB.isStatic && !bodyA.isStatic) k = 0.5;
            if (bodyA.isStatic) k = 0;

            c.moveTo(bodyA.position.x, bodyA.position.y);
            c.lineTo(bodyA.position.x + collision.penetration.x * k, bodyA.position.y + collision.penetration.y * k);
        }

        if (options.wireframes) {
            c.strokeStyle = 'rgba(255,165,0,0.5)';
        } else {
            c.strokeStyle = 'orange';
        }
        c.stroke();
    };

    /**
     * Description
     * @private
     * @method grid
     * @param {render} render
     * @param {grid} grid
     * @param {RenderingContext} context
     */
    Render.grid = function(render, grid, context) {
        var c = context,
            options = render.options;

        if (options.wireframes) {
            c.strokeStyle = 'rgba(255,180,0,0.1)';
        } else {
            c.strokeStyle = 'rgba(255,180,0,0.5)';
        }

        c.beginPath();

        var bucketKeys = Common.keys(grid.buckets);

        for (var i = 0; i < bucketKeys.length; i++) {
            var bucketId = bucketKeys[i];

            if (grid.buckets[bucketId].length < 2)
                continue;

            var region = bucketId.split(/C|R/);
            c.rect(0.5 + parseInt(region[1], 10) * grid.bucketWidth, 
                    0.5 + parseInt(region[2], 10) * grid.bucketHeight, 
                    grid.bucketWidth, 
                    grid.bucketHeight);
        }

        c.lineWidth = 1;
        c.stroke();
    };

    /**
     * Description
     * @private
     * @method inspector
     * @param {inspector} inspector
     * @param {RenderingContext} context
     */
    Render.inspector = function(inspector, context) {
        var engine = inspector.engine,
            selected = inspector.selected,
            render = inspector.render,
            options = render.options,
            bounds;

        if (options.hasBounds) {
            var boundsWidth = render.bounds.max.x - render.bounds.min.x,
                boundsHeight = render.bounds.max.y - render.bounds.min.y,
                boundsScaleX = boundsWidth / render.options.width,
                boundsScaleY = boundsHeight / render.options.height;
            
            context.scale(1 / boundsScaleX, 1 / boundsScaleY);
            context.translate(-render.bounds.min.x, -render.bounds.min.y);
        }

        for (var i = 0; i < selected.length; i++) {
            var item = selected[i].data;

            context.translate(0.5, 0.5);
            context.lineWidth = 1;
            context.strokeStyle = 'rgba(255,165,0,0.9)';
            context.setLineDash([1,2]);

            switch (item.type) {

            case 'body':

                // render body selections
                bounds = item.bounds;
                context.beginPath();
                context.rect(Math.floor(bounds.min.x - 3), Math.floor(bounds.min.y - 3), 
                             Math.floor(bounds.max.x - bounds.min.x + 6), Math.floor(bounds.max.y - bounds.min.y + 6));
                context.closePath();
                context.stroke();

                break;

            case 'constraint':

                // render constraint selections
                var point = item.pointA;
                if (item.bodyA)
                    point = item.pointB;
                context.beginPath();
                context.arc(point.x, point.y, 10, 0, 2 * Math.PI);
                context.closePath();
                context.stroke();

                break;

            }

            context.setLineDash([]);
            context.translate(-0.5, -0.5);
        }

        // render selection region
        if (inspector.selectStart !== null) {
            context.translate(0.5, 0.5);
            context.lineWidth = 1;
            context.strokeStyle = 'rgba(255,165,0,0.6)';
            context.fillStyle = 'rgba(255,165,0,0.1)';
            bounds = inspector.selectBounds;
            context.beginPath();
            context.rect(Math.floor(bounds.min.x), Math.floor(bounds.min.y), 
                         Math.floor(bounds.max.x - bounds.min.x), Math.floor(bounds.max.y - bounds.min.y));
            context.closePath();
            context.stroke();
            context.fill();
            context.translate(-0.5, -0.5);
        }

        if (options.hasBounds)
            context.setTransform(1, 0, 0, 1, 0, 0);
    };

    /**
     * Description
     * @method _createCanvas
     * @private
     * @param {} width
     * @param {} height
     * @return canvas
     */
    var _createCanvas = function(width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.oncontextmenu = function() { return false; };
        canvas.onselectstart = function() { return false; };
        return canvas;
    };

    /**
     * Gets the pixel ratio of the canvas.
     * @method _getPixelRatio
     * @private
     * @param {HTMLElement} canvas
     * @return {Number} pixel ratio
     */
    var _getPixelRatio = function(canvas) {
        var context = canvas.getContext('2d'),
            devicePixelRatio = window.devicePixelRatio || 1,
            backingStorePixelRatio = context.webkitBackingStorePixelRatio || context.mozBackingStorePixelRatio
                                      || context.msBackingStorePixelRatio || context.oBackingStorePixelRatio
                                      || context.backingStorePixelRatio || 1;

        return devicePixelRatio / backingStorePixelRatio;
    };

    /**
     * Gets the requested texture (an Image) via its path
     * @method _getTexture
     * @private
     * @param {render} render
     * @param {string} imagePath
     * @return {Image} texture
     */
    var _getTexture = function(render, imagePath) {
        var image = render.textures[imagePath];

        if (image)
            return image;

        image = render.textures[imagePath] = new Image();
        image.src = imagePath;

        return image;
    };

    /**
     * Applies the background to the canvas using CSS.
     * @method applyBackground
     * @private
     * @param {render} render
     * @param {string} background
     */
    var _applyBackground = function(render, background) {
        var cssBackground = background;

        if (/(jpg|gif|png)$/.test(background))
            cssBackground = 'url(' + background + ')';

        render.canvas.style.background = cssBackground;
        render.canvas.style.backgroundSize = "contain";
        render.currentBackground = background;
    };

    /*
    *
    *  Events Documentation
    *
    */

    /**
    * Fired before rendering
    *
    * @event beforeRender
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /**
    * Fired after rendering
    *
    * @event afterRender
    * @param {} event An event object
    * @param {number} event.timestamp The engine.timing.timestamp of the event
    * @param {} event.source The source object of the event
    * @param {} event.name The name of the event
    */

    /*
    *
    *  Properties Documentation
    *
    */

    /**
     * A back-reference to the `Matter.Render` module.
     *
     * @property controller
     * @type render
     */

    /**
     * A reference to the `Matter.Engine` instance to be used.
     *
     * @property engine
     * @type engine
     */

    /**
     * A reference to the element where the canvas is to be inserted (if `render.canvas` has not been specified)
     *
     * @property element
     * @type HTMLElement
     * @default null
     */

    /**
     * The canvas element to render to. If not specified, one will be created if `render.element` has been specified.
     *
     * @property canvas
     * @type HTMLCanvasElement
     * @default null
     */

    /**
     * The configuration options of the renderer.
     *
     * @property options
     * @type {}
     */

    /**
     * The target width in pixels of the `render.canvas` to be created.
     *
     * @property options.width
     * @type number
     * @default 800
     */

    /**
     * The target height in pixels of the `render.canvas` to be created.
     *
     * @property options.height
     * @type number
     * @default 600
     */

    /**
     * A flag that specifies if `render.bounds` should be used when rendering.
     *
     * @property options.hasBounds
     * @type boolean
     * @default false
     */

    /**
     * A `Bounds` object that specifies the drawing view region. 
     * Rendering will be automatically transformed and scaled to fit within the canvas size (`render.options.width` and `render.options.height`).
     * This allows for creating views that can pan or zoom around the scene.
     * You must also set `render.options.hasBounds` to `true` to enable bounded rendering.
     *
     * @property bounds
     * @type bounds
     */

    /**
     * The 2d rendering context from the `render.canvas` element.
     *
     * @property context
     * @type CanvasRenderingContext2D
     */

    /**
     * The sprite texture cache.
     *
     * @property textures
     * @type {}
     */

})();

},{"../body/Composite":2,"../collision/Grid":6,"../core/Common":14,"../core/Events":16,"../core/Mouse":19,"../geometry/Bounds":26,"../geometry/Vector":28}],32:[function(_dereq_,module,exports){
/**
* The `Matter.RenderPixi` module is an example renderer using pixi.js.
* See also `Matter.Render` for a canvas based renderer.
*
* @class RenderPixi
* @deprecated the Matter.RenderPixi module will soon be removed from the Matter.js core.
* It will likely be moved to its own repository (but maintenance will be limited).
*/

var RenderPixi = {};

module.exports = RenderPixi;

var Bounds = _dereq_('../geometry/Bounds');
var Composite = _dereq_('../body/Composite');
var Common = _dereq_('../core/Common');
var Events = _dereq_('../core/Events');
var Vector = _dereq_('../geometry/Vector');

(function() {

    var _requestAnimationFrame,
        _cancelAnimationFrame;

    if (typeof window !== 'undefined') {
        _requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame
                                      || window.mozRequestAnimationFrame || window.msRequestAnimationFrame 
                                      || function(callback){ window.setTimeout(function() { callback(Common.now()); }, 1000 / 60); };
   
        _cancelAnimationFrame = window.cancelAnimationFrame || window.mozCancelAnimationFrame 
                                      || window.webkitCancelAnimationFrame || window.msCancelAnimationFrame;
    }
    
    /**
     * Creates a new Pixi.js WebGL renderer
     * @method create
     * @param {object} options
     * @return {RenderPixi} A new renderer
     * @deprecated
     */
    RenderPixi.create = function(options) {
        Common.warn('RenderPixi.create: Matter.RenderPixi is deprecated (see docs)');

        var defaults = {
            controller: RenderPixi,
            engine: null,
            element: null,
            frameRequestId: null,
            canvas: null,
            renderer: null,
            container: null,
            spriteContainer: null,
            pixiOptions: null,
            options: {
                width: 800,
                height: 600,
                background: '#fafafa',
                wireframeBackground: '#222',
                hasBounds: false,
                enabled: true,
                wireframes: true,
                showSleeping: true,
                showDebug: false,
                showBroadphase: false,
                showBounds: false,
                showVelocity: false,
                showCollisions: false,
                showAxes: false,
                showPositions: false,
                showAngleIndicator: false,
                showIds: false,
                showShadows: false
            }
        };

        var render = Common.extend(defaults, options),
            transparent = !render.options.wireframes && render.options.background === 'transparent';

        // init pixi
        render.pixiOptions = render.pixiOptions || {
            view: render.canvas,
            transparent: transparent,
            antialias: true,
            backgroundColor: options.background
        };

        render.mouse = options.mouse;
        render.engine = options.engine;
        render.renderer = render.renderer || new PIXI.WebGLRenderer(render.options.width, render.options.height, render.pixiOptions);
        render.container = render.container || new PIXI.Container();
        render.spriteContainer = render.spriteContainer || new PIXI.Container();
        render.canvas = render.canvas || render.renderer.view;
        render.bounds = render.bounds || { 
            min: {
                x: 0,
                y: 0
            }, 
            max: { 
                x: render.options.width,
                y: render.options.height
            }
        };

        // event listeners
        Events.on(render.engine, 'beforeUpdate', function() {
            RenderPixi.clear(render);
        });

        // caches
        render.textures = {};
        render.sprites = {};
        render.primitives = {};

        // use a sprite batch for performance
        render.container.addChild(render.spriteContainer);

        // insert canvas
        if (Common.isElement(render.element)) {
            render.element.appendChild(render.canvas);
        } else {
            Common.warn('No "render.element" passed, "render.canvas" was not inserted into document.');
        }

        // prevent menus on canvas
        render.canvas.oncontextmenu = function() { return false; };
        render.canvas.onselectstart = function() { return false; };

        return render;
    };

    /**
     * Continuously updates the render canvas on the `requestAnimationFrame` event.
     * @method run
     * @param {render} render
     * @deprecated
     */
    RenderPixi.run = function(render) {
        (function loop(time){
            render.frameRequestId = _requestAnimationFrame(loop);
            RenderPixi.world(render);
        })();
    };

    /**
     * Ends execution of `Render.run` on the given `render`, by canceling the animation frame request event loop.
     * @method stop
     * @param {render} render
     * @deprecated
     */
    RenderPixi.stop = function(render) {
        _cancelAnimationFrame(render.frameRequestId);
    };

    /**
     * Clears the scene graph
     * @method clear
     * @param {RenderPixi} render
     * @deprecated
     */
    RenderPixi.clear = function(render) {
        var container = render.container,
            spriteContainer = render.spriteContainer;

        // clear stage container
        while (container.children[0]) { 
            container.removeChild(container.children[0]); 
        }

        // clear sprite batch
        while (spriteContainer.children[0]) { 
            spriteContainer.removeChild(spriteContainer.children[0]); 
        }

        var bgSprite = render.sprites['bg-0'];

        // clear caches
        render.textures = {};
        render.sprites = {};
        render.primitives = {};

        // set background sprite
        render.sprites['bg-0'] = bgSprite;
        if (bgSprite)
            container.addChildAt(bgSprite, 0);

        // add sprite batch back into container
        render.container.addChild(render.spriteContainer);

        // reset background state
        render.currentBackground = null;

        // reset bounds transforms
        container.scale.set(1, 1);
        container.position.set(0, 0);
    };

    /**
     * Sets the background of the canvas 
     * @method setBackground
     * @param {RenderPixi} render
     * @param {string} background
     * @deprecated
     */
    RenderPixi.setBackground = function(render, background) {
        if (render.currentBackground !== background) {
            var isColor = background.indexOf && background.indexOf('#') !== -1,
                bgSprite = render.sprites['bg-0'];

            if (isColor) {
                // if solid background color
                var color = Common.colorToNumber(background);
                render.renderer.backgroundColor = color;

                // remove background sprite if existing
                if (bgSprite)
                    render.container.removeChild(bgSprite); 
            } else {
                // initialise background sprite if needed
                if (!bgSprite) {
                    var texture = _getTexture(render, background);

                    bgSprite = render.sprites['bg-0'] = new PIXI.Sprite(texture);
                    bgSprite.position.x = 0;
                    bgSprite.position.y = 0;
                    render.container.addChildAt(bgSprite, 0);
                }
            }

            render.currentBackground = background;
        }
    };

    /**
     * Description
     * @method world
     * @param {engine} engine
     * @deprecated
     */
    RenderPixi.world = function(render) {
        var engine = render.engine,
            world = engine.world,
            renderer = render.renderer,
            container = render.container,
            options = render.options,
            bodies = Composite.allBodies(world),
            allConstraints = Composite.allConstraints(world),
            constraints = [],
            i;

        if (options.wireframes) {
            RenderPixi.setBackground(render, options.wireframeBackground);
        } else {
            RenderPixi.setBackground(render, options.background);
        }

        // handle bounds
        var boundsWidth = render.bounds.max.x - render.bounds.min.x,
            boundsHeight = render.bounds.max.y - render.bounds.min.y,
            boundsScaleX = boundsWidth / render.options.width,
            boundsScaleY = boundsHeight / render.options.height;

        if (options.hasBounds) {
            // Hide bodies that are not in view
            for (i = 0; i < bodies.length; i++) {
                var body = bodies[i];
                body.render.sprite.visible = Bounds.overlaps(body.bounds, render.bounds);
            }

            // filter out constraints that are not in view
            for (i = 0; i < allConstraints.length; i++) {
                var constraint = allConstraints[i],
                    bodyA = constraint.bodyA,
                    bodyB = constraint.bodyB,
                    pointAWorld = constraint.pointA,
                    pointBWorld = constraint.pointB;

                if (bodyA) pointAWorld = Vector.add(bodyA.position, constraint.pointA);
                if (bodyB) pointBWorld = Vector.add(bodyB.position, constraint.pointB);

                if (!pointAWorld || !pointBWorld)
                    continue;

                if (Bounds.contains(render.bounds, pointAWorld) || Bounds.contains(render.bounds, pointBWorld))
                    constraints.push(constraint);
            }

            // transform the view
            container.scale.set(1 / boundsScaleX, 1 / boundsScaleY);
            container.position.set(-render.bounds.min.x * (1 / boundsScaleX), -render.bounds.min.y * (1 / boundsScaleY));
        } else {
            constraints = allConstraints;
        }

        for (i = 0; i < bodies.length; i++)
            RenderPixi.body(render, bodies[i]);

        for (i = 0; i < constraints.length; i++)
            RenderPixi.constraint(render, constraints[i]);

        renderer.render(container);
    };


    /**
     * Description
     * @method constraint
     * @param {engine} engine
     * @param {constraint} constraint
     * @deprecated
     */
    RenderPixi.constraint = function(render, constraint) {
        var engine = render.engine,
            bodyA = constraint.bodyA,
            bodyB = constraint.bodyB,
            pointA = constraint.pointA,
            pointB = constraint.pointB,
            container = render.container,
            constraintRender = constraint.render,
            primitiveId = 'c-' + constraint.id,
            primitive = render.primitives[primitiveId];

        // initialise constraint primitive if not existing
        if (!primitive)
            primitive = render.primitives[primitiveId] = new PIXI.Graphics();

        // don't render if constraint does not have two end points
        if (!constraintRender.visible || !constraint.pointA || !constraint.pointB) {
            primitive.clear();
            return;
        }

        // add to scene graph if not already there
        if (Common.indexOf(container.children, primitive) === -1)
            container.addChild(primitive);

        // render the constraint on every update, since they can change dynamically
        primitive.clear();
        primitive.beginFill(0, 0);
        primitive.lineStyle(constraintRender.lineWidth, Common.colorToNumber(constraintRender.strokeStyle), 1);
        
        if (bodyA) {
            primitive.moveTo(bodyA.position.x + pointA.x, bodyA.position.y + pointA.y);
        } else {
            primitive.moveTo(pointA.x, pointA.y);
        }

        if (bodyB) {
            primitive.lineTo(bodyB.position.x + pointB.x, bodyB.position.y + pointB.y);
        } else {
            primitive.lineTo(pointB.x, pointB.y);
        }

        primitive.endFill();
    };
    
    /**
     * Description
     * @method body
     * @param {engine} engine
     * @param {body} body
     * @deprecated
     */
    RenderPixi.body = function(render, body) {
        var engine = render.engine,
            bodyRender = body.render;

        if (!bodyRender.visible)
            return;

        if (bodyRender.sprite && bodyRender.sprite.texture) {
            var spriteId = 'b-' + body.id,
                sprite = render.sprites[spriteId],
                spriteContainer = render.spriteContainer;

            // initialise body sprite if not existing
            if (!sprite)
                sprite = render.sprites[spriteId] = _createBodySprite(render, body);

            // add to scene graph if not already there
            if (Common.indexOf(spriteContainer.children, sprite) === -1)
                spriteContainer.addChild(sprite);

            // update body sprite
            sprite.position.x = body.position.x;
            sprite.position.y = body.position.y;
            sprite.rotation = body.angle;
            sprite.scale.x = bodyRender.sprite.xScale || 1;
            sprite.scale.y = bodyRender.sprite.yScale || 1;
        } else {
            var primitiveId = 'b-' + body.id,
                primitive = render.primitives[primitiveId],
                container = render.container;

            // initialise body primitive if not existing
            if (!primitive) {
                primitive = render.primitives[primitiveId] = _createBodyPrimitive(render, body);
                primitive.initialAngle = body.angle;
            }

            // add to scene graph if not already there
            if (Common.indexOf(container.children, primitive) === -1)
                container.addChild(primitive);

            // update body primitive
            primitive.position.x = body.position.x;
            primitive.position.y = body.position.y;
            primitive.rotation = body.angle - primitive.initialAngle;
        }
    };

    /**
     * Creates a body sprite
     * @method _createBodySprite
     * @private
     * @param {RenderPixi} render
     * @param {body} body
     * @return {PIXI.Sprite} sprite
     * @deprecated
     */
    var _createBodySprite = function(render, body) {
        var bodyRender = body.render,
            texturePath = bodyRender.sprite.texture,
            texture = _getTexture(render, texturePath),
            sprite = new PIXI.Sprite(texture);

        sprite.anchor.x = body.render.sprite.xOffset;
        sprite.anchor.y = body.render.sprite.yOffset;

        return sprite;
    };

    /**
     * Creates a body primitive
     * @method _createBodyPrimitive
     * @private
     * @param {RenderPixi} render
     * @param {body} body
     * @return {PIXI.Graphics} graphics
     * @deprecated
     */
    var _createBodyPrimitive = function(render, body) {
        var bodyRender = body.render,
            options = render.options,
            primitive = new PIXI.Graphics(),
            fillStyle = Common.colorToNumber(bodyRender.fillStyle),
            strokeStyle = Common.colorToNumber(bodyRender.strokeStyle),
            strokeStyleIndicator = Common.colorToNumber(bodyRender.strokeStyle),
            strokeStyleWireframe = Common.colorToNumber('#bbb'),
            strokeStyleWireframeIndicator = Common.colorToNumber('#CD5C5C'),
            part;

        primitive.clear();

        // handle compound parts
        for (var k = body.parts.length > 1 ? 1 : 0; k < body.parts.length; k++) {
            part = body.parts[k];

            if (!options.wireframes) {
                primitive.beginFill(fillStyle, 1);
                primitive.lineStyle(bodyRender.lineWidth, strokeStyle, 1);
            } else {
                primitive.beginFill(0, 0);
                primitive.lineStyle(1, strokeStyleWireframe, 1);
            }

            primitive.moveTo(part.vertices[0].x - body.position.x, part.vertices[0].y - body.position.y);

            for (var j = 1; j < part.vertices.length; j++) {
                primitive.lineTo(part.vertices[j].x - body.position.x, part.vertices[j].y - body.position.y);
            }

            primitive.lineTo(part.vertices[0].x - body.position.x, part.vertices[0].y - body.position.y);

            primitive.endFill();

            // angle indicator
            if (options.showAngleIndicator || options.showAxes) {
                primitive.beginFill(0, 0);

                if (options.wireframes) {
                    primitive.lineStyle(1, strokeStyleWireframeIndicator, 1);
                } else {
                    primitive.lineStyle(1, strokeStyleIndicator);
                }

                primitive.moveTo(part.position.x - body.position.x, part.position.y - body.position.y);
                primitive.lineTo(((part.vertices[0].x + part.vertices[part.vertices.length-1].x) / 2 - body.position.x), 
                                 ((part.vertices[0].y + part.vertices[part.vertices.length-1].y) / 2 - body.position.y));

                primitive.endFill();
            }
        }

        return primitive;
    };

    /**
     * Gets the requested texture (a PIXI.Texture) via its path
     * @method _getTexture
     * @private
     * @param {RenderPixi} render
     * @param {string} imagePath
     * @return {PIXI.Texture} texture
     * @deprecated
     */
    var _getTexture = function(render, imagePath) {
        var texture = render.textures[imagePath];

        if (!texture)
            texture = render.textures[imagePath] = PIXI.Texture.fromImage(imagePath);

        return texture;
    };

})();

},{"../body/Composite":2,"../core/Common":14,"../core/Events":16,"../geometry/Bounds":26,"../geometry/Vector":28}]},{},[30])(30)
});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],15:[function(require,module,exports){
/*!
 * Paper.js v0.11.4 - The Swiss Army Knife of Vector Graphics Scripting.
 * http://paperjs.org/
 *
 * Copyright (c) 2011 - 2016, Juerg Lehni & Jonathan Puckey
 * http://scratchdisk.com/ & http://jonathanpuckey.com/
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 *
 * Date: Wed Jun 7 16:56:44 2017 +0200
 *
 ***
 *
 * Straps.js - Class inheritance library with support for bean-style accessors
 *
 * Copyright (c) 2006 - 2016 Juerg Lehni
 * http://scratchdisk.com/
 *
 * Distributed under the MIT license.
 *
 ***
 *
 * Acorn.js
 * http://marijnhaverbeke.nl/acorn/
 *
 * Acorn is a tiny, fast JavaScript parser written in JavaScript,
 * created by Marijn Haverbeke and released under an MIT license.
 *
 */

var paper = function(self, undefined) {

self = self || require('./node/self.js');
var window = self.window,
	document = self.document;

var Base = new function() {
	var hidden = /^(statics|enumerable|beans|preserve)$/,
		array = [],
		slice = array.slice,
		create = Object.create,
		describe = Object.getOwnPropertyDescriptor,
		define = Object.defineProperty,

		forEach = array.forEach || function(iter, bind) {
			for (var i = 0, l = this.length; i < l; i++) {
				iter.call(bind, this[i], i, this);
			}
		},

		forIn = function(iter, bind) {
			for (var i in this) {
				if (this.hasOwnProperty(i))
					iter.call(bind, this[i], i, this);
			}
		},

		set = Object.assign || function(dst) {
			for (var i = 1, l = arguments.length; i < l; i++) {
				var src = arguments[i];
				for (var key in src) {
					if (src.hasOwnProperty(key))
						dst[key] = src[key];
				}
			}
			return dst;
		},

		each = function(obj, iter, bind) {
			if (obj) {
				var desc = describe(obj, 'length');
				(desc && typeof desc.value === 'number' ? forEach : forIn)
					.call(obj, iter, bind = bind || obj);
			}
			return bind;
		};

	function inject(dest, src, enumerable, beans, preserve) {
		var beansNames = {};

		function field(name, val) {
			val = val || (val = describe(src, name))
					&& (val.get ? val : val.value);
			if (typeof val === 'string' && val[0] === '#')
				val = dest[val.substring(1)] || val;
			var isFunc = typeof val === 'function',
				res = val,
				prev = preserve || isFunc && !val.base
						? (val && val.get ? name in dest : dest[name])
						: null,
				bean;
			if (!preserve || !prev) {
				if (isFunc && prev)
					val.base = prev;
				if (isFunc && beans !== false
						&& (bean = name.match(/^([gs]et|is)(([A-Z])(.*))$/)))
					beansNames[bean[3].toLowerCase() + bean[4]] = bean[2];
				if (!res || isFunc || !res.get || typeof res.get !== 'function'
						|| !Base.isPlainObject(res)) {
					res = { value: res, writable: true };
				}
				if ((describe(dest, name)
						|| { configurable: true }).configurable) {
					res.configurable = true;
					res.enumerable = enumerable != null ? enumerable : !bean;
				}
				define(dest, name, res);
			}
		}
		if (src) {
			for (var name in src) {
				if (src.hasOwnProperty(name) && !hidden.test(name))
					field(name);
			}
			for (var name in beansNames) {
				var part = beansNames[name],
					set = dest['set' + part],
					get = dest['get' + part] || set && dest['is' + part];
				if (get && (beans === true || get.length === 0))
					field(name, { get: get, set: set });
			}
		}
		return dest;
	}

	function Base() {
		for (var i = 0, l = arguments.length; i < l; i++) {
			var src = arguments[i];
			if (src)
				set(this, src);
		}
		return this;
	}

	return inject(Base, {
		inject: function(src) {
			if (src) {
				var statics = src.statics === true ? src : src.statics,
					beans = src.beans,
					preserve = src.preserve;
				if (statics !== src)
					inject(this.prototype, src, src.enumerable, beans, preserve);
				inject(this, statics, null, beans, preserve);
			}
			for (var i = 1, l = arguments.length; i < l; i++)
				this.inject(arguments[i]);
			return this;
		},

		extend: function() {
			var base = this,
				ctor,
				proto;
			for (var i = 0, obj, l = arguments.length;
					i < l && !(ctor && proto); i++) {
				obj = arguments[i];
				ctor = ctor || obj.initialize;
				proto = proto || obj.prototype;
			}
			ctor = ctor || function() {
				base.apply(this, arguments);
			};
			proto = ctor.prototype = proto || create(this.prototype);
			define(proto, 'constructor',
					{ value: ctor, writable: true, configurable: true });
			inject(ctor, this);
			if (arguments.length)
				this.inject.apply(ctor, arguments);
			ctor.base = base;
			return ctor;
		}
	}).inject({
		enumerable: false,

		initialize: Base,

		set: Base,

		inject: function() {
			for (var i = 0, l = arguments.length; i < l; i++) {
				var src = arguments[i];
				if (src) {
					inject(this, src, src.enumerable, src.beans, src.preserve);
				}
			}
			return this;
		},

		extend: function() {
			var res = create(this);
			return res.inject.apply(res, arguments);
		},

		each: function(iter, bind) {
			return each(this, iter, bind);
		},

		clone: function() {
			return new this.constructor(this);
		},

		statics: {
			set: set,
			each: each,
			create: create,
			define: define,
			describe: describe,

			clone: function(obj) {
				return set(new obj.constructor(), obj);
			},

			isPlainObject: function(obj) {
				var ctor = obj != null && obj.constructor;
				return ctor && (ctor === Object || ctor === Base
						|| ctor.name === 'Object');
			},

			pick: function(a, b) {
				return a !== undefined ? a : b;
			},

			slice: function(list, begin, end) {
				return slice.call(list, begin, end);
			}
		}
	});
};

if (typeof module !== 'undefined')
	module.exports = Base;

Base.inject({
	enumerable: false,

	toString: function() {
		return this._id != null
			?  (this._class || 'Object') + (this._name
				? " '" + this._name + "'"
				: ' @' + this._id)
			: '{ ' + Base.each(this, function(value, key) {
				if (!/^_/.test(key)) {
					var type = typeof value;
					this.push(key + ': ' + (type === 'number'
							? Formatter.instance.number(value)
							: type === 'string' ? "'" + value + "'" : value));
				}
			}, []).join(', ') + ' }';
	},

	getClassName: function() {
		return this._class || '';
	},

	importJSON: function(json) {
		return Base.importJSON(json, this);
	},

	exportJSON: function(options) {
		return Base.exportJSON(this, options);
	},

	toJSON: function() {
		return Base.serialize(this);
	},

	set: function(props, exclude) {
		if (props)
			Base.filter(this, props, exclude, this._prioritize);
		return this;
	}
}, {

beans: false,
statics: {
	exports: {},

	extend: function extend() {
		var res = extend.base.apply(this, arguments),
			name = res.prototype._class;
		if (name && !Base.exports[name])
			Base.exports[name] = res;
		return res;
	},

	equals: function(obj1, obj2) {
		if (obj1 === obj2)
			return true;
		if (obj1 && obj1.equals)
			return obj1.equals(obj2);
		if (obj2 && obj2.equals)
			return obj2.equals(obj1);
		if (obj1 && obj2
				&& typeof obj1 === 'object' && typeof obj2 === 'object') {
			if (Array.isArray(obj1) && Array.isArray(obj2)) {
				var length = obj1.length;
				if (length !== obj2.length)
					return false;
				while (length--) {
					if (!Base.equals(obj1[length], obj2[length]))
						return false;
				}
			} else {
				var keys = Object.keys(obj1),
					length = keys.length;
				if (length !== Object.keys(obj2).length)
					return false;
				while (length--) {
					var key = keys[length];
					if (!(obj2.hasOwnProperty(key)
							&& Base.equals(obj1[key], obj2[key])))
						return false;
				}
			}
			return true;
		}
		return false;
	},

	read: function(list, start, options, amount) {
		if (this === Base) {
			var value = this.peek(list, start);
			list.__index++;
			return value;
		}
		var proto = this.prototype,
			readIndex = proto._readIndex,
			begin = start || readIndex && list.__index || 0,
			length = list.length,
			obj = list[begin];
		amount = amount || length - begin;
		if (obj instanceof this
			|| options && options.readNull && obj == null && amount <= 1) {
			if (readIndex)
				list.__index = begin + 1;
			return obj && options && options.clone ? obj.clone() : obj;
		}
		obj = Base.create(proto);
		if (readIndex)
			obj.__read = true;
		obj = obj.initialize.apply(obj, begin > 0 || begin + amount < length
				? Base.slice(list, begin, begin + amount)
				: list) || obj;
		if (readIndex) {
			list.__index = begin + obj.__read;
			var filtered = obj.__filtered;
			if (filtered) {
				list.__filtered = filtered;
				obj.__filtered = undefined;
			}
			obj.__read = undefined;
		}
		return obj;
	},

	peek: function(list, start) {
		return list[list.__index = start || list.__index || 0];
	},

	remain: function(list) {
		return list.length - (list.__index || 0);
	},

	readList: function(list, start, options, amount) {
		var res = [],
			entry,
			begin = start || 0,
			end = amount ? begin + amount : list.length;
		for (var i = begin; i < end; i++) {
			res.push(Array.isArray(entry = list[i])
					? this.read(entry, 0, options)
					: this.read(list, i, options, 1));
		}
		return res;
	},

	readNamed: function(list, name, start, options, amount) {
		var value = this.getNamed(list, name),
			hasObject = value !== undefined;
		if (hasObject) {
			var filtered = list.__filtered;
			if (!filtered) {
				filtered = list.__filtered = Base.create(list[0]);
				filtered.__unfiltered = list[0];
			}
			filtered[name] = undefined;
		}
		var l = hasObject ? [value] : list,
			res = this.read(l, start, options, amount);
		return res;
	},

	getNamed: function(list, name) {
		var arg = list[0];
		if (list._hasObject === undefined)
			list._hasObject = list.length === 1 && Base.isPlainObject(arg);
		if (list._hasObject)
			return name ? arg[name] : list.__filtered || arg;
	},

	hasNamed: function(list, name) {
		return !!this.getNamed(list, name);
	},

	filter: function(dest, source, exclude, prioritize) {
		var processed;

		function handleKey(key) {
			if (!(exclude && key in exclude) &&
				!(processed && key in processed)) {
				var value = source[key];
				if (value !== undefined)
					dest[key] = value;
			}
		}

		if (prioritize) {
			var keys = {};
			for (var i = 0, key, l = prioritize.length; i < l; i++) {
				if ((key = prioritize[i]) in source) {
					handleKey(key);
					keys[key] = true;
				}
			}
			processed = keys;
		}

		Object.keys(source.__unfiltered || source).forEach(handleKey);
		return dest;
	},

	isPlainValue: function(obj, asString) {
		return Base.isPlainObject(obj) || Array.isArray(obj)
				|| asString && typeof obj === 'string';
	},

	serialize: function(obj, options, compact, dictionary) {
		options = options || {};

		var isRoot = !dictionary,
			res;
		if (isRoot) {
			options.formatter = new Formatter(options.precision);
			dictionary = {
				length: 0,
				definitions: {},
				references: {},
				add: function(item, create) {
					var id = '#' + item._id,
						ref = this.references[id];
					if (!ref) {
						this.length++;
						var res = create.call(item),
							name = item._class;
						if (name && res[0] !== name)
							res.unshift(name);
						this.definitions[id] = res;
						ref = this.references[id] = [id];
					}
					return ref;
				}
			};
		}
		if (obj && obj._serialize) {
			res = obj._serialize(options, dictionary);
			var name = obj._class;
			if (name && !obj._compactSerialize && (isRoot || !compact)
					&& res[0] !== name) {
				res.unshift(name);
			}
		} else if (Array.isArray(obj)) {
			res = [];
			for (var i = 0, l = obj.length; i < l; i++)
				res[i] = Base.serialize(obj[i], options, compact, dictionary);
		} else if (Base.isPlainObject(obj)) {
			res = {};
			var keys = Object.keys(obj);
			for (var i = 0, l = keys.length; i < l; i++) {
				var key = keys[i];
				res[key] = Base.serialize(obj[key], options, compact,
						dictionary);
			}
		} else if (typeof obj === 'number') {
			res = options.formatter.number(obj, options.precision);
		} else {
			res = obj;
		}
		return isRoot && dictionary.length > 0
				? [['dictionary', dictionary.definitions], res]
				: res;
	},

	deserialize: function(json, create, _data, _setDictionary, _isRoot) {
		var res = json,
			isFirst = !_data,
			hasDictionary = isFirst && json && json.length
				&& json[0][0] === 'dictionary';
		_data = _data || {};
		if (Array.isArray(json)) {
			var type = json[0],
				isDictionary = type === 'dictionary';
			if (json.length == 1 && /^#/.test(type)) {
				return _data.dictionary[type];
			}
			type = Base.exports[type];
			res = [];
			for (var i = type ? 1 : 0, l = json.length; i < l; i++) {
				res.push(Base.deserialize(json[i], create, _data,
						isDictionary, hasDictionary));
			}
			if (type) {
				var args = res;
				if (create) {
					res = create(type, args, isFirst || _isRoot);
				} else {
					res = Base.create(type.prototype);
					type.apply(res, args);
				}
			}
		} else if (Base.isPlainObject(json)) {
			res = {};
			if (_setDictionary)
				_data.dictionary = res;
			for (var key in json)
				res[key] = Base.deserialize(json[key], create, _data);
		}
		return hasDictionary ? res[1] : res;
	},

	exportJSON: function(obj, options) {
		var json = Base.serialize(obj, options);
		return options && options.asString == false
				? json
				: JSON.stringify(json);
	},

	importJSON: function(json, target) {
		return Base.deserialize(
				typeof json === 'string' ? JSON.parse(json) : json,
				function(ctor, args, isRoot) {
					var useTarget = isRoot && target
							&& target.constructor === ctor,
						obj = useTarget ? target
							: Base.create(ctor.prototype);
					if (args.length === 1 && obj instanceof Item
							&& (useTarget || !(obj instanceof Layer))) {
						var arg = args[0];
						if (Base.isPlainObject(arg))
							arg.insert = false;
					}
					(useTarget ? obj.set : ctor).apply(obj, args);
					if (useTarget)
						target = null;
					return obj;
				});
	},

	splice: function(list, items, index, remove) {
		var amount = items && items.length,
			append = index === undefined;
		index = append ? list.length : index;
		if (index > list.length)
			index = list.length;
		for (var i = 0; i < amount; i++)
			items[i]._index = index + i;
		if (append) {
			list.push.apply(list, items);
			return [];
		} else {
			var args = [index, remove];
			if (items)
				args.push.apply(args, items);
			var removed = list.splice.apply(list, args);
			for (var i = 0, l = removed.length; i < l; i++)
				removed[i]._index = undefined;
			for (var i = index + amount, l = list.length; i < l; i++)
				list[i]._index = i;
			return removed;
		}
	},

	capitalize: function(str) {
		return str.replace(/\b[a-z]/g, function(match) {
			return match.toUpperCase();
		});
	},

	camelize: function(str) {
		return str.replace(/-(.)/g, function(match, chr) {
			return chr.toUpperCase();
		});
	},

	hyphenate: function(str) {
		return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
	}
}});

var Emitter = {
	on: function(type, func) {
		if (typeof type !== 'string') {
			Base.each(type, function(value, key) {
				this.on(key, value);
			}, this);
		} else {
			var types = this._eventTypes,
				entry = types && types[type],
				handlers = this._callbacks = this._callbacks || {};
			handlers = handlers[type] = handlers[type] || [];
			if (handlers.indexOf(func) === -1) {
				handlers.push(func);
				if (entry && entry.install && handlers.length === 1)
					entry.install.call(this, type);
			}
		}
		return this;
	},

	off: function(type, func) {
		if (typeof type !== 'string') {
			Base.each(type, function(value, key) {
				this.off(key, value);
			}, this);
			return;
		}
		var types = this._eventTypes,
			entry = types && types[type],
			handlers = this._callbacks && this._callbacks[type],
			index;
		if (handlers) {
			if (!func || (index = handlers.indexOf(func)) !== -1
					&& handlers.length === 1) {
				if (entry && entry.uninstall)
					entry.uninstall.call(this, type);
				delete this._callbacks[type];
			} else if (index !== -1) {
				handlers.splice(index, 1);
			}
		}
		return this;
	},

	once: function(type, func) {
		return this.on(type, function() {
			func.apply(this, arguments);
			this.off(type, func);
		});
	},

	emit: function(type, event) {
		var handlers = this._callbacks && this._callbacks[type];
		if (!handlers)
			return false;
		var args = Base.slice(arguments, 1),
			setTarget = event && event.target && !event.currentTarget;
		handlers = handlers.slice();
		if (setTarget)
			event.currentTarget = this;
		for (var i = 0, l = handlers.length; i < l; i++) {
			if (handlers[i].apply(this, args) == false) {
				if (event && event.stop)
					event.stop();
				break;
		   }
		}
		if (setTarget)
			delete event.currentTarget;
		return true;
	},

	responds: function(type) {
		return !!(this._callbacks && this._callbacks[type]);
	},

	attach: '#on',
	detach: '#off',
	fire: '#emit',

	_installEvents: function(install) {
		var types = this._eventTypes,
			handlers = this._callbacks,
			key = install ? 'install' : 'uninstall';
		if (types) {
			for (var type in handlers) {
				if (handlers[type].length > 0) {
					var entry = types[type],
						func = entry && entry[key];
					if (func)
						func.call(this, type);
				}
			}
		}
	},

	statics: {
		inject: function inject(src) {
			var events = src._events;
			if (events) {
				var types = {};
				Base.each(events, function(entry, key) {
					var isString = typeof entry === 'string',
						name = isString ? entry : key,
						part = Base.capitalize(name),
						type = name.substring(2).toLowerCase();
					types[type] = isString ? {} : entry;
					name = '_' + name;
					src['get' + part] = function() {
						return this[name];
					};
					src['set' + part] = function(func) {
						var prev = this[name];
						if (prev)
							this.off(type, prev);
						if (func)
							this.on(type, func);
						this[name] = func;
					};
				});
				src._eventTypes = types;
			}
			return inject.base.apply(this, arguments);
		}
	}
};

var PaperScope = Base.extend({
	_class: 'PaperScope',

	initialize: function PaperScope() {
		paper = this;
		this.settings = new Base({
			applyMatrix: true,
			insertItems: true,
			handleSize: 4,
			hitTolerance: 0
		});
		this.project = null;
		this.projects = [];
		this.tools = [];
		this._id = PaperScope._id++;
		PaperScope._scopes[this._id] = this;
		var proto = PaperScope.prototype;
		if (!this.support) {
			var ctx = CanvasProvider.getContext(1, 1) || {};
			proto.support = {
				nativeDash: 'setLineDash' in ctx || 'mozDash' in ctx,
				nativeBlendModes: BlendMode.nativeModes
			};
			CanvasProvider.release(ctx);
		}
		if (!this.agent) {
			var user = self.navigator.userAgent.toLowerCase(),
				os = (/(darwin|win|mac|linux|freebsd|sunos)/.exec(user)||[])[0],
				platform = os === 'darwin' ? 'mac' : os,
				agent = proto.agent = proto.browser = { platform: platform };
			if (platform)
				agent[platform] = true;
			user.replace(
				/(opera|chrome|safari|webkit|firefox|msie|trident|atom|node)\/?\s*([.\d]+)(?:.*version\/([.\d]+))?(?:.*rv\:v?([.\d]+))?/g,
				function(match, n, v1, v2, rv) {
					if (!agent.chrome) {
						var v = n === 'opera' ? v2 :
								/^(node|trident)$/.test(n) ? rv : v1;
						agent.version = v;
						agent.versionNumber = parseFloat(v);
						n = n === 'trident' ? 'msie' : n;
						agent.name = n;
						agent[n] = true;
					}
				}
			);
			if (agent.chrome)
				delete agent.webkit;
			if (agent.atom)
				delete agent.chrome;
		}
	},

	version: "0.11.4",

	getView: function() {
		var project = this.project;
		return project && project._view;
	},

	getPaper: function() {
		return this;
	},

	execute: function(code, options) {
		paper.PaperScript.execute(code, this, options);
		View.updateFocus();
	},

	install: function(scope) {
		var that = this;
		Base.each(['project', 'view', 'tool'], function(key) {
			Base.define(scope, key, {
				configurable: true,
				get: function() {
					return that[key];
				}
			});
		});
		for (var key in this)
			if (!/^_/.test(key) && this[key])
				scope[key] = this[key];
	},

	setup: function(element) {
		paper = this;
		this.project = new Project(element);
		return this;
	},

	createCanvas: function(width, height) {
		return CanvasProvider.getCanvas(width, height);
	},

	activate: function() {
		paper = this;
	},

	clear: function() {
		var projects = this.projects,
			tools = this.tools;
		for (var i = projects.length - 1; i >= 0; i--)
			projects[i].remove();
		for (var i = tools.length - 1; i >= 0; i--)
			tools[i].remove();
	},

	remove: function() {
		this.clear();
		delete PaperScope._scopes[this._id];
	},

	statics: new function() {
		function handleAttribute(name) {
			name += 'Attribute';
			return function(el, attr) {
				return el[name](attr) || el[name]('data-paper-' + attr);
			};
		}

		return {
			_scopes: {},
			_id: 0,

			get: function(id) {
				return this._scopes[id] || null;
			},

			getAttribute: handleAttribute('get'),
			hasAttribute: handleAttribute('has')
		};
	}
});

var PaperScopeItem = Base.extend(Emitter, {

	initialize: function(activate) {
		this._scope = paper;
		this._index = this._scope[this._list].push(this) - 1;
		if (activate || !this._scope[this._reference])
			this.activate();
	},

	activate: function() {
		if (!this._scope)
			return false;
		var prev = this._scope[this._reference];
		if (prev && prev !== this)
			prev.emit('deactivate');
		this._scope[this._reference] = this;
		this.emit('activate', prev);
		return true;
	},

	isActive: function() {
		return this._scope[this._reference] === this;
	},

	remove: function() {
		if (this._index == null)
			return false;
		Base.splice(this._scope[this._list], null, this._index, 1);
		if (this._scope[this._reference] == this)
			this._scope[this._reference] = null;
		this._scope = null;
		return true;
	},

	getView: function() {
		return this._scope.getView();
	}
});

var Formatter = Base.extend({
	initialize: function(precision) {
		this.precision = Base.pick(precision, 5);
		this.multiplier = Math.pow(10, this.precision);
	},

	number: function(val) {
		return this.precision < 16
				? Math.round(val * this.multiplier) / this.multiplier : val;
	},

	pair: function(val1, val2, separator) {
		return this.number(val1) + (separator || ',') + this.number(val2);
	},

	point: function(val, separator) {
		return this.number(val.x) + (separator || ',') + this.number(val.y);
	},

	size: function(val, separator) {
		return this.number(val.width) + (separator || ',')
				+ this.number(val.height);
	},

	rectangle: function(val, separator) {
		return this.point(val, separator) + (separator || ',')
				+ this.size(val, separator);
	}
});

Formatter.instance = new Formatter();

var Numerical = new function() {

	var abscissas = [
		[  0.5773502691896257645091488],
		[0,0.7745966692414833770358531],
		[  0.3399810435848562648026658,0.8611363115940525752239465],
		[0,0.5384693101056830910363144,0.9061798459386639927976269],
		[  0.2386191860831969086305017,0.6612093864662645136613996,0.9324695142031520278123016],
		[0,0.4058451513773971669066064,0.7415311855993944398638648,0.9491079123427585245261897],
		[  0.1834346424956498049394761,0.5255324099163289858177390,0.7966664774136267395915539,0.9602898564975362316835609],
		[0,0.3242534234038089290385380,0.6133714327005903973087020,0.8360311073266357942994298,0.9681602395076260898355762],
		[  0.1488743389816312108848260,0.4333953941292471907992659,0.6794095682990244062343274,0.8650633666889845107320967,0.9739065285171717200779640],
		[0,0.2695431559523449723315320,0.5190961292068118159257257,0.7301520055740493240934163,0.8870625997680952990751578,0.9782286581460569928039380],
		[  0.1252334085114689154724414,0.3678314989981801937526915,0.5873179542866174472967024,0.7699026741943046870368938,0.9041172563704748566784659,0.9815606342467192506905491],
		[0,0.2304583159551347940655281,0.4484927510364468528779129,0.6423493394403402206439846,0.8015780907333099127942065,0.9175983992229779652065478,0.9841830547185881494728294],
		[  0.1080549487073436620662447,0.3191123689278897604356718,0.5152486363581540919652907,0.6872929048116854701480198,0.8272013150697649931897947,0.9284348836635735173363911,0.9862838086968123388415973],
		[0,0.2011940939974345223006283,0.3941513470775633698972074,0.5709721726085388475372267,0.7244177313601700474161861,0.8482065834104272162006483,0.9372733924007059043077589,0.9879925180204854284895657],
		[  0.0950125098376374401853193,0.2816035507792589132304605,0.4580167776572273863424194,0.6178762444026437484466718,0.7554044083550030338951012,0.8656312023878317438804679,0.9445750230732325760779884,0.9894009349916499325961542]
	];

	var weights = [
		[1],
		[0.8888888888888888888888889,0.5555555555555555555555556],
		[0.6521451548625461426269361,0.3478548451374538573730639],
		[0.5688888888888888888888889,0.4786286704993664680412915,0.2369268850561890875142640],
		[0.4679139345726910473898703,0.3607615730481386075698335,0.1713244923791703450402961],
		[0.4179591836734693877551020,0.3818300505051189449503698,0.2797053914892766679014678,0.1294849661688696932706114],
		[0.3626837833783619829651504,0.3137066458778872873379622,0.2223810344533744705443560,0.1012285362903762591525314],
		[0.3302393550012597631645251,0.3123470770400028400686304,0.2606106964029354623187429,0.1806481606948574040584720,0.0812743883615744119718922],
		[0.2955242247147528701738930,0.2692667193099963550912269,0.2190863625159820439955349,0.1494513491505805931457763,0.0666713443086881375935688],
		[0.2729250867779006307144835,0.2628045445102466621806889,0.2331937645919904799185237,0.1862902109277342514260976,0.1255803694649046246346943,0.0556685671161736664827537],
		[0.2491470458134027850005624,0.2334925365383548087608499,0.2031674267230659217490645,0.1600783285433462263346525,0.1069393259953184309602547,0.0471753363865118271946160],
		[0.2325515532308739101945895,0.2262831802628972384120902,0.2078160475368885023125232,0.1781459807619457382800467,0.1388735102197872384636018,0.0921214998377284479144218,0.0404840047653158795200216],
		[0.2152638534631577901958764,0.2051984637212956039659241,0.1855383974779378137417166,0.1572031671581935345696019,0.1215185706879031846894148,0.0801580871597602098056333,0.0351194603317518630318329],
		[0.2025782419255612728806202,0.1984314853271115764561183,0.1861610000155622110268006,0.1662692058169939335532009,0.1395706779261543144478048,0.1071592204671719350118695,0.0703660474881081247092674,0.0307532419961172683546284],
		[0.1894506104550684962853967,0.1826034150449235888667637,0.1691565193950025381893121,0.1495959888165767320815017,0.1246289712555338720524763,0.0951585116824927848099251,0.0622535239386478928628438,0.0271524594117540948517806]
	];

	var abs = Math.abs,
		sqrt = Math.sqrt,
		pow = Math.pow,
		log2 = Math.log2 || function(x) {
			return Math.log(x) * Math.LOG2E;
		},
		EPSILON = 1e-12,
		MACHINE_EPSILON = 1.12e-16;

	function clamp(value, min, max) {
		return value < min ? min : value > max ? max : value;
	}

	function getDiscriminant(a, b, c) {
		function split(v) {
			var x = v * 134217729,
				y = v - x,
				hi = y + x,
				lo = v - hi;
			return [hi, lo];
		}

		var D = b * b - a * c,
			E = b * b + a * c;
		if (abs(D) * 3 < E) {
			var ad = split(a),
				bd = split(b),
				cd = split(c),
				p = b * b,
				dp = (bd[0] * bd[0] - p + 2 * bd[0] * bd[1]) + bd[1] * bd[1],
				q = a * c,
				dq = (ad[0] * cd[0] - q + ad[0] * cd[1] + ad[1] * cd[0])
						+ ad[1] * cd[1];
			D = (p - q) + (dp - dq);
		}
		return D;
	}

	function getNormalizationFactor() {
		var norm = Math.max.apply(Math, arguments);
		return norm && (norm < 1e-8 || norm > 1e8)
				? pow(2, -Math.round(log2(norm)))
				: 0;
	}

	return {
		EPSILON: EPSILON,
		MACHINE_EPSILON: MACHINE_EPSILON,
		CURVETIME_EPSILON: 1e-8,
		GEOMETRIC_EPSILON: 1e-7,
		TRIGONOMETRIC_EPSILON: 1e-8,
		KAPPA: 4 * (sqrt(2) - 1) / 3,

		isZero: function(val) {
			return val >= -EPSILON && val <= EPSILON;
		},

		clamp: clamp,

		integrate: function(f, a, b, n) {
			var x = abscissas[n - 2],
				w = weights[n - 2],
				A = (b - a) * 0.5,
				B = A + a,
				i = 0,
				m = (n + 1) >> 1,
				sum = n & 1 ? w[i++] * f(B) : 0;
			while (i < m) {
				var Ax = A * x[i];
				sum += w[i++] * (f(B + Ax) + f(B - Ax));
			}
			return A * sum;
		},

		findRoot: function(f, df, x, a, b, n, tolerance) {
			for (var i = 0; i < n; i++) {
				var fx = f(x),
					dx = fx / df(x),
					nx = x - dx;
				if (abs(dx) < tolerance) {
					x = nx;
					break;
				}
				if (fx > 0) {
					b = x;
					x = nx <= a ? (a + b) * 0.5 : nx;
				} else {
					a = x;
					x = nx >= b ? (a + b) * 0.5 : nx;
				}
			}
			return clamp(x, a, b);
		},

		solveQuadratic: function(a, b, c, roots, min, max) {
			var x1, x2 = Infinity;
			if (abs(a) < EPSILON) {
				if (abs(b) < EPSILON)
					return abs(c) < EPSILON ? -1 : 0;
				x1 = -c / b;
			} else {
				b *= -0.5;
				var D = getDiscriminant(a, b, c);
				if (D && abs(D) < MACHINE_EPSILON) {
					var f = getNormalizationFactor(abs(a), abs(b), abs(c));
					if (f) {
						a *= f;
						b *= f;
						c *= f;
						D = getDiscriminant(a, b, c);
					}
				}
				if (D >= -MACHINE_EPSILON) {
					var Q = D < 0 ? 0 : sqrt(D),
						R = b + (b < 0 ? -Q : Q);
					if (R === 0) {
						x1 = c / a;
						x2 = -x1;
					} else {
						x1 = R / a;
						x2 = c / R;
					}
				}
			}
			var count = 0,
				boundless = min == null,
				minB = min - EPSILON,
				maxB = max + EPSILON;
			if (isFinite(x1) && (boundless || x1 > minB && x1 < maxB))
				roots[count++] = boundless ? x1 : clamp(x1, min, max);
			if (x2 !== x1
					&& isFinite(x2) && (boundless || x2 > minB && x2 < maxB))
				roots[count++] = boundless ? x2 : clamp(x2, min, max);
			return count;
		},

		solveCubic: function(a, b, c, d, roots, min, max) {
			var f = getNormalizationFactor(abs(a), abs(b), abs(c), abs(d)),
				x, b1, c2, qd, q;
			if (f) {
				a *= f;
				b *= f;
				c *= f;
				d *= f;
			}

			function evaluate(x0) {
				x = x0;
				var tmp = a * x;
				b1 = tmp + b;
				c2 = b1 * x + c;
				qd = (tmp + b1) * x + c2;
				q = c2 * x + d;
			}

			if (abs(a) < EPSILON) {
				a = b;
				b1 = c;
				c2 = d;
				x = Infinity;
			} else if (abs(d) < EPSILON) {
				b1 = b;
				c2 = c;
				x = 0;
			} else {
				evaluate(-(b / a) / 3);
				var t = q / a,
					r = pow(abs(t), 1/3),
					s = t < 0 ? -1 : 1,
					td = -qd / a,
					rd = td > 0 ? 1.324717957244746 * Math.max(r, sqrt(td)) : r,
					x0 = x - s * rd;
				if (x0 !== x) {
					do {
						evaluate(x0);
						x0 = qd === 0 ? x : x - q / qd / (1 + MACHINE_EPSILON);
					} while (s * x0 > s * x);
					if (abs(a) * x * x > abs(d / x)) {
						c2 = -d / x;
						b1 = (c2 - c) / x;
					}
				}
			}
			var count = Numerical.solveQuadratic(a, b1, c2, roots, min, max),
				boundless = min == null;
			if (isFinite(x) && (count === 0
					|| count > 0 && x !== roots[0] && x !== roots[1])
					&& (boundless || x > min - EPSILON && x < max + EPSILON))
				roots[count++] = boundless ? x : clamp(x, min, max);
			return count;
		}
	};
};

var UID = {
	_id: 1,
	_pools: {},

	get: function(name) {
		if (name) {
			var pool = this._pools[name];
			if (!pool)
				pool = this._pools[name] = { _id: 1 };
			return pool._id++;
		} else {
			return this._id++;
		}
	}
};

var Point = Base.extend({
	_class: 'Point',
	_readIndex: true,

	initialize: function Point(arg0, arg1) {
		var type = typeof arg0,
			reading = this.__read,
			read = 0;
		if (type === 'number') {
			var hasY = typeof arg1 === 'number';
			this._set(arg0, hasY ? arg1 : arg0);
			if (reading)
				read = hasY ? 2 : 1;
		} else if (type === 'undefined' || arg0 === null) {
			this._set(0, 0);
			if (reading)
				read = arg0 === null ? 1 : 0;
		} else {
			var obj = type === 'string' ? arg0.split(/[\s,]+/) || [] : arg0;
			read = 1;
			if (Array.isArray(obj)) {
				this._set(+obj[0], +(obj.length > 1 ? obj[1] : obj[0]));
			} else if ('x' in obj) {
				this._set(obj.x || 0, obj.y || 0);
			} else if ('width' in obj) {
				this._set(obj.width || 0, obj.height || 0);
			} else if ('angle' in obj) {
				this._set(obj.length || 0, 0);
				this.setAngle(obj.angle || 0);
			} else {
				this._set(0, 0);
				read = 0;
			}
		}
		if (reading)
			this.__read = read;
		return this;
	},

	set: '#initialize',

	_set: function(x, y) {
		this.x = x;
		this.y = y;
		return this;
	},

	equals: function(point) {
		return this === point || point
				&& (this.x === point.x && this.y === point.y
					|| Array.isArray(point)
						&& this.x === point[0] && this.y === point[1])
				|| false;
	},

	clone: function() {
		return new Point(this.x, this.y);
	},

	toString: function() {
		var f = Formatter.instance;
		return '{ x: ' + f.number(this.x) + ', y: ' + f.number(this.y) + ' }';
	},

	_serialize: function(options) {
		var f = options.formatter;
		return [f.number(this.x), f.number(this.y)];
	},

	getLength: function() {
		return Math.sqrt(this.x * this.x + this.y * this.y);
	},

	setLength: function(length) {
		if (this.isZero()) {
			var angle = this._angle || 0;
			this._set(
				Math.cos(angle) * length,
				Math.sin(angle) * length
			);
		} else {
			var scale = length / this.getLength();
			if (Numerical.isZero(scale))
				this.getAngle();
			this._set(
				this.x * scale,
				this.y * scale
			);
		}
	},
	getAngle: function() {
		return this.getAngleInRadians.apply(this, arguments) * 180 / Math.PI;
	},

	setAngle: function(angle) {
		this.setAngleInRadians.call(this, angle * Math.PI / 180);
	},

	getAngleInDegrees: '#getAngle',
	setAngleInDegrees: '#setAngle',

	getAngleInRadians: function() {
		if (!arguments.length) {
			return this.isZero()
					? this._angle || 0
					: this._angle = Math.atan2(this.y, this.x);
		} else {
			var point = Point.read(arguments),
				div = this.getLength() * point.getLength();
			if (Numerical.isZero(div)) {
				return NaN;
			} else {
				var a = this.dot(point) / div;
				return Math.acos(a < -1 ? -1 : a > 1 ? 1 : a);
			}
		}
	},

	setAngleInRadians: function(angle) {
		this._angle = angle;
		if (!this.isZero()) {
			var length = this.getLength();
			this._set(
				Math.cos(angle) * length,
				Math.sin(angle) * length
			);
		}
	},

	getQuadrant: function() {
		return this.x >= 0 ? this.y >= 0 ? 1 : 4 : this.y >= 0 ? 2 : 3;
	}
}, {
	beans: false,

	getDirectedAngle: function() {
		var point = Point.read(arguments);
		return Math.atan2(this.cross(point), this.dot(point)) * 180 / Math.PI;
	},

	getDistance: function() {
		var point = Point.read(arguments),
			x = point.x - this.x,
			y = point.y - this.y,
			d = x * x + y * y,
			squared = Base.read(arguments);
		return squared ? d : Math.sqrt(d);
	},

	normalize: function(length) {
		if (length === undefined)
			length = 1;
		var current = this.getLength(),
			scale = current !== 0 ? length / current : 0,
			point = new Point(this.x * scale, this.y * scale);
		if (scale >= 0)
			point._angle = this._angle;
		return point;
	},

	rotate: function(angle, center) {
		if (angle === 0)
			return this.clone();
		angle = angle * Math.PI / 180;
		var point = center ? this.subtract(center) : this,
			sin = Math.sin(angle),
			cos = Math.cos(angle);
		point = new Point(
			point.x * cos - point.y * sin,
			point.x * sin + point.y * cos
		);
		return center ? point.add(center) : point;
	},

	transform: function(matrix) {
		return matrix ? matrix._transformPoint(this) : this;
	},

	add: function() {
		var point = Point.read(arguments);
		return new Point(this.x + point.x, this.y + point.y);
	},

	subtract: function() {
		var point = Point.read(arguments);
		return new Point(this.x - point.x, this.y - point.y);
	},

	multiply: function() {
		var point = Point.read(arguments);
		return new Point(this.x * point.x, this.y * point.y);
	},

	divide: function() {
		var point = Point.read(arguments);
		return new Point(this.x / point.x, this.y / point.y);
	},

	modulo: function() {
		var point = Point.read(arguments);
		return new Point(this.x % point.x, this.y % point.y);
	},

	negate: function() {
		return new Point(-this.x, -this.y);
	},

	isInside: function() {
		return Rectangle.read(arguments).contains(this);
	},

	isClose: function() {
		var point = Point.read(arguments),
			tolerance = Base.read(arguments);
		return this.getDistance(point) <= tolerance;
	},

	isCollinear: function() {
		var point = Point.read(arguments);
		return Point.isCollinear(this.x, this.y, point.x, point.y);
	},

	isColinear: '#isCollinear',

	isOrthogonal: function() {
		var point = Point.read(arguments);
		return Point.isOrthogonal(this.x, this.y, point.x, point.y);
	},

	isZero: function() {
		var isZero = Numerical.isZero;
		return isZero(this.x) && isZero(this.y);
	},

	isNaN: function() {
		return isNaN(this.x) || isNaN(this.y);
	},

	isInQuadrant: function(q) {
		return this.x * (q > 1 && q < 4 ? -1 : 1) >= 0
			&& this.y * (q > 2 ? -1 : 1) >= 0;
	},

	dot: function() {
		var point = Point.read(arguments);
		return this.x * point.x + this.y * point.y;
	},

	cross: function() {
		var point = Point.read(arguments);
		return this.x * point.y - this.y * point.x;
	},

	project: function() {
		var point = Point.read(arguments),
			scale = point.isZero() ? 0 : this.dot(point) / point.dot(point);
		return new Point(
			point.x * scale,
			point.y * scale
		);
	},

	statics: {
		min: function() {
			var point1 = Point.read(arguments),
				point2 = Point.read(arguments);
			return new Point(
				Math.min(point1.x, point2.x),
				Math.min(point1.y, point2.y)
			);
		},

		max: function() {
			var point1 = Point.read(arguments),
				point2 = Point.read(arguments);
			return new Point(
				Math.max(point1.x, point2.x),
				Math.max(point1.y, point2.y)
			);
		},

		random: function() {
			return new Point(Math.random(), Math.random());
		},

		isCollinear: function(x1, y1, x2, y2) {
			return Math.abs(x1 * y2 - y1 * x2)
					<= Math.sqrt((x1 * x1 + y1 * y1) * (x2 * x2 + y2 * y2))
						* 1e-8;
		},

		isOrthogonal: function(x1, y1, x2, y2) {
			return Math.abs(x1 * x2 + y1 * y2)
					<= Math.sqrt((x1 * x1 + y1 * y1) * (x2 * x2 + y2 * y2))
						* 1e-8;
		}
	}
}, Base.each(['round', 'ceil', 'floor', 'abs'], function(key) {
	var op = Math[key];
	this[key] = function() {
		return new Point(op(this.x), op(this.y));
	};
}, {}));

var LinkedPoint = Point.extend({
	initialize: function Point(x, y, owner, setter) {
		this._x = x;
		this._y = y;
		this._owner = owner;
		this._setter = setter;
	},

	_set: function(x, y, _dontNotify) {
		this._x = x;
		this._y = y;
		if (!_dontNotify)
			this._owner[this._setter](this);
		return this;
	},

	getX: function() {
		return this._x;
	},

	setX: function(x) {
		this._x = x;
		this._owner[this._setter](this);
	},

	getY: function() {
		return this._y;
	},

	setY: function(y) {
		this._y = y;
		this._owner[this._setter](this);
	},

	isSelected: function() {
		return !!(this._owner._selection & this._getSelection());
	},

	setSelected: function(selected) {
		this._owner._changeSelection(this._getSelection(), selected);
	},

	_getSelection: function() {
		return this._setter === 'setPosition' ? 4 : 0;
	}
});

var Size = Base.extend({
	_class: 'Size',
	_readIndex: true,

	initialize: function Size(arg0, arg1) {
		var type = typeof arg0,
			reading = this.__read,
			read = 0;
		if (type === 'number') {
			var hasHeight = typeof arg1 === 'number';
			this._set(arg0, hasHeight ? arg1 : arg0);
			if (reading)
				read = hasHeight ? 2 : 1;
		} else if (type === 'undefined' || arg0 === null) {
			this._set(0, 0);
			if (reading)
				read = arg0 === null ? 1 : 0;
		} else {
			var obj = type === 'string' ? arg0.split(/[\s,]+/) || [] : arg0;
			read = 1;
			if (Array.isArray(obj)) {
				this._set(+obj[0], +(obj.length > 1 ? obj[1] : obj[0]));
			} else if ('width' in obj) {
				this._set(obj.width || 0, obj.height || 0);
			} else if ('x' in obj) {
				this._set(obj.x || 0, obj.y || 0);
			} else {
				this._set(0, 0);
				read = 0;
			}
		}
		if (reading)
			this.__read = read;
		return this;
	},

	set: '#initialize',

	_set: function(width, height) {
		this.width = width;
		this.height = height;
		return this;
	},

	equals: function(size) {
		return size === this || size && (this.width === size.width
				&& this.height === size.height
				|| Array.isArray(size) && this.width === size[0]
					&& this.height === size[1]) || false;
	},

	clone: function() {
		return new Size(this.width, this.height);
	},

	toString: function() {
		var f = Formatter.instance;
		return '{ width: ' + f.number(this.width)
				+ ', height: ' + f.number(this.height) + ' }';
	},

	_serialize: function(options) {
		var f = options.formatter;
		return [f.number(this.width),
				f.number(this.height)];
	},

	add: function() {
		var size = Size.read(arguments);
		return new Size(this.width + size.width, this.height + size.height);
	},

	subtract: function() {
		var size = Size.read(arguments);
		return new Size(this.width - size.width, this.height - size.height);
	},

	multiply: function() {
		var size = Size.read(arguments);
		return new Size(this.width * size.width, this.height * size.height);
	},

	divide: function() {
		var size = Size.read(arguments);
		return new Size(this.width / size.width, this.height / size.height);
	},

	modulo: function() {
		var size = Size.read(arguments);
		return new Size(this.width % size.width, this.height % size.height);
	},

	negate: function() {
		return new Size(-this.width, -this.height);
	},

	isZero: function() {
		var isZero = Numerical.isZero;
		return isZero(this.width) && isZero(this.height);
	},

	isNaN: function() {
		return isNaN(this.width) || isNaN(this.height);
	},

	statics: {
		min: function(size1, size2) {
			return new Size(
				Math.min(size1.width, size2.width),
				Math.min(size1.height, size2.height));
		},

		max: function(size1, size2) {
			return new Size(
				Math.max(size1.width, size2.width),
				Math.max(size1.height, size2.height));
		},

		random: function() {
			return new Size(Math.random(), Math.random());
		}
	}
}, Base.each(['round', 'ceil', 'floor', 'abs'], function(key) {
	var op = Math[key];
	this[key] = function() {
		return new Size(op(this.width), op(this.height));
	};
}, {}));

var LinkedSize = Size.extend({
	initialize: function Size(width, height, owner, setter) {
		this._width = width;
		this._height = height;
		this._owner = owner;
		this._setter = setter;
	},

	_set: function(width, height, _dontNotify) {
		this._width = width;
		this._height = height;
		if (!_dontNotify)
			this._owner[this._setter](this);
		return this;
	},

	getWidth: function() {
		return this._width;
	},

	setWidth: function(width) {
		this._width = width;
		this._owner[this._setter](this);
	},

	getHeight: function() {
		return this._height;
	},

	setHeight: function(height) {
		this._height = height;
		this._owner[this._setter](this);
	}
});

var Rectangle = Base.extend({
	_class: 'Rectangle',
	_readIndex: true,
	beans: true,

	initialize: function Rectangle(arg0, arg1, arg2, arg3) {
		var type = typeof arg0,
			read;
		if (type === 'number') {
			this._set(arg0, arg1, arg2, arg3);
			read = 4;
		} else if (type === 'undefined' || arg0 === null) {
			this._set(0, 0, 0, 0);
			read = arg0 === null ? 1 : 0;
		} else if (arguments.length === 1) {
			if (Array.isArray(arg0)) {
				this._set.apply(this, arg0);
				read = 1;
			} else if (arg0.x !== undefined || arg0.width !== undefined) {
				this._set(arg0.x || 0, arg0.y || 0,
						arg0.width || 0, arg0.height || 0);
				read = 1;
			} else if (arg0.from === undefined && arg0.to === undefined) {
				this._set(0, 0, 0, 0);
				Base.filter(this, arg0);
				read = 1;
			}
		}
		if (read === undefined) {
			var frm = Point.readNamed(arguments, 'from'),
				next = Base.peek(arguments),
				x = frm.x,
				y = frm.y,
				width,
				height;
			if (next && next.x !== undefined
					|| Base.hasNamed(arguments, 'to')) {
				var to = Point.readNamed(arguments, 'to');
				width = to.x - x;
				height = to.y - y;
				if (width < 0) {
					x = to.x;
					width = -width;
				}
				if (height < 0) {
					y = to.y;
					height = -height;
				}
			} else {
				var size = Size.read(arguments);
				width = size.width;
				height = size.height;
			}
			this._set(x, y, width, height);
			read = arguments.__index;
			var filtered = arguments.__filtered;
			if (filtered)
				this.__filtered = filtered;
		}
		if (this.__read)
			this.__read = read;
		return this;
	},

	set: '#initialize',

	_set: function(x, y, width, height) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		return this;
	},

	clone: function() {
		return new Rectangle(this.x, this.y, this.width, this.height);
	},

	equals: function(rect) {
		var rt = Base.isPlainValue(rect)
				? Rectangle.read(arguments)
				: rect;
		return rt === this
				|| rt && this.x === rt.x && this.y === rt.y
					&& this.width === rt.width && this.height === rt.height
				|| false;
	},

	toString: function() {
		var f = Formatter.instance;
		return '{ x: ' + f.number(this.x)
				+ ', y: ' + f.number(this.y)
				+ ', width: ' + f.number(this.width)
				+ ', height: ' + f.number(this.height)
				+ ' }';
	},

	_serialize: function(options) {
		var f = options.formatter;
		return [f.number(this.x),
				f.number(this.y),
				f.number(this.width),
				f.number(this.height)];
	},

	getPoint: function(_dontLink) {
		var ctor = _dontLink ? Point : LinkedPoint;
		return new ctor(this.x, this.y, this, 'setPoint');
	},

	setPoint: function() {
		var point = Point.read(arguments);
		this.x = point.x;
		this.y = point.y;
	},

	getSize: function(_dontLink) {
		var ctor = _dontLink ? Size : LinkedSize;
		return new ctor(this.width, this.height, this, 'setSize');
	},

	_fw: 1,
	_fh: 1,

	setSize: function() {
		var size = Size.read(arguments),
			sx = this._sx,
			sy = this._sy,
			w = size.width,
			h = size.height;
		if (sx) {
			this.x += (this.width - w) * sx;
		}
		if (sy) {
			this.y += (this.height - h) * sy;
		}
		this.width = w;
		this.height = h;
		this._fw = this._fh = 1;
	},

	getLeft: function() {
		return this.x;
	},

	setLeft: function(left) {
		if (!this._fw) {
			var amount = left - this.x;
			this.width -= this._sx === 0.5 ? amount * 2 : amount;
		}
		this.x = left;
		this._sx = this._fw = 0;
	},

	getTop: function() {
		return this.y;
	},

	setTop: function(top) {
		if (!this._fh) {
			var amount = top - this.y;
			this.height -= this._sy === 0.5 ? amount * 2 : amount;
		}
		this.y = top;
		this._sy = this._fh = 0;
	},

	getRight: function() {
		return this.x + this.width;
	},

	setRight: function(right) {
		if (!this._fw) {
			var amount = right - this.x;
			this.width = this._sx === 0.5 ? amount * 2 : amount;
		}
		this.x = right - this.width;
		this._sx = 1;
		this._fw = 0;
	},

	getBottom: function() {
		return this.y + this.height;
	},

	setBottom: function(bottom) {
		if (!this._fh) {
			var amount = bottom - this.y;
			this.height = this._sy === 0.5 ? amount * 2 : amount;
		}
		this.y = bottom - this.height;
		this._sy = 1;
		this._fh = 0;
	},

	getCenterX: function() {
		return this.x + this.width / 2;
	},

	setCenterX: function(x) {
		if (this._fw || this._sx === 0.5) {
			this.x = x - this.width / 2;
		} else {
			if (this._sx) {
				this.x += (x - this.x) * 2 * this._sx;
			}
			this.width = (x - this.x) * 2;
		}
		this._sx = 0.5;
		this._fw = 0;
	},

	getCenterY: function() {
		return this.y + this.height / 2;
	},

	setCenterY: function(y) {
		if (this._fh || this._sy === 0.5) {
			this.y = y - this.height / 2;
		} else {
			if (this._sy) {
				this.y += (y - this.y) * 2 * this._sy;
			}
			this.height = (y - this.y) * 2;
		}
		this._sy = 0.5;
		this._fh = 0;
	},

	getCenter: function(_dontLink) {
		var ctor = _dontLink ? Point : LinkedPoint;
		return new ctor(this.getCenterX(), this.getCenterY(), this, 'setCenter');
	},

	setCenter: function() {
		var point = Point.read(arguments);
		this.setCenterX(point.x);
		this.setCenterY(point.y);
		return this;
	},

	getArea: function() {
		return this.width * this.height;
	},

	isEmpty: function() {
		return this.width === 0 || this.height === 0;
	},

	contains: function(arg) {
		return arg && arg.width !== undefined
				|| (Array.isArray(arg) ? arg : arguments).length === 4
				? this._containsRectangle(Rectangle.read(arguments))
				: this._containsPoint(Point.read(arguments));
	},

	_containsPoint: function(point) {
		var x = point.x,
			y = point.y;
		return x >= this.x && y >= this.y
				&& x <= this.x + this.width
				&& y <= this.y + this.height;
	},

	_containsRectangle: function(rect) {
		var x = rect.x,
			y = rect.y;
		return x >= this.x && y >= this.y
				&& x + rect.width <= this.x + this.width
				&& y + rect.height <= this.y + this.height;
	},

	intersects: function() {
		var rect = Rectangle.read(arguments),
			epsilon = Base.read(arguments) || 0;
		return rect.x + rect.width > this.x - epsilon
				&& rect.y + rect.height > this.y - epsilon
				&& rect.x < this.x + this.width + epsilon
				&& rect.y < this.y + this.height + epsilon;
	},

	intersect: function() {
		var rect = Rectangle.read(arguments),
			x1 = Math.max(this.x, rect.x),
			y1 = Math.max(this.y, rect.y),
			x2 = Math.min(this.x + this.width, rect.x + rect.width),
			y2 = Math.min(this.y + this.height, rect.y + rect.height);
		return new Rectangle(x1, y1, x2 - x1, y2 - y1);
	},

	unite: function() {
		var rect = Rectangle.read(arguments),
			x1 = Math.min(this.x, rect.x),
			y1 = Math.min(this.y, rect.y),
			x2 = Math.max(this.x + this.width, rect.x + rect.width),
			y2 = Math.max(this.y + this.height, rect.y + rect.height);
		return new Rectangle(x1, y1, x2 - x1, y2 - y1);
	},

	include: function() {
		var point = Point.read(arguments);
		var x1 = Math.min(this.x, point.x),
			y1 = Math.min(this.y, point.y),
			x2 = Math.max(this.x + this.width, point.x),
			y2 = Math.max(this.y + this.height, point.y);
		return new Rectangle(x1, y1, x2 - x1, y2 - y1);
	},

	expand: function() {
		var amount = Size.read(arguments),
			hor = amount.width,
			ver = amount.height;
		return new Rectangle(this.x - hor / 2, this.y - ver / 2,
				this.width + hor, this.height + ver);
	},

	scale: function(hor, ver) {
		return this.expand(this.width * hor - this.width,
				this.height * (ver === undefined ? hor : ver) - this.height);
	}
}, Base.each([
		['Top', 'Left'], ['Top', 'Right'],
		['Bottom', 'Left'], ['Bottom', 'Right'],
		['Left', 'Center'], ['Top', 'Center'],
		['Right', 'Center'], ['Bottom', 'Center']
	],
	function(parts, index) {
		var part = parts.join(''),
			xFirst = /^[RL]/.test(part);
		if (index >= 4)
			parts[1] += xFirst ? 'Y' : 'X';
		var x = parts[xFirst ? 0 : 1],
			y = parts[xFirst ? 1 : 0],
			getX = 'get' + x,
			getY = 'get' + y,
			setX = 'set' + x,
			setY = 'set' + y,
			get = 'get' + part,
			set = 'set' + part;
		this[get] = function(_dontLink) {
			var ctor = _dontLink ? Point : LinkedPoint;
			return new ctor(this[getX](), this[getY](), this, set);
		};
		this[set] = function() {
			var point = Point.read(arguments);
			this[setX](point.x);
			this[setY](point.y);
		};
	}, {
		beans: true
	}
));

var LinkedRectangle = Rectangle.extend({
	initialize: function Rectangle(x, y, width, height, owner, setter) {
		this._set(x, y, width, height, true);
		this._owner = owner;
		this._setter = setter;
	},

	_set: function(x, y, width, height, _dontNotify) {
		this._x = x;
		this._y = y;
		this._width = width;
		this._height = height;
		if (!_dontNotify)
			this._owner[this._setter](this);
		return this;
	}
},
new function() {
	var proto = Rectangle.prototype;

	return Base.each(['x', 'y', 'width', 'height'], function(key) {
		var part = Base.capitalize(key),
			internal = '_' + key;
		this['get' + part] = function() {
			return this[internal];
		};

		this['set' + part] = function(value) {
			this[internal] = value;
			if (!this._dontNotify)
				this._owner[this._setter](this);
		};
	}, Base.each(['Point', 'Size', 'Center',
			'Left', 'Top', 'Right', 'Bottom', 'CenterX', 'CenterY',
			'TopLeft', 'TopRight', 'BottomLeft', 'BottomRight',
			'LeftCenter', 'TopCenter', 'RightCenter', 'BottomCenter'],
		function(key) {
			var name = 'set' + key;
			this[name] = function() {
				this._dontNotify = true;
				proto[name].apply(this, arguments);
				this._dontNotify = false;
				this._owner[this._setter](this);
			};
		}, {
			isSelected: function() {
				return !!(this._owner._selection & 2);
			},

			setSelected: function(selected) {
				var owner = this._owner;
				if (owner._changeSelection) {
					owner._changeSelection(2, selected);
				}
			}
		})
	);
});

var Matrix = Base.extend({
	_class: 'Matrix',

	initialize: function Matrix(arg, _dontNotify) {
		var count = arguments.length,
			ok = true;
		if (count >= 6) {
			this._set.apply(this, arguments);
		} else if (count === 1 || count === 2) {
			if (arg instanceof Matrix) {
				this._set(arg._a, arg._b, arg._c, arg._d, arg._tx, arg._ty,
						_dontNotify);
			} else if (Array.isArray(arg)) {
				this._set.apply(this,
						_dontNotify ? arg.concat([_dontNotify]) : arg);
			} else {
				ok = false;
			}
		} else if (!count) {
			this.reset();
		} else {
			ok = false;
		}
		if (!ok) {
			throw new Error('Unsupported matrix parameters');
		}
		return this;
	},

	set: '#initialize',

	_set: function(a, b, c, d, tx, ty, _dontNotify) {
		this._a = a;
		this._b = b;
		this._c = c;
		this._d = d;
		this._tx = tx;
		this._ty = ty;
		if (!_dontNotify)
			this._changed();
		return this;
	},

	_serialize: function(options, dictionary) {
		return Base.serialize(this.getValues(), options, true, dictionary);
	},

	_changed: function() {
		var owner = this._owner;
		if (owner) {
			if (owner._applyMatrix) {
				owner.transform(null, true);
			} else {
				owner._changed(9);
			}
		}
	},

	clone: function() {
		return new Matrix(this._a, this._b, this._c, this._d,
				this._tx, this._ty);
	},

	equals: function(mx) {
		return mx === this || mx && this._a === mx._a && this._b === mx._b
				&& this._c === mx._c && this._d === mx._d
				&& this._tx === mx._tx && this._ty === mx._ty;
	},

	toString: function() {
		var f = Formatter.instance;
		return '[[' + [f.number(this._a), f.number(this._c),
					f.number(this._tx)].join(', ') + '], ['
				+ [f.number(this._b), f.number(this._d),
					f.number(this._ty)].join(', ') + ']]';
	},

	reset: function(_dontNotify) {
		this._a = this._d = 1;
		this._b = this._c = this._tx = this._ty = 0;
		if (!_dontNotify)
			this._changed();
		return this;
	},

	apply: function(recursively, _setApplyMatrix) {
		var owner = this._owner;
		if (owner) {
			owner.transform(null, true, Base.pick(recursively, true),
					_setApplyMatrix);
			return this.isIdentity();
		}
		return false;
	},

	translate: function() {
		var point = Point.read(arguments),
			x = point.x,
			y = point.y;
		this._tx += x * this._a + y * this._c;
		this._ty += x * this._b + y * this._d;
		this._changed();
		return this;
	},

	scale: function() {
		var scale = Point.read(arguments),
			center = Point.read(arguments, 0, { readNull: true });
		if (center)
			this.translate(center);
		this._a *= scale.x;
		this._b *= scale.x;
		this._c *= scale.y;
		this._d *= scale.y;
		if (center)
			this.translate(center.negate());
		this._changed();
		return this;
	},

	rotate: function(angle ) {
		angle *= Math.PI / 180;
		var center = Point.read(arguments, 1),
			x = center.x,
			y = center.y,
			cos = Math.cos(angle),
			sin = Math.sin(angle),
			tx = x - x * cos + y * sin,
			ty = y - x * sin - y * cos,
			a = this._a,
			b = this._b,
			c = this._c,
			d = this._d;
		this._a = cos * a + sin * c;
		this._b = cos * b + sin * d;
		this._c = -sin * a + cos * c;
		this._d = -sin * b + cos * d;
		this._tx += tx * a + ty * c;
		this._ty += tx * b + ty * d;
		this._changed();
		return this;
	},

	shear: function() {
		var shear = Point.read(arguments),
			center = Point.read(arguments, 0, { readNull: true });
		if (center)
			this.translate(center);
		var a = this._a,
			b = this._b;
		this._a += shear.y * this._c;
		this._b += shear.y * this._d;
		this._c += shear.x * a;
		this._d += shear.x * b;
		if (center)
			this.translate(center.negate());
		this._changed();
		return this;
	},

	skew: function() {
		var skew = Point.read(arguments),
			center = Point.read(arguments, 0, { readNull: true }),
			toRadians = Math.PI / 180,
			shear = new Point(Math.tan(skew.x * toRadians),
				Math.tan(skew.y * toRadians));
		return this.shear(shear, center);
	},

	append: function(mx, _dontNotify) {
		if (mx) {
			var a1 = this._a,
				b1 = this._b,
				c1 = this._c,
				d1 = this._d,
				a2 = mx._a,
				b2 = mx._c,
				c2 = mx._b,
				d2 = mx._d,
				tx2 = mx._tx,
				ty2 = mx._ty;
			this._a = a2 * a1 + c2 * c1;
			this._c = b2 * a1 + d2 * c1;
			this._b = a2 * b1 + c2 * d1;
			this._d = b2 * b1 + d2 * d1;
			this._tx += tx2 * a1 + ty2 * c1;
			this._ty += tx2 * b1 + ty2 * d1;
			if (!_dontNotify)
				this._changed();
		}
		return this;
	},

	prepend: function(mx, _dontNotify) {
		if (mx) {
			var a1 = this._a,
				b1 = this._b,
				c1 = this._c,
				d1 = this._d,
				tx1 = this._tx,
				ty1 = this._ty,
				a2 = mx._a,
				b2 = mx._c,
				c2 = mx._b,
				d2 = mx._d,
				tx2 = mx._tx,
				ty2 = mx._ty;
			this._a = a2 * a1 + b2 * b1;
			this._c = a2 * c1 + b2 * d1;
			this._b = c2 * a1 + d2 * b1;
			this._d = c2 * c1 + d2 * d1;
			this._tx = a2 * tx1 + b2 * ty1 + tx2;
			this._ty = c2 * tx1 + d2 * ty1 + ty2;
			if (!_dontNotify)
				this._changed();
		}
		return this;
	},

	appended: function(mx) {
		return this.clone().append(mx);
	},

	prepended: function(mx) {
		return this.clone().prepend(mx);
	},

	invert: function() {
		var a = this._a,
			b = this._b,
			c = this._c,
			d = this._d,
			tx = this._tx,
			ty = this._ty,
			det = a * d - b * c,
			res = null;
		if (det && !isNaN(det) && isFinite(tx) && isFinite(ty)) {
			this._a = d / det;
			this._b = -b / det;
			this._c = -c / det;
			this._d = a / det;
			this._tx = (c * ty - d * tx) / det;
			this._ty = (b * tx - a * ty) / det;
			res = this;
		}
		return res;
	},

	inverted: function() {
		return this.clone().invert();
	},

	concatenate: '#append',
	preConcatenate: '#prepend',
	chain: '#appended',

	_shiftless: function() {
		return new Matrix(this._a, this._b, this._c, this._d, 0, 0);
	},

	_orNullIfIdentity: function() {
		return this.isIdentity() ? null : this;
	},

	isIdentity: function() {
		return this._a === 1 && this._b === 0 && this._c === 0 && this._d === 1
				&& this._tx === 0 && this._ty === 0;
	},

	isInvertible: function() {
		var det = this._a * this._d - this._c * this._b;
		return det && !isNaN(det) && isFinite(this._tx) && isFinite(this._ty);
	},

	isSingular: function() {
		return !this.isInvertible();
	},

	transform: function( src, dst, count) {
		return arguments.length < 3
			? this._transformPoint(Point.read(arguments))
			: this._transformCoordinates(src, dst, count);
	},

	_transformPoint: function(point, dest, _dontNotify) {
		var x = point.x,
			y = point.y;
		if (!dest)
			dest = new Point();
		return dest._set(
				x * this._a + y * this._c + this._tx,
				x * this._b + y * this._d + this._ty,
				_dontNotify);
	},

	_transformCoordinates: function(src, dst, count) {
		for (var i = 0, max = 2 * count; i < max; i += 2) {
			var x = src[i],
				y = src[i + 1];
			dst[i] = x * this._a + y * this._c + this._tx;
			dst[i + 1] = x * this._b + y * this._d + this._ty;
		}
		return dst;
	},

	_transformCorners: function(rect) {
		var x1 = rect.x,
			y1 = rect.y,
			x2 = x1 + rect.width,
			y2 = y1 + rect.height,
			coords = [ x1, y1, x2, y1, x2, y2, x1, y2 ];
		return this._transformCoordinates(coords, coords, 4);
	},

	_transformBounds: function(bounds, dest, _dontNotify) {
		var coords = this._transformCorners(bounds),
			min = coords.slice(0, 2),
			max = min.slice();
		for (var i = 2; i < 8; i++) {
			var val = coords[i],
				j = i & 1;
			if (val < min[j]) {
				min[j] = val;
			} else if (val > max[j]) {
				max[j] = val;
			}
		}
		if (!dest)
			dest = new Rectangle();
		return dest._set(min[0], min[1], max[0] - min[0], max[1] - min[1],
				_dontNotify);
	},

	inverseTransform: function() {
		return this._inverseTransform(Point.read(arguments));
	},

	_inverseTransform: function(point, dest, _dontNotify) {
		var a = this._a,
			b = this._b,
			c = this._c,
			d = this._d,
			tx = this._tx,
			ty = this._ty,
			det = a * d - b * c,
			res = null;
		if (det && !isNaN(det) && isFinite(tx) && isFinite(ty)) {
			var x = point.x - this._tx,
				y = point.y - this._ty;
			if (!dest)
				dest = new Point();
			res = dest._set(
					(x * d - y * c) / det,
					(y * a - x * b) / det,
					_dontNotify);
		}
		return res;
	},

	decompose: function() {
		var a = this._a,
			b = this._b,
			c = this._c,
			d = this._d,
			det = a * d - b * c,
			sqrt = Math.sqrt,
			atan2 = Math.atan2,
			degrees = 180 / Math.PI,
			rotate,
			scale,
			skew;
		if (a !== 0 || b !== 0) {
			var r = sqrt(a * a + b * b);
			rotate = Math.acos(a / r) * (b > 0 ? 1 : -1);
			scale = [r, det / r];
			skew = [atan2(a * c + b * d, r * r), 0];
		} else if (c !== 0 || d !== 0) {
			var s = sqrt(c * c + d * d);
			rotate = Math.asin(c / s)  * (d > 0 ? 1 : -1);
			scale = [det / s, s];
			skew = [0, atan2(a * c + b * d, s * s)];
		} else {
			rotate = 0;
			skew = scale = [0, 0];
		}
		return {
			translation: this.getTranslation(),
			rotation: rotate * degrees,
			scaling: new Point(scale),
			skewing: new Point(skew[0] * degrees, skew[1] * degrees)
		};
	},

	getValues: function() {
		return [ this._a, this._b, this._c, this._d, this._tx, this._ty ];
	},

	getTranslation: function() {
		return new Point(this._tx, this._ty);
	},

	getScaling: function() {
		return (this.decompose() || {}).scaling;
	},

	getRotation: function() {
		return (this.decompose() || {}).rotation;
	},

	applyToContext: function(ctx) {
		if (!this.isIdentity()) {
			ctx.transform(this._a, this._b, this._c, this._d,
					this._tx, this._ty);
		}
	}
}, Base.each(['a', 'b', 'c', 'd', 'tx', 'ty'], function(key) {
	var part = Base.capitalize(key),
		prop = '_' + key;
	this['get' + part] = function() {
		return this[prop];
	};
	this['set' + part] = function(value) {
		this[prop] = value;
		this._changed();
	};
}, {}));

var Line = Base.extend({
	_class: 'Line',

	initialize: function Line(arg0, arg1, arg2, arg3, arg4) {
		var asVector = false;
		if (arguments.length >= 4) {
			this._px = arg0;
			this._py = arg1;
			this._vx = arg2;
			this._vy = arg3;
			asVector = arg4;
		} else {
			this._px = arg0.x;
			this._py = arg0.y;
			this._vx = arg1.x;
			this._vy = arg1.y;
			asVector = arg2;
		}
		if (!asVector) {
			this._vx -= this._px;
			this._vy -= this._py;
		}
	},

	getPoint: function() {
		return new Point(this._px, this._py);
	},

	getVector: function() {
		return new Point(this._vx, this._vy);
	},

	getLength: function() {
		return this.getVector().getLength();
	},

	intersect: function(line, isInfinite) {
		return Line.intersect(
				this._px, this._py, this._vx, this._vy,
				line._px, line._py, line._vx, line._vy,
				true, isInfinite);
	},

	getSide: function(point, isInfinite) {
		return Line.getSide(
				this._px, this._py, this._vx, this._vy,
				point.x, point.y, true, isInfinite);
	},

	getDistance: function(point) {
		return Math.abs(this.getSignedDistance(point));
	},

	getSignedDistance: function(point) {
		return Line.getSignedDistance(this._px, this._py, this._vx, this._vy,
				point.x, point.y, true);
	},

	isCollinear: function(line) {
		return Point.isCollinear(this._vx, this._vy, line._vx, line._vy);
	},

	isOrthogonal: function(line) {
		return Point.isOrthogonal(this._vx, this._vy, line._vx, line._vy);
	},

	statics: {
		intersect: function(p1x, p1y, v1x, v1y, p2x, p2y, v2x, v2y, asVector,
				isInfinite) {
			if (!asVector) {
				v1x -= p1x;
				v1y -= p1y;
				v2x -= p2x;
				v2y -= p2y;
			}
			var cross = v1x * v2y - v1y * v2x;
			if (!Numerical.isZero(cross)) {
				var dx = p1x - p2x,
					dy = p1y - p2y,
					u1 = (v2x * dy - v2y * dx) / cross,
					u2 = (v1x * dy - v1y * dx) / cross,
					epsilon = 1e-12,
					uMin = -epsilon,
					uMax = 1 + epsilon;
				if (isInfinite
						|| uMin < u1 && u1 < uMax && uMin < u2 && u2 < uMax) {
					if (!isInfinite) {
						u1 = u1 <= 0 ? 0 : u1 >= 1 ? 1 : u1;
					}
					return new Point(
							p1x + u1 * v1x,
							p1y + u1 * v1y);
				}
			}
		},

		getSide: function(px, py, vx, vy, x, y, asVector, isInfinite) {
			if (!asVector) {
				vx -= px;
				vy -= py;
			}
			var v2x = x - px,
				v2y = y - py,
				ccw = v2x * vy - v2y * vx;
			if (!isInfinite && Numerical.isZero(ccw)) {
				ccw = (v2x * vx + v2x * vx) / (vx * vx + vy * vy);
				if (ccw >= 0 && ccw <= 1)
					ccw = 0;
			}
			return ccw < 0 ? -1 : ccw > 0 ? 1 : 0;
		},

		getSignedDistance: function(px, py, vx, vy, x, y, asVector) {
			if (!asVector) {
				vx -= px;
				vy -= py;
			}
			return vx === 0 ? vy > 0 ? x - px : px - x
				 : vy === 0 ? vx < 0 ? y - py : py - y
				 : ((x-px) * vy - (y-py) * vx) / Math.sqrt(vx * vx + vy * vy);
		},

		getDistance: function(px, py, vx, vy, x, y, asVector) {
			return Math.abs(
					Line.getSignedDistance(px, py, vx, vy, x, y, asVector));
		}
	}
});

var Project = PaperScopeItem.extend({
	_class: 'Project',
	_list: 'projects',
	_reference: 'project',
	_compactSerialize: true,

	initialize: function Project(element) {
		PaperScopeItem.call(this, true);
		this._children = [];
		this._namedChildren = {};
		this._activeLayer = null;
		this._currentStyle = new Style(null, null, this);
		this._view = View.create(this,
				element || CanvasProvider.getCanvas(1, 1));
		this._selectionItems = {};
		this._selectionCount = 0;
		this._updateVersion = 0;
	},

	_serialize: function(options, dictionary) {
		return Base.serialize(this._children, options, true, dictionary);
	},

	_changed: function(flags, item) {
		if (flags & 1) {
			var view = this._view;
			if (view) {
				view._needsUpdate = true;
				if (!view._requested && view._autoUpdate)
					view.requestUpdate();
			}
		}
		var changes = this._changes;
		if (changes && item) {
			var changesById = this._changesById,
				id = item._id,
				entry = changesById[id];
			if (entry) {
				entry.flags |= flags;
			} else {
				changes.push(changesById[id] = { item: item, flags: flags });
			}
		}
	},

	clear: function() {
		var children = this._children;
		for (var i = children.length - 1; i >= 0; i--)
			children[i].remove();
	},

	isEmpty: function() {
		return !this._children.length;
	},

	remove: function remove() {
		if (!remove.base.call(this))
			return false;
		if (this._view)
			this._view.remove();
		return true;
	},

	getView: function() {
		return this._view;
	},

	getCurrentStyle: function() {
		return this._currentStyle;
	},

	setCurrentStyle: function(style) {
		this._currentStyle.set(style);
	},

	getIndex: function() {
		return this._index;
	},

	getOptions: function() {
		return this._scope.settings;
	},

	getLayers: function() {
		return this._children;
	},

	getActiveLayer: function() {
		return this._activeLayer || new Layer({ project: this, insert: true });
	},

	getSymbolDefinitions: function() {
		var definitions = [],
			ids = {};
		this.getItems({
			class: SymbolItem,
			match: function(item) {
				var definition = item._definition,
					id = definition._id;
				if (!ids[id]) {
					ids[id] = true;
					definitions.push(definition);
				}
				return false;
			}
		});
		return definitions;
	},

	getSymbols: 'getSymbolDefinitions',

	getSelectedItems: function() {
		var selectionItems = this._selectionItems,
			items = [];
		for (var id in selectionItems) {
			var item = selectionItems[id],
				selection = item._selection;
			if ((selection & 1) && item.isInserted()) {
				items.push(item);
			} else if (!selection) {
				this._updateSelection(item);
			}
		}
		return items;
	},

	_updateSelection: function(item) {
		var id = item._id,
			selectionItems = this._selectionItems;
		if (item._selection) {
			if (selectionItems[id] !== item) {
				this._selectionCount++;
				selectionItems[id] = item;
			}
		} else if (selectionItems[id] === item) {
			this._selectionCount--;
			delete selectionItems[id];
		}
	},

	selectAll: function() {
		var children = this._children;
		for (var i = 0, l = children.length; i < l; i++)
			children[i].setFullySelected(true);
	},

	deselectAll: function() {
		var selectionItems = this._selectionItems;
		for (var i in selectionItems)
			selectionItems[i].setFullySelected(false);
	},

	addLayer: function(layer) {
		return this.insertLayer(undefined, layer);
	},

	insertLayer: function(index, layer) {
		if (layer instanceof Layer) {
			layer._remove(false, true);
			Base.splice(this._children, [layer], index, 0);
			layer._setProject(this, true);
			var name = layer._name;
			if (name)
				layer.setName(name);
			if (this._changes)
				layer._changed(5);
			if (!this._activeLayer)
				this._activeLayer = layer;
		} else {
			layer = null;
		}
		return layer;
	},

	_insertItem: function(index, item, _created) {
		item = this.insertLayer(index, item)
				|| (this._activeLayer || this._insertItem(undefined,
						new Layer(Item.NO_INSERT), true))
						.insertChild(index, item);
		if (_created && item.activate)
			item.activate();
		return item;
	},

	getItems: function(options) {
		return Item._getItems(this, options);
	},

	getItem: function(options) {
		return Item._getItems(this, options, null, null, true)[0] || null;
	},

	importJSON: function(json) {
		this.activate();
		var layer = this._activeLayer;
		return Base.importJSON(json, layer && layer.isEmpty() && layer);
	},

	removeOn: function(type) {
		var sets = this._removeSets;
		if (sets) {
			if (type === 'mouseup')
				sets.mousedrag = null;
			var set = sets[type];
			if (set) {
				for (var id in set) {
					var item = set[id];
					for (var key in sets) {
						var other = sets[key];
						if (other && other != set)
							delete other[item._id];
					}
					item.remove();
				}
				sets[type] = null;
			}
		}
	},

	draw: function(ctx, matrix, pixelRatio) {
		this._updateVersion++;
		ctx.save();
		matrix.applyToContext(ctx);
		var children = this._children,
			param = new Base({
				offset: new Point(0, 0),
				pixelRatio: pixelRatio,
				viewMatrix: matrix.isIdentity() ? null : matrix,
				matrices: [new Matrix()],
				updateMatrix: true
			});
		for (var i = 0, l = children.length; i < l; i++) {
			children[i].draw(ctx, param);
		}
		ctx.restore();

		if (this._selectionCount > 0) {
			ctx.save();
			ctx.strokeWidth = 1;
			var items = this._selectionItems,
				size = this._scope.settings.handleSize,
				version = this._updateVersion;
			for (var id in items) {
				items[id]._drawSelection(ctx, matrix, size, items, version);
			}
			ctx.restore();
		}
	}
});

var Item = Base.extend(Emitter, {
	statics: {
		extend: function extend(src) {
			if (src._serializeFields)
				src._serializeFields = Base.set({},
					this.prototype._serializeFields, src._serializeFields);
			return extend.base.apply(this, arguments);
		},

		NO_INSERT: { insert: false }
	},

	_class: 'Item',
	_name: null,
	_applyMatrix: true,
	_canApplyMatrix: true,
	_canScaleStroke: false,
	_pivot: null,
	_visible: true,
	_blendMode: 'normal',
	_opacity: 1,
	_locked: false,
	_guide: false,
	_clipMask: false,
	_selection: 0,
	_selectBounds: true,
	_selectChildren: false,
	_serializeFields: {
		name: null,
		applyMatrix: null,
		matrix: new Matrix(),
		pivot: null,
		visible: true,
		blendMode: 'normal',
		opacity: 1,
		locked: false,
		guide: false,
		clipMask: false,
		selected: false,
		data: {}
	},
	_prioritize: ['applyMatrix']
},
new function() {
	var handlers = ['onMouseDown', 'onMouseUp', 'onMouseDrag', 'onClick',
			'onDoubleClick', 'onMouseMove', 'onMouseEnter', 'onMouseLeave'];
	return Base.each(handlers,
		function(name) {
			this._events[name] = {
				install: function(type) {
					this.getView()._countItemEvent(type, 1);
				},

				uninstall: function(type) {
					this.getView()._countItemEvent(type, -1);
				}
			};
		}, {
			_events: {
				onFrame: {
					install: function() {
						this.getView()._animateItem(this, true);
					},

					uninstall: function() {
						this.getView()._animateItem(this, false);
					}
				},

				onLoad: {},
				onError: {}
			},
			statics: {
				_itemHandlers: handlers
			}
		}
	);
}, {
	initialize: function Item() {
	},

	_initialize: function(props, point) {
		var hasProps = props && Base.isPlainObject(props),
			internal = hasProps && props.internal === true,
			matrix = this._matrix = new Matrix(),
			project = hasProps && props.project || paper.project,
			settings = paper.settings;
		this._id = internal ? null : UID.get();
		this._parent = this._index = null;
		this._applyMatrix = this._canApplyMatrix && settings.applyMatrix;
		if (point)
			matrix.translate(point);
		matrix._owner = this;
		this._style = new Style(project._currentStyle, this, project);
		if (internal || hasProps && props.insert == false
			|| !settings.insertItems && !(hasProps && props.insert === true)) {
			this._setProject(project);
		} else {
			(hasProps && props.parent || project)
					._insertItem(undefined, this, true);
		}
		if (hasProps && props !== Item.NO_INSERT) {
			this.set(props, {
				internal: true, insert: true, project: true, parent: true
			});
		}
		return hasProps;
	},

	_serialize: function(options, dictionary) {
		var props = {},
			that = this;

		function serialize(fields) {
			for (var key in fields) {
				var value = that[key];
				if (!Base.equals(value, key === 'leading'
						? fields.fontSize * 1.2 : fields[key])) {
					props[key] = Base.serialize(value, options,
							key !== 'data', dictionary);
				}
			}
		}

		serialize(this._serializeFields);
		if (!(this instanceof Group))
			serialize(this._style._defaults);
		return [ this._class, props ];
	},

	_changed: function(flags) {
		var symbol = this._symbol,
			cacheParent = this._parent || symbol,
			project = this._project;
		if (flags & 8) {
			this._bounds = this._position = this._decomposed =
					this._globalMatrix = undefined;
		}
		if (cacheParent
				&& (flags & 40)) {
			Item._clearBoundsCache(cacheParent);
		}
		if (flags & 2) {
			Item._clearBoundsCache(this);
		}
		if (project)
			project._changed(flags, this);
		if (symbol)
			symbol._changed(flags);
	},

	getId: function() {
		return this._id;
	},

	getName: function() {
		return this._name;
	},

	setName: function(name) {

		if (this._name)
			this._removeNamed();
		if (name === (+name) + '')
			throw new Error(
					'Names consisting only of numbers are not supported.');
		var owner = this._getOwner();
		if (name && owner) {
			var children = owner._children,
				namedChildren = owner._namedChildren;
			(namedChildren[name] = namedChildren[name] || []).push(this);
			if (!(name in children))
				children[name] = this;
		}
		this._name = name || undefined;
		this._changed(128);
	},

	getStyle: function() {
		return this._style;
	},

	setStyle: function(style) {
		this.getStyle().set(style);
	}
}, Base.each(['locked', 'visible', 'blendMode', 'opacity', 'guide'],
	function(name) {
		var part = Base.capitalize(name),
			key = '_' + name,
			flags = {
				locked: 128,
				visible: 137
			};
		this['get' + part] = function() {
			return this[key];
		};
		this['set' + part] = function(value) {
			if (value != this[key]) {
				this[key] = value;
				this._changed(flags[name] || 129);
			}
		};
	},
{}), {
	beans: true,

	getSelection: function() {
		return this._selection;
	},

	setSelection: function(selection) {
		if (selection !== this._selection) {
			this._selection = selection;
			var project = this._project;
			if (project) {
				project._updateSelection(this);
				this._changed(129);
			}
		}
	},

	_changeSelection: function(flag, selected) {
		var selection = this._selection;
		this.setSelection(selected ? selection | flag : selection & ~flag);
	},

	isSelected: function() {
		if (this._selectChildren) {
			var children = this._children;
			for (var i = 0, l = children.length; i < l; i++)
				if (children[i].isSelected())
					return true;
		}
		return !!(this._selection & 1);
	},

	setSelected: function(selected) {
		if (this._selectChildren) {
			var children = this._children;
			for (var i = 0, l = children.length; i < l; i++)
				children[i].setSelected(selected);
		}
		this._changeSelection(1, selected);
	},

	isFullySelected: function() {
		var children = this._children,
			selected = !!(this._selection & 1);
		if (children && selected) {
			for (var i = 0, l = children.length; i < l; i++)
				if (!children[i].isFullySelected())
					return false;
			return true;
		}
		return selected;
	},

	setFullySelected: function(selected) {
		var children = this._children;
		if (children) {
			for (var i = 0, l = children.length; i < l; i++)
				children[i].setFullySelected(selected);
		}
		this._changeSelection(1, selected);
	},

	isClipMask: function() {
		return this._clipMask;
	},

	setClipMask: function(clipMask) {
		if (this._clipMask != (clipMask = !!clipMask)) {
			this._clipMask = clipMask;
			if (clipMask) {
				this.setFillColor(null);
				this.setStrokeColor(null);
			}
			this._changed(129);
			if (this._parent)
				this._parent._changed(1024);
		}
	},

	getData: function() {
		if (!this._data)
			this._data = {};
		return this._data;
	},

	setData: function(data) {
		this._data = data;
	},

	getPosition: function(_dontLink) {
		var position = this._position,
			ctor = _dontLink ? Point : LinkedPoint;
		if (!position) {
			var pivot = this._pivot;
			position = this._position = pivot
					? this._matrix._transformPoint(pivot)
					: this.getBounds().getCenter(true);
		}
		return new ctor(position.x, position.y, this, 'setPosition');
	},

	setPosition: function() {
		this.translate(Point.read(arguments).subtract(this.getPosition(true)));
	},

	getPivot: function() {
		var pivot = this._pivot;
		return pivot
				? new LinkedPoint(pivot.x, pivot.y, this, 'setPivot')
				: null;
	},

	setPivot: function() {
		this._pivot = Point.read(arguments, 0, { clone: true, readNull: true });
		this._position = undefined;
	}
}, Base.each({
		getStrokeBounds: { stroke: true },
		getHandleBounds: { handle: true },
		getInternalBounds: { internal: true }
	},
	function(options, key) {
		this[key] = function(matrix) {
			return this.getBounds(matrix, options);
		};
	},
{
	beans: true,

	getBounds: function(matrix, options) {
		var hasMatrix = options || matrix instanceof Matrix,
			opts = Base.set({}, hasMatrix ? options : matrix,
					this._boundsOptions);
		if (!opts.stroke || this.getStrokeScaling())
			opts.cacheItem = this;
		var rect = this._getCachedBounds(hasMatrix && matrix, opts).rect;
		return !arguments.length
				? new LinkedRectangle(rect.x, rect.y, rect.width, rect.height,
					this, 'setBounds')
				: rect;
	},

	setBounds: function() {
		var rect = Rectangle.read(arguments),
			bounds = this.getBounds(),
			_matrix = this._matrix,
			matrix = new Matrix(),
			center = rect.getCenter();
		matrix.translate(center);
		if (rect.width != bounds.width || rect.height != bounds.height) {
			if (!_matrix.isInvertible()) {
				_matrix.set(_matrix._backup
						|| new Matrix().translate(_matrix.getTranslation()));
				bounds = this.getBounds();
			}
			matrix.scale(
					bounds.width !== 0 ? rect.width / bounds.width : 0,
					bounds.height !== 0 ? rect.height / bounds.height : 0);
		}
		center = bounds.getCenter();
		matrix.translate(-center.x, -center.y);
		this.transform(matrix);
	},

	_getBounds: function(matrix, options) {
		var children = this._children;
		if (!children || !children.length)
			return new Rectangle();
		Item._updateBoundsCache(this, options.cacheItem);
		return Item._getBounds(children, matrix, options);
	},

	_getBoundsCacheKey: function(options, internal) {
		return [
			options.stroke ? 1 : 0,
			options.handle ? 1 : 0,
			internal ? 1 : 0
		].join('');
	},

	_getCachedBounds: function(matrix, options, noInternal) {
		matrix = matrix && matrix._orNullIfIdentity();
		var internal = options.internal && !noInternal,
			cacheItem = options.cacheItem,
			_matrix = internal ? null : this._matrix._orNullIfIdentity(),
			cacheKey = cacheItem && (!matrix || matrix.equals(_matrix))
				&& this._getBoundsCacheKey(options, internal),
			bounds = this._bounds;
		Item._updateBoundsCache(this._parent || this._symbol, cacheItem);
		if (cacheKey && bounds && cacheKey in bounds) {
			var cached = bounds[cacheKey];
			return {
				rect: cached.rect.clone(),
				nonscaling: cached.nonscaling
			};
		}
		var res = this._getBounds(matrix || _matrix, options),
			rect = res.rect || res,
			style = this._style,
			nonscaling = res.nonscaling || style.hasStroke()
				&& !style.getStrokeScaling();
		if (cacheKey) {
			if (!bounds) {
				this._bounds = bounds = {};
			}
			var cached = bounds[cacheKey] = {
				rect: rect.clone(),
				nonscaling: nonscaling,
				internal: internal
			};
		}
		return {
			rect: rect,
			nonscaling: nonscaling
		};
	},

	_getStrokeMatrix: function(matrix, options) {
		var parent = this.getStrokeScaling() ? null
				: options && options.internal ? this
					: this._parent || this._symbol && this._symbol._item,
			mx = parent ? parent.getViewMatrix().invert() : matrix;
		return mx && mx._shiftless();
	},

	statics: {
		_updateBoundsCache: function(parent, item) {
			if (parent && item) {
				var id = item._id,
					ref = parent._boundsCache = parent._boundsCache || {
						ids: {},
						list: []
					};
				if (!ref.ids[id]) {
					ref.list.push(item);
					ref.ids[id] = item;
				}
			}
		},

		_clearBoundsCache: function(item) {
			var cache = item._boundsCache;
			if (cache) {
				item._bounds = item._position = item._boundsCache = undefined;
				for (var i = 0, list = cache.list, l = list.length; i < l; i++){
					var other = list[i];
					if (other !== item) {
						other._bounds = other._position = undefined;
						if (other._boundsCache)
							Item._clearBoundsCache(other);
					}
				}
			}
		},

		_getBounds: function(items, matrix, options) {
			var x1 = Infinity,
				x2 = -x1,
				y1 = x1,
				y2 = x2,
				nonscaling = false;
			options = options || {};
			for (var i = 0, l = items.length; i < l; i++) {
				var item = items[i];
				if (item._visible && !item.isEmpty()) {
					var bounds = item._getCachedBounds(
						matrix && matrix.appended(item._matrix), options, true),
						rect = bounds.rect;
					x1 = Math.min(rect.x, x1);
					y1 = Math.min(rect.y, y1);
					x2 = Math.max(rect.x + rect.width, x2);
					y2 = Math.max(rect.y + rect.height, y2);
					if (bounds.nonscaling)
						nonscaling = true;
				}
			}
			return {
				rect: isFinite(x1)
					? new Rectangle(x1, y1, x2 - x1, y2 - y1)
					: new Rectangle(),
				nonscaling: nonscaling
			};
		}
	}

}), {
	beans: true,

	_decompose: function() {
		return this._applyMatrix
			? null
			: this._decomposed || (this._decomposed = this._matrix.decompose());
	},

	getRotation: function() {
		var decomposed = this._decompose();
		return decomposed ? decomposed.rotation : 0;
	},

	setRotation: function(rotation) {
		var current = this.getRotation();
		if (current != null && rotation != null) {
			var decomposed = this._decomposed;
			this.rotate(rotation - current);
			if (decomposed) {
				decomposed.rotation = rotation;
				this._decomposed = decomposed;
			}
		}
	},

	getScaling: function() {
		var decomposed = this._decompose(),
			s = decomposed && decomposed.scaling;
		return new LinkedPoint(s ? s.x : 1, s ? s.y : 1, this, 'setScaling');
	},

	setScaling: function() {
		var current = this.getScaling(),
			scaling = Point.read(arguments, 0, { clone: true, readNull: true });
		if (current && scaling && !current.equals(scaling)) {
			var rotation = this.getRotation(),
				decomposed = this._decomposed,
				matrix = new Matrix(),
				center = this.getPosition(true);
			matrix.translate(center);
			if (rotation)
				matrix.rotate(rotation);
			matrix.scale(scaling.x / current.x, scaling.y / current.y);
			if (rotation)
				matrix.rotate(-rotation);
			matrix.translate(center.negate());
			this.transform(matrix);
			if (decomposed) {
				decomposed.scaling = scaling;
				this._decomposed = decomposed;
			}
		}
	},

	getMatrix: function() {
		return this._matrix;
	},

	setMatrix: function() {
		var matrix = this._matrix;
		matrix.initialize.apply(matrix, arguments);
	},

	getGlobalMatrix: function(_dontClone) {
		var matrix = this._globalMatrix,
			updateVersion = this._project._updateVersion;
		if (matrix && matrix._updateVersion !== updateVersion)
			matrix = null;
		if (!matrix) {
			matrix = this._globalMatrix = this._matrix.clone();
			var parent = this._parent;
			if (parent)
				matrix.prepend(parent.getGlobalMatrix(true));
			matrix._updateVersion = updateVersion;
		}
		return _dontClone ? matrix : matrix.clone();
	},

	getViewMatrix: function() {
		return this.getGlobalMatrix().prepend(this.getView()._matrix);
	},

	getApplyMatrix: function() {
		return this._applyMatrix;
	},

	setApplyMatrix: function(apply) {
		if (this._applyMatrix = this._canApplyMatrix && !!apply)
			this.transform(null, true);
	},

	getTransformContent: '#getApplyMatrix',
	setTransformContent: '#setApplyMatrix',
}, {
	getProject: function() {
		return this._project;
	},

	_setProject: function(project, installEvents) {
		if (this._project !== project) {
			if (this._project)
				this._installEvents(false);
			this._project = project;
			var children = this._children;
			for (var i = 0, l = children && children.length; i < l; i++)
				children[i]._setProject(project);
			installEvents = true;
		}
		if (installEvents)
			this._installEvents(true);
	},

	getView: function() {
		return this._project._view;
	},

	_installEvents: function _installEvents(install) {
		_installEvents.base.call(this, install);
		var children = this._children;
		for (var i = 0, l = children && children.length; i < l; i++)
			children[i]._installEvents(install);
	},

	getLayer: function() {
		var parent = this;
		while (parent = parent._parent) {
			if (parent instanceof Layer)
				return parent;
		}
		return null;
	},

	getParent: function() {
		return this._parent;
	},

	setParent: function(item) {
		return item.addChild(this);
	},

	_getOwner: '#getParent',

	getChildren: function() {
		return this._children;
	},

	setChildren: function(items) {
		this.removeChildren();
		this.addChildren(items);
	},

	getFirstChild: function() {
		return this._children && this._children[0] || null;
	},

	getLastChild: function() {
		return this._children && this._children[this._children.length - 1]
				|| null;
	},

	getNextSibling: function() {
		var owner = this._getOwner();
		return owner && owner._children[this._index + 1] || null;
	},

	getPreviousSibling: function() {
		var owner = this._getOwner();
		return owner && owner._children[this._index - 1] || null;
	},

	getIndex: function() {
		return this._index;
	},

	equals: function(item) {
		return item === this || item && this._class === item._class
				&& this._style.equals(item._style)
				&& this._matrix.equals(item._matrix)
				&& this._locked === item._locked
				&& this._visible === item._visible
				&& this._blendMode === item._blendMode
				&& this._opacity === item._opacity
				&& this._clipMask === item._clipMask
				&& this._guide === item._guide
				&& this._equals(item)
				|| false;
	},

	_equals: function(item) {
		return Base.equals(this._children, item._children);
	},

	clone: function(options) {
		var copy = new this.constructor(Item.NO_INSERT),
			children = this._children,
			insert = Base.pick(options ? options.insert : undefined,
					options === undefined || options === true),
			deep = Base.pick(options ? options.deep : undefined, true);
		if (children)
			copy.copyAttributes(this);
		if (!children || deep)
			copy.copyContent(this);
		if (!children)
			copy.copyAttributes(this);
		if (insert)
			copy.insertAbove(this);
		var name = this._name,
			parent = this._parent;
		if (name && parent) {
			var children = parent._children,
				orig = name,
				i = 1;
			while (children[name])
				name = orig + ' ' + (i++);
			if (name !== orig)
				copy.setName(name);
		}
		return copy;
	},

	copyContent: function(source) {
		var children = source._children;
		for (var i = 0, l = children && children.length; i < l; i++) {
			this.addChild(children[i].clone(false), true);
		}
	},

	copyAttributes: function(source, excludeMatrix) {
		this.setStyle(source._style);
		var keys = ['_locked', '_visible', '_blendMode', '_opacity',
				'_clipMask', '_guide'];
		for (var i = 0, l = keys.length; i < l; i++) {
			var key = keys[i];
			if (source.hasOwnProperty(key))
				this[key] = source[key];
		}
		if (!excludeMatrix)
			this._matrix.set(source._matrix, true);
		this.setApplyMatrix(source._applyMatrix);
		this.setPivot(source._pivot);
		this.setSelection(source._selection);
		var data = source._data,
			name = source._name;
		this._data = data ? Base.clone(data) : null;
		if (name)
			this.setName(name);
	},

	rasterize: function(resolution, insert) {
		var bounds = this.getStrokeBounds(),
			scale = (resolution || this.getView().getResolution()) / 72,
			topLeft = bounds.getTopLeft().floor(),
			bottomRight = bounds.getBottomRight().ceil(),
			size = new Size(bottomRight.subtract(topLeft)),
			raster = new Raster(Item.NO_INSERT);
		if (!size.isZero()) {
			var canvas = CanvasProvider.getCanvas(size.multiply(scale)),
				ctx = canvas.getContext('2d'),
				matrix = new Matrix().scale(scale).translate(topLeft.negate());
			ctx.save();
			matrix.applyToContext(ctx);
			this.draw(ctx, new Base({ matrices: [matrix] }));
			ctx.restore();
			raster.setCanvas(canvas);
		}
		raster.transform(new Matrix().translate(topLeft.add(size.divide(2)))
				.scale(1 / scale));
		if (insert === undefined || insert)
			raster.insertAbove(this);
		return raster;
	},

	contains: function() {
		return !!this._contains(
				this._matrix._inverseTransform(Point.read(arguments)));
	},

	_contains: function(point) {
		var children = this._children;
		if (children) {
			for (var i = children.length - 1; i >= 0; i--) {
				if (children[i].contains(point))
					return true;
			}
			return false;
		}
		return point.isInside(this.getInternalBounds());
	},

	isInside: function() {
		return Rectangle.read(arguments).contains(this.getBounds());
	},

	_asPathItem: function() {
		return new Path.Rectangle({
			rectangle: this.getInternalBounds(),
			matrix: this._matrix,
			insert: false,
		});
	},

	intersects: function(item, _matrix) {
		if (!(item instanceof Item))
			return false;
		return this._asPathItem().getIntersections(item._asPathItem(), null,
				_matrix, true).length > 0;
	}
},
new function() {
	function hitTest() {
		return this._hitTest(
				Point.read(arguments),
				HitResult.getOptions(arguments));
	}

	function hitTestAll() {
		var point = Point.read(arguments),
			options = HitResult.getOptions(arguments),
			all = [];
		this._hitTest(point, Base.set({ all: all }, options));
		return all;
	}

	function hitTestChildren(point, options, viewMatrix, _exclude) {
		var children = this._children;
		if (children) {
			for (var i = children.length - 1; i >= 0; i--) {
				var child = children[i];
				var res = child !== _exclude && child._hitTest(point, options,
						viewMatrix);
				if (res && !options.all)
					return res;
			}
		}
		return null;
	}

	Project.inject({
		hitTest: hitTest,
		hitTestAll: hitTestAll,
		_hitTest: hitTestChildren
	});

	return {
		hitTest: hitTest,
		hitTestAll: hitTestAll,
		_hitTestChildren: hitTestChildren,
	};
}, {

	_hitTest: function(point, options, parentViewMatrix) {
		if (this._locked || !this._visible || this._guide && !options.guides
				|| this.isEmpty()) {
			return null;
		}

		var matrix = this._matrix,
			viewMatrix = parentViewMatrix
					? parentViewMatrix.appended(matrix)
					: this.getGlobalMatrix().prepend(this.getView()._matrix),
			tolerance = Math.max(options.tolerance, 1e-12),
			tolerancePadding = options._tolerancePadding = new Size(
					Path._getStrokePadding(tolerance,
						matrix._shiftless().invert()));
		point = matrix._inverseTransform(point);
		if (!point || !this._children &&
			!this.getBounds({ internal: true, stroke: true, handle: true })
				.expand(tolerancePadding.multiply(2))._containsPoint(point)) {
			return null;
		}

		var checkSelf = !(options.guides && !this._guide
				|| options.selected && !this.isSelected()
				|| options.type && options.type !== Base.hyphenate(this._class)
				|| options.class && !(this instanceof options.class)),
			match = options.match,
			that = this,
			bounds,
			res;

		function filter(hit) {
			if (hit && match && !match(hit))
				hit = null;
			if (hit && options.all)
				options.all.push(hit);
			return hit;
		}

		function checkPoint(type, part) {
			var pt = part ? bounds['get' + part]() : that.getPosition();
			if (point.subtract(pt).divide(tolerancePadding).length <= 1) {
				return new HitResult(type, that, {
					name: part ? Base.hyphenate(part) : type,
					point: pt
				});
			}
		}

		var checkPosition = options.position,
			checkCenter = options.center,
			checkBounds = options.bounds;
		if (checkSelf && this._parent
				&& (checkPosition || checkCenter || checkBounds)) {
			if (checkCenter || checkBounds) {
				bounds = this.getInternalBounds();
			}
			res = checkPosition && checkPoint('position') ||
					checkCenter && checkPoint('center', 'Center');
			if (!res && checkBounds) {
				var points = [
					'TopLeft', 'TopRight', 'BottomLeft', 'BottomRight',
					'LeftCenter', 'TopCenter', 'RightCenter', 'BottomCenter'
				];
				for (var i = 0; i < 8 && !res; i++) {
					res = checkPoint('bounds', points[i]);
				}
			}
			res = filter(res);
		}

		if (!res) {
			res = this._hitTestChildren(point, options, viewMatrix)
				|| checkSelf
					&& filter(this._hitTestSelf(point, options, viewMatrix,
						this.getStrokeScaling() ? null
							: viewMatrix._shiftless().invert()))
				|| null;
		}
		if (res && res.point) {
			res.point = matrix.transform(res.point);
		}
		return res;
	},

	_hitTestSelf: function(point, options) {
		if (options.fill && this.hasFill() && this._contains(point))
			return new HitResult('fill', this);
	},

	matches: function(name, compare) {
		function matchObject(obj1, obj2) {
			for (var i in obj1) {
				if (obj1.hasOwnProperty(i)) {
					var val1 = obj1[i],
						val2 = obj2[i];
					if (Base.isPlainObject(val1) && Base.isPlainObject(val2)) {
						if (!matchObject(val1, val2))
							return false;
					} else if (!Base.equals(val1, val2)) {
						return false;
					}
				}
			}
			return true;
		}
		var type = typeof name;
		if (type === 'object') {
			for (var key in name) {
				if (name.hasOwnProperty(key) && !this.matches(key, name[key]))
					return false;
			}
			return true;
		} else if (type === 'function') {
			return name(this);
		} else if (name === 'match') {
			return compare(this);
		} else {
			var value = /^(empty|editable)$/.test(name)
					? this['is' + Base.capitalize(name)]()
					: name === 'type'
						? Base.hyphenate(this._class)
						: this[name];
			if (name === 'class') {
				if (typeof compare === 'function')
					return this instanceof compare;
				value = this._class;
			}
			if (typeof compare === 'function') {
				return !!compare(value);
			} else if (compare) {
				if (compare.test) {
					return compare.test(value);
				} else if (Base.isPlainObject(compare)) {
					return matchObject(compare, value);
				}
			}
			return Base.equals(value, compare);
		}
	},

	getItems: function(options) {
		return Item._getItems(this, options, this._matrix);
	},

	getItem: function(options) {
		return Item._getItems(this, options, this._matrix, null, true)[0]
				|| null;
	},

	statics: {
		_getItems: function _getItems(item, options, matrix, param, firstOnly) {
			if (!param) {
				var obj = typeof options === 'object' && options,
					overlapping = obj && obj.overlapping,
					inside = obj && obj.inside,
					bounds = overlapping || inside,
					rect = bounds && Rectangle.read([bounds]);
				param = {
					items: [],
					recursive: obj && obj.recursive !== false,
					inside: !!inside,
					overlapping: !!overlapping,
					rect: rect,
					path: overlapping && new Path.Rectangle({
						rectangle: rect,
						insert: false
					})
				};
				if (obj) {
					options = Base.filter({}, options, {
						recursive: true, inside: true, overlapping: true
					});
				}
			}
			var children = item._children,
				items = param.items,
				rect = param.rect;
			matrix = rect && (matrix || new Matrix());
			for (var i = 0, l = children && children.length; i < l; i++) {
				var child = children[i],
					childMatrix = matrix && matrix.appended(child._matrix),
					add = true;
				if (rect) {
					var bounds = child.getBounds(childMatrix);
					if (!rect.intersects(bounds))
						continue;
					if (!(rect.contains(bounds)
							|| param.overlapping && (bounds.contains(rect)
								|| param.path.intersects(child, childMatrix))))
						add = false;
				}
				if (add && child.matches(options)) {
					items.push(child);
					if (firstOnly)
						break;
				}
				if (param.recursive !== false) {
					_getItems(child, options, childMatrix, param, firstOnly);
				}
				if (firstOnly && items.length > 0)
					break;
			}
			return items;
		}
	}
}, {

	importJSON: function(json) {
		var res = Base.importJSON(json, this);
		return res !== this ? this.addChild(res) : res;
	},

	addChild: function(item) {
		return this.insertChild(undefined, item);
	},

	insertChild: function(index, item) {
		var res = item ? this.insertChildren(index, [item]) : null;
		return res && res[0];
	},

	addChildren: function(items) {
		return this.insertChildren(this._children.length, items);
	},

	insertChildren: function(index, items) {
		var children = this._children;
		if (children && items && items.length > 0) {
			items = Base.slice(items);
			var inserted = {};
			for (var i = items.length - 1; i >= 0; i--) {
				var item = items[i],
					id = item && item._id;
				if (!item || inserted[id]) {
					items.splice(i, 1);
				} else {
					item._remove(false, true);
					inserted[id] = true;
				}
			}
			Base.splice(children, items, index, 0);
			var project = this._project,
				notifySelf = project._changes;
			for (var i = 0, l = items.length; i < l; i++) {
				var item = items[i],
					name = item._name;
				item._parent = this;
				item._setProject(project, true);
				if (name)
					item.setName(name);
				if (notifySelf)
					item._changed(5);
			}
			this._changed(11);
		} else {
			items = null;
		}
		return items;
	},

	_insertItem: '#insertChild',

	_insertAt: function(item, offset) {
		var owner = item && item._getOwner(),
			res = item !== this && owner ? this : null;
		if (res) {
			res._remove(false, true);
			owner._insertItem(item._index + offset, res);
		}
		return res;
	},

	insertAbove: function(item) {
		return this._insertAt(item, 1);
	},

	insertBelow: function(item) {
		return this._insertAt(item, 0);
	},

	sendToBack: function() {
		var owner = this._getOwner();
		return owner ? owner._insertItem(0, this) : null;
	},

	bringToFront: function() {
		var owner = this._getOwner();
		return owner ? owner._insertItem(undefined, this) : null;
	},

	appendTop: '#addChild',

	appendBottom: function(item) {
		return this.insertChild(0, item);
	},

	moveAbove: '#insertAbove',

	moveBelow: '#insertBelow',

	addTo: function(owner) {
		return owner._insertItem(undefined, this);
	},

	copyTo: function(owner) {
		return this.clone(false).addTo(owner);
	},

	reduce: function(options) {
		var children = this._children;
		if (children && children.length === 1) {
			var child = children[0].reduce(options);
			if (this._parent) {
				child.insertAbove(this);
				this.remove();
			} else {
				child.remove();
			}
			return child;
		}
		return this;
	},

	_removeNamed: function() {
		var owner = this._getOwner();
		if (owner) {
			var children = owner._children,
				namedChildren = owner._namedChildren,
				name = this._name,
				namedArray = namedChildren[name],
				index = namedArray ? namedArray.indexOf(this) : -1;
			if (index !== -1) {
				if (children[name] == this)
					delete children[name];
				namedArray.splice(index, 1);
				if (namedArray.length) {
					children[name] = namedArray[0];
				} else {
					delete namedChildren[name];
				}
			}
		}
	},

	_remove: function(notifySelf, notifyParent) {
		var owner = this._getOwner(),
			project = this._project,
			index = this._index;
		if (owner) {
			if (this._name)
				this._removeNamed();
			if (index != null) {
				if (project._activeLayer === this)
					project._activeLayer = this.getNextSibling()
							|| this.getPreviousSibling();
				Base.splice(owner._children, null, index, 1);
			}
			this._installEvents(false);
			if (notifySelf && project._changes)
				this._changed(5);
			if (notifyParent)
				owner._changed(11, this);
			this._parent = null;
			return true;
		}
		return false;
	},

	remove: function() {
		return this._remove(true, true);
	},

	replaceWith: function(item) {
		var ok = item && item.insertBelow(this);
		if (ok)
			this.remove();
		return ok;
	},

	removeChildren: function(start, end) {
		if (!this._children)
			return null;
		start = start || 0;
		end = Base.pick(end, this._children.length);
		var removed = Base.splice(this._children, null, start, end - start);
		for (var i = removed.length - 1; i >= 0; i--) {
			removed[i]._remove(true, false);
		}
		if (removed.length > 0)
			this._changed(11);
		return removed;
	},

	clear: '#removeChildren',

	reverseChildren: function() {
		if (this._children) {
			this._children.reverse();
			for (var i = 0, l = this._children.length; i < l; i++)
				this._children[i]._index = i;
			this._changed(11);
		}
	},

	isEmpty: function() {
		var children = this._children;
		return !children || !children.length;
	},

	isEditable: function() {
		var item = this;
		while (item) {
			if (!item._visible || item._locked)
				return false;
			item = item._parent;
		}
		return true;
	},

	hasFill: function() {
		return this.getStyle().hasFill();
	},

	hasStroke: function() {
		return this.getStyle().hasStroke();
	},

	hasShadow: function() {
		return this.getStyle().hasShadow();
	},

	_getOrder: function(item) {
		function getList(item) {
			var list = [];
			do {
				list.unshift(item);
			} while (item = item._parent);
			return list;
		}
		var list1 = getList(this),
			list2 = getList(item);
		for (var i = 0, l = Math.min(list1.length, list2.length); i < l; i++) {
			if (list1[i] != list2[i]) {
				return list1[i]._index < list2[i]._index ? 1 : -1;
			}
		}
		return 0;
	},

	hasChildren: function() {
		return this._children && this._children.length > 0;
	},

	isInserted: function() {
		return this._parent ? this._parent.isInserted() : false;
	},

	isAbove: function(item) {
		return this._getOrder(item) === -1;
	},

	isBelow: function(item) {
		return this._getOrder(item) === 1;
	},

	isParent: function(item) {
		return this._parent === item;
	},

	isChild: function(item) {
		return item && item._parent === this;
	},

	isDescendant: function(item) {
		var parent = this;
		while (parent = parent._parent) {
			if (parent === item)
				return true;
		}
		return false;
	},

	isAncestor: function(item) {
		return item ? item.isDescendant(this) : false;
	},

	isSibling: function(item) {
		return this._parent === item._parent;
	},

	isGroupedWith: function(item) {
		var parent = this._parent;
		while (parent) {
			if (parent._parent
				&& /^(Group|Layer|CompoundPath)$/.test(parent._class)
				&& item.isDescendant(parent))
					return true;
			parent = parent._parent;
		}
		return false;
	},

}, Base.each(['rotate', 'scale', 'shear', 'skew'], function(key) {
	var rotate = key === 'rotate';
	this[key] = function() {
		var value = (rotate ? Base : Point).read(arguments),
			center = Point.read(arguments, 0, { readNull: true });
		return this.transform(new Matrix()[key](value,
				center || this.getPosition(true)));
	};
}, {
	translate: function() {
		var mx = new Matrix();
		return this.transform(mx.translate.apply(mx, arguments));
	},

	transform: function(matrix, _applyMatrix, _applyRecursively,
			_setApplyMatrix) {
		var _matrix = this._matrix,
			transform = matrix && !matrix.isIdentity(),
			applyMatrix = (_applyMatrix || this._applyMatrix)
					&& ((!_matrix.isIdentity() || transform)
						|| _applyMatrix && _applyRecursively && this._children);
		if (!transform && !applyMatrix)
			return this;
		if (transform) {
			if (!matrix.isInvertible() && _matrix.isInvertible())
				_matrix._backup = _matrix.getValues();
			_matrix.prepend(matrix, true);
			var style = this._style,
				fillColor = style.getFillColor(true),
				strokeColor = style.getStrokeColor(true);
			if (fillColor)
				fillColor.transform(matrix);
			if (strokeColor)
				strokeColor.transform(matrix);
		}
		if (applyMatrix && (applyMatrix = this._transformContent(_matrix,
				_applyRecursively, _setApplyMatrix))) {
			var pivot = this._pivot;
			if (pivot)
				_matrix._transformPoint(pivot, pivot, true);
			_matrix.reset(true);
			if (_setApplyMatrix && this._canApplyMatrix)
				this._applyMatrix = true;
		}
		var bounds = this._bounds,
			position = this._position;
		if (transform || applyMatrix) {
			this._changed(9);
		}
		var decomp = transform && bounds && matrix.decompose();
		if (decomp && decomp.skewing.isZero() && decomp.rotation % 90 === 0) {
			for (var key in bounds) {
				var cache = bounds[key];
				if (cache.nonscaling) {
					delete bounds[key];
				} else if (applyMatrix || !cache.internal) {
					var rect = cache.rect;
					matrix._transformBounds(rect, rect);
				}
			}
			this._bounds = bounds;
			var cached = bounds[this._getBoundsCacheKey(
					this._boundsOptions || {})];
			if (cached) {
				this._position = cached.rect.getCenter(true);
			}
		} else if (transform && position && this._pivot) {
			this._position = matrix._transformPoint(position, position);
		}
		return this;
	},

	_transformContent: function(matrix, applyRecursively, setApplyMatrix) {
		var children = this._children;
		if (children) {
			for (var i = 0, l = children.length; i < l; i++)
				children[i].transform(matrix, true, applyRecursively,
						setApplyMatrix);
			return true;
		}
	},

	globalToLocal: function() {
		return this.getGlobalMatrix(true)._inverseTransform(
				Point.read(arguments));
	},

	localToGlobal: function() {
		return this.getGlobalMatrix(true)._transformPoint(
				Point.read(arguments));
	},

	parentToLocal: function() {
		return this._matrix._inverseTransform(Point.read(arguments));
	},

	localToParent: function() {
		return this._matrix._transformPoint(Point.read(arguments));
	},

	fitBounds: function(rectangle, fill) {
		rectangle = Rectangle.read(arguments);
		var bounds = this.getBounds(),
			itemRatio = bounds.height / bounds.width,
			rectRatio = rectangle.height / rectangle.width,
			scale = (fill ? itemRatio > rectRatio : itemRatio < rectRatio)
					? rectangle.width / bounds.width
					: rectangle.height / bounds.height,
			newBounds = new Rectangle(new Point(),
					new Size(bounds.width * scale, bounds.height * scale));
		newBounds.setCenter(rectangle.getCenter());
		this.setBounds(newBounds);
	}
}), {

	_setStyles: function(ctx, param, viewMatrix) {
		var style = this._style,
			matrix = this._matrix;
		if (style.hasFill()) {
			ctx.fillStyle = style.getFillColor().toCanvasStyle(ctx, matrix);
		}
		if (style.hasStroke()) {
			ctx.strokeStyle = style.getStrokeColor().toCanvasStyle(ctx, matrix);
			ctx.lineWidth = style.getStrokeWidth();
			var strokeJoin = style.getStrokeJoin(),
				strokeCap = style.getStrokeCap(),
				miterLimit = style.getMiterLimit();
			if (strokeJoin)
				ctx.lineJoin = strokeJoin;
			if (strokeCap)
				ctx.lineCap = strokeCap;
			if (miterLimit)
				ctx.miterLimit = miterLimit;
			if (paper.support.nativeDash) {
				var dashArray = style.getDashArray(),
					dashOffset = style.getDashOffset();
				if (dashArray && dashArray.length) {
					if ('setLineDash' in ctx) {
						ctx.setLineDash(dashArray);
						ctx.lineDashOffset = dashOffset;
					} else {
						ctx.mozDash = dashArray;
						ctx.mozDashOffset = dashOffset;
					}
				}
			}
		}
		if (style.hasShadow()) {
			var pixelRatio = param.pixelRatio || 1,
				mx = viewMatrix._shiftless().prepend(
					new Matrix().scale(pixelRatio, pixelRatio)),
				blur = mx.transform(new Point(style.getShadowBlur(), 0)),
				offset = mx.transform(this.getShadowOffset());
			ctx.shadowColor = style.getShadowColor().toCanvasStyle(ctx);
			ctx.shadowBlur = blur.getLength();
			ctx.shadowOffsetX = offset.x;
			ctx.shadowOffsetY = offset.y;
		}
	},

	draw: function(ctx, param, parentStrokeMatrix) {
		var updateVersion = this._updateVersion = this._project._updateVersion;
		if (!this._visible || this._opacity === 0)
			return;
		var matrices = param.matrices,
			viewMatrix = param.viewMatrix,
			matrix = this._matrix,
			globalMatrix = matrices[matrices.length - 1].appended(matrix);
		if (!globalMatrix.isInvertible())
			return;

		viewMatrix = viewMatrix ? viewMatrix.appended(globalMatrix)
				: globalMatrix;

		matrices.push(globalMatrix);
		if (param.updateMatrix) {
			globalMatrix._updateVersion = updateVersion;
			this._globalMatrix = globalMatrix;
		}

		var blendMode = this._blendMode,
			opacity = this._opacity,
			normalBlend = blendMode === 'normal',
			nativeBlend = BlendMode.nativeModes[blendMode],
			direct = normalBlend && opacity === 1
					|| param.dontStart
					|| param.clip
					|| (nativeBlend || normalBlend && opacity < 1)
						&& this._canComposite(),
			pixelRatio = param.pixelRatio || 1,
			mainCtx, itemOffset, prevOffset;
		if (!direct) {
			var bounds = this.getStrokeBounds(viewMatrix);
			if (!bounds.width || !bounds.height)
				return;
			prevOffset = param.offset;
			itemOffset = param.offset = bounds.getTopLeft().floor();
			mainCtx = ctx;
			ctx = CanvasProvider.getContext(bounds.getSize().ceil().add(1)
					.multiply(pixelRatio));
			if (pixelRatio !== 1)
				ctx.scale(pixelRatio, pixelRatio);
		}
		ctx.save();
		var strokeMatrix = parentStrokeMatrix
				? parentStrokeMatrix.appended(matrix)
				: this._canScaleStroke && !this.getStrokeScaling(true)
					&& viewMatrix,
			clip = !direct && param.clipItem,
			transform = !strokeMatrix || clip;
		if (direct) {
			ctx.globalAlpha = opacity;
			if (nativeBlend)
				ctx.globalCompositeOperation = blendMode;
		} else if (transform) {
			ctx.translate(-itemOffset.x, -itemOffset.y);
		}
		if (transform) {
			(direct ? matrix : viewMatrix).applyToContext(ctx);
		}
		if (clip) {
			param.clipItem.draw(ctx, param.extend({ clip: true }));
		}
		if (strokeMatrix) {
			ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
			var offset = param.offset;
			if (offset)
				ctx.translate(-offset.x, -offset.y);
		}
		this._draw(ctx, param, viewMatrix, strokeMatrix);
		ctx.restore();
		matrices.pop();
		if (param.clip && !param.dontFinish)
			ctx.clip();
		if (!direct) {
			BlendMode.process(blendMode, ctx, mainCtx, opacity,
					itemOffset.subtract(prevOffset).multiply(pixelRatio));
			CanvasProvider.release(ctx);
			param.offset = prevOffset;
		}
	},

	_isUpdated: function(updateVersion) {
		var parent = this._parent;
		if (parent instanceof CompoundPath)
			return parent._isUpdated(updateVersion);
		var updated = this._updateVersion === updateVersion;
		if (!updated && parent && parent._visible
				&& parent._isUpdated(updateVersion)) {
			this._updateVersion = updateVersion;
			updated = true;
		}
		return updated;
	},

	_drawSelection: function(ctx, matrix, size, selectionItems, updateVersion) {
		var selection = this._selection,
			itemSelected = selection & 1,
			boundsSelected = selection & 2
					|| itemSelected && this._selectBounds,
			positionSelected = selection & 4;
		if (!this._drawSelected)
			itemSelected = false;
		if ((itemSelected || boundsSelected || positionSelected)
				&& this._isUpdated(updateVersion)) {
			var layer,
				color = this.getSelectedColor(true) || (layer = this.getLayer())
					&& layer.getSelectedColor(true),
				mx = matrix.appended(this.getGlobalMatrix(true)),
				half = size / 2;
			ctx.strokeStyle = ctx.fillStyle = color
					? color.toCanvasStyle(ctx) : '#009dec';
			if (itemSelected)
				this._drawSelected(ctx, mx, selectionItems);
			if (positionSelected) {
				var point = this.getPosition(true),
					x = point.x,
					y = point.y;
				ctx.beginPath();
				ctx.arc(x, y, half, 0, Math.PI * 2, true);
				ctx.stroke();
				var deltas = [[0, -1], [1, 0], [0, 1], [-1, 0]],
					start = half,
					end = size + 1;
				for (var i = 0; i < 4; i++) {
					var delta = deltas[i],
						dx = delta[0],
						dy = delta[1];
					ctx.moveTo(x + dx * start, y + dy * start);
					ctx.lineTo(x + dx * end, y + dy * end);
					ctx.stroke();
				}
			}
			if (boundsSelected) {
				var coords = mx._transformCorners(this.getInternalBounds());
				ctx.beginPath();
				for (var i = 0; i < 8; i++) {
					ctx[!i ? 'moveTo' : 'lineTo'](coords[i], coords[++i]);
				}
				ctx.closePath();
				ctx.stroke();
				for (var i = 0; i < 8; i++) {
					ctx.fillRect(coords[i] - half, coords[++i] - half,
							size, size);
				}
			}
		}
	},

	_canComposite: function() {
		return false;
	}
}, Base.each(['down', 'drag', 'up', 'move'], function(key) {
	this['removeOn' + Base.capitalize(key)] = function() {
		var hash = {};
		hash[key] = true;
		return this.removeOn(hash);
	};
}, {

	removeOn: function(obj) {
		for (var name in obj) {
			if (obj[name]) {
				var key = 'mouse' + name,
					project = this._project,
					sets = project._removeSets = project._removeSets || {};
				sets[key] = sets[key] || {};
				sets[key][this._id] = this;
			}
		}
		return this;
	}
}));

var Group = Item.extend({
	_class: 'Group',
	_selectBounds: false,
	_selectChildren: true,
	_serializeFields: {
		children: []
	},

	initialize: function Group(arg) {
		this._children = [];
		this._namedChildren = {};
		if (!this._initialize(arg))
			this.addChildren(Array.isArray(arg) ? arg : arguments);
	},

	_changed: function _changed(flags) {
		_changed.base.call(this, flags);
		if (flags & 1026) {
			this._clipItem = undefined;
		}
	},

	_getClipItem: function() {
		var clipItem = this._clipItem;
		if (clipItem === undefined) {
			clipItem = null;
			var children = this._children;
			for (var i = 0, l = children.length; i < l; i++) {
				if (children[i]._clipMask) {
					clipItem = children[i];
					break;
				}
			}
			this._clipItem = clipItem;
		}
		return clipItem;
	},

	isClipped: function() {
		return !!this._getClipItem();
	},

	setClipped: function(clipped) {
		var child = this.getFirstChild();
		if (child)
			child.setClipMask(clipped);
	},

	_getBounds: function _getBounds(matrix, options) {
		var clipItem = this._getClipItem();
		return clipItem
			? clipItem._getCachedBounds(
				matrix && matrix.appended(clipItem._matrix),
				Base.set({}, options, { stroke: false }))
			: _getBounds.base.call(this, matrix, options);
	},

	_hitTestChildren: function _hitTestChildren(point, options, viewMatrix) {
		var clipItem = this._getClipItem();
		return (!clipItem || clipItem.contains(point))
				&& _hitTestChildren.base.call(this, point, options, viewMatrix,
					clipItem);
	},

	_draw: function(ctx, param) {
		var clip = param.clip,
			clipItem = !clip && this._getClipItem();
		param = param.extend({ clipItem: clipItem, clip: false });
		if (clip) {
			ctx.beginPath();
			param.dontStart = param.dontFinish = true;
		} else if (clipItem) {
			clipItem.draw(ctx, param.extend({ clip: true }));
		}
		var children = this._children;
		for (var i = 0, l = children.length; i < l; i++) {
			var item = children[i];
			if (item !== clipItem)
				item.draw(ctx, param);
		}
	}
});

var Layer = Group.extend({
	_class: 'Layer',

	initialize: function Layer() {
		Group.apply(this, arguments);
	},

	_getOwner: function() {
		return this._parent || this._index != null && this._project;
	},

	isInserted: function isInserted() {
		return this._parent ? isInserted.base.call(this) : this._index != null;
	},

	activate: function() {
		this._project._activeLayer = this;
	},

	_hitTestSelf: function() {
	}
});

var Shape = Item.extend({
	_class: 'Shape',
	_applyMatrix: false,
	_canApplyMatrix: false,
	_canScaleStroke: true,
	_serializeFields: {
		type: null,
		size: null,
		radius: null
	},

	initialize: function Shape(props, point) {
		this._initialize(props, point);
	},

	_equals: function(item) {
		return this._type === item._type
			&& this._size.equals(item._size)
			&& Base.equals(this._radius, item._radius);
	},

	copyContent: function(source) {
		this.setType(source._type);
		this.setSize(source._size);
		this.setRadius(source._radius);
	},

	getType: function() {
		return this._type;
	},

	setType: function(type) {
		this._type = type;
	},

	getShape: '#getType',
	setShape: '#setType',

	getSize: function() {
		var size = this._size;
		return new LinkedSize(size.width, size.height, this, 'setSize');
	},

	setSize: function() {
		var size = Size.read(arguments);
		if (!this._size) {
			this._size = size.clone();
		} else if (!this._size.equals(size)) {
			var type = this._type,
				width = size.width,
				height = size.height;
			if (type === 'rectangle') {
				this._radius.set(Size.min(this._radius, size.divide(2)));
			} else if (type === 'circle') {
				width = height = (width + height) / 2;
				this._radius = width / 2;
			} else if (type === 'ellipse') {
				this._radius._set(width / 2, height / 2);
			}
			this._size._set(width, height);
			this._changed(9);
		}
	},

	getRadius: function() {
		var rad = this._radius;
		return this._type === 'circle'
				? rad
				: new LinkedSize(rad.width, rad.height, this, 'setRadius');
	},

	setRadius: function(radius) {
		var type = this._type;
		if (type === 'circle') {
			if (radius === this._radius)
				return;
			var size = radius * 2;
			this._radius = radius;
			this._size._set(size, size);
		} else {
			radius = Size.read(arguments);
			if (!this._radius) {
				this._radius = radius.clone();
			} else {
				if (this._radius.equals(radius))
					return;
				this._radius.set(radius);
				if (type === 'rectangle') {
					var size = Size.max(this._size, radius.multiply(2));
					this._size.set(size);
				} else if (type === 'ellipse') {
					this._size._set(radius.width * 2, radius.height * 2);
				}
			}
		}
		this._changed(9);
	},

	isEmpty: function() {
		return false;
	},

	toPath: function(insert) {
		var path = new Path[Base.capitalize(this._type)]({
			center: new Point(),
			size: this._size,
			radius: this._radius,
			insert: false
		});
		path.copyAttributes(this);
		if (paper.settings.applyMatrix)
			path.setApplyMatrix(true);
		if (insert === undefined || insert)
			path.insertAbove(this);
		return path;
	},

	toShape: '#clone',

	_asPathItem: function() {
		return this.toPath(false);
	},

	_draw: function(ctx, param, viewMatrix, strokeMatrix) {
		var style = this._style,
			hasFill = style.hasFill(),
			hasStroke = style.hasStroke(),
			dontPaint = param.dontFinish || param.clip,
			untransformed = !strokeMatrix;
		if (hasFill || hasStroke || dontPaint) {
			var type = this._type,
				radius = this._radius,
				isCircle = type === 'circle';
			if (!param.dontStart)
				ctx.beginPath();
			if (untransformed && isCircle) {
				ctx.arc(0, 0, radius, 0, Math.PI * 2, true);
			} else {
				var rx = isCircle ? radius : radius.width,
					ry = isCircle ? radius : radius.height,
					size = this._size,
					width = size.width,
					height = size.height;
				if (untransformed && type === 'rectangle' && rx === 0 && ry === 0) {
					ctx.rect(-width / 2, -height / 2, width, height);
				} else {
					var x = width / 2,
						y = height / 2,
						kappa = 1 - 0.5522847498307936,
						cx = rx * kappa,
						cy = ry * kappa,
						c = [
							-x, -y + ry,
							-x, -y + cy,
							-x + cx, -y,
							-x + rx, -y,
							x - rx, -y,
							x - cx, -y,
							x, -y + cy,
							x, -y + ry,
							x, y - ry,
							x, y - cy,
							x - cx, y,
							x - rx, y,
							-x + rx, y,
							-x + cx, y,
							-x, y - cy,
							-x, y - ry
						];
					if (strokeMatrix)
						strokeMatrix.transform(c, c, 32);
					ctx.moveTo(c[0], c[1]);
					ctx.bezierCurveTo(c[2], c[3], c[4], c[5], c[6], c[7]);
					if (x !== rx)
						ctx.lineTo(c[8], c[9]);
					ctx.bezierCurveTo(c[10], c[11], c[12], c[13], c[14], c[15]);
					if (y !== ry)
						ctx.lineTo(c[16], c[17]);
					ctx.bezierCurveTo(c[18], c[19], c[20], c[21], c[22], c[23]);
					if (x !== rx)
						ctx.lineTo(c[24], c[25]);
					ctx.bezierCurveTo(c[26], c[27], c[28], c[29], c[30], c[31]);
				}
			}
			ctx.closePath();
		}
		if (!dontPaint && (hasFill || hasStroke)) {
			this._setStyles(ctx, param, viewMatrix);
			if (hasFill) {
				ctx.fill(style.getFillRule());
				ctx.shadowColor = 'rgba(0,0,0,0)';
			}
			if (hasStroke)
				ctx.stroke();
		}
	},

	_canComposite: function() {
		return !(this.hasFill() && this.hasStroke());
	},

	_getBounds: function(matrix, options) {
		var rect = new Rectangle(this._size).setCenter(0, 0),
			style = this._style,
			strokeWidth = options.stroke && style.hasStroke()
					&& style.getStrokeWidth();
		if (matrix)
			rect = matrix._transformBounds(rect);
		return strokeWidth
				? rect.expand(Path._getStrokePadding(strokeWidth,
					this._getStrokeMatrix(matrix, options)))
				: rect;
	}
},
new function() {
	function getCornerCenter(that, point, expand) {
		var radius = that._radius;
		if (!radius.isZero()) {
			var halfSize = that._size.divide(2);
			for (var q = 1; q <= 4; q++) {
				var dir = new Point(q > 1 && q < 4 ? -1 : 1, q > 2 ? -1 : 1),
					corner = dir.multiply(halfSize),
					center = corner.subtract(dir.multiply(radius)),
					rect = new Rectangle(
							expand ? corner.add(dir.multiply(expand)) : corner,
							center);
				if (rect.contains(point))
					return { point: center, quadrant: q };
			}
		}
	}

	function isOnEllipseStroke(point, radius, padding, quadrant) {
		var vector = point.divide(radius);
		return (!quadrant || vector.isInQuadrant(quadrant)) &&
				vector.subtract(vector.normalize()).multiply(radius)
					.divide(padding).length <= 1;
	}

	return {
		_contains: function _contains(point) {
			if (this._type === 'rectangle') {
				var center = getCornerCenter(this, point);
				return center
						? point.subtract(center.point).divide(this._radius)
							.getLength() <= 1
						: _contains.base.call(this, point);
			} else {
				return point.divide(this.size).getLength() <= 0.5;
			}
		},

		_hitTestSelf: function _hitTestSelf(point, options, viewMatrix,
				strokeMatrix) {
			var hit = false,
				style = this._style,
				hitStroke = options.stroke && style.hasStroke(),
				hitFill = options.fill && style.hasFill();
			if (hitStroke || hitFill) {
				var type = this._type,
					radius = this._radius,
					strokeRadius = hitStroke ? style.getStrokeWidth() / 2 : 0,
					strokePadding = options._tolerancePadding.add(
						Path._getStrokePadding(strokeRadius,
							!style.getStrokeScaling() && strokeMatrix));
				if (type === 'rectangle') {
					var padding = strokePadding.multiply(2),
						center = getCornerCenter(this, point, padding);
					if (center) {
						hit = isOnEllipseStroke(point.subtract(center.point),
								radius, strokePadding, center.quadrant);
					} else {
						var rect = new Rectangle(this._size).setCenter(0, 0),
							outer = rect.expand(padding),
							inner = rect.expand(padding.negate());
						hit = outer._containsPoint(point)
								&& !inner._containsPoint(point);
					}
				} else {
					hit = isOnEllipseStroke(point, radius, strokePadding);
				}
			}
			return hit ? new HitResult(hitStroke ? 'stroke' : 'fill', this)
					: _hitTestSelf.base.apply(this, arguments);
		}
	};
}, {

statics: new function() {
	function createShape(type, point, size, radius, args) {
		var item = new Shape(Base.getNamed(args), point);
		item._type = type;
		item._size = size;
		item._radius = radius;
		return item;
	}

	return {
		Circle: function() {
			var center = Point.readNamed(arguments, 'center'),
				radius = Base.readNamed(arguments, 'radius');
			return createShape('circle', center, new Size(radius * 2), radius,
					arguments);
		},

		Rectangle: function() {
			var rect = Rectangle.readNamed(arguments, 'rectangle'),
				radius = Size.min(Size.readNamed(arguments, 'radius'),
						rect.getSize(true).divide(2));
			return createShape('rectangle', rect.getCenter(true),
					rect.getSize(true), radius, arguments);
		},

		Ellipse: function() {
			var ellipse = Shape._readEllipse(arguments),
				radius = ellipse.radius;
			return createShape('ellipse', ellipse.center, radius.multiply(2),
					radius, arguments);
		},

		_readEllipse: function(args) {
			var center,
				radius;
			if (Base.hasNamed(args, 'radius')) {
				center = Point.readNamed(args, 'center');
				radius = Size.readNamed(args, 'radius');
			} else {
				var rect = Rectangle.readNamed(args, 'rectangle');
				center = rect.getCenter(true);
				radius = rect.getSize(true).divide(2);
			}
			return { center: center, radius: radius };
		}
	};
}});

var Raster = Item.extend({
	_class: 'Raster',
	_applyMatrix: false,
	_canApplyMatrix: false,
	_boundsOptions: { stroke: false, handle: false },
	_serializeFields: {
		crossOrigin: null,
		source: null
	},
	_prioritize: ['crossOrigin'],

	initialize: function Raster(object, position) {
		if (!this._initialize(object,
				position !== undefined && Point.read(arguments, 1))) {
			var image = typeof object === 'string'
					? document.getElementById(object) : object;
			if (image) {
				this.setImage(image);
			} else {
				this.setSource(object);
			}
		}
		if (!this._size) {
			this._size = new Size();
			this._loaded = false;
		}
	},

	_equals: function(item) {
		return this.getSource() === item.getSource();
	},

	copyContent: function(source) {
		var image = source._image,
			canvas = source._canvas;
		if (image) {
			this._setImage(image);
		} else if (canvas) {
			var copyCanvas = CanvasProvider.getCanvas(source._size);
			copyCanvas.getContext('2d').drawImage(canvas, 0, 0);
			this._setImage(copyCanvas);
		}
		this._crossOrigin = source._crossOrigin;
	},

	getSize: function() {
		var size = this._size;
		return new LinkedSize(size ? size.width : 0, size ? size.height : 0,
				this, 'setSize');
	},

	setSize: function() {
		var size = Size.read(arguments);
		if (!size.equals(this._size)) {
			if (size.width > 0 && size.height > 0) {
				var element = this.getElement();
				this._setImage(CanvasProvider.getCanvas(size));
				if (element)
					this.getContext(true).drawImage(element, 0, 0,
							size.width, size.height);
			} else {
				if (this._canvas)
					CanvasProvider.release(this._canvas);
				this._size = size.clone();
			}
		}
	},

	getWidth: function() {
		return this._size ? this._size.width : 0;
	},

	setWidth: function(width) {
		this.setSize(width, this.getHeight());
	},

	getHeight: function() {
		return this._size ? this._size.height : 0;
	},

	setHeight: function(height) {
		this.setSize(this.getWidth(), height);
	},

	getLoaded: function() {
		return this._loaded;
	},

	isEmpty: function() {
		var size = this._size;
		return !size || size.width === 0 && size.height === 0;
	},

	getResolution: function() {
		var matrix = this._matrix,
			orig = new Point(0, 0).transform(matrix),
			u = new Point(1, 0).transform(matrix).subtract(orig),
			v = new Point(0, 1).transform(matrix).subtract(orig);
		return new Size(
			72 / u.getLength(),
			72 / v.getLength()
		);
	},

	getPpi: '#getResolution',

	getImage: function() {
		return this._image;
	},

	setImage: function(image) {
		var that = this;

		function emit(event) {
			var view = that.getView(),
				type = event && event.type || 'load';
			if (view && that.responds(type)) {
				paper = view._scope;
				that.emit(type, new Event(event));
			}
		}

		this._setImage(image);
		if (this._loaded) {
			setTimeout(emit, 0);
		} else if (image) {
			DomEvent.add(image, {
				load: function(event) {
					that._setImage(image);
					emit(event);
				},
				error: emit
			});
		}
	},

	_setImage: function(image) {
		if (this._canvas)
			CanvasProvider.release(this._canvas);
		if (image && image.getContext) {
			this._image = null;
			this._canvas = image;
			this._loaded = true;
		} else {
			this._image = image;
			this._canvas = null;
			this._loaded = !!(image && image.src && image.complete);
		}
		this._size = new Size(
				image ? image.naturalWidth || image.width : 0,
				image ? image.naturalHeight || image.height : 0);
		this._context = null;
		this._changed(521);
	},

	getCanvas: function() {
		if (!this._canvas) {
			var ctx = CanvasProvider.getContext(this._size);
			try {
				if (this._image)
					ctx.drawImage(this._image, 0, 0);
				this._canvas = ctx.canvas;
			} catch (e) {
				CanvasProvider.release(ctx);
			}
		}
		return this._canvas;
	},

	setCanvas: '#setImage',

	getContext: function(modify) {
		if (!this._context)
			this._context = this.getCanvas().getContext('2d');
		if (modify) {
			this._image = null;
			this._changed(513);
		}
		return this._context;
	},

	setContext: function(context) {
		this._context = context;
	},

	getSource: function() {
		var image = this._image;
		return image && image.src || this.toDataURL();
	},

	setSource: function(src) {
		var image = new self.Image(),
			crossOrigin = this._crossOrigin;
		if (crossOrigin)
			image.crossOrigin = crossOrigin;
		image.src = src;
		this.setImage(image);
	},

	getCrossOrigin: function() {
		var image = this._image;
		return image && image.crossOrigin || this._crossOrigin || '';
	},

	setCrossOrigin: function(crossOrigin) {
		this._crossOrigin = crossOrigin;
		var image = this._image;
		if (image)
			image.crossOrigin = crossOrigin;
	},

	getElement: function() {
		return this._canvas || this._loaded && this._image;
	}
}, {
	beans: false,

	getSubCanvas: function() {
		var rect = Rectangle.read(arguments),
			ctx = CanvasProvider.getContext(rect.getSize());
		ctx.drawImage(this.getCanvas(), rect.x, rect.y,
				rect.width, rect.height, 0, 0, rect.width, rect.height);
		return ctx.canvas;
	},

	getSubRaster: function() {
		var rect = Rectangle.read(arguments),
			raster = new Raster(Item.NO_INSERT);
		raster._setImage(this.getSubCanvas(rect));
		raster.translate(rect.getCenter().subtract(this.getSize().divide(2)));
		raster._matrix.prepend(this._matrix);
		raster.insertAbove(this);
		return raster;
	},

	toDataURL: function() {
		var image = this._image,
			src = image && image.src;
		if (/^data:/.test(src))
			return src;
		var canvas = this.getCanvas();
		return canvas ? canvas.toDataURL.apply(canvas, arguments) : null;
	},

	drawImage: function(image ) {
		var point = Point.read(arguments, 1);
		this.getContext(true).drawImage(image, point.x, point.y);
	},

	getAverageColor: function(object) {
		var bounds, path;
		if (!object) {
			bounds = this.getBounds();
		} else if (object instanceof PathItem) {
			path = object;
			bounds = object.getBounds();
		} else if (typeof object === 'object') {
			if ('width' in object) {
				bounds = new Rectangle(object);
			} else if ('x' in object) {
				bounds = new Rectangle(object.x - 0.5, object.y - 0.5, 1, 1);
			}
		}
		if (!bounds)
			return null;
		var sampleSize = 32,
			width = Math.min(bounds.width, sampleSize),
			height = Math.min(bounds.height, sampleSize);
		var ctx = Raster._sampleContext;
		if (!ctx) {
			ctx = Raster._sampleContext = CanvasProvider.getContext(
					new Size(sampleSize));
		} else {
			ctx.clearRect(0, 0, sampleSize + 1, sampleSize + 1);
		}
		ctx.save();
		var matrix = new Matrix()
				.scale(width / bounds.width, height / bounds.height)
				.translate(-bounds.x, -bounds.y);
		matrix.applyToContext(ctx);
		if (path)
			path.draw(ctx, new Base({ clip: true, matrices: [matrix] }));
		this._matrix.applyToContext(ctx);
		var element = this.getElement(),
			size = this._size;
		if (element)
			ctx.drawImage(element, -size.width / 2, -size.height / 2);
		ctx.restore();
		var pixels = ctx.getImageData(0.5, 0.5, Math.ceil(width),
				Math.ceil(height)).data,
			channels = [0, 0, 0],
			total = 0;
		for (var i = 0, l = pixels.length; i < l; i += 4) {
			var alpha = pixels[i + 3];
			total += alpha;
			alpha /= 255;
			channels[0] += pixels[i] * alpha;
			channels[1] += pixels[i + 1] * alpha;
			channels[2] += pixels[i + 2] * alpha;
		}
		for (var i = 0; i < 3; i++)
			channels[i] /= total;
		return total ? Color.read(channels) : null;
	},

	getPixel: function() {
		var point = Point.read(arguments);
		var data = this.getContext().getImageData(point.x, point.y, 1, 1).data;
		return new Color('rgb', [data[0] / 255, data[1] / 255, data[2] / 255],
				data[3] / 255);
	},

	setPixel: function() {
		var point = Point.read(arguments),
			color = Color.read(arguments),
			components = color._convert('rgb'),
			alpha = color._alpha,
			ctx = this.getContext(true),
			imageData = ctx.createImageData(1, 1),
			data = imageData.data;
		data[0] = components[0] * 255;
		data[1] = components[1] * 255;
		data[2] = components[2] * 255;
		data[3] = alpha != null ? alpha * 255 : 255;
		ctx.putImageData(imageData, point.x, point.y);
	},

	createImageData: function() {
		var size = Size.read(arguments);
		return this.getContext().createImageData(size.width, size.height);
	},

	getImageData: function() {
		var rect = Rectangle.read(arguments);
		if (rect.isEmpty())
			rect = new Rectangle(this._size);
		return this.getContext().getImageData(rect.x, rect.y,
				rect.width, rect.height);
	},

	setImageData: function(data ) {
		var point = Point.read(arguments, 1);
		this.getContext(true).putImageData(data, point.x, point.y);
	},

	_getBounds: function(matrix, options) {
		var rect = new Rectangle(this._size).setCenter(0, 0);
		return matrix ? matrix._transformBounds(rect) : rect;
	},

	_hitTestSelf: function(point) {
		if (this._contains(point)) {
			var that = this;
			return new HitResult('pixel', that, {
				offset: point.add(that._size.divide(2)).round(),
				color: {
					get: function() {
						return that.getPixel(this.offset);
					}
				}
			});
		}
	},

	_draw: function(ctx) {
		var element = this.getElement();
		if (element) {
			ctx.globalAlpha = this._opacity;
			ctx.drawImage(element,
					-this._size.width / 2, -this._size.height / 2);
		}
	},

	_canComposite: function() {
		return true;
	}
});

var SymbolItem = Item.extend({
	_class: 'SymbolItem',
	_applyMatrix: false,
	_canApplyMatrix: false,
	_boundsOptions: { stroke: true },
	_serializeFields: {
		symbol: null
	},

	initialize: function SymbolItem(arg0, arg1) {
		if (!this._initialize(arg0,
				arg1 !== undefined && Point.read(arguments, 1)))
			this.setDefinition(arg0 instanceof SymbolDefinition ?
					arg0 : new SymbolDefinition(arg0));
	},

	_equals: function(item) {
		return this._definition === item._definition;
	},

	copyContent: function(source) {
		this.setDefinition(source._definition);
	},

	getDefinition: function() {
		return this._definition;
	},

	setDefinition: function(definition) {
		this._definition = definition;
		this._changed(9);
	},

	getSymbol: '#getDefinition',
	setSymbol: '#setDefinition',

	isEmpty: function() {
		return this._definition._item.isEmpty();
	},

	_getBounds: function(matrix, options) {
		var item = this._definition._item;
		return item._getCachedBounds(item._matrix.prepended(matrix), options);
	},

	_hitTestSelf: function(point, options, viewMatrix) {
		var res = this._definition._item._hitTest(point, options, viewMatrix);
		if (res)
			res.item = this;
		return res;
	},

	_draw: function(ctx, param) {
		this._definition._item.draw(ctx, param);
	}

});

var SymbolDefinition = Base.extend({
	_class: 'SymbolDefinition',

	initialize: function SymbolDefinition(item, dontCenter) {
		this._id = UID.get();
		this.project = paper.project;
		if (item)
			this.setItem(item, dontCenter);
	},

	_serialize: function(options, dictionary) {
		return dictionary.add(this, function() {
			return Base.serialize([this._class, this._item],
					options, false, dictionary);
		});
	},

	_changed: function(flags) {
		if (flags & 8)
			Item._clearBoundsCache(this);
		if (flags & 1)
			this.project._changed(flags);
	},

	getItem: function() {
		return this._item;
	},

	setItem: function(item, _dontCenter) {
		if (item._symbol)
			item = item.clone();
		if (this._item)
			this._item._symbol = null;
		this._item = item;
		item.remove();
		item.setSelected(false);
		if (!_dontCenter)
			item.setPosition(new Point());
		item._symbol = this;
		this._changed(9);
	},

	getDefinition: '#getItem',
	setDefinition: '#setItem',

	place: function(position) {
		return new SymbolItem(this, position);
	},

	clone: function() {
		return new SymbolDefinition(this._item.clone(false));
	},

	equals: function(symbol) {
		return symbol === this
				|| symbol && this._item.equals(symbol._item)
				|| false;
	}
});

var HitResult = Base.extend({
	_class: 'HitResult',

	initialize: function HitResult(type, item, values) {
		this.type = type;
		this.item = item;
		if (values)
			this.inject(values);
	},

	statics: {
		getOptions: function(args) {
			var options = args && Base.read(args);
			return Base.set({
				type: null,
				tolerance: paper.settings.hitTolerance,
				fill: !options,
				stroke: !options,
				segments: !options,
				handles: false,
				ends: false,
				position: false,
				center: false,
				bounds: false,
				guides: false,
				selected: false
			}, options);
		}
	}
});

var Segment = Base.extend({
	_class: 'Segment',
	beans: true,
	_selection: 0,

	initialize: function Segment(arg0, arg1, arg2, arg3, arg4, arg5) {
		var count = arguments.length,
			point, handleIn, handleOut, selection;
		if (count > 0) {
			if (arg0 == null || typeof arg0 === 'object') {
				if (count === 1 && arg0 && 'point' in arg0) {
					point = arg0.point;
					handleIn = arg0.handleIn;
					handleOut = arg0.handleOut;
					selection = arg0.selection;
				} else {
					point = arg0;
					handleIn = arg1;
					handleOut = arg2;
					selection = arg3;
				}
			} else {
				point = [ arg0, arg1 ];
				handleIn = arg2 !== undefined ? [ arg2, arg3 ] : null;
				handleOut = arg4 !== undefined ? [ arg4, arg5 ] : null;
			}
		}
		new SegmentPoint(point, this, '_point');
		new SegmentPoint(handleIn, this, '_handleIn');
		new SegmentPoint(handleOut, this, '_handleOut');
		if (selection)
			this.setSelection(selection);
	},

	_serialize: function(options, dictionary) {
		var point = this._point,
			selection = this._selection,
			obj = selection || this.hasHandles()
					? [point, this._handleIn, this._handleOut]
					: point;
		if (selection)
			obj.push(selection);
		return Base.serialize(obj, options, true, dictionary);
	},

	_changed: function(point) {
		var path = this._path;
		if (!path)
			return;
		var curves = path._curves,
			index = this._index,
			curve;
		if (curves) {
			if ((!point || point === this._point || point === this._handleIn)
					&& (curve = index > 0 ? curves[index - 1] : path._closed
						? curves[curves.length - 1] : null))
				curve._changed();
			if ((!point || point === this._point || point === this._handleOut)
					&& (curve = curves[index]))
				curve._changed();
		}
		path._changed(25);
	},

	getPoint: function() {
		return this._point;
	},

	setPoint: function() {
		this._point.set(Point.read(arguments));
	},

	getHandleIn: function() {
		return this._handleIn;
	},

	setHandleIn: function() {
		this._handleIn.set(Point.read(arguments));
	},

	getHandleOut: function() {
		return this._handleOut;
	},

	setHandleOut: function() {
		this._handleOut.set(Point.read(arguments));
	},

	hasHandles: function() {
		return !this._handleIn.isZero() || !this._handleOut.isZero();
	},

	isSmooth: function() {
		var handleIn = this._handleIn,
			handleOut = this._handleOut;
		return !handleIn.isZero() && !handleOut.isZero()
				&& handleIn.isCollinear(handleOut);
	},

	clearHandles: function() {
		this._handleIn._set(0, 0);
		this._handleOut._set(0, 0);
	},

	getSelection: function() {
		return this._selection;
	},

	setSelection: function(selection) {
		var oldSelection = this._selection,
			path = this._path;
		this._selection = selection = selection || 0;
		if (path && selection !== oldSelection) {
			path._updateSelection(this, oldSelection, selection);
			path._changed(129);
		}
	},

	_changeSelection: function(flag, selected) {
		var selection = this._selection;
		this.setSelection(selected ? selection | flag : selection & ~flag);
	},

	isSelected: function() {
		return !!(this._selection & 7);
	},

	setSelected: function(selected) {
		this._changeSelection(7, selected);
	},

	getIndex: function() {
		return this._index !== undefined ? this._index : null;
	},

	getPath: function() {
		return this._path || null;
	},

	getCurve: function() {
		var path = this._path,
			index = this._index;
		if (path) {
			if (index > 0 && !path._closed
					&& index === path._segments.length - 1)
				index--;
			return path.getCurves()[index] || null;
		}
		return null;
	},

	getLocation: function() {
		var curve = this.getCurve();
		return curve
				? new CurveLocation(curve, this === curve._segment1 ? 0 : 1)
				: null;
	},

	getNext: function() {
		var segments = this._path && this._path._segments;
		return segments && (segments[this._index + 1]
				|| this._path._closed && segments[0]) || null;
	},

	smooth: function(options, _first, _last) {
		var opts = options || {},
			type = opts.type,
			factor = opts.factor,
			prev = this.getPrevious(),
			next = this.getNext(),
			p0 = (prev || this)._point,
			p1 = this._point,
			p2 = (next || this)._point,
			d1 = p0.getDistance(p1),
			d2 = p1.getDistance(p2);
		if (!type || type === 'catmull-rom') {
			var a = factor === undefined ? 0.5 : factor,
				d1_a = Math.pow(d1, a),
				d1_2a = d1_a * d1_a,
				d2_a = Math.pow(d2, a),
				d2_2a = d2_a * d2_a;
			if (!_first && prev) {
				var A = 2 * d2_2a + 3 * d2_a * d1_a + d1_2a,
					N = 3 * d2_a * (d2_a + d1_a);
				this.setHandleIn(N !== 0
					? new Point(
						(d2_2a * p0._x + A * p1._x - d1_2a * p2._x) / N - p1._x,
						(d2_2a * p0._y + A * p1._y - d1_2a * p2._y) / N - p1._y)
					: new Point());
			}
			if (!_last && next) {
				var A = 2 * d1_2a + 3 * d1_a * d2_a + d2_2a,
					N = 3 * d1_a * (d1_a + d2_a);
				this.setHandleOut(N !== 0
					? new Point(
						(d1_2a * p2._x + A * p1._x - d2_2a * p0._x) / N - p1._x,
						(d1_2a * p2._y + A * p1._y - d2_2a * p0._y) / N - p1._y)
					: new Point());
			}
		} else if (type === 'geometric') {
			if (prev && next) {
				var vector = p0.subtract(p2),
					t = factor === undefined ? 0.4 : factor,
					k = t * d1 / (d1 + d2);
				if (!_first)
					this.setHandleIn(vector.multiply(k));
				if (!_last)
					this.setHandleOut(vector.multiply(k - t));
			}
		} else {
			throw new Error('Smoothing method \'' + type + '\' not supported.');
		}
	},

	getPrevious: function() {
		var segments = this._path && this._path._segments;
		return segments && (segments[this._index - 1]
				|| this._path._closed && segments[segments.length - 1]) || null;
	},

	isFirst: function() {
		return !this._index;
	},

	isLast: function() {
		var path = this._path;
		return path && this._index === path._segments.length - 1 || false;
	},

	reverse: function() {
		var handleIn = this._handleIn,
			handleOut = this._handleOut,
			tmp = handleIn.clone();
		handleIn.set(handleOut);
		handleOut.set(tmp);
	},

	reversed: function() {
		return new Segment(this._point, this._handleOut, this._handleIn);
	},

	remove: function() {
		return this._path ? !!this._path.removeSegment(this._index) : false;
	},

	clone: function() {
		return new Segment(this._point, this._handleIn, this._handleOut);
	},

	equals: function(segment) {
		return segment === this || segment && this._class === segment._class
				&& this._point.equals(segment._point)
				&& this._handleIn.equals(segment._handleIn)
				&& this._handleOut.equals(segment._handleOut)
				|| false;
	},

	toString: function() {
		var parts = [ 'point: ' + this._point ];
		if (!this._handleIn.isZero())
			parts.push('handleIn: ' + this._handleIn);
		if (!this._handleOut.isZero())
			parts.push('handleOut: ' + this._handleOut);
		return '{ ' + parts.join(', ') + ' }';
	},

	transform: function(matrix) {
		this._transformCoordinates(matrix, new Array(6), true);
		this._changed();
	},

	interpolate: function(from, to, factor) {
		var u = 1 - factor,
			v = factor,
			point1 = from._point,
			point2 = to._point,
			handleIn1 = from._handleIn,
			handleIn2 = to._handleIn,
			handleOut2 = to._handleOut,
			handleOut1 = from._handleOut;
		this._point._set(
				u * point1._x + v * point2._x,
				u * point1._y + v * point2._y, true);
		this._handleIn._set(
				u * handleIn1._x + v * handleIn2._x,
				u * handleIn1._y + v * handleIn2._y, true);
		this._handleOut._set(
				u * handleOut1._x + v * handleOut2._x,
				u * handleOut1._y + v * handleOut2._y, true);
		this._changed();
	},

	_transformCoordinates: function(matrix, coords, change) {
		var point = this._point,
			handleIn = !change || !this._handleIn.isZero()
					? this._handleIn : null,
			handleOut = !change || !this._handleOut.isZero()
					? this._handleOut : null,
			x = point._x,
			y = point._y,
			i = 2;
		coords[0] = x;
		coords[1] = y;
		if (handleIn) {
			coords[i++] = handleIn._x + x;
			coords[i++] = handleIn._y + y;
		}
		if (handleOut) {
			coords[i++] = handleOut._x + x;
			coords[i++] = handleOut._y + y;
		}
		if (matrix) {
			matrix._transformCoordinates(coords, coords, i / 2);
			x = coords[0];
			y = coords[1];
			if (change) {
				point._x = x;
				point._y = y;
				i = 2;
				if (handleIn) {
					handleIn._x = coords[i++] - x;
					handleIn._y = coords[i++] - y;
				}
				if (handleOut) {
					handleOut._x = coords[i++] - x;
					handleOut._y = coords[i++] - y;
				}
			} else {
				if (!handleIn) {
					coords[i++] = x;
					coords[i++] = y;
				}
				if (!handleOut) {
					coords[i++] = x;
					coords[i++] = y;
				}
			}
		}
		return coords;
	}
});

var SegmentPoint = Point.extend({
	initialize: function SegmentPoint(point, owner, key) {
		var x, y,
			selected;
		if (!point) {
			x = y = 0;
		} else if ((x = point[0]) !== undefined) {
			y = point[1];
		} else {
			var pt = point;
			if ((x = pt.x) === undefined) {
				pt = Point.read(arguments);
				x = pt.x;
			}
			y = pt.y;
			selected = pt.selected;
		}
		this._x = x;
		this._y = y;
		this._owner = owner;
		owner[key] = this;
		if (selected)
			this.setSelected(true);
	},

	_set: function(x, y) {
		this._x = x;
		this._y = y;
		this._owner._changed(this);
		return this;
	},

	getX: function() {
		return this._x;
	},

	setX: function(x) {
		this._x = x;
		this._owner._changed(this);
	},

	getY: function() {
		return this._y;
	},

	setY: function(y) {
		this._y = y;
		this._owner._changed(this);
	},

	isZero: function() {
		var isZero = Numerical.isZero;
		return isZero(this._x) && isZero(this._y);
	},

	isSelected: function() {
		return !!(this._owner._selection & this._getSelection());
	},

	setSelected: function(selected) {
		this._owner._changeSelection(this._getSelection(), selected);
	},

	_getSelection: function() {
		var owner = this._owner;
		return this === owner._point ? 1
			: this === owner._handleIn ? 2
			: this === owner._handleOut ? 4
			: 0;
	}
});

var Curve = Base.extend({
	_class: 'Curve',
	beans: true,

	initialize: function Curve(arg0, arg1, arg2, arg3, arg4, arg5, arg6, arg7) {
		var count = arguments.length,
			seg1, seg2,
			point1, point2,
			handle1, handle2;
		if (count === 3) {
			this._path = arg0;
			seg1 = arg1;
			seg2 = arg2;
		} else if (!count) {
			seg1 = new Segment();
			seg2 = new Segment();
		} else if (count === 1) {
			if ('segment1' in arg0) {
				seg1 = new Segment(arg0.segment1);
				seg2 = new Segment(arg0.segment2);
			} else if ('point1' in arg0) {
				point1 = arg0.point1;
				handle1 = arg0.handle1;
				handle2 = arg0.handle2;
				point2 = arg0.point2;
			} else if (Array.isArray(arg0)) {
				point1 = [arg0[0], arg0[1]];
				point2 = [arg0[6], arg0[7]];
				handle1 = [arg0[2] - arg0[0], arg0[3] - arg0[1]];
				handle2 = [arg0[4] - arg0[6], arg0[5] - arg0[7]];
			}
		} else if (count === 2) {
			seg1 = new Segment(arg0);
			seg2 = new Segment(arg1);
		} else if (count === 4) {
			point1 = arg0;
			handle1 = arg1;
			handle2 = arg2;
			point2 = arg3;
		} else if (count === 8) {
			point1 = [arg0, arg1];
			point2 = [arg6, arg7];
			handle1 = [arg2 - arg0, arg3 - arg1];
			handle2 = [arg4 - arg6, arg5 - arg7];
		}
		this._segment1 = seg1 || new Segment(point1, null, handle1);
		this._segment2 = seg2 || new Segment(point2, handle2, null);
	},

	_serialize: function(options, dictionary) {
		return Base.serialize(this.hasHandles()
				? [this.getPoint1(), this.getHandle1(), this.getHandle2(),
					this.getPoint2()]
				: [this.getPoint1(), this.getPoint2()],
				options, true, dictionary);
	},

	_changed: function() {
		this._length = this._bounds = undefined;
	},

	clone: function() {
		return new Curve(this._segment1, this._segment2);
	},

	toString: function() {
		var parts = [ 'point1: ' + this._segment1._point ];
		if (!this._segment1._handleOut.isZero())
			parts.push('handle1: ' + this._segment1._handleOut);
		if (!this._segment2._handleIn.isZero())
			parts.push('handle2: ' + this._segment2._handleIn);
		parts.push('point2: ' + this._segment2._point);
		return '{ ' + parts.join(', ') + ' }';
	},

	classify: function() {
		return Curve.classify(this.getValues());
	},

	remove: function() {
		var removed = false;
		if (this._path) {
			var segment2 = this._segment2,
				handleOut = segment2._handleOut;
			removed = segment2.remove();
			if (removed)
				this._segment1._handleOut.set(handleOut);
		}
		return removed;
	},

	getPoint1: function() {
		return this._segment1._point;
	},

	setPoint1: function() {
		this._segment1._point.set(Point.read(arguments));
	},

	getPoint2: function() {
		return this._segment2._point;
	},

	setPoint2: function() {
		this._segment2._point.set(Point.read(arguments));
	},

	getHandle1: function() {
		return this._segment1._handleOut;
	},

	setHandle1: function() {
		this._segment1._handleOut.set(Point.read(arguments));
	},

	getHandle2: function() {
		return this._segment2._handleIn;
	},

	setHandle2: function() {
		this._segment2._handleIn.set(Point.read(arguments));
	},

	getSegment1: function() {
		return this._segment1;
	},

	getSegment2: function() {
		return this._segment2;
	},

	getPath: function() {
		return this._path;
	},

	getIndex: function() {
		return this._segment1._index;
	},

	getNext: function() {
		var curves = this._path && this._path._curves;
		return curves && (curves[this._segment1._index + 1]
				|| this._path._closed && curves[0]) || null;
	},

	getPrevious: function() {
		var curves = this._path && this._path._curves;
		return curves && (curves[this._segment1._index - 1]
				|| this._path._closed && curves[curves.length - 1]) || null;
	},

	isFirst: function() {
		return !this._segment1._index;
	},

	isLast: function() {
		var path = this._path;
		return path && this._segment1._index === path._curves.length - 1
				|| false;
	},

	isSelected: function() {
		return this.getPoint1().isSelected()
				&& this.getHandle2().isSelected()
				&& this.getHandle2().isSelected()
				&& this.getPoint2().isSelected();
	},

	setSelected: function(selected) {
		this.getPoint1().setSelected(selected);
		this.getHandle1().setSelected(selected);
		this.getHandle2().setSelected(selected);
		this.getPoint2().setSelected(selected);
	},

	getValues: function(matrix) {
		return Curve.getValues(this._segment1, this._segment2, matrix);
	},

	getPoints: function() {
		var coords = this.getValues(),
			points = [];
		for (var i = 0; i < 8; i += 2)
			points.push(new Point(coords[i], coords[i + 1]));
		return points;
	}
}, {
	getLength: function() {
		if (this._length == null)
			this._length = Curve.getLength(this.getValues(), 0, 1);
		return this._length;
	},

	getArea: function() {
		return Curve.getArea(this.getValues());
	},

	getLine: function() {
		return new Line(this._segment1._point, this._segment2._point);
	},

	getPart: function(from, to) {
		return new Curve(Curve.getPart(this.getValues(), from, to));
	},

	getPartLength: function(from, to) {
		return Curve.getLength(this.getValues(), from, to);
	},

	divideAt: function(location) {
		return this.divideAtTime(location && location.curve === this
				? location.time : this.getTimeAt(location));
	},

	divideAtTime: function(time, _setHandles) {
		var tMin = 1e-8,
			tMax = 1 - tMin,
			res = null;
		if (time >= tMin && time <= tMax) {
			var parts = Curve.subdivide(this.getValues(), time),
				left = parts[0],
				right = parts[1],
				setHandles = _setHandles || this.hasHandles(),
				seg1 = this._segment1,
				seg2 = this._segment2,
				path = this._path;
			if (setHandles) {
				seg1._handleOut._set(left[2] - left[0], left[3] - left[1]);
				seg2._handleIn._set(right[4] - right[6],right[5] - right[7]);
			}
			var x = left[6], y = left[7],
				segment = new Segment(new Point(x, y),
						setHandles && new Point(left[4] - x, left[5] - y),
						setHandles && new Point(right[2] - x, right[3] - y));
			if (path) {
				path.insert(seg1._index + 1, segment);
				res = this.getNext();
			} else {
				this._segment2 = segment;
				this._changed();
				res = new Curve(segment, seg2);
			}
		}
		return res;
	},

	splitAt: function(location) {
		var path = this._path;
		return path ? path.splitAt(location) : null;
	},

	splitAtTime: function(time) {
		return this.splitAt(this.getLocationAtTime(time));
	},

	divide: function(offset, isTime) {
		return this.divideAtTime(offset === undefined ? 0.5 : isTime ? offset
				: this.getTimeAt(offset));
	},

	split: function(offset, isTime) {
		return this.splitAtTime(offset === undefined ? 0.5 : isTime ? offset
				: this.getTimeAt(offset));
	},

	reversed: function() {
		return new Curve(this._segment2.reversed(), this._segment1.reversed());
	},

	clearHandles: function() {
		this._segment1._handleOut._set(0, 0);
		this._segment2._handleIn._set(0, 0);
	},

statics: {
	getValues: function(segment1, segment2, matrix, straight) {
		var p1 = segment1._point,
			h1 = segment1._handleOut,
			h2 = segment2._handleIn,
			p2 = segment2._point,
			x1 = p1.x, y1 = p1.y,
			x2 = p2.x, y2 = p2.y,
			values = straight
				? [ x1, y1, x1, y1, x2, y2, x2, y2 ]
				: [
					x1, y1,
					x1 + h1._x, y1 + h1._y,
					x2 + h2._x, y2 + h2._y,
					x2, y2
				];
		if (matrix)
			matrix._transformCoordinates(values, values, 4);
		return values;
	},

	subdivide: function(v, t) {
		var x0 = v[0], y0 = v[1],
			x1 = v[2], y1 = v[3],
			x2 = v[4], y2 = v[5],
			x3 = v[6], y3 = v[7];
		if (t === undefined)
			t = 0.5;
		var u = 1 - t,
			x4 = u * x0 + t * x1, y4 = u * y0 + t * y1,
			x5 = u * x1 + t * x2, y5 = u * y1 + t * y2,
			x6 = u * x2 + t * x3, y6 = u * y2 + t * y3,
			x7 = u * x4 + t * x5, y7 = u * y4 + t * y5,
			x8 = u * x5 + t * x6, y8 = u * y5 + t * y6,
			x9 = u * x7 + t * x8, y9 = u * y7 + t * y8;
		return [
			[x0, y0, x4, y4, x7, y7, x9, y9],
			[x9, y9, x8, y8, x6, y6, x3, y3]
		];
	},

	getMonoCurves: function(v, dir) {
		var curves = [],
			io = dir ? 0 : 1,
			o0 = v[io + 0],
			o1 = v[io + 2],
			o2 = v[io + 4],
			o3 = v[io + 6];
		if ((o0 >= o1) === (o1 >= o2) && (o1 >= o2) === (o2 >= o3)
				|| Curve.isStraight(v)) {
			curves.push(v);
		} else {
			var a = 3 * (o1 - o2) - o0 + o3,
				b = 2 * (o0 + o2) - 4 * o1,
				c = o1 - o0,
				tMin = 1e-8,
				tMax = 1 - tMin,
				roots = [],
				n = Numerical.solveQuadratic(a, b, c, roots, tMin, tMax);
			if (!n) {
				curves.push(v);
			} else {
				roots.sort();
				var t = roots[0],
					parts = Curve.subdivide(v, t);
				curves.push(parts[0]);
				if (n > 1) {
					t = (roots[1] - t) / (1 - t);
					parts = Curve.subdivide(parts[1], t);
					curves.push(parts[0]);
				}
				curves.push(parts[1]);
			}
		}
		return curves;
	},

	solveCubic: function (v, coord, val, roots, min, max) {
		var v0 = v[coord],
			v1 = v[coord + 2],
			v2 = v[coord + 4],
			v3 = v[coord + 6],
			res = 0;
		if (  !(v0 < val && v3 < val && v1 < val && v2 < val ||
				v0 > val && v3 > val && v1 > val && v2 > val)) {
			var c = 3 * (v1 - v0),
				b = 3 * (v2 - v1) - c,
				a = v3 - v0 - c - b;
			res = Numerical.solveCubic(a, b, c, v0 - val, roots, min, max);
		}
		return res;
	},

	getTimeOf: function(v, point) {
		var p0 = new Point(v[0], v[1]),
			p3 = new Point(v[6], v[7]),
			epsilon = 1e-12,
			geomEpsilon = 1e-7,
			t = point.isClose(p0, epsilon) ? 0
			  : point.isClose(p3, epsilon) ? 1
			  : null;
		if (t === null) {
			var coords = [point.x, point.y],
				roots = [];
			for (var c = 0; c < 2; c++) {
				var count = Curve.solveCubic(v, c, coords[c], roots, 0, 1);
				for (var i = 0; i < count; i++) {
					var u = roots[i];
					if (point.isClose(Curve.getPoint(v, u), geomEpsilon))
						return u;
				}
			}
		}
		return point.isClose(p0, geomEpsilon) ? 0
			 : point.isClose(p3, geomEpsilon) ? 1
			 : null;
	},

	getNearestTime: function(v, point) {
		if (Curve.isStraight(v)) {
			var x0 = v[0], y0 = v[1],
				x3 = v[6], y3 = v[7],
				vx = x3 - x0, vy = y3 - y0,
				det = vx * vx + vy * vy;
			if (det === 0)
				return 0;
			var u = ((point.x - x0) * vx + (point.y - y0) * vy) / det;
			return u < 1e-12 ? 0
				 : u > 0.999999999999 ? 1
				 : Curve.getTimeOf(v,
					new Point(x0 + u * vx, y0 + u * vy));
		}

		var count = 100,
			minDist = Infinity,
			minT = 0;

		function refine(t) {
			if (t >= 0 && t <= 1) {
				var dist = point.getDistance(Curve.getPoint(v, t), true);
				if (dist < minDist) {
					minDist = dist;
					minT = t;
					return true;
				}
			}
		}

		for (var i = 0; i <= count; i++)
			refine(i / count);

		var step = 1 / (count * 2);
		while (step > 1e-8) {
			if (!refine(minT - step) && !refine(minT + step))
				step /= 2;
		}
		return minT;
	},

	getPart: function(v, from, to) {
		var flip = from > to;
		if (flip) {
			var tmp = from;
			from = to;
			to = tmp;
		}
		if (from > 0)
			v = Curve.subdivide(v, from)[1];
		if (to < 1)
			v = Curve.subdivide(v, (to - from) / (1 - from))[0];
		return flip
				? [v[6], v[7], v[4], v[5], v[2], v[3], v[0], v[1]]
				: v;
	},

	isFlatEnough: function(v, flatness) {
		var x0 = v[0], y0 = v[1],
			x1 = v[2], y1 = v[3],
			x2 = v[4], y2 = v[5],
			x3 = v[6], y3 = v[7],
			ux = 3 * x1 - 2 * x0 - x3,
			uy = 3 * y1 - 2 * y0 - y3,
			vx = 3 * x2 - 2 * x3 - x0,
			vy = 3 * y2 - 2 * y3 - y0;
		return Math.max(ux * ux, vx * vx) + Math.max(uy * uy, vy * vy)
				<= 16 * flatness * flatness;
	},

	getArea: function(v) {
		var x0 = v[0], y0 = v[1],
			x1 = v[2], y1 = v[3],
			x2 = v[4], y2 = v[5],
			x3 = v[6], y3 = v[7];
		return 3 * ((y3 - y0) * (x1 + x2) - (x3 - x0) * (y1 + y2)
				+ y1 * (x0 - x2) - x1 * (y0 - y2)
				+ y3 * (x2 + x0 / 3) - x3 * (y2 + y0 / 3)) / 20;
	},

	getBounds: function(v) {
		var min = v.slice(0, 2),
			max = min.slice(),
			roots = [0, 0];
		for (var i = 0; i < 2; i++)
			Curve._addBounds(v[i], v[i + 2], v[i + 4], v[i + 6],
					i, 0, min, max, roots);
		return new Rectangle(min[0], min[1], max[0] - min[0], max[1] - min[1]);
	},

	_addBounds: function(v0, v1, v2, v3, coord, padding, min, max, roots) {
		function add(value, padding) {
			var left = value - padding,
				right = value + padding;
			if (left < min[coord])
				min[coord] = left;
			if (right > max[coord])
				max[coord] = right;
		}

		padding /= 2;
		var minPad = min[coord] - padding,
			maxPad = max[coord] + padding;
		if (    v0 < minPad || v1 < minPad || v2 < minPad || v3 < minPad ||
				v0 > maxPad || v1 > maxPad || v2 > maxPad || v3 > maxPad) {
			if (v1 < v0 != v1 < v3 && v2 < v0 != v2 < v3) {
				add(v0, padding);
				add(v3, padding);
			} else {
				var a = 3 * (v1 - v2) - v0 + v3,
					b = 2 * (v0 + v2) - 4 * v1,
					c = v1 - v0,
					count = Numerical.solveQuadratic(a, b, c, roots),
					tMin = 1e-8,
					tMax = 1 - tMin;
				add(v3, 0);
				for (var i = 0; i < count; i++) {
					var t = roots[i],
						u = 1 - t;
					if (tMin <= t && t <= tMax)
						add(u * u * u * v0
							+ 3 * u * u * t * v1
							+ 3 * u * t * t * v2
							+ t * t * t * v3,
							padding);
				}
			}
		}
	}
}}, Base.each(
	['getBounds', 'getStrokeBounds', 'getHandleBounds'],
	function(name) {
		this[name] = function() {
			if (!this._bounds)
				this._bounds = {};
			var bounds = this._bounds[name];
			if (!bounds) {
				bounds = this._bounds[name] = Path[name](
						[this._segment1, this._segment2], false, this._path);
			}
			return bounds.clone();
		};
	},
{

}), Base.each({
	isStraight: function(p1, h1, h2, p2) {
		if (h1.isZero() && h2.isZero()) {
			return true;
		} else {
			var v = p2.subtract(p1);
			if (v.isZero()) {
				return false;
			} else if (v.isCollinear(h1) && v.isCollinear(h2)) {
				var l = new Line(p1, p2),
					epsilon = 1e-7;
				if (l.getDistance(p1.add(h1)) < epsilon &&
					l.getDistance(p2.add(h2)) < epsilon) {
					var div = v.dot(v),
						s1 = v.dot(h1) / div,
						s2 = v.dot(h2) / div;
					return s1 >= 0 && s1 <= 1 && s2 <= 0 && s2 >= -1;
				}
			}
		}
		return false;
	},

	isLinear: function(p1, h1, h2, p2) {
		var third = p2.subtract(p1).divide(3);
		return h1.equals(third) && h2.negate().equals(third);
	}
}, function(test, name) {
	this[name] = function(epsilon) {
		var seg1 = this._segment1,
			seg2 = this._segment2;
		return test(seg1._point, seg1._handleOut, seg2._handleIn, seg2._point,
				epsilon);
	};

	this.statics[name] = function(v, epsilon) {
		var x0 = v[0], y0 = v[1],
			x3 = v[6], y3 = v[7];
		return test(
				new Point(x0, y0),
				new Point(v[2] - x0, v[3] - y0),
				new Point(v[4] - x3, v[5] - y3),
				new Point(x3, y3), epsilon);
	};
}, {
	statics: {},

	hasHandles: function() {
		return !this._segment1._handleOut.isZero()
				|| !this._segment2._handleIn.isZero();
	},

	hasLength: function(epsilon) {
		return (!this.getPoint1().equals(this.getPoint2()) || this.hasHandles())
				&& this.getLength() > (epsilon || 0);
	},

	isCollinear: function(curve) {
		return curve && this.isStraight() && curve.isStraight()
				&& this.getLine().isCollinear(curve.getLine());
	},

	isHorizontal: function() {
		return this.isStraight() && Math.abs(this.getTangentAtTime(0.5).y)
				< 1e-8;
	},

	isVertical: function() {
		return this.isStraight() && Math.abs(this.getTangentAtTime(0.5).x)
				< 1e-8;
	}
}), {
	beans: false,

	getLocationAt: function(offset, _isTime) {
		return this.getLocationAtTime(
				_isTime ? offset : this.getTimeAt(offset));
	},

	getLocationAtTime: function(t) {
		return t != null && t >= 0 && t <= 1
				? new CurveLocation(this, t)
				: null;
	},

	getTimeAt: function(offset, start) {
		return Curve.getTimeAt(this.getValues(), offset, start);
	},

	getParameterAt: '#getTimeAt',

	getOffsetAtTime: function(t) {
		return this.getPartLength(0, t);
	},

	getLocationOf: function() {
		return this.getLocationAtTime(this.getTimeOf(Point.read(arguments)));
	},

	getOffsetOf: function() {
		var loc = this.getLocationOf.apply(this, arguments);
		return loc ? loc.getOffset() : null;
	},

	getTimeOf: function() {
		return Curve.getTimeOf(this.getValues(), Point.read(arguments));
	},

	getParameterOf: '#getTimeOf',

	getNearestLocation: function() {
		var point = Point.read(arguments),
			values = this.getValues(),
			t = Curve.getNearestTime(values, point),
			pt = Curve.getPoint(values, t);
		return new CurveLocation(this, t, pt, null, point.getDistance(pt));
	},

	getNearestPoint: function() {
		var loc = this.getNearestLocation.apply(this, arguments);
		return loc ? loc.getPoint() : loc;
	}

},
new function() {
	var methods = ['getPoint', 'getTangent', 'getNormal', 'getWeightedTangent',
		'getWeightedNormal', 'getCurvature'];
	return Base.each(methods,
		function(name) {
			this[name + 'At'] = function(location, _isTime) {
				var values = this.getValues();
				return Curve[name](values, _isTime ? location
						: Curve.getTimeAt(values, location));
			};

			this[name + 'AtTime'] = function(time) {
				return Curve[name](this.getValues(), time);
			};
		}, {
			statics: {
				_evaluateMethods: methods
			}
		}
	);
},
new function() {

	function getLengthIntegrand(v) {
		var x0 = v[0], y0 = v[1],
			x1 = v[2], y1 = v[3],
			x2 = v[4], y2 = v[5],
			x3 = v[6], y3 = v[7],

			ax = 9 * (x1 - x2) + 3 * (x3 - x0),
			bx = 6 * (x0 + x2) - 12 * x1,
			cx = 3 * (x1 - x0),

			ay = 9 * (y1 - y2) + 3 * (y3 - y0),
			by = 6 * (y0 + y2) - 12 * y1,
			cy = 3 * (y1 - y0);

		return function(t) {
			var dx = (ax * t + bx) * t + cx,
				dy = (ay * t + by) * t + cy;
			return Math.sqrt(dx * dx + dy * dy);
		};
	}

	function getIterations(a, b) {
		return Math.max(2, Math.min(16, Math.ceil(Math.abs(b - a) * 32)));
	}

	function evaluate(v, t, type, normalized) {
		if (t == null || t < 0 || t > 1)
			return null;
		var x0 = v[0], y0 = v[1],
			x1 = v[2], y1 = v[3],
			x2 = v[4], y2 = v[5],
			x3 = v[6], y3 = v[7],
			isZero = Numerical.isZero;
		if (isZero(x1 - x0) && isZero(y1 - y0)) {
			x1 = x0;
			y1 = y0;
		}
		if (isZero(x2 - x3) && isZero(y2 - y3)) {
			x2 = x3;
			y2 = y3;
		}
		var cx = 3 * (x1 - x0),
			bx = 3 * (x2 - x1) - cx,
			ax = x3 - x0 - cx - bx,
			cy = 3 * (y1 - y0),
			by = 3 * (y2 - y1) - cy,
			ay = y3 - y0 - cy - by,
			x, y;
		if (type === 0) {
			x = t === 0 ? x0 : t === 1 ? x3
					: ((ax * t + bx) * t + cx) * t + x0;
			y = t === 0 ? y0 : t === 1 ? y3
					: ((ay * t + by) * t + cy) * t + y0;
		} else {
			var tMin = 1e-8,
				tMax = 1 - tMin;
			if (t < tMin) {
				x = cx;
				y = cy;
			} else if (t > tMax) {
				x = 3 * (x3 - x2);
				y = 3 * (y3 - y2);
			} else {
				x = (3 * ax * t + 2 * bx) * t + cx;
				y = (3 * ay * t + 2 * by) * t + cy;
			}
			if (normalized) {
				if (x === 0 && y === 0 && (t < tMin || t > tMax)) {
					x = x2 - x1;
					y = y2 - y1;
				}
				var len = Math.sqrt(x * x + y * y);
				if (len) {
					x /= len;
					y /= len;
				}
			}
			if (type === 3) {
				var x2 = 6 * ax * t + 2 * bx,
					y2 = 6 * ay * t + 2 * by,
					d = Math.pow(x * x + y * y, 3 / 2);
				x = d !== 0 ? (x * y2 - y * x2) / d : 0;
				y = 0;
			}
		}
		return type === 2 ? new Point(y, -x) : new Point(x, y);
	}

	return { statics: {

		classify: function(v) {

			var x0 = v[0], y0 = v[1],
				x1 = v[2], y1 = v[3],
				x2 = v[4], y2 = v[5],
				x3 = v[6], y3 = v[7],
				a1 = x0 * (y3 - y2) + y0 * (x2 - x3) + x3 * y2 - y3 * x2,
				a2 = x1 * (y0 - y3) + y1 * (x3 - x0) + x0 * y3 - y0 * x3,
				a3 = x2 * (y1 - y0) + y2 * (x0 - x1) + x1 * y0 - y1 * x0,
				d3 = 3 * a3,
				d2 = d3 - a2,
				d1 = d2 - a2 + a1,
				l = Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3),
				s = l !== 0 ? 1 / l : 0,
				isZero = Numerical.isZero,
				serpentine = 'serpentine';
			d1 *= s;
			d2 *= s;
			d3 *= s;

			function type(type, t1, t2) {
				var hasRoots = t1 !== undefined,
					t1Ok = hasRoots && t1 > 0 && t1 < 1,
					t2Ok = hasRoots && t2 > 0 && t2 < 1;
				if (hasRoots && (!(t1Ok || t2Ok)
						|| type === 'loop' && !(t1Ok && t2Ok))) {
					type = 'arch';
					t1Ok = t2Ok = false;
				}
				return {
					type: type,
					roots: t1Ok || t2Ok
							? t1Ok && t2Ok
								? t1 < t2 ? [t1, t2] : [t2, t1]
								: [t1Ok ? t1 : t2]
							: null
				};
			}

			if (isZero(d1)) {
				return isZero(d2)
						? type(isZero(d3) ? 'line' : 'quadratic')
						: type(serpentine, d3 / (3 * d2));
			}
			var d = 3 * d2 * d2 - 4 * d1 * d3;
			if (isZero(d)) {
				return type('cusp', d2 / (2 * d1));
			}
			var f1 = d > 0 ? Math.sqrt(d / 3) : Math.sqrt(-d),
				f2 = 2 * d1;
			return type(d > 0 ? serpentine : 'loop',
					(d2 + f1) / f2,
					(d2 - f1) / f2);
		},

		getLength: function(v, a, b, ds) {
			if (a === undefined)
				a = 0;
			if (b === undefined)
				b = 1;
			if (Curve.isStraight(v)) {
				var c = v;
				if (b < 1) {
					c = Curve.subdivide(c, b)[0];
					a /= b;
				}
				if (a > 0) {
					c = Curve.subdivide(c, a)[1];
				}
				var dx = c[6] - c[0],
					dy = c[7] - c[1];
				return Math.sqrt(dx * dx + dy * dy);
			}
			return Numerical.integrate(ds || getLengthIntegrand(v), a, b,
					getIterations(a, b));
		},

		getTimeAt: function(v, offset, start) {
			if (start === undefined)
				start = offset < 0 ? 1 : 0;
			if (offset === 0)
				return start;
			var abs = Math.abs,
				epsilon = 1e-12,
				forward = offset > 0,
				a = forward ? start : 0,
				b = forward ? 1 : start,
				ds = getLengthIntegrand(v),
				rangeLength = Curve.getLength(v, a, b, ds),
				diff = abs(offset) - rangeLength;
			if (abs(diff) < epsilon) {
				return forward ? b : a;
			} else if (diff > epsilon) {
				return null;
			}
			var guess = offset / rangeLength,
				length = 0;
			function f(t) {
				length += Numerical.integrate(ds, start, t,
						getIterations(start, t));
				start = t;
				return length - offset;
			}
			return Numerical.findRoot(f, ds, start + guess, a, b, 32,
					1e-12);
		},

		getPoint: function(v, t) {
			return evaluate(v, t, 0, false);
		},

		getTangent: function(v, t) {
			return evaluate(v, t, 1, true);
		},

		getWeightedTangent: function(v, t) {
			return evaluate(v, t, 1, false);
		},

		getNormal: function(v, t) {
			return evaluate(v, t, 2, true);
		},

		getWeightedNormal: function(v, t) {
			return evaluate(v, t, 2, false);
		},

		getCurvature: function(v, t) {
			return evaluate(v, t, 3, false).x;
		},

		getPeaks: function(v) {
			var x0 = v[0], y0 = v[1],
				x1 = v[2], y1 = v[3],
				x2 = v[4], y2 = v[5],
				x3 = v[6], y3 = v[7],
				ax =     -x0 + 3 * x1 - 3 * x2 + x3,
				bx =  3 * x0 - 6 * x1 + 3 * x2,
				cx = -3 * x0 + 3 * x1,
				ay =     -y0 + 3 * y1 - 3 * y2 + y3,
				by =  3 * y0 - 6 * y1 + 3 * y2,
				cy = -3 * y0 + 3 * y1,
				tMin = 1e-8,
				tMax = 1 - tMin,
				roots = [];
			Numerical.solveCubic(
					9 * (ax * ax + ay * ay),
					9 * (ax * bx + by * ay),
					2 * (bx * bx + by * by) + 3 * (cx * ax + cy * ay),
					(cx * bx + by * cy),
					roots, tMin, tMax);
			return roots.sort();
		}
	}};
},
new function() {

	function addLocation(locations, include, c1, t1, c2, t2, overlap) {
		var excludeStart = !overlap && c1.getPrevious() === c2,
			excludeEnd = !overlap && c1 !== c2 && c1.getNext() === c2,
			tMin = 1e-8,
			tMax = 1 - tMin;
		if (t1 !== null && t1 >= (excludeStart ? tMin : 0) &&
			t1 <= (excludeEnd ? tMax : 1)) {
			if (t2 !== null && t2 >= (excludeEnd ? tMin : 0) &&
				t2 <= (excludeStart ? tMax : 1)) {
				var loc1 = new CurveLocation(c1, t1, null, overlap),
					loc2 = new CurveLocation(c2, t2, null, overlap);
				loc1._intersection = loc2;
				loc2._intersection = loc1;
				if (!include || include(loc1)) {
					CurveLocation.insert(locations, loc1, true);
				}
			}
		}
	}

	function addCurveIntersections(v1, v2, c1, c2, locations, include, flip,
			recursion, calls, tMin, tMax, uMin, uMax) {
		if (++calls >= 4096 || ++recursion >= 40)
			return calls;
		var fatLineEpsilon = 1e-9,
			q0x = v2[0], q0y = v2[1], q3x = v2[6], q3y = v2[7],
			getSignedDistance = Line.getSignedDistance,
			d1 = getSignedDistance(q0x, q0y, q3x, q3y, v2[2], v2[3]),
			d2 = getSignedDistance(q0x, q0y, q3x, q3y, v2[4], v2[5]),
			factor = d1 * d2 > 0 ? 3 / 4 : 4 / 9,
			dMin = factor * Math.min(0, d1, d2),
			dMax = factor * Math.max(0, d1, d2),
			dp0 = getSignedDistance(q0x, q0y, q3x, q3y, v1[0], v1[1]),
			dp1 = getSignedDistance(q0x, q0y, q3x, q3y, v1[2], v1[3]),
			dp2 = getSignedDistance(q0x, q0y, q3x, q3y, v1[4], v1[5]),
			dp3 = getSignedDistance(q0x, q0y, q3x, q3y, v1[6], v1[7]),
			hull = getConvexHull(dp0, dp1, dp2, dp3),
			top = hull[0],
			bottom = hull[1],
			tMinClip,
			tMaxClip;
		if (d1 === 0 && d2 === 0
				&& dp0 === 0 && dp1 === 0 && dp2 === 0 && dp3 === 0
			|| (tMinClip = clipConvexHull(top, bottom, dMin, dMax)) == null
			|| (tMaxClip = clipConvexHull(top.reverse(), bottom.reverse(),
				dMin, dMax)) == null)
			return calls;
		var tMinNew = tMin + (tMax - tMin) * tMinClip,
			tMaxNew = tMin + (tMax - tMin) * tMaxClip;
		if (Math.max(uMax - uMin, tMaxNew - tMinNew) < fatLineEpsilon) {
			var t = (tMinNew + tMaxNew) / 2,
				u = (uMin + uMax) / 2;
			addLocation(locations, include,
					flip ? c2 : c1, flip ? u : t,
					flip ? c1 : c2, flip ? t : u);
		} else {
			v1 = Curve.getPart(v1, tMinClip, tMaxClip);
			if (tMaxClip - tMinClip > 0.8) {
				if (tMaxNew - tMinNew > uMax - uMin) {
					var parts = Curve.subdivide(v1, 0.5),
						t = (tMinNew + tMaxNew) / 2;
					calls = addCurveIntersections(
							v2, parts[0], c2, c1, locations, include, !flip,
							recursion, calls, uMin, uMax, tMinNew, t);
					calls = addCurveIntersections(
							v2, parts[1], c2, c1, locations, include, !flip,
							recursion, calls, uMin, uMax, t, tMaxNew);
				} else {
					var parts = Curve.subdivide(v2, 0.5),
						u = (uMin + uMax) / 2;
					calls = addCurveIntersections(
							parts[0], v1, c2, c1, locations, include, !flip,
							recursion, calls, uMin, u, tMinNew, tMaxNew);
					calls = addCurveIntersections(
							parts[1], v1, c2, c1, locations, include, !flip,
							recursion, calls, u, uMax, tMinNew, tMaxNew);
				}
			} else {
				if (uMax - uMin >= fatLineEpsilon) {
					calls = addCurveIntersections(
							v2, v1, c2, c1, locations, include, !flip,
							recursion, calls, uMin, uMax, tMinNew, tMaxNew);
				} else {
					calls = addCurveIntersections(
							v1, v2, c1, c2, locations, include, flip,
							recursion, calls, tMinNew, tMaxNew, uMin, uMax);
				}
			}
		}
		return calls;
	}

	function getConvexHull(dq0, dq1, dq2, dq3) {
		var p0 = [ 0, dq0 ],
			p1 = [ 1 / 3, dq1 ],
			p2 = [ 2 / 3, dq2 ],
			p3 = [ 1, dq3 ],
			dist1 = dq1 - (2 * dq0 + dq3) / 3,
			dist2 = dq2 - (dq0 + 2 * dq3) / 3,
			hull;
		if (dist1 * dist2 < 0) {
			hull = [[p0, p1, p3], [p0, p2, p3]];
		} else {
			var distRatio = dist1 / dist2;
			hull = [
				distRatio >= 2 ? [p0, p1, p3]
				: distRatio <= 0.5 ? [p0, p2, p3]
				: [p0, p1, p2, p3],
				[p0, p3]
			];
		}
		return (dist1 || dist2) < 0 ? hull.reverse() : hull;
	}

	function clipConvexHull(hullTop, hullBottom, dMin, dMax) {
		if (hullTop[0][1] < dMin) {
			return clipConvexHullPart(hullTop, true, dMin);
		} else if (hullBottom[0][1] > dMax) {
			return clipConvexHullPart(hullBottom, false, dMax);
		} else {
			return hullTop[0][0];
		}
	}

	function clipConvexHullPart(part, top, threshold) {
		var px = part[0][0],
			py = part[0][1];
		for (var i = 1, l = part.length; i < l; i++) {
			var qx = part[i][0],
				qy = part[i][1];
			if (top ? qy >= threshold : qy <= threshold) {
				return qy === threshold ? qx
						: px + (threshold - py) * (qx - px) / (qy - py);
			}
			px = qx;
			py = qy;
		}
		return null;
	}

	function getCurveLineIntersections(v, px, py, vx, vy) {
		var isZero = Numerical.isZero;
		if (isZero(vx) && isZero(vy)) {
			var t = Curve.getTimeOf(v, new Point(px, py));
			return t === null ? [] : [t];
		}
		var angle = Math.atan2(-vy, vx),
			sin = Math.sin(angle),
			cos = Math.cos(angle),
			rv = [],
			roots = [];
		for (var i = 0; i < 8; i += 2) {
			var x = v[i] - px,
				y = v[i + 1] - py;
			rv.push(
				x * cos - y * sin,
				x * sin + y * cos);
		}
		Curve.solveCubic(rv, 1, 0, roots, 0, 1);
		return roots;
	}

	function addCurveLineIntersections(v1, v2, c1, c2, locations, include,
			flip) {
		var x1 = v2[0], y1 = v2[1],
			x2 = v2[6], y2 = v2[7],
			roots = getCurveLineIntersections(v1, x1, y1, x2 - x1, y2 - y1);
		for (var i = 0, l = roots.length; i < l; i++) {
			var t1 = roots[i],
				p1 = Curve.getPoint(v1, t1),
				t2 = Curve.getTimeOf(v2, p1);
			if (t2 !== null) {
				addLocation(locations, include,
						flip ? c2 : c1, flip ? t2 : t1,
						flip ? c1 : c2, flip ? t1 : t2);
			}
		}
	}

	function addLineIntersection(v1, v2, c1, c2, locations, include) {
		var pt = Line.intersect(
				v1[0], v1[1], v1[6], v1[7],
				v2[0], v2[1], v2[6], v2[7]);
		if (pt) {
			addLocation(locations, include,
					c1, Curve.getTimeOf(v1, pt),
					c2, Curve.getTimeOf(v2, pt));
		}
	}

	function getCurveIntersections(v1, v2, c1, c2, locations, include) {
		var epsilon = 1e-12,
			min = Math.min,
			max = Math.max;

		if (max(v1[0], v1[2], v1[4], v1[6]) + epsilon >
			min(v2[0], v2[2], v2[4], v2[6]) &&
			min(v1[0], v1[2], v1[4], v1[6]) - epsilon <
			max(v2[0], v2[2], v2[4], v2[6]) &&
			max(v1[1], v1[3], v1[5], v1[7]) + epsilon >
			min(v2[1], v2[3], v2[5], v2[7]) &&
			min(v1[1], v1[3], v1[5], v1[7]) - epsilon <
			max(v2[1], v2[3], v2[5], v2[7])) {
			var overlaps = getOverlaps(v1, v2);
			if (overlaps) {
				for (var i = 0; i < 2; i++) {
					var overlap = overlaps[i];
					addLocation(locations, include,
							c1, overlap[0],
							c2, overlap[1], true);
				}
			} else {
				var straight1 = Curve.isStraight(v1),
					straight2 = Curve.isStraight(v2),
					straight = straight1 && straight2,
					flip = straight1 && !straight2,
					before = locations.length;
				(straight
					? addLineIntersection
					: straight1 || straight2
						? addCurveLineIntersections
						: addCurveIntersections)(
							flip ? v2 : v1, flip ? v1 : v2,
							flip ? c2 : c1, flip ? c1 : c2,
							locations, include, flip,
							0, 0, 0, 1, 0, 1);
				if (!straight || locations.length === before) {
					for (var i = 0; i < 4; i++) {
						var t1 = i >> 1,
							t2 = i & 1,
							i1 = t1 * 6,
							i2 = t2 * 6,
							p1 = new Point(v1[i1], v1[i1 + 1]),
							p2 = new Point(v2[i2], v2[i2 + 1]);
						if (p1.isClose(p2, epsilon)) {
							addLocation(locations, include,
									c1, t1,
									c2, t2);
						}
					}
				}
			}
		}
		return locations;
	}

	function getLoopIntersection(v1, c1, locations, include) {
		var info = Curve.classify(v1);
		if (info.type === 'loop') {
			var roots = info.roots;
			addLocation(locations, include,
					c1, roots[0],
					c1, roots[1]);
		}
	  return locations;
	}

	function getIntersections(curves1, curves2, include, matrix1, matrix2,
			_returnFirst) {
		var self = !curves2;
		if (self)
			curves2 = curves1;
		var length1 = curves1.length,
			length2 = curves2.length,
			values2 = [],
			arrays = [],
			locations,
			current;
		for (var i = 0; i < length2; i++)
			values2[i] = curves2[i].getValues(matrix2);
		for (var i = 0; i < length1; i++) {
			var curve1 = curves1[i],
				values1 = self ? values2[i] : curve1.getValues(matrix1),
				path1 = curve1.getPath();
			if (path1 !== current) {
				current = path1;
				locations = [];
				arrays.push(locations);
			}
			if (self) {
				getLoopIntersection(values1, curve1, locations, include);
			}
			for (var j = self ? i + 1 : 0; j < length2; j++) {
				if (_returnFirst && locations.length)
					return locations;
				getCurveIntersections(values1, values2[j], curve1, curves2[j],
						locations, include);
			}
		}
		locations = [];
		for (var i = 0, l = arrays.length; i < l; i++) {
			locations.push.apply(locations, arrays[i]);
		}
		return locations;
	}

	function getOverlaps(v1, v2) {

		function getSquaredLineLength(v) {
			var x = v[6] - v[0],
				y = v[7] - v[1];
			return x * x + y * y;
		}

		var abs = Math.abs,
			getDistance = Line.getDistance,
			timeEpsilon = 1e-8,
			geomEpsilon = 1e-7,
			straight1 = Curve.isStraight(v1),
			straight2 = Curve.isStraight(v2),
			straightBoth = straight1 && straight2,
			flip = getSquaredLineLength(v1) < getSquaredLineLength(v2),
			l1 = flip ? v2 : v1,
			l2 = flip ? v1 : v2,
			px = l1[0], py = l1[1],
			vx = l1[6] - px, vy = l1[7] - py;
		if (getDistance(px, py, vx, vy, l2[0], l2[1], true) < geomEpsilon &&
			getDistance(px, py, vx, vy, l2[6], l2[7], true) < geomEpsilon) {
			if (!straightBoth &&
				getDistance(px, py, vx, vy, l1[2], l1[3], true) < geomEpsilon &&
				getDistance(px, py, vx, vy, l1[4], l1[5], true) < geomEpsilon &&
				getDistance(px, py, vx, vy, l2[2], l2[3], true) < geomEpsilon &&
				getDistance(px, py, vx, vy, l2[4], l2[5], true) < geomEpsilon) {
				straight1 = straight2 = straightBoth = true;
			}
		} else if (straightBoth) {
			return null;
		}
		if (straight1 ^ straight2) {
			return null;
		}

		var v = [v1, v2],
			pairs = [];
		for (var i = 0; i < 4 && pairs.length < 2; i++) {
			var i1 = i & 1,
				i2 = i1 ^ 1,
				t1 = i >> 1,
				t2 = Curve.getTimeOf(v[i1], new Point(
					v[i2][t1 ? 6 : 0],
					v[i2][t1 ? 7 : 1]));
			if (t2 != null) {
				var pair = i1 ? [t1, t2] : [t2, t1];
				if (!pairs.length ||
					abs(pair[0] - pairs[0][0]) > timeEpsilon &&
					abs(pair[1] - pairs[0][1]) > timeEpsilon) {
					pairs.push(pair);
				}
			}
			if (i > 2 && !pairs.length)
				break;
		}
		if (pairs.length !== 2) {
			pairs = null;
		} else if (!straightBoth) {
			var o1 = Curve.getPart(v1, pairs[0][0], pairs[1][0]),
				o2 = Curve.getPart(v2, pairs[0][1], pairs[1][1]);
			if (abs(o2[2] - o1[2]) > geomEpsilon ||
				abs(o2[3] - o1[3]) > geomEpsilon ||
				abs(o2[4] - o1[4]) > geomEpsilon ||
				abs(o2[5] - o1[5]) > geomEpsilon)
				pairs = null;
		}
		return pairs;
	}

	return {
		getIntersections: function(curve) {
			var v1 = this.getValues(),
				v2 = curve && curve !== this && curve.getValues();
			return v2 ? getCurveIntersections(v1, v2, this, curve, [])
					  : getLoopIntersection(v1, this, []);
		},

		statics: {
			getOverlaps: getOverlaps,
			getIntersections: getIntersections,
			getCurveLineIntersections: getCurveLineIntersections
		}
	};
});

var CurveLocation = Base.extend({
	_class: 'CurveLocation',

	initialize: function CurveLocation(curve, time, point, _overlap, _distance) {
		if (time >= 0.99999999) {
			var next = curve.getNext();
			if (next) {
				time = 0;
				curve = next;
			}
		}
		this._setCurve(curve);
		this._time = time;
		this._point = point || curve.getPointAtTime(time);
		this._overlap = _overlap;
		this._distance = _distance;
		this._intersection = this._next = this._previous = null;
	},

	_setCurve: function(curve) {
		var path = curve._path;
		this._path = path;
		this._version = path ? path._version : 0;
		this._curve = curve;
		this._segment = null;
		this._segment1 = curve._segment1;
		this._segment2 = curve._segment2;
	},

	_setSegment: function(segment) {
		this._setCurve(segment.getCurve());
		this._segment = segment;
		this._time = segment === this._segment1 ? 0 : 1;
		this._point = segment._point.clone();
	},

	getSegment: function() {
		var segment = this._segment;
		if (!segment) {
			var curve = this.getCurve(),
				time = this.getTime();
			if (time === 0) {
				segment = curve._segment1;
			} else if (time === 1) {
				segment = curve._segment2;
			} else if (time != null) {
				segment = curve.getPartLength(0, time)
					< curve.getPartLength(time, 1)
						? curve._segment1
						: curve._segment2;
			}
			this._segment = segment;
		}
		return segment;
	},

	getCurve: function() {
		var path = this._path,
			that = this;
		if (path && path._version !== this._version) {
			this._time = this._offset = this._curveOffset = this._curve = null;
		}

		function trySegment(segment) {
			var curve = segment && segment.getCurve();
			if (curve && (that._time = curve.getTimeOf(that._point)) != null) {
				that._setCurve(curve);
				return curve;
			}
		}

		return this._curve
			|| trySegment(this._segment)
			|| trySegment(this._segment1)
			|| trySegment(this._segment2.getPrevious());
	},

	getPath: function() {
		var curve = this.getCurve();
		return curve && curve._path;
	},

	getIndex: function() {
		var curve = this.getCurve();
		return curve && curve.getIndex();
	},

	getTime: function() {
		var curve = this.getCurve(),
			time = this._time;
		return curve && time == null
			? this._time = curve.getTimeOf(this._point)
			: time;
	},

	getParameter: '#getTime',

	getPoint: function() {
		return this._point;
	},

	getOffset: function() {
		var offset = this._offset;
		if (offset == null) {
			offset = 0;
			var path = this.getPath(),
				index = this.getIndex();
			if (path && index != null) {
				var curves = path.getCurves();
				for (var i = 0; i < index; i++)
					offset += curves[i].getLength();
			}
			this._offset = offset += this.getCurveOffset();
		}
		return offset;
	},

	getCurveOffset: function() {
		var offset = this._curveOffset;
		if (offset == null) {
			var curve = this.getCurve(),
				time = this.getTime();
			this._curveOffset = offset = time != null && curve
					&& curve.getPartLength(0, time);
		}
		return offset;
	},

	getIntersection: function() {
		return this._intersection;
	},

	getDistance: function() {
		return this._distance;
	},

	divide: function() {
		var curve = this.getCurve(),
			res = curve && curve.divideAtTime(this.getTime());
		if (res) {
			this._setSegment(res._segment1);
		}
		return res;
	},

	split: function() {
		var curve = this.getCurve(),
			path = curve._path,
			res = curve && curve.splitAtTime(this.getTime());
		if (res) {
			this._setSegment(path.getLastSegment());
		}
		return  res;
	},

	equals: function(loc, _ignoreOther) {
		var res = this === loc;
		if (!res && loc instanceof CurveLocation) {
			var c1 = this.getCurve(),
				c2 = loc.getCurve(),
				p1 = c1._path,
				p2 = c2._path;
			if (p1 === p2) {
				var abs = Math.abs,
					epsilon = 1e-7,
					diff = abs(this.getOffset() - loc.getOffset()),
					i1 = !_ignoreOther && this._intersection,
					i2 = !_ignoreOther && loc._intersection;
				res = (diff < epsilon
						|| p1 && abs(p1.getLength() - diff) < epsilon)
					&& (!i1 && !i2 || i1 && i2 && i1.equals(i2, true));
			}
		}
		return res;
	},

	toString: function() {
		var parts = [],
			point = this.getPoint(),
			f = Formatter.instance;
		if (point)
			parts.push('point: ' + point);
		var index = this.getIndex();
		if (index != null)
			parts.push('index: ' + index);
		var time = this.getTime();
		if (time != null)
			parts.push('time: ' + f.number(time));
		if (this._distance != null)
			parts.push('distance: ' + f.number(this._distance));
		return '{ ' + parts.join(', ') + ' }';
	},

	isTouching: function() {
		var inter = this._intersection;
		if (inter && this.getTangent().isCollinear(inter.getTangent())) {
			var curve1 = this.getCurve(),
				curve2 = inter.getCurve();
			return !(curve1.isStraight() && curve2.isStraight()
					&& curve1.getLine().intersect(curve2.getLine()));
		}
		return false;
	},

	isCrossing: function() {
		var inter = this._intersection;
		if (!inter)
			return false;
		var t1 = this.getTime(),
			t2 = inter.getTime(),
			tMin = 1e-8,
			tMax = 1 - tMin,
			t1Inside = t1 >= tMin && t1 <= tMax,
			t2Inside = t2 >= tMin && t2 <= tMax;
		if (t1Inside && t2Inside)
			return !this.isTouching();
		var c2 = this.getCurve(),
			c1 = t1 < tMin ? c2.getPrevious() : c2,
			c4 = inter.getCurve(),
			c3 = t2 < tMin ? c4.getPrevious() : c4;
		if (t1 > tMax)
			c2 = c2.getNext();
		if (t2 > tMax)
			c4 = c4.getNext();
		if (!c1 || !c2 || !c3 || !c4)
			return false;

		var offsets = [];

		function addOffsets(curve, end) {
			var v = curve.getValues(),
				roots = Curve.classify(v).roots || Curve.getPeaks(v),
				count = roots.length,
				t = end && count > 1 ? roots[count - 1]
						: count > 0 ? roots[0]
						: 0.5;
			offsets.push(Curve.getLength(v, end ? t : 0, end ? 1 : t) / 2);
		}

		function isInRange(angle, min, max) {
			return min < max
					? angle > min && angle < max
					: angle > min || angle < max;
		}

		if (!t1Inside) {
			addOffsets(c1, true);
			addOffsets(c2, false);
		}
		if (!t2Inside) {
			addOffsets(c3, true);
			addOffsets(c4, false);
		}
		var pt = this.getPoint(),
			offset = Math.min.apply(Math, offsets),
			v2 = t1Inside ? c2.getTangentAtTime(t1)
					: c2.getPointAt(offset).subtract(pt),
			v1 = t1Inside ? v2.negate()
					: c1.getPointAt(-offset).subtract(pt),
			v4 = t2Inside ? c4.getTangentAtTime(t2)
					: c4.getPointAt(offset).subtract(pt),
			v3 = t2Inside ? v4.negate()
					: c3.getPointAt(-offset).subtract(pt),
			a1 = v1.getAngle(),
			a2 = v2.getAngle(),
			a3 = v3.getAngle(),
			a4 = v4.getAngle();
		return !!(t1Inside
				? (isInRange(a1, a3, a4) ^ isInRange(a2, a3, a4)) &&
				  (isInRange(a1, a4, a3) ^ isInRange(a2, a4, a3))
				: (isInRange(a3, a1, a2) ^ isInRange(a4, a1, a2)) &&
				  (isInRange(a3, a2, a1) ^ isInRange(a4, a2, a1)));
	},

	hasOverlap: function() {
		return !!this._overlap;
	}
}, Base.each(Curve._evaluateMethods, function(name) {
	var get = name + 'At';
	this[name] = function() {
		var curve = this.getCurve(),
			time = this.getTime();
		return time != null && curve && curve[get](time, true);
	};
}, {
	preserve: true
}),
new function() {

	function insert(locations, loc, merge) {
		var length = locations.length,
			l = 0,
			r = length - 1;

		function search(index, dir) {
			for (var i = index + dir; i >= -1 && i <= length; i += dir) {
				var loc2 = locations[((i % length) + length) % length];
				if (!loc.getPoint().isClose(loc2.getPoint(),
						1e-7))
					break;
				if (loc.equals(loc2))
					return loc2;
			}
			return null;
		}

		while (l <= r) {
			var m = (l + r) >>> 1,
				loc2 = locations[m],
				found;
			if (merge && (found = loc.equals(loc2) ? loc2
					: (search(m, -1) || search(m, 1)))) {
				if (loc._overlap) {
					found._overlap = found._intersection._overlap = true;
				}
				return found;
			}
		var path1 = loc.getPath(),
			path2 = loc2.getPath(),
			diff = path1 !== path2
				? path1._id - path2._id
				: (loc.getIndex() + loc.getTime())
				- (loc2.getIndex() + loc2.getTime());
			if (diff < 0) {
				r = m - 1;
			} else {
				l = m + 1;
			}
		}
		locations.splice(l, 0, loc);
		return loc;
	}

	return { statics: {
		insert: insert,

		expand: function(locations) {
			var expanded = locations.slice();
			for (var i = locations.length - 1; i >= 0; i--) {
				insert(expanded, locations[i]._intersection, false);
			}
			return expanded;
		}
	}};
});

var PathItem = Item.extend({
	_class: 'PathItem',
	_selectBounds: false,
	_canScaleStroke: true,
	beans: true,

	initialize: function PathItem() {
	},

	statics: {
		create: function(arg) {
			var data,
				segments,
				compound;
			if (Base.isPlainObject(arg)) {
				segments = arg.segments;
				data = arg.pathData;
			} else if (Array.isArray(arg)) {
				segments = arg;
			} else if (typeof arg === 'string') {
				data = arg;
			}
			if (segments) {
				var first = segments[0];
				compound = first && Array.isArray(first[0]);
			} else if (data) {
				compound = (data.match(/m/gi) || []).length > 1
						|| /z\s*\S+/i.test(data);
			}
			var ctor = compound ? CompoundPath : Path;
			return new ctor(arg);
		}
	},

	_asPathItem: function() {
		return this;
	},

	isClockwise: function() {
		return this.getArea() >= 0;
	},

	setClockwise: function(clockwise) {
		if (this.isClockwise() != (clockwise = !!clockwise))
			this.reverse();
	},

	setPathData: function(data) {

		var parts = data && data.match(/[mlhvcsqtaz][^mlhvcsqtaz]*/ig),
			coords,
			relative = false,
			previous,
			control,
			current = new Point(),
			start = new Point();

		function getCoord(index, coord) {
			var val = +coords[index];
			if (relative)
				val += current[coord];
			return val;
		}

		function getPoint(index) {
			return new Point(
				getCoord(index, 'x'),
				getCoord(index + 1, 'y')
			);
		}

		this.clear();

		for (var i = 0, l = parts && parts.length; i < l; i++) {
			var part = parts[i],
				command = part[0],
				lower = command.toLowerCase();
			coords = part.match(/[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g);
			var length = coords && coords.length;
			relative = command === lower;
			if (previous === 'z' && !/[mz]/.test(lower))
				this.moveTo(current);
			switch (lower) {
			case 'm':
			case 'l':
				var move = lower === 'm';
				for (var j = 0; j < length; j += 2) {
					this[move ? 'moveTo' : 'lineTo'](current = getPoint(j));
					if (move) {
						start = current;
						move = false;
					}
				}
				control = current;
				break;
			case 'h':
			case 'v':
				var coord = lower === 'h' ? 'x' : 'y';
				current = current.clone();
				for (var j = 0; j < length; j++) {
					current[coord] = getCoord(j, coord);
					this.lineTo(current);
				}
				control = current;
				break;
			case 'c':
				for (var j = 0; j < length; j += 6) {
					this.cubicCurveTo(
							getPoint(j),
							control = getPoint(j + 2),
							current = getPoint(j + 4));
				}
				break;
			case 's':
				for (var j = 0; j < length; j += 4) {
					this.cubicCurveTo(
							/[cs]/.test(previous)
									? current.multiply(2).subtract(control)
									: current,
							control = getPoint(j),
							current = getPoint(j + 2));
					previous = lower;
				}
				break;
			case 'q':
				for (var j = 0; j < length; j += 4) {
					this.quadraticCurveTo(
							control = getPoint(j),
							current = getPoint(j + 2));
				}
				break;
			case 't':
				for (var j = 0; j < length; j += 2) {
					this.quadraticCurveTo(
							control = (/[qt]/.test(previous)
									? current.multiply(2).subtract(control)
									: current),
							current = getPoint(j));
					previous = lower;
				}
				break;
			case 'a':
				for (var j = 0; j < length; j += 7) {
					this.arcTo(current = getPoint(j + 5),
							new Size(+coords[j], +coords[j + 1]),
							+coords[j + 2], +coords[j + 4], +coords[j + 3]);
				}
				break;
			case 'z':
				this.closePath(1e-12);
				current = start;
				break;
			}
			previous = lower;
		}
	},

	_canComposite: function() {
		return !(this.hasFill() && this.hasStroke());
	},

	_contains: function(point) {
		var winding = point.isInside(
				this.getBounds({ internal: true, handle: true }))
					? this._getWinding(point)
					: {};
		return winding.onPath || !!(this.getFillRule() === 'evenodd'
				? winding.windingL & 1 || winding.windingR & 1
				: winding.winding);
	},

	getIntersections: function(path, include, _matrix, _returnFirst) {
		var self = this === path || !path,
			matrix1 = this._matrix._orNullIfIdentity(),
			matrix2 = self ? matrix1
				: (_matrix || path._matrix)._orNullIfIdentity();
		return self || this.getBounds(matrix1).intersects(
				path.getBounds(matrix2), 1e-12)
				? Curve.getIntersections(
						this.getCurves(), !self && path.getCurves(), include,
						matrix1, matrix2, _returnFirst)
				: [];
	},

	getCrossings: function(path) {
		return this.getIntersections(path, function(inter) {
			return inter.hasOverlap() || inter.isCrossing();
		});
	},

	getNearestLocation: function() {
		var point = Point.read(arguments),
			curves = this.getCurves(),
			minDist = Infinity,
			minLoc = null;
		for (var i = 0, l = curves.length; i < l; i++) {
			var loc = curves[i].getNearestLocation(point);
			if (loc._distance < minDist) {
				minDist = loc._distance;
				minLoc = loc;
			}
		}
		return minLoc;
	},

	getNearestPoint: function() {
		var loc = this.getNearestLocation.apply(this, arguments);
		return loc ? loc.getPoint() : loc;
	},

	interpolate: function(from, to, factor) {
		var isPath = !this._children,
			name = isPath ? '_segments' : '_children',
			itemsFrom = from[name],
			itemsTo = to[name],
			items = this[name];
		if (!itemsFrom || !itemsTo || itemsFrom.length !== itemsTo.length) {
			throw new Error('Invalid operands in interpolate() call: ' +
					from + ', ' + to);
		}
		var current = items.length,
			length = itemsTo.length;
		if (current < length) {
			var ctor = isPath ? Segment : Path;
			for (var i = current; i < length; i++) {
				this.add(new ctor());
			}
		} else if (current > length) {
			this[isPath ? 'removeSegments' : 'removeChildren'](length, current);
		}
		for (var i = 0; i < length; i++) {
			items[i].interpolate(itemsFrom[i], itemsTo[i], factor);
		}
		if (isPath) {
			this.setClosed(from._closed);
			this._changed(9);
		}
	},

	compare: function(path) {
		var ok = false;
		if (path) {
			var paths1 = this._children || [this],
				paths2 = path._children ? path._children.slice() : [path],
				length1 = paths1.length,
				length2 = paths2.length,
				matched = [],
				count = 0;
			ok = true;
			for (var i1 = length1 - 1; i1 >= 0 && ok; i1--) {
				var path1 = paths1[i1];
				ok = false;
				for (var i2 = length2 - 1; i2 >= 0 && !ok; i2--) {
					if (path1.compare(paths2[i2])) {
						if (!matched[i2]) {
							matched[i2] = true;
							count++;
						}
						ok = true;
					}
				}
			}
			ok = ok && count === length2;
		}
		return ok;
	},

});

var Path = PathItem.extend({
	_class: 'Path',
	_serializeFields: {
		segments: [],
		closed: false
	},

	initialize: function Path(arg) {
		this._closed = false;
		this._segments = [];
		this._version = 0;
		var segments = Array.isArray(arg)
			? typeof arg[0] === 'object'
				? arg
				: arguments
			: arg && (arg.size === undefined && (arg.x !== undefined
					|| arg.point !== undefined))
				? arguments
				: null;
		if (segments && segments.length > 0) {
			this.setSegments(segments);
		} else {
			this._curves = undefined;
			this._segmentSelection = 0;
			if (!segments && typeof arg === 'string') {
				this.setPathData(arg);
				arg = null;
			}
		}
		this._initialize(!segments && arg);
	},

	_equals: function(item) {
		return this._closed === item._closed
				&& Base.equals(this._segments, item._segments);
	},

	copyContent: function(source) {
		this.setSegments(source._segments);
		this._closed = source._closed;
	},

	_changed: function _changed(flags) {
		_changed.base.call(this, flags);
		if (flags & 8) {
			this._length = this._area = undefined;
			if (flags & 16) {
				this._version++;
			} else if (this._curves) {
			   for (var i = 0, l = this._curves.length; i < l; i++)
					this._curves[i]._changed();
			}
		} else if (flags & 32) {
			this._bounds = undefined;
		}
	},

	getStyle: function() {
		var parent = this._parent;
		return (parent instanceof CompoundPath ? parent : this)._style;
	},

	getSegments: function() {
		return this._segments;
	},

	setSegments: function(segments) {
		var fullySelected = this.isFullySelected(),
			length = segments && segments.length;
		this._segments.length = 0;
		this._segmentSelection = 0;
		this._curves = undefined;
		if (length) {
			var last = segments[length - 1];
			if (typeof last === 'boolean') {
				this.setClosed(last);
				length--;
			}
			this._add(Segment.readList(segments, 0, {}, length));
		}
		if (fullySelected)
			this.setFullySelected(true);
	},

	getFirstSegment: function() {
		return this._segments[0];
	},

	getLastSegment: function() {
		return this._segments[this._segments.length - 1];
	},

	getCurves: function() {
		var curves = this._curves,
			segments = this._segments;
		if (!curves) {
			var length = this._countCurves();
			curves = this._curves = new Array(length);
			for (var i = 0; i < length; i++)
				curves[i] = new Curve(this, segments[i],
					segments[i + 1] || segments[0]);
		}
		return curves;
	},

	getFirstCurve: function() {
		return this.getCurves()[0];
	},

	getLastCurve: function() {
		var curves = this.getCurves();
		return curves[curves.length - 1];
	},

	isClosed: function() {
		return this._closed;
	},

	setClosed: function(closed) {
		if (this._closed != (closed = !!closed)) {
			this._closed = closed;
			if (this._curves) {
				var length = this._curves.length = this._countCurves();
				if (closed)
					this._curves[length - 1] = new Curve(this,
						this._segments[length - 1], this._segments[0]);
			}
			this._changed(25);
		}
	}
}, {
	beans: true,

	getPathData: function(_matrix, _precision) {
		var segments = this._segments,
			length = segments.length,
			f = new Formatter(_precision),
			coords = new Array(6),
			first = true,
			curX, curY,
			prevX, prevY,
			inX, inY,
			outX, outY,
			parts = [];

		function addSegment(segment, skipLine) {
			segment._transformCoordinates(_matrix, coords);
			curX = coords[0];
			curY = coords[1];
			if (first) {
				parts.push('M' + f.pair(curX, curY));
				first = false;
			} else {
				inX = coords[2];
				inY = coords[3];
				if (inX === curX && inY === curY
						&& outX === prevX && outY === prevY) {
					if (!skipLine) {
						var dx = curX - prevX,
							dy = curY - prevY;
						parts.push(
							  dx === 0 ? 'v' + f.number(dy)
							: dy === 0 ? 'h' + f.number(dx)
							: 'l' + f.pair(dx, dy));
					}
				} else {
					parts.push('c' + f.pair(outX - prevX, outY - prevY)
							 + ' ' + f.pair( inX - prevX,  inY - prevY)
							 + ' ' + f.pair(curX - prevX, curY - prevY));
				}
			}
			prevX = curX;
			prevY = curY;
			outX = coords[4];
			outY = coords[5];
		}

		if (!length)
			return '';

		for (var i = 0; i < length; i++)
			addSegment(segments[i]);
		if (this._closed && length > 0) {
			addSegment(segments[0], true);
			parts.push('z');
		}
		return parts.join('');
	},

	isEmpty: function() {
		return !this._segments.length;
	},

	_transformContent: function(matrix) {
		var segments = this._segments,
			coords = new Array(6);
		for (var i = 0, l = segments.length; i < l; i++)
			segments[i]._transformCoordinates(matrix, coords, true);
		return true;
	},

	_add: function(segs, index) {
		var segments = this._segments,
			curves = this._curves,
			amount = segs.length,
			append = index == null,
			index = append ? segments.length : index;
		for (var i = 0; i < amount; i++) {
			var segment = segs[i];
			if (segment._path)
				segment = segs[i] = segment.clone();
			segment._path = this;
			segment._index = index + i;
			if (segment._selection)
				this._updateSelection(segment, 0, segment._selection);
		}
		if (append) {
			segments.push.apply(segments, segs);
		} else {
			segments.splice.apply(segments, [index, 0].concat(segs));
			for (var i = index + amount, l = segments.length; i < l; i++)
				segments[i]._index = i;
		}
		if (curves) {
			var total = this._countCurves(),
				start = index > 0 && index + amount - 1 === total ? index - 1
					: index,
				insert = start,
				end = Math.min(start + amount, total);
			if (segs._curves) {
				curves.splice.apply(curves, [start, 0].concat(segs._curves));
				insert += segs._curves.length;
			}
			for (var i = insert; i < end; i++)
				curves.splice(i, 0, new Curve(this, null, null));
			this._adjustCurves(start, end);
		}
		this._changed(25);
		return segs;
	},

	_adjustCurves: function(start, end) {
		var segments = this._segments,
			curves = this._curves,
			curve;
		for (var i = start; i < end; i++) {
			curve = curves[i];
			curve._path = this;
			curve._segment1 = segments[i];
			curve._segment2 = segments[i + 1] || segments[0];
			curve._changed();
		}
		if (curve = curves[this._closed && !start ? segments.length - 1
				: start - 1]) {
			curve._segment2 = segments[start] || segments[0];
			curve._changed();
		}
		if (curve = curves[end]) {
			curve._segment1 = segments[end];
			curve._changed();
		}
	},

	_countCurves: function() {
		var length = this._segments.length;
		return !this._closed && length > 0 ? length - 1 : length;
	},

	add: function(segment1 ) {
		return arguments.length > 1 && typeof segment1 !== 'number'
			? this._add(Segment.readList(arguments))
			: this._add([ Segment.read(arguments) ])[0];
	},

	insert: function(index, segment1 ) {
		return arguments.length > 2 && typeof segment1 !== 'number'
			? this._add(Segment.readList(arguments, 1), index)
			: this._add([ Segment.read(arguments, 1) ], index)[0];
	},

	addSegment: function() {
		return this._add([ Segment.read(arguments) ])[0];
	},

	insertSegment: function(index ) {
		return this._add([ Segment.read(arguments, 1) ], index)[0];
	},

	addSegments: function(segments) {
		return this._add(Segment.readList(segments));
	},

	insertSegments: function(index, segments) {
		return this._add(Segment.readList(segments), index);
	},

	removeSegment: function(index) {
		return this.removeSegments(index, index + 1)[0] || null;
	},

	removeSegments: function(start, end, _includeCurves) {
		start = start || 0;
		end = Base.pick(end, this._segments.length);
		var segments = this._segments,
			curves = this._curves,
			count = segments.length,
			removed = segments.splice(start, end - start),
			amount = removed.length;
		if (!amount)
			return removed;
		for (var i = 0; i < amount; i++) {
			var segment = removed[i];
			if (segment._selection)
				this._updateSelection(segment, segment._selection, 0);
			segment._index = segment._path = null;
		}
		for (var i = start, l = segments.length; i < l; i++)
			segments[i]._index = i;
		if (curves) {
			var index = start > 0 && end === count + (this._closed ? 1 : 0)
					? start - 1
					: start,
				curves = curves.splice(index, amount);
			for (var i = curves.length - 1; i >= 0; i--)
				curves[i]._path = null;
			if (_includeCurves)
				removed._curves = curves.slice(1);
			this._adjustCurves(index, index);
		}
		this._changed(25);
		return removed;
	},

	clear: '#removeSegments',

	hasHandles: function() {
		var segments = this._segments;
		for (var i = 0, l = segments.length; i < l; i++) {
			if (segments[i].hasHandles())
				return true;
		}
		return false;
	},

	clearHandles: function() {
		var segments = this._segments;
		for (var i = 0, l = segments.length; i < l; i++)
			segments[i].clearHandles();
	},

	getLength: function() {
		if (this._length == null) {
			var curves = this.getCurves(),
				length = 0;
			for (var i = 0, l = curves.length; i < l; i++)
				length += curves[i].getLength();
			this._length = length;
		}
		return this._length;
	},

	getArea: function() {
		var area = this._area;
		if (area == null) {
			var segments = this._segments,
				closed = this._closed;
			area = 0;
			for (var i = 0, l = segments.length; i < l; i++) {
				var last = i + 1 === l;
				area += Curve.getArea(Curve.getValues(
						segments[i], segments[last ? 0 : i + 1],
						null, last && !closed));
			}
			this._area = area;
		}
		return area;
	},

	isFullySelected: function() {
		var length = this._segments.length;
		return this.isSelected() && length > 0 && this._segmentSelection
				=== length * 7;
	},

	setFullySelected: function(selected) {
		if (selected)
			this._selectSegments(true);
		this.setSelected(selected);
	},

	setSelection: function setSelection(selection) {
		if (!(selection & 1))
			this._selectSegments(false);
		setSelection.base.call(this, selection);
	},

	_selectSegments: function(selected) {
		var segments = this._segments,
			length = segments.length,
			selection = selected ? 7 : 0;
		this._segmentSelection = selection * length;
		for (var i = 0; i < length; i++)
			segments[i]._selection = selection;
	},

	_updateSelection: function(segment, oldSelection, newSelection) {
		segment._selection = newSelection;
		var selection = this._segmentSelection += newSelection - oldSelection;
		if (selection > 0)
			this.setSelected(true);
	},

	divideAt: function(location) {
		var loc = this.getLocationAt(location),
			curve;
		return loc && (curve = loc.getCurve().divideAt(loc.getCurveOffset()))
				? curve._segment1
				: null;
	},

	splitAt: function(location) {
		var loc = this.getLocationAt(location),
			index = loc && loc.index,
			time = loc && loc.time,
			tMin = 1e-8,
			tMax = 1 - tMin;
		if (time > tMax) {
			index++;
			time = 0;
		}
		var curves = this.getCurves();
		if (index >= 0 && index < curves.length) {
			if (time >= tMin) {
				curves[index++].divideAtTime(time);
			}
			var segs = this.removeSegments(index, this._segments.length, true),
				path;
			if (this._closed) {
				this.setClosed(false);
				path = this;
			} else {
				path = new Path(Item.NO_INSERT);
				path.insertAbove(this);
				path.copyAttributes(this);
			}
			path._add(segs, 0);
			this.addSegment(segs[0]);
			return path;
		}
		return null;
	},

	split: function(index, time) {
		var curve,
			location = time === undefined ? index
				: (curve = this.getCurves()[index])
					&& curve.getLocationAtTime(time);
		return location != null ? this.splitAt(location) : null;
	},

	join: function(path, tolerance) {
		var epsilon = tolerance || 0;
		if (path && path !== this) {
			var segments = path._segments,
				last1 = this.getLastSegment(),
				last2 = path.getLastSegment();
			if (!last2)
				return this;
			if (last1 && last1._point.isClose(last2._point, epsilon))
				path.reverse();
			var first2 = path.getFirstSegment();
			if (last1 && last1._point.isClose(first2._point, epsilon)) {
				last1.setHandleOut(first2._handleOut);
				this._add(segments.slice(1));
			} else {
				var first1 = this.getFirstSegment();
				if (first1 && first1._point.isClose(first2._point, epsilon))
					path.reverse();
				last2 = path.getLastSegment();
				if (first1 && first1._point.isClose(last2._point, epsilon)) {
					first1.setHandleIn(last2._handleIn);
					this._add(segments.slice(0, segments.length - 1), 0);
				} else {
					this._add(segments.slice());
				}
			}
			if (path._closed)
				this._add([segments[0]]);
			path.remove();
		}
		var first = this.getFirstSegment(),
			last = this.getLastSegment();
		if (first !== last && first._point.isClose(last._point, epsilon)) {
			first.setHandleIn(last._handleIn);
			last.remove();
			this.setClosed(true);
		}
		return this;
	},

	reduce: function(options) {
		var curves = this.getCurves(),
			simplify = options && options.simplify,
			tolerance = simplify ? 1e-7 : 0;
		for (var i = curves.length - 1; i >= 0; i--) {
			var curve = curves[i];
			if (!curve.hasHandles() && (!curve.hasLength(tolerance)
					|| simplify && curve.isCollinear(curve.getNext())))
				curve.remove();
		}
		return this;
	},

	reverse: function() {
		this._segments.reverse();
		for (var i = 0, l = this._segments.length; i < l; i++) {
			var segment = this._segments[i];
			var handleIn = segment._handleIn;
			segment._handleIn = segment._handleOut;
			segment._handleOut = handleIn;
			segment._index = i;
		}
		this._curves = null;
		this._changed(9);
	},

	flatten: function(flatness) {
		var flattener = new PathFlattener(this, flatness || 0.25, 256, true),
			parts = flattener.parts,
			length = parts.length,
			segments = [];
		for (var i = 0; i < length; i++) {
			segments.push(new Segment(parts[i].curve.slice(0, 2)));
		}
		if (!this._closed && length > 0) {
			segments.push(new Segment(parts[length - 1].curve.slice(6)));
		}
		this.setSegments(segments);
	},

	simplify: function(tolerance) {
		var segments = new PathFitter(this).fit(tolerance || 2.5);
		if (segments)
			this.setSegments(segments);
		return !!segments;
	},

	smooth: function(options) {
		var that = this,
			opts = options || {},
			type = opts.type || 'asymmetric',
			segments = this._segments,
			length = segments.length,
			closed = this._closed;

		function getIndex(value, _default) {
			var index = value && value.index;
			if (index != null) {
				var path = value.path;
				if (path && path !== that)
					throw new Error(value._class + ' ' + index + ' of ' + path
							+ ' is not part of ' + that);
				if (_default && value instanceof Curve)
					index++;
			} else {
				index = typeof value === 'number' ? value : _default;
			}
			return Math.min(index < 0 && closed
					? index % length
					: index < 0 ? index + length : index, length - 1);
		}

		var loop = closed && opts.from === undefined && opts.to === undefined,
			from = getIndex(opts.from, 0),
			to = getIndex(opts.to, length - 1);

		if (from > to) {
			if (closed) {
				from -= length;
			} else {
				var tmp = from;
				from = to;
				to = tmp;
			}
		}
		if (/^(?:asymmetric|continuous)$/.test(type)) {
			var asymmetric = type === 'asymmetric',
				min = Math.min,
				amount = to - from + 1,
				n = amount - 1,
				padding = loop ? min(amount, 4) : 1,
				paddingLeft = padding,
				paddingRight = padding,
				knots = [];
			if (!closed) {
				paddingLeft = min(1, from);
				paddingRight = min(1, length - to - 1);
			}
			n += paddingLeft + paddingRight;
			if (n <= 1)
				return;
			for (var i = 0, j = from - paddingLeft; i <= n; i++, j++) {
				knots[i] = segments[(j < 0 ? j + length : j) % length]._point;
			}

			var x = knots[0]._x + 2 * knots[1]._x,
				y = knots[0]._y + 2 * knots[1]._y,
				f = 2,
				n_1 = n - 1,
				rx = [x],
				ry = [y],
				rf = [f],
				px = [],
				py = [];
			for (var i = 1; i < n; i++) {
				var internal = i < n_1,
					a = internal ? 1 : asymmetric ? 1 : 2,
					b = internal ? 4 : asymmetric ? 2 : 7,
					u = internal ? 4 : asymmetric ? 3 : 8,
					v = internal ? 2 : asymmetric ? 0 : 1,
					m = a / f;
				f = rf[i] = b - m;
				x = rx[i] = u * knots[i]._x + v * knots[i + 1]._x - m * x;
				y = ry[i] = u * knots[i]._y + v * knots[i + 1]._y - m * y;
			}

			px[n_1] = rx[n_1] / rf[n_1];
			py[n_1] = ry[n_1] / rf[n_1];
			for (var i = n - 2; i >= 0; i--) {
				px[i] = (rx[i] - px[i + 1]) / rf[i];
				py[i] = (ry[i] - py[i + 1]) / rf[i];
			}
			px[n] = (3 * knots[n]._x - px[n_1]) / 2;
			py[n] = (3 * knots[n]._y - py[n_1]) / 2;

			for (var i = paddingLeft, max = n - paddingRight, j = from;
					i <= max; i++, j++) {
				var segment = segments[j < 0 ? j + length : j],
					pt = segment._point,
					hx = px[i] - pt._x,
					hy = py[i] - pt._y;
				if (loop || i < max)
					segment.setHandleOut(hx, hy);
				if (loop || i > paddingLeft)
					segment.setHandleIn(-hx, -hy);
			}
		} else {
			for (var i = from; i <= to; i++) {
				segments[i < 0 ? i + length : i].smooth(opts,
						!loop && i === from, !loop && i === to);
			}
		}
	},

	toShape: function(insert) {
		if (!this._closed)
			return null;

		var segments = this._segments,
			type,
			size,
			radius,
			topCenter;

		function isCollinear(i, j) {
			var seg1 = segments[i],
				seg2 = seg1.getNext(),
				seg3 = segments[j],
				seg4 = seg3.getNext();
			return seg1._handleOut.isZero() && seg2._handleIn.isZero()
					&& seg3._handleOut.isZero() && seg4._handleIn.isZero()
					&& seg2._point.subtract(seg1._point).isCollinear(
						seg4._point.subtract(seg3._point));
		}

		function isOrthogonal(i) {
			var seg2 = segments[i],
				seg1 = seg2.getPrevious(),
				seg3 = seg2.getNext();
			return seg1._handleOut.isZero() && seg2._handleIn.isZero()
					&& seg2._handleOut.isZero() && seg3._handleIn.isZero()
					&& seg2._point.subtract(seg1._point).isOrthogonal(
						seg3._point.subtract(seg2._point));
		}

		function isArc(i) {
			var seg1 = segments[i],
				seg2 = seg1.getNext(),
				handle1 = seg1._handleOut,
				handle2 = seg2._handleIn,
				kappa = 0.5522847498307936;
			if (handle1.isOrthogonal(handle2)) {
				var pt1 = seg1._point,
					pt2 = seg2._point,
					corner = new Line(pt1, handle1, true).intersect(
							new Line(pt2, handle2, true), true);
				return corner && Numerical.isZero(handle1.getLength() /
						corner.subtract(pt1).getLength() - kappa)
					&& Numerical.isZero(handle2.getLength() /
						corner.subtract(pt2).getLength() - kappa);
			}
			return false;
		}

		function getDistance(i, j) {
			return segments[i]._point.getDistance(segments[j]._point);
		}

		if (!this.hasHandles() && segments.length === 4
				&& isCollinear(0, 2) && isCollinear(1, 3) && isOrthogonal(1)) {
			type = Shape.Rectangle;
			size = new Size(getDistance(0, 3), getDistance(0, 1));
			topCenter = segments[1]._point.add(segments[2]._point).divide(2);
		} else if (segments.length === 8 && isArc(0) && isArc(2) && isArc(4)
				&& isArc(6) && isCollinear(1, 5) && isCollinear(3, 7)) {
			type = Shape.Rectangle;
			size = new Size(getDistance(1, 6), getDistance(0, 3));
			radius = size.subtract(new Size(getDistance(0, 7),
					getDistance(1, 2))).divide(2);
			topCenter = segments[3]._point.add(segments[4]._point).divide(2);
		} else if (segments.length === 4
				&& isArc(0) && isArc(1) && isArc(2) && isArc(3)) {
			if (Numerical.isZero(getDistance(0, 2) - getDistance(1, 3))) {
				type = Shape.Circle;
				radius = getDistance(0, 2) / 2;
			} else {
				type = Shape.Ellipse;
				radius = new Size(getDistance(2, 0) / 2, getDistance(3, 1) / 2);
			}
			topCenter = segments[1]._point;
		}

		if (type) {
			var center = this.getPosition(true),
				shape = new type({
					center: center,
					size: size,
					radius: radius,
					insert: false
				});
			shape.copyAttributes(this, true);
			shape._matrix.prepend(this._matrix);
			shape.rotate(topCenter.subtract(center).getAngle() + 90);
			if (insert === undefined || insert)
				shape.insertAbove(this);
			return shape;
		}
		return null;
	},

	toPath: '#clone',

	compare: function compare(path) {
		if (!path || path instanceof CompoundPath)
			return compare.base.call(this, path);
		var curves1 = this.getCurves(),
			curves2 = path.getCurves(),
			length1 = curves1.length,
			length2 = curves2.length;
		if (!length1 || !length2) {
			return length1 == length2;
		}
		var v1 = curves1[0].getValues(),
			values2 = [],
			pos1 = 0, pos2,
			end1 = 0, end2;
		for (var i = 0; i < length2; i++) {
			var v2 = curves2[i].getValues();
			values2.push(v2);
			var overlaps = Curve.getOverlaps(v1, v2);
			if (overlaps) {
				pos2 = !i && overlaps[0][0] > 0 ? length2 - 1 : i;
				end2 = overlaps[0][1];
				break;
			}
		}
		var abs = Math.abs,
			epsilon = 1e-8,
			v2 = values2[pos2],
			start2;
		while (v1 && v2) {
			var overlaps = Curve.getOverlaps(v1, v2);
			if (overlaps) {
				var t1 = overlaps[0][0];
				if (abs(t1 - end1) < epsilon) {
					end1 = overlaps[1][0];
					if (end1 === 1) {
						v1 = ++pos1 < length1 ? curves1[pos1].getValues() : null;
						end1 = 0;
					}
					var t2 = overlaps[0][1];
					if (abs(t2 - end2) < epsilon) {
						if (!start2)
							start2 = [pos2, t2];
						end2 = overlaps[1][1];
						if (end2 === 1) {
							if (++pos2 >= length2)
								pos2 = 0;
							v2 = values2[pos2] || curves2[pos2].getValues();
							end2 = 0;
						}
						if (!v1) {
							return start2[0] === pos2 && start2[1] === end2;
						}
						continue;
					}
				}
			}
			break;
		}
		return false;
	},

	_hitTestSelf: function(point, options, viewMatrix, strokeMatrix) {
		var that = this,
			style = this.getStyle(),
			segments = this._segments,
			numSegments = segments.length,
			closed = this._closed,
			tolerancePadding = options._tolerancePadding,
			strokePadding = tolerancePadding,
			join, cap, miterLimit,
			area, loc, res,
			hitStroke = options.stroke && style.hasStroke(),
			hitFill = options.fill && style.hasFill(),
			hitCurves = options.curves,
			strokeRadius = hitStroke
					? style.getStrokeWidth() / 2
					: hitFill && options.tolerance > 0 || hitCurves
						? 0 : null;
		if (strokeRadius !== null) {
			if (strokeRadius > 0) {
				join = style.getStrokeJoin();
				cap = style.getStrokeCap();
				miterLimit = style.getMiterLimit();
				strokePadding = strokePadding.add(
					Path._getStrokePadding(strokeRadius, strokeMatrix));
			} else {
				join = cap = 'round';
			}
		}

		function isCloseEnough(pt, padding) {
			return point.subtract(pt).divide(padding).length <= 1;
		}

		function checkSegmentPoint(seg, pt, name) {
			if (!options.selected || pt.isSelected()) {
				var anchor = seg._point;
				if (pt !== anchor)
					pt = pt.add(anchor);
				if (isCloseEnough(pt, strokePadding)) {
					return new HitResult(name, that, {
						segment: seg,
						point: pt
					});
				}
			}
		}

		function checkSegmentPoints(seg, ends) {
			return (ends || options.segments)
				&& checkSegmentPoint(seg, seg._point, 'segment')
				|| (!ends && options.handles) && (
					checkSegmentPoint(seg, seg._handleIn, 'handle-in') ||
					checkSegmentPoint(seg, seg._handleOut, 'handle-out'));
		}

		function addToArea(point) {
			area.add(point);
		}

		function checkSegmentStroke(segment) {
			var isJoin = closed || segment._index > 0
					&& segment._index < numSegments - 1;
			if ((isJoin ? join : cap) === 'round') {
				return isCloseEnough(segment._point, strokePadding);
			} else {
				area = new Path({ internal: true, closed: true });
				if (isJoin) {
					if (!segment.isSmooth()) {
						Path._addBevelJoin(segment, join, strokeRadius,
							   miterLimit, null, strokeMatrix, addToArea, true);
					}
				} else if (cap === 'square') {
					Path._addSquareCap(segment, cap, strokeRadius, null,
							strokeMatrix, addToArea, true);
				}
				if (!area.isEmpty()) {
					var loc;
					return area.contains(point)
						|| (loc = area.getNearestLocation(point))
							&& isCloseEnough(loc.getPoint(), tolerancePadding);
				}
			}
		}

		if (options.ends && !options.segments && !closed) {
			if (res = checkSegmentPoints(segments[0], true)
					|| checkSegmentPoints(segments[numSegments - 1], true))
				return res;
		} else if (options.segments || options.handles) {
			for (var i = 0; i < numSegments; i++)
				if (res = checkSegmentPoints(segments[i]))
					return res;
		}
		if (strokeRadius !== null) {
			loc = this.getNearestLocation(point);
			if (loc) {
				var time = loc.getTime();
				if (time === 0 || time === 1 && numSegments > 1) {
					if (!checkSegmentStroke(loc.getSegment()))
						loc = null;
				} else if (!isCloseEnough(loc.getPoint(), strokePadding)) {
					loc = null;
				}
			}
			if (!loc && join === 'miter' && numSegments > 1) {
				for (var i = 0; i < numSegments; i++) {
					var segment = segments[i];
					if (point.getDistance(segment._point)
							<= miterLimit * strokeRadius
							&& checkSegmentStroke(segment)) {
						loc = segment.getLocation();
						break;
					}
				}
			}
		}
		return !loc && hitFill && this._contains(point)
				|| loc && !hitStroke && !hitCurves
					? new HitResult('fill', this)
					: loc
						? new HitResult(hitStroke ? 'stroke' : 'curve', this, {
							location: loc,
							point: loc.getPoint()
						})
						: null;
	}

}, Base.each(Curve._evaluateMethods,
	function(name) {
		this[name + 'At'] = function(offset) {
			var loc = this.getLocationAt(offset);
			return loc && loc[name]();
		};
	},
{
	beans: false,

	getLocationOf: function() {
		var point = Point.read(arguments),
			curves = this.getCurves();
		for (var i = 0, l = curves.length; i < l; i++) {
			var loc = curves[i].getLocationOf(point);
			if (loc)
				return loc;
		}
		return null;
	},

	getOffsetOf: function() {
		var loc = this.getLocationOf.apply(this, arguments);
		return loc ? loc.getOffset() : null;
	},

	getLocationAt: function(offset) {
		if (typeof offset === 'number') {
			var curves = this.getCurves(),
				length = 0;
			for (var i = 0, l = curves.length; i < l; i++) {
				var start = length,
					curve = curves[i];
				length += curve.getLength();
				if (length > offset) {
					return curve.getLocationAt(offset - start);
				}
			}
			if (curves.length > 0 && offset <= this.getLength()) {
				return new CurveLocation(curves[curves.length - 1], 1);
			}
		} else if (offset && offset.getPath && offset.getPath() === this) {
			return offset;
		}
		return null;
	}

}),
new function() {

	function drawHandles(ctx, segments, matrix, size) {
		var half = size / 2,
			coords = new Array(6),
			pX, pY;

		function drawHandle(index) {
			var hX = coords[index],
				hY = coords[index + 1];
			if (pX != hX || pY != hY) {
				ctx.beginPath();
				ctx.moveTo(pX, pY);
				ctx.lineTo(hX, hY);
				ctx.stroke();
				ctx.beginPath();
				ctx.arc(hX, hY, half, 0, Math.PI * 2, true);
				ctx.fill();
			}
		}

		for (var i = 0, l = segments.length; i < l; i++) {
			var segment = segments[i],
				selection = segment._selection;
			segment._transformCoordinates(matrix, coords);
			pX = coords[0];
			pY = coords[1];
			if (selection & 2)
				drawHandle(2);
			if (selection & 4)
				drawHandle(4);
			ctx.fillRect(pX - half, pY - half, size, size);
			if (!(selection & 1)) {
				var fillStyle = ctx.fillStyle;
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(pX - half + 1, pY - half + 1, size - 2, size - 2);
				ctx.fillStyle = fillStyle;
			}
		}
	}

	function drawSegments(ctx, path, matrix) {
		var segments = path._segments,
			length = segments.length,
			coords = new Array(6),
			first = true,
			curX, curY,
			prevX, prevY,
			inX, inY,
			outX, outY;

		function drawSegment(segment) {
			if (matrix) {
				segment._transformCoordinates(matrix, coords);
				curX = coords[0];
				curY = coords[1];
			} else {
				var point = segment._point;
				curX = point._x;
				curY = point._y;
			}
			if (first) {
				ctx.moveTo(curX, curY);
				first = false;
			} else {
				if (matrix) {
					inX = coords[2];
					inY = coords[3];
				} else {
					var handle = segment._handleIn;
					inX = curX + handle._x;
					inY = curY + handle._y;
				}
				if (inX === curX && inY === curY
						&& outX === prevX && outY === prevY) {
					ctx.lineTo(curX, curY);
				} else {
					ctx.bezierCurveTo(outX, outY, inX, inY, curX, curY);
				}
			}
			prevX = curX;
			prevY = curY;
			if (matrix) {
				outX = coords[4];
				outY = coords[5];
			} else {
				var handle = segment._handleOut;
				outX = prevX + handle._x;
				outY = prevY + handle._y;
			}
		}

		for (var i = 0; i < length; i++)
			drawSegment(segments[i]);
		if (path._closed && length > 0)
			drawSegment(segments[0]);
	}

	return {
		_draw: function(ctx, param, viewMatrix, strokeMatrix) {
			var dontStart = param.dontStart,
				dontPaint = param.dontFinish || param.clip,
				style = this.getStyle(),
				hasFill = style.hasFill(),
				hasStroke = style.hasStroke(),
				dashArray = style.getDashArray(),
				dashLength = !paper.support.nativeDash && hasStroke
						&& dashArray && dashArray.length;

			if (!dontStart)
				ctx.beginPath();

			if (hasFill || hasStroke && !dashLength || dontPaint) {
				drawSegments(ctx, this, strokeMatrix);
				if (this._closed)
					ctx.closePath();
			}

			function getOffset(i) {
				return dashArray[((i % dashLength) + dashLength) % dashLength];
			}

			if (!dontPaint && (hasFill || hasStroke)) {
				this._setStyles(ctx, param, viewMatrix);
				if (hasFill) {
					ctx.fill(style.getFillRule());
					ctx.shadowColor = 'rgba(0,0,0,0)';
				}
				if (hasStroke) {
					if (dashLength) {
						if (!dontStart)
							ctx.beginPath();
						var flattener = new PathFlattener(this, 0.25, 32, false,
								strokeMatrix),
							length = flattener.length,
							from = -style.getDashOffset(), to,
							i = 0;
						from = from % length;
						while (from > 0) {
							from -= getOffset(i--) + getOffset(i--);
						}
						while (from < length) {
							to = from + getOffset(i++);
							if (from > 0 || to > 0)
								flattener.drawPart(ctx,
										Math.max(from, 0), Math.max(to, 0));
							from = to + getOffset(i++);
						}
					}
					ctx.stroke();
				}
			}
		},

		_drawSelected: function(ctx, matrix) {
			ctx.beginPath();
			drawSegments(ctx, this, matrix);
			ctx.stroke();
			drawHandles(ctx, this._segments, matrix, paper.settings.handleSize);
		}
	};
},
new function() {
	function getCurrentSegment(that) {
		var segments = that._segments;
		if (!segments.length)
			throw new Error('Use a moveTo() command first');
		return segments[segments.length - 1];
	}

	return {
		moveTo: function() {
			var segments = this._segments;
			if (segments.length === 1)
				this.removeSegment(0);
			if (!segments.length)
				this._add([ new Segment(Point.read(arguments)) ]);
		},

		moveBy: function() {
			throw new Error('moveBy() is unsupported on Path items.');
		},

		lineTo: function() {
			this._add([ new Segment(Point.read(arguments)) ]);
		},

		cubicCurveTo: function() {
			var handle1 = Point.read(arguments),
				handle2 = Point.read(arguments),
				to = Point.read(arguments),
				current = getCurrentSegment(this);
			current.setHandleOut(handle1.subtract(current._point));
			this._add([ new Segment(to, handle2.subtract(to)) ]);
		},

		quadraticCurveTo: function() {
			var handle = Point.read(arguments),
				to = Point.read(arguments),
				current = getCurrentSegment(this)._point;
			this.cubicCurveTo(
				handle.add(current.subtract(handle).multiply(1 / 3)),
				handle.add(to.subtract(handle).multiply(1 / 3)),
				to
			);
		},

		curveTo: function() {
			var through = Point.read(arguments),
				to = Point.read(arguments),
				t = Base.pick(Base.read(arguments), 0.5),
				t1 = 1 - t,
				current = getCurrentSegment(this)._point,
				handle = through.subtract(current.multiply(t1 * t1))
					.subtract(to.multiply(t * t)).divide(2 * t * t1);
			if (handle.isNaN())
				throw new Error(
					'Cannot put a curve through points with parameter = ' + t);
			this.quadraticCurveTo(handle, to);
		},

		arcTo: function() {
			var abs = Math.abs,
				sqrt = Math.sqrt,
				current = getCurrentSegment(this),
				from = current._point,
				to = Point.read(arguments),
				through,
				peek = Base.peek(arguments),
				clockwise = Base.pick(peek, true),
				center, extent, vector, matrix;
			if (typeof clockwise === 'boolean') {
				var middle = from.add(to).divide(2),
				through = middle.add(middle.subtract(from).rotate(
						clockwise ? -90 : 90));
			} else if (Base.remain(arguments) <= 2) {
				through = to;
				to = Point.read(arguments);
			} else {
				var radius = Size.read(arguments),
					isZero = Numerical.isZero;
				if (isZero(radius.width) || isZero(radius.height))
					return this.lineTo(to);
				var rotation = Base.read(arguments),
					clockwise = !!Base.read(arguments),
					large = !!Base.read(arguments),
					middle = from.add(to).divide(2),
					pt = from.subtract(middle).rotate(-rotation),
					x = pt.x,
					y = pt.y,
					rx = abs(radius.width),
					ry = abs(radius.height),
					rxSq = rx * rx,
					rySq = ry * ry,
					xSq = x * x,
					ySq = y * y;
				var factor = sqrt(xSq / rxSq + ySq / rySq);
				if (factor > 1) {
					rx *= factor;
					ry *= factor;
					rxSq = rx * rx;
					rySq = ry * ry;
				}
				factor = (rxSq * rySq - rxSq * ySq - rySq * xSq) /
						(rxSq * ySq + rySq * xSq);
				if (abs(factor) < 1e-12)
					factor = 0;
				if (factor < 0)
					throw new Error(
							'Cannot create an arc with the given arguments');
				center = new Point(rx * y / ry, -ry * x / rx)
						.multiply((large === clockwise ? -1 : 1) * sqrt(factor))
						.rotate(rotation).add(middle);
				matrix = new Matrix().translate(center).rotate(rotation)
						.scale(rx, ry);
				vector = matrix._inverseTransform(from);
				extent = vector.getDirectedAngle(matrix._inverseTransform(to));
				if (!clockwise && extent > 0)
					extent -= 360;
				else if (clockwise && extent < 0)
					extent += 360;
			}
			if (through) {
				var l1 = new Line(from.add(through).divide(2),
							through.subtract(from).rotate(90), true),
					l2 = new Line(through.add(to).divide(2),
							to.subtract(through).rotate(90), true),
					line = new Line(from, to),
					throughSide = line.getSide(through);
				center = l1.intersect(l2, true);
				if (!center) {
					if (!throughSide)
						return this.lineTo(to);
					throw new Error(
							'Cannot create an arc with the given arguments');
				}
				vector = from.subtract(center);
				extent = vector.getDirectedAngle(to.subtract(center));
				var centerSide = line.getSide(center);
				if (centerSide === 0) {
					extent = throughSide * abs(extent);
				} else if (throughSide === centerSide) {
					extent += extent < 0 ? 360 : -360;
				}
			}
			var epsilon = 1e-7,
				ext = abs(extent),
				count = ext >= 360 ? 4 : Math.ceil((ext - epsilon) / 90),
				inc = extent / count,
				half = inc * Math.PI / 360,
				z = 4 / 3 * Math.sin(half) / (1 + Math.cos(half)),
				segments = [];
			for (var i = 0; i <= count; i++) {
				var pt = to,
					out = null;
				if (i < count) {
					out = vector.rotate(90).multiply(z);
					if (matrix) {
						pt = matrix._transformPoint(vector);
						out = matrix._transformPoint(vector.add(out))
								.subtract(pt);
					} else {
						pt = center.add(vector);
					}
				}
				if (!i) {
					current.setHandleOut(out);
				} else {
					var _in = vector.rotate(-90).multiply(z);
					if (matrix) {
						_in = matrix._transformPoint(vector.add(_in))
								.subtract(pt);
					}
					segments.push(new Segment(pt, _in, out));
				}
				vector = vector.rotate(inc);
			}
			this._add(segments);
		},

		lineBy: function() {
			var to = Point.read(arguments),
				current = getCurrentSegment(this)._point;
			this.lineTo(current.add(to));
		},

		curveBy: function() {
			var through = Point.read(arguments),
				to = Point.read(arguments),
				parameter = Base.read(arguments),
				current = getCurrentSegment(this)._point;
			this.curveTo(current.add(through), current.add(to), parameter);
		},

		cubicCurveBy: function() {
			var handle1 = Point.read(arguments),
				handle2 = Point.read(arguments),
				to = Point.read(arguments),
				current = getCurrentSegment(this)._point;
			this.cubicCurveTo(current.add(handle1), current.add(handle2),
					current.add(to));
		},

		quadraticCurveBy: function() {
			var handle = Point.read(arguments),
				to = Point.read(arguments),
				current = getCurrentSegment(this)._point;
			this.quadraticCurveTo(current.add(handle), current.add(to));
		},

		arcBy: function() {
			var current = getCurrentSegment(this)._point,
				point = current.add(Point.read(arguments)),
				clockwise = Base.pick(Base.peek(arguments), true);
			if (typeof clockwise === 'boolean') {
				this.arcTo(point, clockwise);
			} else {
				this.arcTo(point, current.add(Point.read(arguments)));
			}
		},

		closePath: function(tolerance) {
			this.setClosed(true);
			this.join(this, tolerance);
		}
	};
}, {

	_getBounds: function(matrix, options) {
		var method = options.handle
				? 'getHandleBounds'
				: options.stroke
				? 'getStrokeBounds'
				: 'getBounds';
		return Path[method](this._segments, this._closed, this, matrix, options);
	},

statics: {
	getBounds: function(segments, closed, path, matrix, options, strokePadding) {
		var first = segments[0];
		if (!first)
			return new Rectangle();
		var coords = new Array(6),
			prevCoords = first._transformCoordinates(matrix, new Array(6)),
			min = prevCoords.slice(0, 2),
			max = min.slice(),
			roots = new Array(2);

		function processSegment(segment) {
			segment._transformCoordinates(matrix, coords);
			for (var i = 0; i < 2; i++) {
				Curve._addBounds(
					prevCoords[i],
					prevCoords[i + 4],
					coords[i + 2],
					coords[i],
					i, strokePadding ? strokePadding[i] : 0, min, max, roots);
			}
			var tmp = prevCoords;
			prevCoords = coords;
			coords = tmp;
		}

		for (var i = 1, l = segments.length; i < l; i++)
			processSegment(segments[i]);
		if (closed)
			processSegment(first);
		return new Rectangle(min[0], min[1], max[0] - min[0], max[1] - min[1]);
	},

	getStrokeBounds: function(segments, closed, path, matrix, options) {
		var style = path.getStyle(),
			stroke = style.hasStroke(),
			strokeWidth = style.getStrokeWidth(),
			strokeMatrix = stroke && path._getStrokeMatrix(matrix, options),
			strokePadding = stroke && Path._getStrokePadding(strokeWidth,
				strokeMatrix),
			bounds = Path.getBounds(segments, closed, path, matrix, options,
				strokePadding);
		if (!stroke)
			return bounds;
		var strokeRadius = strokeWidth / 2,
			join = style.getStrokeJoin(),
			cap = style.getStrokeCap(),
			miterLimit = style.getMiterLimit(),
			joinBounds = new Rectangle(new Size(strokePadding));

		function addPoint(point) {
			bounds = bounds.include(point);
		}

		function addRound(segment) {
			bounds = bounds.unite(
					joinBounds.setCenter(segment._point.transform(matrix)));
		}

		function addJoin(segment, join) {
			if (join === 'round' || segment.isSmooth()) {
				addRound(segment);
			} else {
				Path._addBevelJoin(segment, join, strokeRadius, miterLimit,
						matrix, strokeMatrix, addPoint);
			}
		}

		function addCap(segment, cap) {
			if (cap === 'round') {
				addRound(segment);
			} else {
				Path._addSquareCap(segment, cap, strokeRadius, matrix,
						strokeMatrix, addPoint);
			}
		}

		var length = segments.length - (closed ? 0 : 1);
		for (var i = 1; i < length; i++)
			addJoin(segments[i], join);
		if (closed) {
			addJoin(segments[0], join);
		} else if (length > 0) {
			addCap(segments[0], cap);
			addCap(segments[segments.length - 1], cap);
		}
		return bounds;
	},

	_getStrokePadding: function(radius, matrix) {
		if (!matrix)
			return [radius, radius];
		var hor = new Point(radius, 0).transform(matrix),
			ver = new Point(0, radius).transform(matrix),
			phi = hor.getAngleInRadians(),
			a = hor.getLength(),
			b = ver.getLength();
		var sin = Math.sin(phi),
			cos = Math.cos(phi),
			tan = Math.tan(phi),
			tx = Math.atan2(b * tan, a),
			ty = Math.atan2(b, tan * a);
		return [Math.abs(a * Math.cos(tx) * cos + b * Math.sin(tx) * sin),
				Math.abs(b * Math.sin(ty) * cos + a * Math.cos(ty) * sin)];
	},

	_addBevelJoin: function(segment, join, radius, miterLimit, matrix,
			strokeMatrix, addPoint, isArea) {
		var curve2 = segment.getCurve(),
			curve1 = curve2.getPrevious(),
			point = curve2.getPoint1().transform(matrix),
			normal1 = curve1.getNormalAtTime(1).multiply(radius)
				.transform(strokeMatrix),
			normal2 = curve2.getNormalAtTime(0).multiply(radius)
				.transform(strokeMatrix);
		if (normal1.getDirectedAngle(normal2) < 0) {
			normal1 = normal1.negate();
			normal2 = normal2.negate();
		}
		if (isArea)
			addPoint(point);
		addPoint(point.add(normal1));
		if (join === 'miter') {
			var corner = new Line(point.add(normal1),
					new Point(-normal1.y, normal1.x), true
				).intersect(new Line(point.add(normal2),
					new Point(-normal2.y, normal2.x), true
				), true);
			if (corner && point.getDistance(corner) <= miterLimit * radius) {
				addPoint(corner);
			}
		}
		addPoint(point.add(normal2));
	},

	_addSquareCap: function(segment, cap, radius, matrix, strokeMatrix,
			addPoint, isArea) {
		var point = segment._point.transform(matrix),
			loc = segment.getLocation(),
			normal = loc.getNormal()
					.multiply(loc.getTime() === 0 ? radius : -radius)
					.transform(strokeMatrix);
		if (cap === 'square') {
			if (isArea) {
				addPoint(point.subtract(normal));
				addPoint(point.add(normal));
			}
			point = point.add(normal.rotate(-90));
		}
		addPoint(point.add(normal));
		addPoint(point.subtract(normal));
	},

	getHandleBounds: function(segments, closed, path, matrix, options) {
		var style = path.getStyle(),
			stroke = options.stroke && style.hasStroke(),
			strokePadding,
			joinPadding;
		if (stroke) {
			var strokeMatrix = path._getStrokeMatrix(matrix, options),
				strokeRadius = style.getStrokeWidth() / 2,
				joinRadius = strokeRadius;
			if (style.getStrokeJoin() === 'miter')
				joinRadius = strokeRadius * style.getMiterLimit();
			if (style.getStrokeCap() === 'square')
				joinRadius = Math.max(joinRadius, strokeRadius * Math.SQRT2);
			strokePadding = Path._getStrokePadding(strokeRadius, strokeMatrix);
			joinPadding = Path._getStrokePadding(joinRadius, strokeMatrix);
		}
		var coords = new Array(6),
			x1 = Infinity,
			x2 = -x1,
			y1 = x1,
			y2 = x2;
		for (var i = 0, l = segments.length; i < l; i++) {
			var segment = segments[i];
			segment._transformCoordinates(matrix, coords);
			for (var j = 0; j < 6; j += 2) {
				var padding = !j ? joinPadding : strokePadding,
					paddingX = padding ? padding[0] : 0,
					paddingY = padding ? padding[1] : 0,
					x = coords[j],
					y = coords[j + 1],
					xn = x - paddingX,
					xx = x + paddingX,
					yn = y - paddingY,
					yx = y + paddingY;
				if (xn < x1) x1 = xn;
				if (xx > x2) x2 = xx;
				if (yn < y1) y1 = yn;
				if (yx > y2) y2 = yx;
			}
		}
		return new Rectangle(x1, y1, x2 - x1, y2 - y1);
	}
}});

Path.inject({ statics: new function() {

	var kappa = 0.5522847498307936,
		ellipseSegments = [
			new Segment([-1, 0], [0, kappa ], [0, -kappa]),
			new Segment([0, -1], [-kappa, 0], [kappa, 0 ]),
			new Segment([1, 0], [0, -kappa], [0, kappa ]),
			new Segment([0, 1], [kappa, 0 ], [-kappa, 0])
		];

	function createPath(segments, closed, args) {
		var props = Base.getNamed(args),
			path = new Path(props && props.insert == false && Item.NO_INSERT);
		path._add(segments);
		path._closed = closed;
		return path.set(props, { insert: true });
	}

	function createEllipse(center, radius, args) {
		var segments = new Array(4);
		for (var i = 0; i < 4; i++) {
			var segment = ellipseSegments[i];
			segments[i] = new Segment(
				segment._point.multiply(radius).add(center),
				segment._handleIn.multiply(radius),
				segment._handleOut.multiply(radius)
			);
		}
		return createPath(segments, true, args);
	}

	return {
		Line: function() {
			return createPath([
				new Segment(Point.readNamed(arguments, 'from')),
				new Segment(Point.readNamed(arguments, 'to'))
			], false, arguments);
		},

		Circle: function() {
			var center = Point.readNamed(arguments, 'center'),
				radius = Base.readNamed(arguments, 'radius');
			return createEllipse(center, new Size(radius), arguments);
		},

		Rectangle: function() {
			var rect = Rectangle.readNamed(arguments, 'rectangle'),
				radius = Size.readNamed(arguments, 'radius', 0,
						{ readNull: true }),
				bl = rect.getBottomLeft(true),
				tl = rect.getTopLeft(true),
				tr = rect.getTopRight(true),
				br = rect.getBottomRight(true),
				segments;
			if (!radius || radius.isZero()) {
				segments = [
					new Segment(bl),
					new Segment(tl),
					new Segment(tr),
					new Segment(br)
				];
			} else {
				radius = Size.min(radius, rect.getSize(true).divide(2));
				var rx = radius.width,
					ry = radius.height,
					hx = rx * kappa,
					hy = ry * kappa;
				segments = [
					new Segment(bl.add(rx, 0), null, [-hx, 0]),
					new Segment(bl.subtract(0, ry), [0, hy]),
					new Segment(tl.add(0, ry), null, [0, -hy]),
					new Segment(tl.add(rx, 0), [-hx, 0], null),
					new Segment(tr.subtract(rx, 0), null, [hx, 0]),
					new Segment(tr.add(0, ry), [0, -hy], null),
					new Segment(br.subtract(0, ry), null, [0, hy]),
					new Segment(br.subtract(rx, 0), [hx, 0])
				];
			}
			return createPath(segments, true, arguments);
		},

		RoundRectangle: '#Rectangle',

		Ellipse: function() {
			var ellipse = Shape._readEllipse(arguments);
			return createEllipse(ellipse.center, ellipse.radius, arguments);
		},

		Oval: '#Ellipse',

		Arc: function() {
			var from = Point.readNamed(arguments, 'from'),
				through = Point.readNamed(arguments, 'through'),
				to = Point.readNamed(arguments, 'to'),
				props = Base.getNamed(arguments),
				path = new Path(props && props.insert == false
						&& Item.NO_INSERT);
			path.moveTo(from);
			path.arcTo(through, to);
			return path.set(props);
		},

		RegularPolygon: function() {
			var center = Point.readNamed(arguments, 'center'),
				sides = Base.readNamed(arguments, 'sides'),
				radius = Base.readNamed(arguments, 'radius'),
				step = 360 / sides,
				three = sides % 3 === 0,
				vector = new Point(0, three ? -radius : radius),
				offset = three ? -1 : 0.5,
				segments = new Array(sides);
			for (var i = 0; i < sides; i++)
				segments[i] = new Segment(center.add(
					vector.rotate((i + offset) * step)));
			return createPath(segments, true, arguments);
		},

		Star: function() {
			var center = Point.readNamed(arguments, 'center'),
				points = Base.readNamed(arguments, 'points') * 2,
				radius1 = Base.readNamed(arguments, 'radius1'),
				radius2 = Base.readNamed(arguments, 'radius2'),
				step = 360 / points,
				vector = new Point(0, -1),
				segments = new Array(points);
			for (var i = 0; i < points; i++)
				segments[i] = new Segment(center.add(vector.rotate(step * i)
						.multiply(i % 2 ? radius2 : radius1)));
			return createPath(segments, true, arguments);
		}
	};
}});

var CompoundPath = PathItem.extend({
	_class: 'CompoundPath',
	_serializeFields: {
		children: []
	},
	beans: true,

	initialize: function CompoundPath(arg) {
		this._children = [];
		this._namedChildren = {};
		if (!this._initialize(arg)) {
			if (typeof arg === 'string') {
				this.setPathData(arg);
			} else {
				this.addChildren(Array.isArray(arg) ? arg : arguments);
			}
		}
	},

	insertChildren: function insertChildren(index, items) {
		var list = items,
			first = list[0];
		if (first && typeof first[0] === 'number')
			list = [list];
		for (var i = items.length - 1; i >= 0; i--) {
			var item = list[i];
			if (list === items && !(item instanceof Path))
				list = Base.slice(list);
			if (Array.isArray(item)) {
				list[i] = new Path({ segments: item, insert: false });
			} else if (item instanceof CompoundPath) {
				list.splice.apply(list, [i, 1].concat(item.removeChildren()));
				item.remove();
			}
		}
		return insertChildren.base.call(this, index, list);
	},

	reduce: function reduce(options) {
		var children = this._children;
		for (var i = children.length - 1; i >= 0; i--) {
			var path = children[i].reduce(options);
			if (path.isEmpty())
				path.remove();
		}
		if (!children.length) {
			var path = new Path(Item.NO_INSERT);
			path.copyAttributes(this);
			path.insertAbove(this);
			this.remove();
			return path;
		}
		return reduce.base.call(this);
	},

	isClosed: function() {
		var children = this._children;
		for (var i = 0, l = children.length; i < l; i++) {
			if (!children[i]._closed)
				return false;
		}
		return true;
	},

	setClosed: function(closed) {
		var children = this._children;
		for (var i = 0, l = children.length; i < l; i++) {
			children[i].setClosed(closed);
		}
	},

	getFirstSegment: function() {
		var first = this.getFirstChild();
		return first && first.getFirstSegment();
	},

	getLastSegment: function() {
		var last = this.getLastChild();
		return last && last.getLastSegment();
	},

	getCurves: function() {
		var children = this._children,
			curves = [];
		for (var i = 0, l = children.length; i < l; i++)
			curves.push.apply(curves, children[i].getCurves());
		return curves;
	},

	getFirstCurve: function() {
		var first = this.getFirstChild();
		return first && first.getFirstCurve();
	},

	getLastCurve: function() {
		var last = this.getLastChild();
		return last && last.getLastCurve();
	},

	getArea: function() {
		var children = this._children,
			area = 0;
		for (var i = 0, l = children.length; i < l; i++)
			area += children[i].getArea();
		return area;
	},

	getLength: function() {
		var children = this._children,
			length = 0;
		for (var i = 0, l = children.length; i < l; i++)
			length += children[i].getLength();
		return length;
	},

	getPathData: function(_matrix, _precision) {
		var children = this._children,
			paths = [];
		for (var i = 0, l = children.length; i < l; i++) {
			var child = children[i],
				mx = child._matrix;
			paths.push(child.getPathData(_matrix && !mx.isIdentity()
					? _matrix.appended(mx) : _matrix, _precision));
		}
		return paths.join('');
	},

	_hitTestChildren: function _hitTestChildren(point, options, viewMatrix) {
		return _hitTestChildren.base.call(this, point,
				options.class === Path || options.type === 'path' ? options
					: Base.set({}, options, { fill: false }),
				viewMatrix);
	},

	_draw: function(ctx, param, viewMatrix, strokeMatrix) {
		var children = this._children;
		if (!children.length)
			return;

		param = param.extend({ dontStart: true, dontFinish: true });
		ctx.beginPath();
		for (var i = 0, l = children.length; i < l; i++)
			children[i].draw(ctx, param, strokeMatrix);

		if (!param.clip) {
			this._setStyles(ctx, param, viewMatrix);
			var style = this._style;
			if (style.hasFill()) {
				ctx.fill(style.getFillRule());
				ctx.shadowColor = 'rgba(0,0,0,0)';
			}
			if (style.hasStroke())
				ctx.stroke();
		}
	},

	_drawSelected: function(ctx, matrix, selectionItems) {
		var children = this._children;
		for (var i = 0, l = children.length; i < l; i++) {
			var child = children[i],
				mx = child._matrix;
			if (!selectionItems[child._id]) {
				child._drawSelected(ctx, mx.isIdentity() ? matrix
						: matrix.appended(mx));
			}
		}
	}
},
new function() {
	function getCurrentPath(that, check) {
		var children = that._children;
		if (check && !children.length)
			throw new Error('Use a moveTo() command first');
		return children[children.length - 1];
	}

	return Base.each(['lineTo', 'cubicCurveTo', 'quadraticCurveTo', 'curveTo',
			'arcTo', 'lineBy', 'cubicCurveBy', 'quadraticCurveBy', 'curveBy',
			'arcBy'],
		function(key) {
			this[key] = function() {
				var path = getCurrentPath(this, true);
				path[key].apply(path, arguments);
			};
		}, {
			moveTo: function() {
				var current = getCurrentPath(this),
					path = current && current.isEmpty() ? current
							: new Path(Item.NO_INSERT);
				if (path !== current)
					this.addChild(path);
				path.moveTo.apply(path, arguments);
			},

			moveBy: function() {
				var current = getCurrentPath(this, true),
					last = current && current.getLastSegment(),
					point = Point.read(arguments);
				this.moveTo(last ? point.add(last._point) : point);
			},

			closePath: function(tolerance) {
				getCurrentPath(this, true).closePath(tolerance);
			}
		}
	);
}, Base.each(['reverse', 'flatten', 'simplify', 'smooth'], function(key) {
	this[key] = function(param) {
		var children = this._children,
			res;
		for (var i = 0, l = children.length; i < l; i++) {
			res = children[i][key](param) || res;
		}
		return res;
	};
}, {}));

PathItem.inject(new function() {
	var min = Math.min,
		max = Math.max,
		abs = Math.abs,
		operators = {
			unite:     { '1': true, '2': true },
			intersect: { '2': true },
			subtract:  { '1': true },
			exclude:   { '1': true, '-1': true }
		};

	function preparePath(path, resolve) {
		var res = path.clone(false).reduce({ simplify: true })
				.transform(null, true, true);
		return resolve
				? res.resolveCrossings().reorient(
					res.getFillRule() === 'nonzero', true)
				: res;
	}

	function createResult(paths, simplify, path1, path2, options) {
		var result = new CompoundPath(Item.NO_INSERT);
		result.addChildren(paths, true);
		result = result.reduce({ simplify: simplify });
		if (!(options && options.insert == false)) {
			result.insertAbove(path2 && path1.isSibling(path2)
					&& path1.getIndex() < path2.getIndex() ? path2 : path1);
		}
		result.copyAttributes(path1, true);
		return result;
	}

	function traceBoolean(path1, path2, operation, options) {
		if (options && (options.trace == false || options.stroke) &&
				/^(subtract|intersect)$/.test(operation))
			return splitBoolean(path1, path2, operation);
		var _path1 = preparePath(path1, true),
			_path2 = path2 && path1 !== path2 && preparePath(path2, true),
			operator = operators[operation];
		operator[operation] = true;
		if (_path2 && (operator.subtract || operator.exclude)
				^ (_path2.isClockwise() ^ _path1.isClockwise()))
			_path2.reverse();
		var crossings = divideLocations(
				CurveLocation.expand(_path1.getCrossings(_path2))),
			paths1 = _path1._children || [_path1],
			paths2 = _path2 && (_path2._children || [_path2]),
			segments = [],
			curves = [],
			paths;

		function collect(paths) {
			for (var i = 0, l = paths.length; i < l; i++) {
				var path = paths[i];
				segments.push.apply(segments, path._segments);
				curves.push.apply(curves, path.getCurves());
				path._overlapsOnly = true;
			}
		}

		if (crossings.length) {
			collect(paths1);
			if (paths2)
				collect(paths2);
			for (var i = 0, l = crossings.length; i < l; i++) {
				propagateWinding(crossings[i]._segment, _path1, _path2, curves,
						operator);
			}
			for (var i = 0, l = segments.length; i < l; i++) {
				var segment = segments[i],
					inter = segment._intersection;
				if (!segment._winding) {
					propagateWinding(segment, _path1, _path2, curves, operator);
				}
				if (!(inter && inter._overlap))
					segment._path._overlapsOnly = false;
			}
			paths = tracePaths(segments, operator);
		} else {
			paths = reorientPaths(
					paths2 ? paths1.concat(paths2) : paths1.slice(),
					function(w) {
						return !!operator[w];
					});
		}

		return createResult(paths, true, path1, path2, options);
	}

	function splitBoolean(path1, path2, operation) {
		var _path1 = preparePath(path1),
			_path2 = preparePath(path2),
			crossings = _path1.getCrossings(_path2),
			subtract = operation === 'subtract',
			divide = operation === 'divide',
			added = {},
			paths = [];

		function addPath(path) {
			if (!added[path._id] && (divide ||
					_path2.contains(path.getPointAt(path.getLength() / 2))
						^ subtract)) {
				paths.unshift(path);
				return added[path._id] = true;
			}
		}

		for (var i = crossings.length - 1; i >= 0; i--) {
			var path = crossings[i].split();
			if (path) {
				if (addPath(path))
					path.getFirstSegment().setHandleIn(0, 0);
				_path1.getLastSegment().setHandleOut(0, 0);
			}
		}
		addPath(_path1);
		return createResult(paths, false, path1, path2);
	}

	function linkIntersections(from, to) {
		var prev = from;
		while (prev) {
			if (prev === to)
				return;
			prev = prev._previous;
		}
		while (from._next && from._next !== to)
			from = from._next;
		if (!from._next) {
			while (to._previous)
				to = to._previous;
			from._next = to;
			to._previous = from;
		}
	}

	function clearCurveHandles(curves) {
		for (var i = curves.length - 1; i >= 0; i--)
			curves[i].clearHandles();
	}

	function reorientPaths(paths, isInside, clockwise) {
		var length = paths && paths.length;
		if (length) {
			var lookup = Base.each(paths, function (path, i) {
					this[path._id] = {
						container: null,
						winding: path.isClockwise() ? 1 : -1,
						index: i
					};
				}, {}),
				sorted = paths.slice().sort(function (a, b) {
					return abs(b.getArea()) - abs(a.getArea());
				}),
				first = sorted[0];
			if (clockwise == null)
				clockwise = first.isClockwise();
			for (var i = 0; i < length; i++) {
				var path1 = sorted[i],
					entry1 = lookup[path1._id],
					point = path1.getInteriorPoint(),
					containerWinding = 0;
				for (var j = i - 1; j >= 0; j--) {
					var path2 = sorted[j];
					if (path2.contains(point)) {
						var entry2 = lookup[path2._id];
						containerWinding = entry2.winding;
						entry1.winding += containerWinding;
						entry1.container = entry2.exclude ? entry2.container
								: path2;
						break;
					}
				}
				if (isInside(entry1.winding) === isInside(containerWinding)) {
					entry1.exclude = true;
					paths[entry1.index] = null;
				} else {
					var container = entry1.container;
					path1.setClockwise(container ? !container.isClockwise()
							: clockwise);
				}
			}
		}
		return paths;
	}

	function divideLocations(locations, include, clearLater) {
		var results = include && [],
			tMin = 1e-8,
			tMax = 1 - tMin,
			clearHandles = false,
			clearCurves = clearLater || [],
			clearLookup = clearLater && {},
			renormalizeLocs,
			prevCurve,
			prevTime;

		function getId(curve) {
			return curve._path._id + '.' + curve._segment1._index;
		}

		for (var i = (clearLater && clearLater.length) - 1; i >= 0; i--) {
			var curve = clearLater[i];
			if (curve._path)
				clearLookup[getId(curve)] = true;
		}

		for (var i = locations.length - 1; i >= 0; i--) {
			var loc = locations[i],
				time = loc._time,
				origTime = time,
				exclude = include && !include(loc),
				curve = loc._curve,
				segment;
			if (curve) {
				if (curve !== prevCurve) {
					clearHandles = !curve.hasHandles()
							|| clearLookup && clearLookup[getId(curve)];
					renormalizeLocs = [];
					prevTime = null;
					prevCurve = curve;
				} else if (prevTime >= tMin) {
					time /= prevTime;
				}
			}
			if (exclude) {
				if (renormalizeLocs)
					renormalizeLocs.push(loc);
				continue;
			} else if (include) {
				results.unshift(loc);
			}
			prevTime = origTime;
			if (time < tMin) {
				segment = curve._segment1;
			} else if (time > tMax) {
				segment = curve._segment2;
			} else {
				var newCurve = curve.divideAtTime(time, true);
				if (clearHandles)
					clearCurves.push(curve, newCurve);
				segment = newCurve._segment1;
				for (var j = renormalizeLocs.length - 1; j >= 0; j--) {
					var l = renormalizeLocs[j];
					l._time = (l._time - time) / (1 - time);
				}
			}
			loc._setSegment(segment);
			var inter = segment._intersection,
				dest = loc._intersection;
			if (inter) {
				linkIntersections(inter, dest);
				var other = inter;
				while (other) {
					linkIntersections(other._intersection, inter);
					other = other._next;
				}
			} else {
				segment._intersection = dest;
			}
		}
		if (!clearLater)
			clearCurveHandles(clearCurves);
		return results || locations;
	}

	function getWinding(point, curves, dir, closed, dontFlip) {
		var ia = dir ? 1 : 0,
			io = ia ^ 1,
			pv = [point.x, point.y],
			pa = pv[ia],
			po = pv[io],
			windingEpsilon = 1e-9,
			qualityEpsilon = 1e-6,
			paL = pa - windingEpsilon,
			paR = pa + windingEpsilon,
			windingL = 0,
			windingR = 0,
			pathWindingL = 0,
			pathWindingR = 0,
			onPath = false,
			onAnyPath = false,
			quality = 1,
			roots = [],
			vPrev,
			vClose;

		function addWinding(v) {
			var o0 = v[io + 0],
				o3 = v[io + 6];
			if (po < min(o0, o3) || po > max(o0, o3)) {
				return;
			}
			var a0 = v[ia + 0],
				a1 = v[ia + 2],
				a2 = v[ia + 4],
				a3 = v[ia + 6];
			if (o0 === o3) {
				if (a0 < paR && a3 > paL || a3 < paR && a0 > paL) {
					onPath = true;
				}
				return;
			}
			var t =   po === o0 ? 0
					: po === o3 ? 1
					: paL > max(a0, a1, a2, a3) || paR < min(a0, a1, a2, a3)
					? 1
					: Curve.solveCubic(v, io, po, roots, 0, 1) > 0
						? roots[0]
						: 1,
				a =   t === 0 ? a0
					: t === 1 ? a3
					: Curve.getPoint(v, t)[dir ? 'y' : 'x'],
				winding = o0 > o3 ? 1 : -1,
				windingPrev = vPrev[io] > vPrev[io + 6] ? 1 : -1,
				a3Prev = vPrev[ia + 6];
			if (po !== o0) {
				if (a < paL) {
					pathWindingL += winding;
				} else if (a > paR) {
					pathWindingR += winding;
				} else {
					onPath = true;
				}
				if (a > pa - qualityEpsilon && a < pa + qualityEpsilon)
					quality /= 2;
			} else {
				if (winding !== windingPrev) {
					if (a0 < paL) {
						pathWindingL += winding;
					} else if (a0 > paR) {
						pathWindingR += winding;
					}
				} else if (a0 != a3Prev) {
					if (a3Prev < paR && a > paR) {
						pathWindingR += winding;
						onPath = true;
					} else if (a3Prev > paL && a < paL) {
						pathWindingL += winding;
						onPath = true;
					}
				}
				quality = 0;
			}
			vPrev = v;
			return !dontFlip && a > paL && a < paR
					&& Curve.getTangent(v, t)[dir ? 'x' : 'y'] === 0
					&& getWinding(point, curves, !dir, closed, true);
		}

		function handleCurve(v) {
			var o0 = v[io + 0],
				o1 = v[io + 2],
				o2 = v[io + 4],
				o3 = v[io + 6];
			if (po <= max(o0, o1, o2, o3) && po >= min(o0, o1, o2, o3)) {
				var a0 = v[ia + 0],
					a1 = v[ia + 2],
					a2 = v[ia + 4],
					a3 = v[ia + 6],
					monoCurves = paL > max(a0, a1, a2, a3) ||
								 paR < min(a0, a1, a2, a3)
							? [v] : Curve.getMonoCurves(v, dir),
					res;
				for (var i = 0, l = monoCurves.length; i < l; i++) {
					if (res = addWinding(monoCurves[i]))
						return res;
				}
			}
		}

		for (var i = 0, l = curves.length; i < l; i++) {
			var curve = curves[i],
				path = curve._path,
				v = curve.getValues(),
				res;
			if (!i || curves[i - 1]._path !== path) {
				vPrev = null;
				if (!path._closed) {
					vClose = Curve.getValues(
							path.getLastCurve().getSegment2(),
							curve.getSegment1(),
							null, !closed);
					if (vClose[io] !== vClose[io + 6]) {
						vPrev = vClose;
					}
				}

				if (!vPrev) {
					vPrev = v;
					var prev = path.getLastCurve();
					while (prev && prev !== curve) {
						var v2 = prev.getValues();
						if (v2[io] !== v2[io + 6]) {
							vPrev = v2;
							break;
						}
						prev = prev.getPrevious();
					}
				}
			}

			if (res = handleCurve(v))
				return res;

			if (i + 1 === l || curves[i + 1]._path !== path) {
				if (vClose && (res = handleCurve(vClose)))
					return res;
				if (onPath && !pathWindingL && !pathWindingR) {
					pathWindingL = pathWindingR = path.isClockwise(closed) ^ dir
							? 1 : -1;
				}
				windingL += pathWindingL;
				windingR += pathWindingR;
				pathWindingL = pathWindingR = 0;
				if (onPath) {
					onAnyPath = true;
					onPath = false;
				}
				vClose = null;
			}
		}
		windingL = abs(windingL);
		windingR = abs(windingR);
		return {
			winding: max(windingL, windingR),
			windingL: windingL,
			windingR: windingR,
			quality: quality,
			onPath: onAnyPath
		};
	}

	function propagateWinding(segment, path1, path2, curves, operator) {
		var chain = [],
			start = segment,
			totalLength = 0,
			winding;
		do {
			var curve = segment.getCurve(),
				length = curve.getLength();
			chain.push({ segment: segment, curve: curve, length: length });
			totalLength += length;
			segment = segment.getNext();
		} while (segment && !segment._intersection && segment !== start);
		var offsets = [0.5, 0.25, 0.75],
			winding = { winding: 0, quality: -1 },
			tMin = 1e-8,
			tMax = 1 - tMin;
		for (var i = 0; i < offsets.length && winding.quality < 0.5; i++) {
			var length = totalLength * offsets[i];
			for (var j = 0, l = chain.length; j < l; j++) {
				var entry = chain[j],
					curveLength = entry.length;
				if (length <= curveLength) {
					var curve = entry.curve,
						path = curve._path,
						parent = path._parent,
						operand = parent instanceof CompoundPath ? parent : path,
						t = Numerical.clamp(curve.getTimeAt(length), tMin, tMax),
						pt = curve.getPointAtTime(t),
						dir = abs(curve.getTangentAtTime(t).y) < Math.SQRT1_2;
					var wind = !(operator.subtract && path2 && (
							operand === path1 &&
								path2._getWinding(pt, dir, true).winding ||
							operand === path2 &&
								!path1._getWinding(pt, dir, true).winding))
							? getWinding(pt, curves, dir, true)
							: { winding: 0, quality: 1 };
					if (wind.quality > winding.quality)
						winding = wind;
					break;
				}
				length -= curveLength;
			}
		}
		for (var j = chain.length - 1; j >= 0; j--) {
			chain[j].segment._winding = winding;
		}
	}

	function tracePaths(segments, operator) {
		var paths = [],
			starts;

		function isValid(seg) {
			var winding;
			return !!(seg && !seg._visited && (!operator
					|| operator[(winding = seg._winding || {}).winding]
						&& !(operator.unite && winding.winding === 2
							&& winding.windingL && winding.windingR)));
		}

		function isStart(seg) {
			if (seg) {
				for (var i = 0, l = starts.length; i < l; i++) {
					if (seg === starts[i])
						return true;
				}
			}
			return false;
		}

		function visitPath(path) {
			var segments = path._segments;
			for (var i = 0, l = segments.length; i < l; i++) {
				segments[i]._visited = true;
			}
		}

		function getCrossingSegments(segment, collectStarts) {
			var inter = segment._intersection,
				start = inter,
				crossings = [];
			if (collectStarts)
				starts = [segment];

			function collect(inter, end) {
				while (inter && inter !== end) {
					var other = inter._segment,
						path = other._path,
						next = other.getNext() || path && path.getFirstSegment(),
						nextInter = next && next._intersection;
					if (other !== segment && (isStart(other) || isStart(next)
						|| next && (isValid(other) && (isValid(next)
							|| nextInter && isValid(nextInter._segment))))) {
						crossings.push(other);
					}
					if (collectStarts)
						starts.push(other);
					inter = inter._next;
				}
			}

			if (inter) {
				collect(inter);
				while (inter && inter._prev)
					inter = inter._prev;
				collect(inter, start);
			}
			return crossings;
		}

		segments.sort(function(seg1, seg2) {
			var inter1 = seg1._intersection,
				inter2 = seg2._intersection,
				over1 = !!(inter1 && inter1._overlap),
				over2 = !!(inter2 && inter2._overlap),
				path1 = seg1._path,
				path2 = seg2._path;
			return over1 ^ over2
					? over1 ? 1 : -1
					: !inter1 ^ !inter2
						? inter1 ? 1 : -1
						: path1 !== path2
							? path1._id - path2._id
							: seg1._index - seg2._index;
		});

		for (var i = 0, l = segments.length; i < l; i++) {
			var seg = segments[i],
				valid = isValid(seg),
				path = null,
				finished = false,
				closed = true,
				branches = [],
				branch,
				visited,
				handleIn;
			if (valid && seg._path._overlapsOnly) {
				var path1 = seg._path,
					path2 = seg._intersection._segment._path;
				if (path1.compare(path2)) {
					if (path1.getArea())
						paths.push(path1.clone(false));
					visitPath(path1);
					visitPath(path2);
					valid = false;
				}
			}
			while (valid) {
				var first = !path,
					crossings = getCrossingSegments(seg, first),
					other = crossings.shift(),
					finished = !first && (isStart(seg) || isStart(other)),
					cross = !finished && other;
				if (first) {
					path = new Path(Item.NO_INSERT);
					branch = null;
				}
				if (finished) {
					if (seg.isFirst() || seg.isLast())
						closed = seg._path._closed;
					seg._visited = true;
					break;
				}
				if (cross && branch) {
					branches.push(branch);
					branch = null;
				}
				if (!branch) {
					if (cross)
						crossings.push(seg);
					branch = {
						start: path._segments.length,
						crossings: crossings,
						visited: visited = [],
						handleIn: handleIn
					};
				}
				if (cross)
					seg = other;
				if (!isValid(seg)) {
					path.removeSegments(branch.start);
					for (var j = 0, k = visited.length; j < k; j++) {
						visited[j]._visited = false;
					}
					visited.length = 0;
					do {
						seg = branch && branch.crossings.shift();
						if (!seg) {
							branch = branches.pop();
							if (branch) {
								visited = branch.visited;
								handleIn = branch.handleIn;
							}
						}
					} while (branch && !isValid(seg));
					if (!seg)
						break;
				}
				var next = seg.getNext();
				path.add(new Segment(seg._point, handleIn,
						next && seg._handleOut));
				seg._visited = true;
				visited.push(seg);
				seg = next || seg._path.getFirstSegment();
				handleIn = next && next._handleIn;
			}
			if (finished) {
				if (closed) {
					path.getFirstSegment().setHandleIn(handleIn);
					path.setClosed(closed);
				}
				if (path.getArea() !== 0) {
					paths.push(path);
				}
			}
		}
		return paths;
	}

	return {
		_getWinding: function(point, dir, closed) {
			return getWinding(point, this.getCurves(), dir, closed);
		},

		unite: function(path, options) {
			return traceBoolean(this, path, 'unite', options);
		},

		intersect: function(path, options) {
			return traceBoolean(this, path, 'intersect', options);
		},

		subtract: function(path, options) {
			return traceBoolean(this, path, 'subtract', options);
		},

		exclude: function(path, options) {
			return traceBoolean(this, path, 'exclude', options);
		},

		divide: function(path, options) {
			return options && (options.trace == false || options.stroke)
					? splitBoolean(this, path, 'divide')
					: createResult([
						this.subtract(path, options),
						this.intersect(path, options)
					], true, this, path, options);
		},

		resolveCrossings: function() {
			var children = this._children,
				paths = children || [this];

			function hasOverlap(seg) {
				var inter = seg && seg._intersection;
				return inter && inter._overlap;
			}

			var hasOverlaps = false,
				hasCrossings = false,
				intersections = this.getIntersections(null, function(inter) {
					return inter.hasOverlap() && (hasOverlaps = true) ||
							inter.isCrossing() && (hasCrossings = true);
				}),
				clearCurves = hasOverlaps && hasCrossings && [];
			intersections = CurveLocation.expand(intersections);
			if (hasOverlaps) {
				var overlaps = divideLocations(intersections, function(inter) {
					return inter.hasOverlap();
				}, clearCurves);
				for (var i = overlaps.length - 1; i >= 0; i--) {
					var seg = overlaps[i]._segment,
						prev = seg.getPrevious(),
						next = seg.getNext();
					if (hasOverlap(prev) && hasOverlap(next)) {
						seg.remove();
						prev._handleOut._set(0, 0);
						next._handleIn._set(0, 0);
						if (prev !== seg && !prev.getCurve().hasLength()) {
							next._handleIn.set(prev._handleIn);
							prev.remove();
						}
					}
				}
			}
			if (hasCrossings) {
				divideLocations(intersections, hasOverlaps && function(inter) {
					var curve1 = inter.getCurve(),
						seg1 = inter.getSegment(),
						other = inter._intersection,
						curve2 = other._curve,
						seg2 = other._segment;
					if (curve1 && curve2 && curve1._path && curve2._path)
						return true;
					if (seg1)
						seg1._intersection = null;
					if (seg2)
						seg2._intersection = null;
				}, clearCurves);
				if (clearCurves)
					clearCurveHandles(clearCurves);
				paths = tracePaths(Base.each(paths, function(path) {
					this.push.apply(this, path._segments);
				}, []));
			}
			var length = paths.length,
				item;
			if (length > 1 && children) {
				if (paths !== children)
					this.setChildren(paths);
				item = this;
			} else if (length === 1 && !children) {
				if (paths[0] !== this)
					this.setSegments(paths[0].removeSegments());
				item = this;
			}
			if (!item) {
				item = new CompoundPath(Item.NO_INSERT);
				item.addChildren(paths);
				item = item.reduce();
				item.copyAttributes(this);
				this.replaceWith(item);
			}
			return item;
		},

		reorient: function(nonZero, clockwise) {
			var children = this._children;
			if (children && children.length) {
				this.setChildren(reorientPaths(this.removeChildren(),
						function(w) {
							return !!(nonZero ? w : w & 1);
						},
						clockwise));
			} else if (clockwise !== undefined) {
				this.setClockwise(clockwise);
			}
			return this;
		},

		getInteriorPoint: function() {
			var bounds = this.getBounds(),
				point = bounds.getCenter(true);
			if (!this.contains(point)) {
				var curves = this.getCurves(),
					y = point.y,
					intercepts = [],
					roots = [];
				for (var i = 0, l = curves.length; i < l; i++) {
					var v = curves[i].getValues(),
						o0 = v[1],
						o1 = v[3],
						o2 = v[5],
						o3 = v[7];
					if (y >= min(o0, o1, o2, o3) && y <= max(o0, o1, o2, o3)) {
						var monoCurves = Curve.getMonoCurves(v);
						for (var j = 0, m = monoCurves.length; j < m; j++) {
							var mv = monoCurves[j],
								mo0 = mv[1],
								mo3 = mv[7];
							if ((mo0 !== mo3) &&
								(y >= mo0 && y <= mo3 || y >= mo3 && y <= mo0)){
								var x = y === mo0 ? mv[0]
									: y === mo3 ? mv[6]
									: Curve.solveCubic(mv, 1, y, roots, 0, 1)
										=== 1
										? Curve.getPoint(mv, roots[0]).x
										: (mv[0] + mv[6]) / 2;
								intercepts.push(x);
							}
						}
					}
				}
				if (intercepts.length > 1) {
					intercepts.sort(function(a, b) { return a - b; });
					point.x = (intercepts[0] + intercepts[1]) / 2;
				}
			}
			return point;
		}
	};
});

var PathFlattener = Base.extend({
	_class: 'PathFlattener',

	initialize: function(path, flatness, maxRecursion, ignoreStraight, matrix) {
		var curves = [],
			parts = [],
			length = 0,
			minSpan = 1 / (maxRecursion || 32),
			segments = path._segments,
			segment1 = segments[0],
			segment2;

		function addCurve(segment1, segment2) {
			var curve = Curve.getValues(segment1, segment2, matrix);
			curves.push(curve);
			computeParts(curve, segment1._index, 0, 1);
		}

		function computeParts(curve, index, t1, t2) {
			if ((t2 - t1) > minSpan
					&& !(ignoreStraight && Curve.isStraight(curve))
					&& !Curve.isFlatEnough(curve, flatness || 0.25)) {
				var halves = Curve.subdivide(curve, 0.5),
					tMid = (t1 + t2) / 2;
				computeParts(halves[0], index, t1, tMid);
				computeParts(halves[1], index, tMid, t2);
			} else {
				var dx = curve[6] - curve[0],
					dy = curve[7] - curve[1],
					dist = Math.sqrt(dx * dx + dy * dy);
				if (dist > 0) {
					length += dist;
					parts.push({
						offset: length,
						curve: curve,
						index: index,
						time: t2,
					});
				}
			}
		}

		for (var i = 1, l = segments.length; i < l; i++) {
			segment2 = segments[i];
			addCurve(segment1, segment2);
			segment1 = segment2;
		}
		if (path._closed)
			addCurve(segment2, segments[0]);
		this.curves = curves;
		this.parts = parts;
		this.length = length;
		this.index = 0;
	},

	_get: function(offset) {
		var parts = this.parts,
			length = parts.length,
			start,
			i, j = this.index;
		for (;;) {
			i = j;
			if (!j || parts[--j].offset < offset)
				break;
		}
		for (; i < length; i++) {
			var part = parts[i];
			if (part.offset >= offset) {
				this.index = i;
				var prev = parts[i - 1],
					prevTime = prev && prev.index === part.index ? prev.time : 0,
					prevOffset = prev ? prev.offset : 0;
				return {
					index: part.index,
					time: prevTime + (part.time - prevTime)
						* (offset - prevOffset) / (part.offset - prevOffset)
				};
			}
		}
		return {
			index: parts[length - 1].index,
			time: 1
		};
	},

	drawPart: function(ctx, from, to) {
		var start = this._get(from),
			end = this._get(to);
		for (var i = start.index, l = end.index; i <= l; i++) {
			var curve = Curve.getPart(this.curves[i],
					i === start.index ? start.time : 0,
					i === end.index ? end.time : 1);
			if (i === start.index)
				ctx.moveTo(curve[0], curve[1]);
			ctx.bezierCurveTo.apply(ctx, curve.slice(2));
		}
	}
}, Base.each(Curve._evaluateMethods,
	function(name) {
		this[name + 'At'] = function(offset) {
			var param = this._get(offset);
			return Curve[name](this.curves[param.index], param.time);
		};
	}, {})
);

var PathFitter = Base.extend({
	initialize: function(path) {
		var points = this.points = [],
			segments = path._segments,
			closed = path._closed;
		for (var i = 0, prev, l = segments.length; i < l; i++) {
			var point = segments[i].point;
			if (!prev || !prev.equals(point)) {
				points.push(prev = point.clone());
			}
		}
		if (closed) {
			points.unshift(points[points.length - 1]);
			points.push(points[1]);
		}
		this.closed = closed;
	},

	fit: function(error) {
		var points = this.points,
			length = points.length,
			segments = null;
		if (length > 0) {
			segments = [new Segment(points[0])];
			if (length > 1) {
				this.fitCubic(segments, error, 0, length - 1,
						points[1].subtract(points[0]),
						points[length - 2].subtract(points[length - 1]));
				if (this.closed) {
					segments.shift();
					segments.pop();
				}
			}
		}
		return segments;
	},

	fitCubic: function(segments, error, first, last, tan1, tan2) {
		var points = this.points;
		if (last - first === 1) {
			var pt1 = points[first],
				pt2 = points[last],
				dist = pt1.getDistance(pt2) / 3;
			this.addCurve(segments, [pt1, pt1.add(tan1.normalize(dist)),
					pt2.add(tan2.normalize(dist)), pt2]);
			return;
		}
		var uPrime = this.chordLengthParameterize(first, last),
			maxError = Math.max(error, error * error),
			split,
			parametersInOrder = true;
		for (var i = 0; i <= 4; i++) {
			var curve = this.generateBezier(first, last, uPrime, tan1, tan2);
			var max = this.findMaxError(first, last, curve, uPrime);
			if (max.error < error && parametersInOrder) {
				this.addCurve(segments, curve);
				return;
			}
			split = max.index;
			if (max.error >= maxError)
				break;
			parametersInOrder = this.reparameterize(first, last, uPrime, curve);
			maxError = max.error;
		}
		var tanCenter = points[split - 1].subtract(points[split + 1]);
		this.fitCubic(segments, error, first, split, tan1, tanCenter);
		this.fitCubic(segments, error, split, last, tanCenter.negate(), tan2);
	},

	addCurve: function(segments, curve) {
		var prev = segments[segments.length - 1];
		prev.setHandleOut(curve[1].subtract(curve[0]));
		segments.push(new Segment(curve[3], curve[2].subtract(curve[3])));
	},

	generateBezier: function(first, last, uPrime, tan1, tan2) {
		var epsilon = 1e-12,
			abs = Math.abs,
			points = this.points,
			pt1 = points[first],
			pt2 = points[last],
			C = [[0, 0], [0, 0]],
			X = [0, 0];

		for (var i = 0, l = last - first + 1; i < l; i++) {
			var u = uPrime[i],
				t = 1 - u,
				b = 3 * u * t,
				b0 = t * t * t,
				b1 = b * t,
				b2 = b * u,
				b3 = u * u * u,
				a1 = tan1.normalize(b1),
				a2 = tan2.normalize(b2),
				tmp = points[first + i]
					.subtract(pt1.multiply(b0 + b1))
					.subtract(pt2.multiply(b2 + b3));
			C[0][0] += a1.dot(a1);
			C[0][1] += a1.dot(a2);
			C[1][0] = C[0][1];
			C[1][1] += a2.dot(a2);
			X[0] += a1.dot(tmp);
			X[1] += a2.dot(tmp);
		}

		var detC0C1 = C[0][0] * C[1][1] - C[1][0] * C[0][1],
			alpha1,
			alpha2;
		if (abs(detC0C1) > epsilon) {
			var detC0X = C[0][0] * X[1]    - C[1][0] * X[0],
				detXC1 = X[0]    * C[1][1] - X[1]    * C[0][1];
			alpha1 = detXC1 / detC0C1;
			alpha2 = detC0X / detC0C1;
		} else {
			var c0 = C[0][0] + C[0][1],
				c1 = C[1][0] + C[1][1];
			alpha1 = alpha2 = abs(c0) > epsilon ? X[0] / c0
							: abs(c1) > epsilon ? X[1] / c1
							: 0;
		}

		var segLength = pt2.getDistance(pt1),
			eps = epsilon * segLength,
			handle1,
			handle2;
		if (alpha1 < eps || alpha2 < eps) {
			alpha1 = alpha2 = segLength / 3;
		} else {
			var line = pt2.subtract(pt1);
			handle1 = tan1.normalize(alpha1);
			handle2 = tan2.normalize(alpha2);
			if (handle1.dot(line) - handle2.dot(line) > segLength * segLength) {
				alpha1 = alpha2 = segLength / 3;
				handle1 = handle2 = null;
			}
		}

		return [pt1,
				pt1.add(handle1 || tan1.normalize(alpha1)),
				pt2.add(handle2 || tan2.normalize(alpha2)),
				pt2];
	},

	reparameterize: function(first, last, u, curve) {
		for (var i = first; i <= last; i++) {
			u[i - first] = this.findRoot(curve, this.points[i], u[i - first]);
		}
		for (var i = 1, l = u.length; i < l; i++) {
			if (u[i] <= u[i - 1])
				return false;
		}
		return true;
	},

	findRoot: function(curve, point, u) {
		var curve1 = [],
			curve2 = [];
		for (var i = 0; i <= 2; i++) {
			curve1[i] = curve[i + 1].subtract(curve[i]).multiply(3);
		}
		for (var i = 0; i <= 1; i++) {
			curve2[i] = curve1[i + 1].subtract(curve1[i]).multiply(2);
		}
		var pt = this.evaluate(3, curve, u),
			pt1 = this.evaluate(2, curve1, u),
			pt2 = this.evaluate(1, curve2, u),
			diff = pt.subtract(point),
			df = pt1.dot(pt1) + diff.dot(pt2);
		return Numerical.isZero(df) ? u : u - diff.dot(pt1) / df;
	},

	evaluate: function(degree, curve, t) {
		var tmp = curve.slice();
		for (var i = 1; i <= degree; i++) {
			for (var j = 0; j <= degree - i; j++) {
				tmp[j] = tmp[j].multiply(1 - t).add(tmp[j + 1].multiply(t));
			}
		}
		return tmp[0];
	},

	chordLengthParameterize: function(first, last) {
		var u = [0];
		for (var i = first + 1; i <= last; i++) {
			u[i - first] = u[i - first - 1]
					+ this.points[i].getDistance(this.points[i - 1]);
		}
		for (var i = 1, m = last - first; i <= m; i++) {
			u[i] /= u[m];
		}
		return u;
	},

	findMaxError: function(first, last, curve, u) {
		var index = Math.floor((last - first + 1) / 2),
			maxDist = 0;
		for (var i = first + 1; i < last; i++) {
			var P = this.evaluate(3, curve, u[i - first]);
			var v = P.subtract(this.points[i]);
			var dist = v.x * v.x + v.y * v.y;
			if (dist >= maxDist) {
				maxDist = dist;
				index = i;
			}
		}
		return {
			error: maxDist,
			index: index
		};
	}
});

var TextItem = Item.extend({
	_class: 'TextItem',
	_applyMatrix: false,
	_canApplyMatrix: false,
	_serializeFields: {
		content: null
	},
	_boundsOptions: { stroke: false, handle: false },

	initialize: function TextItem(arg) {
		this._content = '';
		this._lines = [];
		var hasProps = arg && Base.isPlainObject(arg)
				&& arg.x === undefined && arg.y === undefined;
		this._initialize(hasProps && arg, !hasProps && Point.read(arguments));
	},

	_equals: function(item) {
		return this._content === item._content;
	},

	copyContent: function(source) {
		this.setContent(source._content);
	},

	getContent: function() {
		return this._content;
	},

	setContent: function(content) {
		this._content = '' + content;
		this._lines = this._content.split(/\r\n|\n|\r/mg);
		this._changed(265);
	},

	isEmpty: function() {
		return !this._content;
	},

	getCharacterStyle: '#getStyle',
	setCharacterStyle: '#setStyle',

	getParagraphStyle: '#getStyle',
	setParagraphStyle: '#setStyle'
});

var PointText = TextItem.extend({
	_class: 'PointText',

	initialize: function PointText() {
		TextItem.apply(this, arguments);
	},

	getPoint: function() {
		var point = this._matrix.getTranslation();
		return new LinkedPoint(point.x, point.y, this, 'setPoint');
	},

	setPoint: function() {
		var point = Point.read(arguments);
		this.translate(point.subtract(this._matrix.getTranslation()));
	},

	_draw: function(ctx, param, viewMatrix) {
		if (!this._content)
			return;
		this._setStyles(ctx, param, viewMatrix);
		var lines = this._lines,
			style = this._style,
			hasFill = style.hasFill(),
			hasStroke = style.hasStroke(),
			leading = style.getLeading(),
			shadowColor = ctx.shadowColor;
		ctx.font = style.getFontStyle();
		ctx.textAlign = style.getJustification();
		for (var i = 0, l = lines.length; i < l; i++) {
			ctx.shadowColor = shadowColor;
			var line = lines[i];
			if (hasFill) {
				ctx.fillText(line, 0, 0);
				ctx.shadowColor = 'rgba(0,0,0,0)';
			}
			if (hasStroke)
				ctx.strokeText(line, 0, 0);
			ctx.translate(0, leading);
		}
	},

	_getBounds: function(matrix, options) {
		var style = this._style,
			lines = this._lines,
			numLines = lines.length,
			justification = style.getJustification(),
			leading = style.getLeading(),
			width = this.getView().getTextWidth(style.getFontStyle(), lines),
			x = 0;
		if (justification !== 'left')
			x -= width / (justification === 'center' ? 2: 1);
		var rect = new Rectangle(x,
					numLines ? - 0.75 * leading : 0,
					width, numLines * leading);
		return matrix ? matrix._transformBounds(rect, rect) : rect;
	}
});

var Color = Base.extend(new function() {
	var types = {
		gray: ['gray'],
		rgb: ['red', 'green', 'blue'],
		hsb: ['hue', 'saturation', 'brightness'],
		hsl: ['hue', 'saturation', 'lightness'],
		gradient: ['gradient', 'origin', 'destination', 'highlight']
	};

	var componentParsers = {},
		colorCache = {},
		colorCtx;

	function fromCSS(string) {
		var match = string.match(/^#(\w{1,2})(\w{1,2})(\w{1,2})$/),
			components;
		if (match) {
			components = [0, 0, 0];
			for (var i = 0; i < 3; i++) {
				var value = match[i + 1];
				components[i] = parseInt(value.length == 1
						? value + value : value, 16) / 255;
			}
		} else if (match = string.match(/^rgba?\((.*)\)$/)) {
			components = match[1].split(',');
			for (var i = 0, l = components.length; i < l; i++) {
				var value = +components[i];
				components[i] = i < 3 ? value / 255 : value;
			}
		} else if (window) {
			var cached = colorCache[string];
			if (!cached) {
				if (!colorCtx) {
					colorCtx = CanvasProvider.getContext(1, 1);
					colorCtx.globalCompositeOperation = 'copy';
				}
				colorCtx.fillStyle = 'rgba(0,0,0,0)';
				colorCtx.fillStyle = string;
				colorCtx.fillRect(0, 0, 1, 1);
				var data = colorCtx.getImageData(0, 0, 1, 1).data;
				cached = colorCache[string] = [
					data[0] / 255,
					data[1] / 255,
					data[2] / 255
				];
			}
			components = cached.slice();
		} else {
			components = [0, 0, 0];
		}
		return components;
	}

	var hsbIndices = [
		[0, 3, 1],
		[2, 0, 1],
		[1, 0, 3],
		[1, 2, 0],
		[3, 1, 0],
		[0, 1, 2]
	];

	var converters = {
		'rgb-hsb': function(r, g, b) {
			var max = Math.max(r, g, b),
				min = Math.min(r, g, b),
				delta = max - min,
				h = delta === 0 ? 0
					:   ( max == r ? (g - b) / delta + (g < b ? 6 : 0)
						: max == g ? (b - r) / delta + 2
						:            (r - g) / delta + 4) * 60;
			return [h, max === 0 ? 0 : delta / max, max];
		},

		'hsb-rgb': function(h, s, b) {
			h = (((h / 60) % 6) + 6) % 6;
			var i = Math.floor(h),
				f = h - i,
				i = hsbIndices[i],
				v = [
					b,
					b * (1 - s),
					b * (1 - s * f),
					b * (1 - s * (1 - f))
				];
			return [v[i[0]], v[i[1]], v[i[2]]];
		},

		'rgb-hsl': function(r, g, b) {
			var max = Math.max(r, g, b),
				min = Math.min(r, g, b),
				delta = max - min,
				achromatic = delta === 0,
				h = achromatic ? 0
					:   ( max == r ? (g - b) / delta + (g < b ? 6 : 0)
						: max == g ? (b - r) / delta + 2
						:            (r - g) / delta + 4) * 60,
				l = (max + min) / 2,
				s = achromatic ? 0 : l < 0.5
						? delta / (max + min)
						: delta / (2 - max - min);
			return [h, s, l];
		},

		'hsl-rgb': function(h, s, l) {
			h = (((h / 360) % 1) + 1) % 1;
			if (s === 0)
				return [l, l, l];
			var t3s = [ h + 1 / 3, h, h - 1 / 3 ],
				t2 = l < 0.5 ? l * (1 + s) : l + s - l * s,
				t1 = 2 * l - t2,
				c = [];
			for (var i = 0; i < 3; i++) {
				var t3 = t3s[i];
				if (t3 < 0) t3 += 1;
				if (t3 > 1) t3 -= 1;
				c[i] = 6 * t3 < 1
					? t1 + (t2 - t1) * 6 * t3
					: 2 * t3 < 1
						? t2
						: 3 * t3 < 2
							? t1 + (t2 - t1) * ((2 / 3) - t3) * 6
							: t1;
			}
			return c;
		},

		'rgb-gray': function(r, g, b) {
			return [r * 0.2989 + g * 0.587 + b * 0.114];
		},

		'gray-rgb': function(g) {
			return [g, g, g];
		},

		'gray-hsb': function(g) {
			return [0, 0, g];
		},

		'gray-hsl': function(g) {
			return [0, 0, g];
		},

		'gradient-rgb': function() {
			return [];
		},

		'rgb-gradient': function() {
			return [];
		}

	};

	return Base.each(types, function(properties, type) {
		componentParsers[type] = [];
		Base.each(properties, function(name, index) {
			var part = Base.capitalize(name),
				hasOverlap = /^(hue|saturation)$/.test(name),
				parser = componentParsers[type][index] = name === 'gradient'
					? function(value) {
						var current = this._components[0];
						value = Gradient.read(Array.isArray(value) ? value
								: arguments, 0, { readNull: true });
						if (current !== value) {
							if (current)
								current._removeOwner(this);
							if (value)
								value._addOwner(this);
						}
						return value;
					}
					: type === 'gradient'
						? function() {
							return Point.read(arguments, 0, {
									readNull: name === 'highlight',
									clone: true
							});
						}
						: function(value) {
							return value == null || isNaN(value) ? 0 : value;
						};

			this['get' + part] = function() {
				return this._type === type
					|| hasOverlap && /^hs[bl]$/.test(this._type)
						? this._components[index]
						: this._convert(type)[index];
			};

			this['set' + part] = function(value) {
				if (this._type !== type
						&& !(hasOverlap && /^hs[bl]$/.test(this._type))) {
					this._components = this._convert(type);
					this._properties = types[type];
					this._type = type;
				}
				this._components[index] = parser.call(this, value);
				this._changed();
			};
		}, this);
	}, {
		_class: 'Color',
		_readIndex: true,

		initialize: function Color(arg) {
			var args = arguments,
				reading = this.__read,
				read = 0,
				type,
				components,
				alpha,
				values;
			if (Array.isArray(arg)) {
				args = arg;
				arg = args[0];
			}
			var argType = arg != null && typeof arg;
			if (argType === 'string' && arg in types) {
				type = arg;
				arg = args[1];
				if (Array.isArray(arg)) {
					components = arg;
					alpha = args[2];
				} else {
					if (reading)
						read = 1;
					args = Base.slice(args, 1);
					argType = typeof arg;
				}
			}
			if (!components) {
				values = argType === 'number'
						? args
						: argType === 'object' && arg.length != null
							? arg
							: null;
				if (values) {
					if (!type)
						type = values.length >= 3
								? 'rgb'
								: 'gray';
					var length = types[type].length;
					alpha = values[length];
					if (reading) {
						read += values === arguments
							? length + (alpha != null ? 1 : 0)
							: 1;
					}
					if (values.length > length)
						values = Base.slice(values, 0, length);
				} else if (argType === 'string') {
					type = 'rgb';
					components = fromCSS(arg);
					if (components.length === 4) {
						alpha = components[3];
						components.length--;
					}
				} else if (argType === 'object') {
					if (arg.constructor === Color) {
						type = arg._type;
						components = arg._components.slice();
						alpha = arg._alpha;
						if (type === 'gradient') {
							for (var i = 1, l = components.length; i < l; i++) {
								var point = components[i];
								if (point)
									components[i] = point.clone();
							}
						}
					} else if (arg.constructor === Gradient) {
						type = 'gradient';
						values = args;
					} else {
						type = 'hue' in arg
							? 'lightness' in arg
								? 'hsl'
								: 'hsb'
							: 'gradient' in arg || 'stops' in arg
									|| 'radial' in arg
								? 'gradient'
								: 'gray' in arg
									? 'gray'
									: 'rgb';
						var properties = types[type],
							parsers = componentParsers[type];
						this._components = components = [];
						for (var i = 0, l = properties.length; i < l; i++) {
							var value = arg[properties[i]];
							if (value == null && !i && type === 'gradient'
									&& 'stops' in arg) {
								value = {
									stops: arg.stops,
									radial: arg.radial
								};
							}
							value = parsers[i].call(this, value);
							if (value != null)
								components[i] = value;
						}
						alpha = arg.alpha;
					}
				}
				if (reading && type)
					read = 1;
			}
			this._type = type || 'rgb';
			if (!components) {
				this._components = components = [];
				var parsers = componentParsers[this._type];
				for (var i = 0, l = parsers.length; i < l; i++) {
					var value = parsers[i].call(this, values && values[i]);
					if (value != null)
						components[i] = value;
				}
			}
			this._components = components;
			this._properties = types[this._type];
			this._alpha = alpha;
			if (reading)
				this.__read = read;
			return this;
		},

		set: '#initialize',

		_serialize: function(options, dictionary) {
			var components = this.getComponents();
			return Base.serialize(
					/^(gray|rgb)$/.test(this._type)
						? components
						: [this._type].concat(components),
					options, true, dictionary);
		},

		_changed: function() {
			this._canvasStyle = null;
			if (this._owner)
				this._owner._changed(65);
		},

		_convert: function(type) {
			var converter;
			return this._type === type
					? this._components.slice()
					: (converter = converters[this._type + '-' + type])
						? converter.apply(this, this._components)
						: converters['rgb-' + type].apply(this,
							converters[this._type + '-rgb'].apply(this,
								this._components));
		},

		convert: function(type) {
			return new Color(type, this._convert(type), this._alpha);
		},

		getType: function() {
			return this._type;
		},

		setType: function(type) {
			this._components = this._convert(type);
			this._properties = types[type];
			this._type = type;
		},

		getComponents: function() {
			var components = this._components.slice();
			if (this._alpha != null)
				components.push(this._alpha);
			return components;
		},

		getAlpha: function() {
			return this._alpha != null ? this._alpha : 1;
		},

		setAlpha: function(alpha) {
			this._alpha = alpha == null ? null : Math.min(Math.max(alpha, 0), 1);
			this._changed();
		},

		hasAlpha: function() {
			return this._alpha != null;
		},

		equals: function(color) {
			var col = Base.isPlainValue(color, true)
					? Color.read(arguments)
					: color;
			return col === this || col && this._class === col._class
					&& this._type === col._type
					&& this.getAlpha() === col.getAlpha()
					&& Base.equals(this._components, col._components)
					|| false;
		},

		toString: function() {
			var properties = this._properties,
				parts = [],
				isGradient = this._type === 'gradient',
				f = Formatter.instance;
			for (var i = 0, l = properties.length; i < l; i++) {
				var value = this._components[i];
				if (value != null)
					parts.push(properties[i] + ': '
							+ (isGradient ? value : f.number(value)));
			}
			if (this._alpha != null)
				parts.push('alpha: ' + f.number(this._alpha));
			return '{ ' + parts.join(', ') + ' }';
		},

		toCSS: function(hex) {
			var components = this._convert('rgb'),
				alpha = hex || this._alpha == null ? 1 : this._alpha;
			function convert(val) {
				return Math.round((val < 0 ? 0 : val > 1 ? 1 : val) * 255);
			}
			components = [
				convert(components[0]),
				convert(components[1]),
				convert(components[2])
			];
			if (alpha < 1)
				components.push(alpha < 0 ? 0 : alpha);
			return hex
					? '#' + ((1 << 24) + (components[0] << 16)
						+ (components[1] << 8)
						+ components[2]).toString(16).slice(1)
					: (components.length == 4 ? 'rgba(' : 'rgb(')
						+ components.join(',') + ')';
		},

		toCanvasStyle: function(ctx, matrix) {
			if (this._canvasStyle)
				return this._canvasStyle;
			if (this._type !== 'gradient')
				return this._canvasStyle = this.toCSS();
			var components = this._components,
				gradient = components[0],
				stops = gradient._stops,
				origin = components[1],
				destination = components[2],
				highlight = components[3],
				inverse = matrix && matrix.inverted(),
				canvasGradient;
			if (inverse) {
				origin = inverse._transformPoint(origin);
				destination = inverse._transformPoint(destination);
				if (highlight)
					highlight = inverse._transformPoint(highlight);
			}
			if (gradient._radial) {
				var radius = destination.getDistance(origin);
				if (highlight) {
					var vector = highlight.subtract(origin);
					if (vector.getLength() > radius)
						highlight = origin.add(vector.normalize(radius - 0.1));
				}
				var start = highlight || origin;
				canvasGradient = ctx.createRadialGradient(start.x, start.y,
						0, origin.x, origin.y, radius);
			} else {
				canvasGradient = ctx.createLinearGradient(origin.x, origin.y,
						destination.x, destination.y);
			}
			for (var i = 0, l = stops.length; i < l; i++) {
				var stop = stops[i],
					offset = stop._offset;
				canvasGradient.addColorStop(
						offset == null ? i / (l - 1) : offset,
						stop._color.toCanvasStyle());
			}
			return this._canvasStyle = canvasGradient;
		},

		transform: function(matrix) {
			if (this._type === 'gradient') {
				var components = this._components;
				for (var i = 1, l = components.length; i < l; i++) {
					var point = components[i];
					matrix._transformPoint(point, point, true);
				}
				this._changed();
			}
		},

		statics: {
			_types: types,

			random: function() {
				var random = Math.random;
				return new Color(random(), random(), random());
			}
		}
	});
},
new function() {
	var operators = {
		add: function(a, b) {
			return a + b;
		},

		subtract: function(a, b) {
			return a - b;
		},

		multiply: function(a, b) {
			return a * b;
		},

		divide: function(a, b) {
			return a / b;
		}
	};

	return Base.each(operators, function(operator, name) {
		this[name] = function(color) {
			color = Color.read(arguments);
			var type = this._type,
				components1 = this._components,
				components2 = color._convert(type);
			for (var i = 0, l = components1.length; i < l; i++)
				components2[i] = operator(components1[i], components2[i]);
			return new Color(type, components2,
					this._alpha != null
							? operator(this._alpha, color.getAlpha())
							: null);
		};
	}, {
	});
});

var Gradient = Base.extend({
	_class: 'Gradient',

	initialize: function Gradient(stops, radial) {
		this._id = UID.get();
		if (stops && Base.isPlainObject(stops)) {
			this.set(stops);
			stops = radial = null;
		}
		if (this._stops == null) {
			this.setStops(stops || ['white', 'black']);
		}
		if (this._radial == null) {
			this.setRadial(typeof radial === 'string' && radial === 'radial'
					|| radial || false);
		}
	},

	_serialize: function(options, dictionary) {
		return dictionary.add(this, function() {
			return Base.serialize([this._stops, this._radial],
					options, true, dictionary);
		});
	},

	_changed: function() {
		for (var i = 0, l = this._owners && this._owners.length; i < l; i++) {
			this._owners[i]._changed();
		}
	},

	_addOwner: function(color) {
		if (!this._owners)
			this._owners = [];
		this._owners.push(color);
	},

	_removeOwner: function(color) {
		var index = this._owners ? this._owners.indexOf(color) : -1;
		if (index != -1) {
			this._owners.splice(index, 1);
			if (!this._owners.length)
				this._owners = undefined;
		}
	},

	clone: function() {
		var stops = [];
		for (var i = 0, l = this._stops.length; i < l; i++) {
			stops[i] = this._stops[i].clone();
		}
		return new Gradient(stops, this._radial);
	},

	getStops: function() {
		return this._stops;
	},

	setStops: function(stops) {
		if (stops.length < 2) {
			throw new Error(
					'Gradient stop list needs to contain at least two stops.');
		}
		var _stops = this._stops;
		if (_stops) {
			for (var i = 0, l = _stops.length; i < l; i++)
				_stops[i]._owner = undefined;
		}
		_stops = this._stops = GradientStop.readList(stops, 0, { clone: true });
		for (var i = 0, l = _stops.length; i < l; i++)
			_stops[i]._owner = this;
		this._changed();
	},

	getRadial: function() {
		return this._radial;
	},

	setRadial: function(radial) {
		this._radial = radial;
		this._changed();
	},

	equals: function(gradient) {
		if (gradient === this)
			return true;
		if (gradient && this._class === gradient._class) {
			var stops1 = this._stops,
				stops2 = gradient._stops,
				length = stops1.length;
			if (length === stops2.length) {
				for (var i = 0; i < length; i++) {
					if (!stops1[i].equals(stops2[i]))
						return false;
				}
				return true;
			}
		}
		return false;
	}
});

var GradientStop = Base.extend({
	_class: 'GradientStop',

	initialize: function GradientStop(arg0, arg1) {
		var color = arg0,
			offset = arg1;
		if (typeof arg0 === 'object' && arg1 === undefined) {
			if (Array.isArray(arg0) && typeof arg0[0] !== 'number') {
				color = arg0[0];
				offset = arg0[1];
			} else if ('color' in arg0 || 'offset' in arg0
					|| 'rampPoint' in arg0) {
				color = arg0.color;
				offset = arg0.offset || arg0.rampPoint || 0;
			}
		}
		this.setColor(color);
		this.setOffset(offset);
	},

	clone: function() {
		return new GradientStop(this._color.clone(), this._offset);
	},

	_serialize: function(options, dictionary) {
		var color = this._color,
			offset = this._offset;
		return Base.serialize(offset == null ? [color] : [color, offset],
				options, true, dictionary);
	},

	_changed: function() {
		if (this._owner)
			this._owner._changed(65);
	},

	getOffset: function() {
		return this._offset;
	},

	setOffset: function(offset) {
		this._offset = offset;
		this._changed();
	},

	getRampPoint: '#getOffset',
	setRampPoint: '#setOffset',

	getColor: function() {
		return this._color;
	},

	setColor: function() {
		var color = Color.read(arguments, 0, { clone: true });
		if (color)
			color._owner = this;
		this._color = color;
		this._changed();
	},

	equals: function(stop) {
		return stop === this || stop && this._class === stop._class
				&& this._color.equals(stop._color)
				&& this._offset == stop._offset
				|| false;
	}
});

var Style = Base.extend(new function() {
	var itemDefaults = {
		fillColor: null,
		fillRule: 'nonzero',
		strokeColor: null,
		strokeWidth: 1,
		strokeCap: 'butt',
		strokeJoin: 'miter',
		strokeScaling: true,
		miterLimit: 10,
		dashOffset: 0,
		dashArray: [],
		shadowColor: null,
		shadowBlur: 0,
		shadowOffset: new Point(),
		selectedColor: null
	},
	groupDefaults = Base.set({}, itemDefaults, {
		fontFamily: 'sans-serif',
		fontWeight: 'normal',
		fontSize: 12,
		leading: null,
		justification: 'left'
	}),
	textDefaults = Base.set({}, groupDefaults, {
		fillColor: new Color()
	}),
	flags = {
		strokeWidth: 97,
		strokeCap: 97,
		strokeJoin: 97,
		strokeScaling: 105,
		miterLimit: 97,
		fontFamily: 9,
		fontWeight: 9,
		fontSize: 9,
		font: 9,
		leading: 9,
		justification: 9
	},
	item = {
		beans: true
	},
	fields = {
		_class: 'Style',
		beans: true,

		initialize: function Style(style, _owner, _project) {
			this._values = {};
			this._owner = _owner;
			this._project = _owner && _owner._project || _project
					|| paper.project;
			this._defaults = !_owner || _owner instanceof Group ? groupDefaults
					: _owner instanceof TextItem ? textDefaults
					: itemDefaults;
			if (style)
				this.set(style);
		}
	};

	Base.each(groupDefaults, function(value, key) {
		var isColor = /Color$/.test(key),
			isPoint = key === 'shadowOffset',
			part = Base.capitalize(key),
			flag = flags[key],
			set = 'set' + part,
			get = 'get' + part;

		fields[set] = function(value) {
			var owner = this._owner,
				children = owner && owner._children;
			if (children && children.length > 0
					&& !(owner instanceof CompoundPath)) {
				for (var i = 0, l = children.length; i < l; i++)
					children[i]._style[set](value);
			} else if (key in this._defaults) {
				var old = this._values[key];
				if (old !== value) {
					if (isColor) {
						if (old && old._owner !== undefined)
							old._owner = undefined;
						if (value && value.constructor === Color) {
							if (value._owner)
								value = value.clone();
							value._owner = owner;
						}
					}
					this._values[key] = value;
					if (owner)
						owner._changed(flag || 65);
				}
			}
		};

		fields[get] = function(_dontMerge) {
			var owner = this._owner,
				children = owner && owner._children,
				value;
			if (key in this._defaults && (!children || !children.length
					|| _dontMerge || owner instanceof CompoundPath)) {
				var value = this._values[key];
				if (value === undefined) {
					value = this._defaults[key];
					if (value && value.clone)
						value = value.clone();
				} else {
					var ctor = isColor ? Color : isPoint ? Point : null;
					if (ctor && !(value && value.constructor === ctor)) {
						this._values[key] = value = ctor.read([value], 0,
								{ readNull: true, clone: true });
						if (value && isColor)
							value._owner = owner;
					}
				}
			} else if (children) {
				for (var i = 0, l = children.length; i < l; i++) {
					var childValue = children[i]._style[get]();
					if (!i) {
						value = childValue;
					} else if (!Base.equals(value, childValue)) {
						return undefined;
					}
				}
			}
			return value;
		};

		item[get] = function(_dontMerge) {
			return this._style[get](_dontMerge);
		};

		item[set] = function(value) {
			this._style[set](value);
		};
	});

	Base.each({
		Font: 'FontFamily',
		WindingRule: 'FillRule'
	}, function(value, key) {
		var get = 'get' + key,
			set = 'set' + key;
		fields[get] = item[get] = '#get' + value;
		fields[set] = item[set] = '#set' + value;
	});

	Item.inject(item);
	return fields;
}, {
	set: function(style) {
		var isStyle = style instanceof Style,
			values = isStyle ? style._values : style;
		if (values) {
			for (var key in values) {
				if (key in this._defaults) {
					var value = values[key];
					this[key] = value && isStyle && value.clone
							? value.clone() : value;
				}
			}
		}
	},

	equals: function(style) {
		function compare(style1, style2, secondary) {
			var values1 = style1._values,
				values2 = style2._values,
				defaults2 = style2._defaults;
			for (var key in values1) {
				var value1 = values1[key],
					value2 = values2[key];
				if (!(secondary && key in values2) && !Base.equals(value1,
						value2 === undefined ? defaults2[key] : value2))
					return false;
			}
			return true;
		}

		return style === this || style && this._class === style._class
				&& compare(this, style)
				&& compare(style, this, true)
				|| false;
	},

	hasFill: function() {
		var color = this.getFillColor();
		return !!color && color.alpha > 0;
	},

	hasStroke: function() {
		var color = this.getStrokeColor();
		return !!color && color.alpha > 0 && this.getStrokeWidth() > 0;
	},

	hasShadow: function() {
		var color = this.getShadowColor();
		return !!color && color.alpha > 0 && (this.getShadowBlur() > 0
				|| !this.getShadowOffset().isZero());
	},

	getView: function() {
		return this._project._view;
	},

	getFontStyle: function() {
		var fontSize = this.getFontSize();
		return this.getFontWeight()
				+ ' ' + fontSize + (/[a-z]/i.test(fontSize + '') ? ' ' : 'px ')
				+ this.getFontFamily();
	},

	getFont: '#getFontFamily',
	setFont: '#setFontFamily',

	getLeading: function getLeading() {
		var leading = getLeading.base.call(this),
			fontSize = this.getFontSize();
		if (/pt|em|%|px/.test(fontSize))
			fontSize = this.getView().getPixelSize(fontSize);
		return leading != null ? leading : fontSize * 1.2;
	}

});

var DomElement = new function() {
	function handlePrefix(el, name, set, value) {
		var prefixes = ['', 'webkit', 'moz', 'Moz', 'ms', 'o'],
			suffix = name[0].toUpperCase() + name.substring(1);
		for (var i = 0; i < 6; i++) {
			var prefix = prefixes[i],
				key = prefix ? prefix + suffix : name;
			if (key in el) {
				if (set) {
					el[key] = value;
				} else {
					return el[key];
				}
				break;
			}
		}
	}

	return {
		getStyles: function(el) {
			var doc = el && el.nodeType !== 9 ? el.ownerDocument : el,
				view = doc && doc.defaultView;
			return view && view.getComputedStyle(el, '');
		},

		getBounds: function(el, viewport) {
			var doc = el.ownerDocument,
				body = doc.body,
				html = doc.documentElement,
				rect;
			try {
				rect = el.getBoundingClientRect();
			} catch (e) {
				rect = { left: 0, top: 0, width: 0, height: 0 };
			}
			var x = rect.left - (html.clientLeft || body.clientLeft || 0),
				y = rect.top - (html.clientTop || body.clientTop || 0);
			if (!viewport) {
				var view = doc.defaultView;
				x += view.pageXOffset || html.scrollLeft || body.scrollLeft;
				y += view.pageYOffset || html.scrollTop || body.scrollTop;
			}
			return new Rectangle(x, y, rect.width, rect.height);
		},

		getViewportBounds: function(el) {
			var doc = el.ownerDocument,
				view = doc.defaultView,
				html = doc.documentElement;
			return new Rectangle(0, 0,
				view.innerWidth || html.clientWidth,
				view.innerHeight || html.clientHeight
			);
		},

		getOffset: function(el, viewport) {
			return DomElement.getBounds(el, viewport).getPoint();
		},

		getSize: function(el) {
			return DomElement.getBounds(el, true).getSize();
		},

		isInvisible: function(el) {
			return DomElement.getSize(el).equals(new Size(0, 0));
		},

		isInView: function(el) {
			return !DomElement.isInvisible(el)
					&& DomElement.getViewportBounds(el).intersects(
						DomElement.getBounds(el, true));
		},

		isInserted: function(el) {
			return document.body.contains(el);
		},

		getPrefixed: function(el, name) {
			return el && handlePrefix(el, name);
		},

		setPrefixed: function(el, name, value) {
			if (typeof name === 'object') {
				for (var key in name)
					handlePrefix(el, key, true, name[key]);
			} else {
				handlePrefix(el, name, true, value);
			}
		}
	};
};

var DomEvent = {
	add: function(el, events) {
		if (el) {
			for (var type in events) {
				var func = events[type],
					parts = type.split(/[\s,]+/g);
				for (var i = 0, l = parts.length; i < l; i++)
					el.addEventListener(parts[i], func, false);
			}
		}
	},

	remove: function(el, events) {
		if (el) {
			for (var type in events) {
				var func = events[type],
					parts = type.split(/[\s,]+/g);
				for (var i = 0, l = parts.length; i < l; i++)
					el.removeEventListener(parts[i], func, false);
			}
		}
	},

	getPoint: function(event) {
		var pos = event.targetTouches
				? event.targetTouches.length
					? event.targetTouches[0]
					: event.changedTouches[0]
				: event;
		return new Point(
			pos.pageX || pos.clientX + document.documentElement.scrollLeft,
			pos.pageY || pos.clientY + document.documentElement.scrollTop
		);
	},

	getTarget: function(event) {
		return event.target || event.srcElement;
	},

	getRelatedTarget: function(event) {
		return event.relatedTarget || event.toElement;
	},

	getOffset: function(event, target) {
		return DomEvent.getPoint(event).subtract(DomElement.getOffset(
				target || DomEvent.getTarget(event)));
	}
};

DomEvent.requestAnimationFrame = new function() {
	var nativeRequest = DomElement.getPrefixed(window, 'requestAnimationFrame'),
		requested = false,
		callbacks = [],
		timer;

	function handleCallbacks() {
		var functions = callbacks;
		callbacks = [];
		for (var i = 0, l = functions.length; i < l; i++)
			functions[i]();
		requested = nativeRequest && callbacks.length;
		if (requested)
			nativeRequest(handleCallbacks);
	}

	return function(callback) {
		callbacks.push(callback);
		if (nativeRequest) {
			if (!requested) {
				nativeRequest(handleCallbacks);
				requested = true;
			}
		} else if (!timer) {
			timer = setInterval(handleCallbacks, 1000 / 60);
		}
	};
};

var View = Base.extend(Emitter, {
	_class: 'View',

	initialize: function View(project, element) {

		function getSize(name) {
			return element[name] || parseInt(element.getAttribute(name), 10);
		}

		function getCanvasSize() {
			var size = DomElement.getSize(element);
			return size.isNaN() || size.isZero()
					? new Size(getSize('width'), getSize('height'))
					: size;
		}

		var size;
		if (window && element) {
			this._id = element.getAttribute('id');
			if (this._id == null)
				element.setAttribute('id', this._id = 'view-' + View._id++);
			DomEvent.add(element, this._viewEvents);
			var none = 'none';
			DomElement.setPrefixed(element.style, {
				userDrag: none,
				userSelect: none,
				touchCallout: none,
				contentZooming: none,
				tapHighlightColor: 'rgba(0,0,0,0)'
			});

			if (PaperScope.hasAttribute(element, 'resize')) {
				var that = this;
				DomEvent.add(window, this._windowEvents = {
					resize: function() {
						that.setViewSize(getCanvasSize());
					}
				});
			}

			size = getCanvasSize();

			if (PaperScope.hasAttribute(element, 'stats')
					&& typeof Stats !== 'undefined') {
				this._stats = new Stats();
				var stats = this._stats.domElement,
					style = stats.style,
					offset = DomElement.getOffset(element);
				style.position = 'absolute';
				style.left = offset.x + 'px';
				style.top = offset.y + 'px';
				document.body.appendChild(stats);
			}
		} else {
			size = new Size(element);
			element = null;
		}
		this._project = project;
		this._scope = project._scope;
		this._element = element;
		if (!this._pixelRatio)
			this._pixelRatio = window && window.devicePixelRatio || 1;
		this._setElementSize(size.width, size.height);
		this._viewSize = size;
		View._views.push(this);
		View._viewsById[this._id] = this;
		(this._matrix = new Matrix())._owner = this;
		if (!View._focused)
			View._focused = this;
		this._frameItems = {};
		this._frameItemCount = 0;
		this._itemEvents = { native: {}, virtual: {} };
		this._autoUpdate = !paper.agent.node;
		this._needsUpdate = false;
	},

	remove: function() {
		if (!this._project)
			return false;
		if (View._focused === this)
			View._focused = null;
		View._views.splice(View._views.indexOf(this), 1);
		delete View._viewsById[this._id];
		var project = this._project;
		if (project._view === this)
			project._view = null;
		DomEvent.remove(this._element, this._viewEvents);
		DomEvent.remove(window, this._windowEvents);
		this._element = this._project = null;
		this.off('frame');
		this._animate = false;
		this._frameItems = {};
		return true;
	},

	_events: Base.each(
		Item._itemHandlers.concat(['onResize', 'onKeyDown', 'onKeyUp']),
		function(name) {
			this[name] = {};
		}, {
			onFrame: {
				install: function() {
					this.play();
				},

				uninstall: function() {
					this.pause();
				}
			}
		}
	),

	_animate: false,
	_time: 0,
	_count: 0,

	getAutoUpdate: function() {
		return this._autoUpdate;
	},

	setAutoUpdate: function(autoUpdate) {
		this._autoUpdate = autoUpdate;
		if (autoUpdate)
			this.requestUpdate();
	},

	update: function() {
	},

	draw: function() {
		this.update();
	},

	requestUpdate: function() {
		if (!this._requested) {
			var that = this;
			DomEvent.requestAnimationFrame(function() {
				that._requested = false;
				if (that._animate) {
					that.requestUpdate();
					var element = that._element;
					if ((!DomElement.getPrefixed(document, 'hidden')
							|| PaperScope.getAttribute(element, 'keepalive')
								=== 'true') && DomElement.isInView(element)) {
						that._handleFrame();
					}
				}
				if (that._autoUpdate)
					that.update();
			});
			this._requested = true;
		}
	},

	play: function() {
		this._animate = true;
		this.requestUpdate();
	},

	pause: function() {
		this._animate = false;
	},

	_handleFrame: function() {
		paper = this._scope;
		var now = Date.now() / 1000,
			delta = this._last ? now - this._last : 0;
		this._last = now;
		this.emit('frame', new Base({
			delta: delta,
			time: this._time += delta,
			count: this._count++
		}));
		if (this._stats)
			this._stats.update();
	},

	_animateItem: function(item, animate) {
		var items = this._frameItems;
		if (animate) {
			items[item._id] = {
				item: item,
				time: 0,
				count: 0
			};
			if (++this._frameItemCount === 1)
				this.on('frame', this._handleFrameItems);
		} else {
			delete items[item._id];
			if (--this._frameItemCount === 0) {
				this.off('frame', this._handleFrameItems);
			}
		}
	},

	_handleFrameItems: function(event) {
		for (var i in this._frameItems) {
			var entry = this._frameItems[i];
			entry.item.emit('frame', new Base(event, {
				time: entry.time += event.delta,
				count: entry.count++
			}));
		}
	},

	_changed: function() {
		this._project._changed(2049);
		this._bounds = this._decomposed = undefined;
	},

	getElement: function() {
		return this._element;
	},

	getPixelRatio: function() {
		return this._pixelRatio;
	},

	getResolution: function() {
		return this._pixelRatio * 72;
	},

	getViewSize: function() {
		var size = this._viewSize;
		return new LinkedSize(size.width, size.height, this, 'setViewSize');
	},

	setViewSize: function() {
		var size = Size.read(arguments),
			delta = size.subtract(this._viewSize);
		if (delta.isZero())
			return;
		this._setElementSize(size.width, size.height);
		this._viewSize.set(size);
		this._changed();
		this.emit('resize', { size: size, delta: delta });
		if (this._autoUpdate) {
			this.update();
		}
	},

	_setElementSize: function(width, height) {
		var element = this._element;
		if (element) {
			if (element.width !== width)
				element.width = width;
			if (element.height !== height)
				element.height = height;
		}
	},

	getBounds: function() {
		if (!this._bounds)
			this._bounds = this._matrix.inverted()._transformBounds(
					new Rectangle(new Point(), this._viewSize));
		return this._bounds;
	},

	getSize: function() {
		return this.getBounds().getSize();
	},

	isVisible: function() {
		return DomElement.isInView(this._element);
	},

	isInserted: function() {
		return DomElement.isInserted(this._element);
	},

	getPixelSize: function(size) {
		var element = this._element,
			pixels;
		if (element) {
			var parent = element.parentNode,
				temp = document.createElement('div');
			temp.style.fontSize = size;
			parent.appendChild(temp);
			pixels = parseFloat(DomElement.getStyles(temp).fontSize);
			parent.removeChild(temp);
		} else {
			pixels = parseFloat(pixels);
		}
		return pixels;
	},

	getTextWidth: function(font, lines) {
		return 0;
	}
}, Base.each(['rotate', 'scale', 'shear', 'skew'], function(key) {
	var rotate = key === 'rotate';
	this[key] = function() {
		var value = (rotate ? Base : Point).read(arguments),
			center = Point.read(arguments, 0, { readNull: true });
		return this.transform(new Matrix()[key](value,
				center || this.getCenter(true)));
	};
}, {
	_decompose: function() {
		return this._decomposed || (this._decomposed = this._matrix.decompose());
	},

	translate: function() {
		var mx = new Matrix();
		return this.transform(mx.translate.apply(mx, arguments));
	},

	getCenter: function() {
		return this.getBounds().getCenter();
	},

	setCenter: function() {
		var center = Point.read(arguments);
		this.translate(this.getCenter().subtract(center));
	},

	getZoom: function() {
		var decomposed = this._decompose(),
			scaling = decomposed && decomposed.scaling;
		return scaling ? (scaling.x + scaling.y) / 2 : 0;
	},

	setZoom: function(zoom) {
		this.transform(new Matrix().scale(zoom / this.getZoom(),
			this.getCenter()));
	},

	getRotation: function() {
		var decomposed = this._decompose();
		return decomposed && decomposed.rotation;
	},

	setRotation: function(rotation) {
		var current = this.getRotation();
		if (current != null && rotation != null) {
			this.rotate(rotation - current);
		}
	},

	getScaling: function() {
		var decomposed = this._decompose(),
			scaling = decomposed && decomposed.scaling;
		return scaling
				? new LinkedPoint(scaling.x, scaling.y, this, 'setScaling')
				: undefined;
	},

	setScaling: function() {
		var current = this.getScaling(),
			scaling = Point.read(arguments, 0, { clone: true, readNull: true });
		if (current && scaling) {
			this.scale(scaling.x / current.x, scaling.y / current.y);
		}
	},

	getMatrix: function() {
		return this._matrix;
	},

	setMatrix: function() {
		var matrix = this._matrix;
		matrix.initialize.apply(matrix, arguments);
	},

	transform: function(matrix) {
		this._matrix.append(matrix);
	},

	scrollBy: function() {
		this.translate(Point.read(arguments).negate());
	}
}), {

	projectToView: function() {
		return this._matrix._transformPoint(Point.read(arguments));
	},

	viewToProject: function() {
		return this._matrix._inverseTransform(Point.read(arguments));
	},

	getEventPoint: function(event) {
		return this.viewToProject(DomEvent.getOffset(event, this._element));
	},

}, {
	statics: {
		_views: [],
		_viewsById: {},
		_id: 0,

		create: function(project, element) {
			if (document && typeof element === 'string')
				element = document.getElementById(element);
			var ctor = window ? CanvasView : View;
			return new ctor(project, element);
		}
	}
},
new function() {
	if (!window)
		return;
	var prevFocus,
		tempFocus,
		dragging = false,
		mouseDown = false;

	function getView(event) {
		var target = DomEvent.getTarget(event);
		return target.getAttribute && View._viewsById[
				target.getAttribute('id')];
	}

	function updateFocus() {
		var view = View._focused;
		if (!view || !view.isVisible()) {
			for (var i = 0, l = View._views.length; i < l; i++) {
				if ((view = View._views[i]).isVisible()) {
					View._focused = tempFocus = view;
					break;
				}
			}
		}
	}

	function handleMouseMove(view, event, point) {
		view._handleMouseEvent('mousemove', event, point);
	}

	var navigator = window.navigator,
		mousedown, mousemove, mouseup;
	if (navigator.pointerEnabled || navigator.msPointerEnabled) {
		mousedown = 'pointerdown MSPointerDown';
		mousemove = 'pointermove MSPointerMove';
		mouseup = 'pointerup pointercancel MSPointerUp MSPointerCancel';
	} else {
		mousedown = 'touchstart';
		mousemove = 'touchmove';
		mouseup = 'touchend touchcancel';
		if (!('ontouchstart' in window && navigator.userAgent.match(
				/mobile|tablet|ip(ad|hone|od)|android|silk/i))) {
			mousedown += ' mousedown';
			mousemove += ' mousemove';
			mouseup += ' mouseup';
		}
	}

	var viewEvents = {},
		docEvents = {
			mouseout: function(event) {
				var view = View._focused,
					target = DomEvent.getRelatedTarget(event);
				if (view && (!target || target.nodeName === 'HTML')) {
					var offset = DomEvent.getOffset(event, view._element),
						x = offset.x,
						abs = Math.abs,
						ax = abs(x),
						max = 1 << 25,
						diff = ax - max;
					offset.x = abs(diff) < ax ? diff * (x < 0 ? -1 : 1) : x;
					handleMouseMove(view, event, view.viewToProject(offset));
				}
			},

			scroll: updateFocus
		};

	viewEvents[mousedown] = function(event) {
		var view = View._focused = getView(event);
		if (!dragging) {
			dragging = true;
			view._handleMouseEvent('mousedown', event);
		}
	};

	docEvents[mousemove] = function(event) {
		var view = View._focused;
		if (!mouseDown) {
			var target = getView(event);
			if (target) {
				if (view !== target) {
					if (view)
						handleMouseMove(view, event);
					if (!prevFocus)
						prevFocus = view;
					view = View._focused = tempFocus = target;
				}
			} else if (tempFocus && tempFocus === view) {
				if (prevFocus && !prevFocus.isInserted())
					prevFocus = null;
				view = View._focused = prevFocus;
				prevFocus = null;
				updateFocus();
			}
		}
		if (view)
			handleMouseMove(view, event);
	};

	docEvents[mousedown] = function() {
		mouseDown = true;
	};

	docEvents[mouseup] = function(event) {
		var view = View._focused;
		if (view && dragging)
			view._handleMouseEvent('mouseup', event);
		mouseDown = dragging = false;
	};

	DomEvent.add(document, docEvents);

	DomEvent.add(window, {
		load: updateFocus
	});

	var called = false,
		prevented = false,
		fallbacks = {
			doubleclick: 'click',
			mousedrag: 'mousemove'
		},
		wasInView = false,
		overView,
		downPoint,
		lastPoint,
		downItem,
		overItem,
		dragItem,
		clickItem,
		clickTime,
		dblClick;

	function emitMouseEvent(obj, target, type, event, point, prevPoint,
			stopItem) {
		var stopped = false,
			mouseEvent;

		function emit(obj, type) {
			if (obj.responds(type)) {
				if (!mouseEvent) {
					mouseEvent = new MouseEvent(type, event, point,
							target || obj,
							prevPoint ? point.subtract(prevPoint) : null);
				}
				if (obj.emit(type, mouseEvent)) {
					called = true;
					if (mouseEvent.prevented)
						prevented = true;
					if (mouseEvent.stopped)
						return stopped = true;
				}
			} else {
				var fallback = fallbacks[type];
				if (fallback)
					return emit(obj, fallback);
			}
		}

		while (obj && obj !== stopItem) {
			if (emit(obj, type))
				break;
			obj = obj._parent;
		}
		return stopped;
	}

	function emitMouseEvents(view, hitItem, type, event, point, prevPoint) {
		view._project.removeOn(type);
		prevented = called = false;
		return (dragItem && emitMouseEvent(dragItem, null, type, event,
					point, prevPoint)
			|| hitItem && hitItem !== dragItem
				&& !hitItem.isDescendant(dragItem)
				&& emitMouseEvent(hitItem, null, type, event, point, prevPoint,
					dragItem)
			|| emitMouseEvent(view, dragItem || hitItem || view, type, event,
					point, prevPoint));
	}

	var itemEventsMap = {
		mousedown: {
			mousedown: 1,
			mousedrag: 1,
			click: 1,
			doubleclick: 1
		},
		mouseup: {
			mouseup: 1,
			mousedrag: 1,
			click: 1,
			doubleclick: 1
		},
		mousemove: {
			mousedrag: 1,
			mousemove: 1,
			mouseenter: 1,
			mouseleave: 1
		}
	};

	return {
		_viewEvents: viewEvents,

		_handleMouseEvent: function(type, event, point) {
			var itemEvents = this._itemEvents,
				hitItems = itemEvents.native[type],
				nativeMove = type === 'mousemove',
				tool = this._scope.tool,
				view = this;

			function responds(type) {
				return itemEvents.virtual[type] || view.responds(type)
						|| tool && tool.responds(type);
			}

			if (nativeMove && dragging && responds('mousedrag'))
				type = 'mousedrag';
			if (!point)
				point = this.getEventPoint(event);

			var inView = this.getBounds().contains(point),
				hit = hitItems && inView && view._project.hitTest(point, {
					tolerance: 0,
					fill: true,
					stroke: true
				}),
				hitItem = hit && hit.item || null,
				handle = false,
				mouse = {};
			mouse[type.substr(5)] = true;

			if (hitItems && hitItem !== overItem) {
				if (overItem) {
					emitMouseEvent(overItem, null, 'mouseleave', event, point);
				}
				if (hitItem) {
					emitMouseEvent(hitItem, null, 'mouseenter', event, point);
				}
				overItem = hitItem;
			}
			if (wasInView ^ inView) {
				emitMouseEvent(this, null, inView ? 'mouseenter' : 'mouseleave',
						event, point);
				overView = inView ? this : null;
				handle = true;
			}
			if ((inView || mouse.drag) && !point.equals(lastPoint)) {
				emitMouseEvents(this, hitItem, nativeMove ? type : 'mousemove',
						event, point, lastPoint);
				handle = true;
			}
			wasInView = inView;
			if (mouse.down && inView || mouse.up && downPoint) {
				emitMouseEvents(this, hitItem, type, event, point, downPoint);
				if (mouse.down) {
					dblClick = hitItem === clickItem
						&& (Date.now() - clickTime < 300);
					downItem = clickItem = hitItem;
					if (!prevented && hitItem) {
						var item = hitItem;
						while (item && !item.responds('mousedrag'))
							item = item._parent;
						if (item)
							dragItem = hitItem;
					}
					downPoint = point;
				} else if (mouse.up) {
					if (!prevented && hitItem === downItem) {
						clickTime = Date.now();
						emitMouseEvents(this, hitItem, dblClick ? 'doubleclick'
								: 'click', event, point, downPoint);
						dblClick = false;
					}
					downItem = dragItem = null;
				}
				wasInView = false;
				handle = true;
			}
			lastPoint = point;
			if (handle && tool) {
				called = tool._handleMouseEvent(type, event, point, mouse)
					|| called;
			}

			if (called && !mouse.move || mouse.down && responds('mouseup'))
				event.preventDefault();
		},

		_handleKeyEvent: function(type, event, key, character) {
			var scope = this._scope,
				tool = scope.tool,
				keyEvent;

			function emit(obj) {
				if (obj.responds(type)) {
					paper = scope;
					obj.emit(type, keyEvent = keyEvent
							|| new KeyEvent(type, event, key, character));
				}
			}

			if (this.isVisible()) {
				emit(this);
				if (tool && tool.responds(type))
					emit(tool);
			}
		},

		_countItemEvent: function(type, sign) {
			var itemEvents = this._itemEvents,
				native = itemEvents.native,
				virtual = itemEvents.virtual;
			for (var key in itemEventsMap) {
				native[key] = (native[key] || 0)
						+ (itemEventsMap[key][type] || 0) * sign;
			}
			virtual[type] = (virtual[type] || 0) + sign;
		},

		statics: {
			updateFocus: updateFocus
		}
	};
});

var CanvasView = View.extend({
	_class: 'CanvasView',

	initialize: function CanvasView(project, canvas) {
		if (!(canvas instanceof window.HTMLCanvasElement)) {
			var size = Size.read(arguments, 1);
			if (size.isZero())
				throw new Error(
						'Cannot create CanvasView with the provided argument: '
						+ Base.slice(arguments, 1));
			canvas = CanvasProvider.getCanvas(size);
		}
		var ctx = this._context = canvas.getContext('2d');
		ctx.save();
		this._pixelRatio = 1;
		if (!/^off|false$/.test(PaperScope.getAttribute(canvas, 'hidpi'))) {
			var deviceRatio = window.devicePixelRatio || 1,
				backingStoreRatio = DomElement.getPrefixed(ctx,
						'backingStorePixelRatio') || 1;
			this._pixelRatio = deviceRatio / backingStoreRatio;
		}
		View.call(this, project, canvas);
		this._needsUpdate = true;
	},

	remove: function remove() {
		this._context.restore();
		return remove.base.call(this);
	},

	_setElementSize: function _setElementSize(width, height) {
		var pixelRatio = this._pixelRatio;
		_setElementSize.base.call(this, width * pixelRatio, height * pixelRatio);
		if (pixelRatio !== 1) {
			var element = this._element,
				ctx = this._context;
			if (!PaperScope.hasAttribute(element, 'resize')) {
				var style = element.style;
				style.width = width + 'px';
				style.height = height + 'px';
			}
			ctx.restore();
			ctx.save();
			ctx.scale(pixelRatio, pixelRatio);
		}
	},

	getPixelSize: function getPixelSize(size) {
		var agent = paper.agent,
			pixels;
		if (agent && agent.firefox) {
			pixels = getPixelSize.base.call(this, size);
		} else {
			var ctx = this._context,
				prevFont = ctx.font;
			ctx.font = size + ' serif';
			pixels = parseFloat(ctx.font);
			ctx.font = prevFont;
		}
		return pixels;
	},

	getTextWidth: function(font, lines) {
		var ctx = this._context,
			prevFont = ctx.font,
			width = 0;
		ctx.font = font;
		for (var i = 0, l = lines.length; i < l; i++)
			width = Math.max(width, ctx.measureText(lines[i]).width);
		ctx.font = prevFont;
		return width;
	},

	update: function() {
		if (!this._needsUpdate)
			return false;
		var project = this._project,
			ctx = this._context,
			size = this._viewSize;
		ctx.clearRect(0, 0, size.width + 1, size.height + 1);
		if (project)
			project.draw(ctx, this._matrix, this._pixelRatio);
		this._needsUpdate = false;
		return true;
	}
});

var Event = Base.extend({
	_class: 'Event',

	initialize: function Event(event) {
		this.event = event;
		this.type = event && event.type;
	},

	prevented: false,
	stopped: false,

	preventDefault: function() {
		this.prevented = true;
		this.event.preventDefault();
	},

	stopPropagation: function() {
		this.stopped = true;
		this.event.stopPropagation();
	},

	stop: function() {
		this.stopPropagation();
		this.preventDefault();
	},

	getTimeStamp: function() {
		return this.event.timeStamp;
	},

	getModifiers: function() {
		return Key.modifiers;
	}
});

var KeyEvent = Event.extend({
	_class: 'KeyEvent',

	initialize: function KeyEvent(type, event, key, character) {
		this.type = type;
		this.event = event;
		this.key = key;
		this.character = character;
	},

	toString: function() {
		return "{ type: '" + this.type
				+ "', key: '" + this.key
				+ "', character: '" + this.character
				+ "', modifiers: " + this.getModifiers()
				+ " }";
	}
});

var Key = new function() {
	var keyLookup = {
			'\t': 'tab',
			' ': 'space',
			'\b': 'backspace',
			'\x7f': 'delete',
			'Spacebar': 'space',
			'Del': 'delete',
			'Win': 'meta',
			'Esc': 'escape'
		},

		charLookup = {
			'tab': '\t',
			'space': ' ',
			'enter': '\r'
		},

		keyMap = {},
		charMap = {},
		metaFixMap,
		downKey,

		modifiers = new Base({
			shift: false,
			control: false,
			alt: false,
			meta: false,
			capsLock: false,
			space: false
		}).inject({
			option: {
				get: function() {
					return this.alt;
				}
			},

			command: {
				get: function() {
					var agent = paper && paper.agent;
					return agent && agent.mac ? this.meta : this.control;
				}
			}
		});

	function getKey(event) {
		var key = event.key || event.keyIdentifier;
		key = /^U\+/.test(key)
				? String.fromCharCode(parseInt(key.substr(2), 16))
				: /^Arrow[A-Z]/.test(key) ? key.substr(5)
				: key === 'Unidentified' ? String.fromCharCode(event.keyCode)
				: key;
		return keyLookup[key] ||
				(key.length > 1 ? Base.hyphenate(key) : key.toLowerCase());
	}

	function handleKey(down, key, character, event) {
		var type = down ? 'keydown' : 'keyup',
			view = View._focused,
			name;
		keyMap[key] = down;
		if (down) {
			charMap[key] = character;
		} else {
			delete charMap[key];
		}
		if (key.length > 1 && (name = Base.camelize(key)) in modifiers) {
			modifiers[name] = down;
			var agent = paper && paper.agent;
			if (name === 'meta' && agent && agent.mac) {
				if (down) {
					metaFixMap = {};
				} else {
					for (var k in metaFixMap) {
						if (k in charMap)
							handleKey(false, k, metaFixMap[k], event);
					}
					metaFixMap = null;
				}
			}
		} else if (down && metaFixMap) {
			metaFixMap[key] = character;
		}
		if (view) {
			view._handleKeyEvent(down ? 'keydown' : 'keyup', event, key,
					character);
		}
	}

	DomEvent.add(document, {
		keydown: function(event) {
			var key = getKey(event),
				agent = paper && paper.agent;
			if (key.length > 1 || agent && (agent.chrome && (event.altKey
						|| agent.mac && event.metaKey
						|| !agent.mac && event.ctrlKey))) {
				handleKey(true, key,
						charLookup[key] || (key.length > 1 ? '' : key), event);
			} else {
				downKey = key;
			}
		},

		keypress: function(event) {
			if (downKey) {
				var key = getKey(event),
					code = event.charCode,
					character = code >= 32 ? String.fromCharCode(code)
						: key.length > 1 ? '' : key;
				if (key !== downKey) {
					key = character.toLowerCase();
				}
				handleKey(true, key, character, event);
				downKey = null;
			}
		},

		keyup: function(event) {
			var key = getKey(event);
			if (key in charMap)
				handleKey(false, key, charMap[key], event);
		}
	});

	DomEvent.add(window, {
		blur: function(event) {
			for (var key in charMap)
				handleKey(false, key, charMap[key], event);
		}
	});

	return {
		modifiers: modifiers,

		isDown: function(key) {
			return !!keyMap[key];
		}
	};
};

var MouseEvent = Event.extend({
	_class: 'MouseEvent',

	initialize: function MouseEvent(type, event, point, target, delta) {
		this.type = type;
		this.event = event;
		this.point = point;
		this.target = target;
		this.delta = delta;
	},

	toString: function() {
		return "{ type: '" + this.type
				+ "', point: " + this.point
				+ ', target: ' + this.target
				+ (this.delta ? ', delta: ' + this.delta : '')
				+ ', modifiers: ' + this.getModifiers()
				+ ' }';
	}
});

var ToolEvent = Event.extend({
	_class: 'ToolEvent',
	_item: null,

	initialize: function ToolEvent(tool, type, event) {
		this.tool = tool;
		this.type = type;
		this.event = event;
	},

	_choosePoint: function(point, toolPoint) {
		return point ? point : toolPoint ? toolPoint.clone() : null;
	},

	getPoint: function() {
		return this._choosePoint(this._point, this.tool._point);
	},

	setPoint: function(point) {
		this._point = point;
	},

	getLastPoint: function() {
		return this._choosePoint(this._lastPoint, this.tool._lastPoint);
	},

	setLastPoint: function(lastPoint) {
		this._lastPoint = lastPoint;
	},

	getDownPoint: function() {
		return this._choosePoint(this._downPoint, this.tool._downPoint);
	},

	setDownPoint: function(downPoint) {
		this._downPoint = downPoint;
	},

	getMiddlePoint: function() {
		if (!this._middlePoint && this.tool._lastPoint) {
			return this.tool._point.add(this.tool._lastPoint).divide(2);
		}
		return this._middlePoint;
	},

	setMiddlePoint: function(middlePoint) {
		this._middlePoint = middlePoint;
	},

	getDelta: function() {
		return !this._delta && this.tool._lastPoint
				? this.tool._point.subtract(this.tool._lastPoint)
				: this._delta;
	},

	setDelta: function(delta) {
		this._delta = delta;
	},

	getCount: function() {
		return this.tool[/^mouse(down|up)$/.test(this.type)
				? '_downCount' : '_moveCount'];
	},

	setCount: function(count) {
		this.tool[/^mouse(down|up)$/.test(this.type) ? 'downCount' : 'count']
			= count;
	},

	getItem: function() {
		if (!this._item) {
			var result = this.tool._scope.project.hitTest(this.getPoint());
			if (result) {
				var item = result.item,
					parent = item._parent;
				while (/^(Group|CompoundPath)$/.test(parent._class)) {
					item = parent;
					parent = parent._parent;
				}
				this._item = item;
			}
		}
		return this._item;
	},

	setItem: function(item) {
		this._item = item;
	},

	toString: function() {
		return '{ type: ' + this.type
				+ ', point: ' + this.getPoint()
				+ ', count: ' + this.getCount()
				+ ', modifiers: ' + this.getModifiers()
				+ ' }';
	}
});

var Tool = PaperScopeItem.extend({
	_class: 'Tool',
	_list: 'tools',
	_reference: 'tool',
	_events: ['onMouseDown', 'onMouseUp', 'onMouseDrag', 'onMouseMove',
			'onActivate', 'onDeactivate', 'onEditOptions', 'onKeyDown',
			'onKeyUp'],

	initialize: function Tool(props) {
		PaperScopeItem.call(this);
		this._moveCount = -1;
		this._downCount = -1;
		this.set(props);
	},

	getMinDistance: function() {
		return this._minDistance;
	},

	setMinDistance: function(minDistance) {
		this._minDistance = minDistance;
		if (minDistance != null && this._maxDistance != null
				&& minDistance > this._maxDistance) {
			this._maxDistance = minDistance;
		}
	},

	getMaxDistance: function() {
		return this._maxDistance;
	},

	setMaxDistance: function(maxDistance) {
		this._maxDistance = maxDistance;
		if (this._minDistance != null && maxDistance != null
				&& maxDistance < this._minDistance) {
			this._minDistance = maxDistance;
		}
	},

	getFixedDistance: function() {
		return this._minDistance == this._maxDistance
			? this._minDistance : null;
	},

	setFixedDistance: function(distance) {
		this._minDistance = this._maxDistance = distance;
	},

	_handleMouseEvent: function(type, event, point, mouse) {
		paper = this._scope;
		if (mouse.drag && !this.responds(type))
			type = 'mousemove';
		var move = mouse.move || mouse.drag,
			responds = this.responds(type),
			minDistance = this.minDistance,
			maxDistance = this.maxDistance,
			called = false,
			tool = this;
		function update(minDistance, maxDistance) {
			var pt = point,
				toolPoint = move ? tool._point : (tool._downPoint || pt);
			if (move) {
				if (tool._moveCount && pt.equals(toolPoint)) {
					return false;
				}
				if (toolPoint && (minDistance != null || maxDistance != null)) {
					var vector = pt.subtract(toolPoint),
						distance = vector.getLength();
					if (distance < (minDistance || 0))
						return false;
					if (maxDistance) {
						pt = toolPoint.add(vector.normalize(
								Math.min(distance, maxDistance)));
					}
				}
				tool._moveCount++;
			}
			tool._point = pt;
			tool._lastPoint = toolPoint || pt;
			if (mouse.down) {
				tool._moveCount = -1;
				tool._downPoint = pt;
				tool._downCount++;
			}
			return true;
		}

		function emit() {
			if (responds) {
				called = tool.emit(type, new ToolEvent(tool, type, event))
						|| called;
			}
		}

		if (mouse.down) {
			update();
			emit();
		} else if (mouse.up) {
			update(null, maxDistance);
			emit();
		} else if (responds) {
			while (update(minDistance, maxDistance))
				emit();
		}
		return called;
	}

});

var Http = {
	request: function(options) {
		var xhr = new self.XMLHttpRequest();
		xhr.open((options.method || 'get').toUpperCase(), options.url,
				Base.pick(options.async, true));
		if (options.mimeType)
			xhr.overrideMimeType(options.mimeType);
		xhr.onload = function() {
			var status = xhr.status;
			if (status === 0 || status === 200) {
				if (options.onLoad) {
					options.onLoad.call(xhr, xhr.responseText);
				}
			} else {
				xhr.onerror();
			}
		};
		xhr.onerror = function() {
			var status = xhr.status,
				message = 'Could not load "' + options.url + '" (Status: '
						+ status + ')';
			if (options.onError) {
				options.onError(message, status);
			} else {
				throw new Error(message);
			}
		};
		return xhr.send(null);
	}
};

var CanvasProvider = {
	canvases: [],

	getCanvas: function(width, height) {
		if (!window)
			return null;
		var canvas,
			clear = true;
		if (typeof width === 'object') {
			height = width.height;
			width = width.width;
		}
		if (this.canvases.length) {
			canvas = this.canvases.pop();
		} else {
			canvas = document.createElement('canvas');
			clear = false;
		}
		var ctx = canvas.getContext('2d');
		if (!ctx) {
			throw new Error('Canvas ' + canvas +
					' is unable to provide a 2D context.');
		}
		if (canvas.width === width && canvas.height === height) {
			if (clear)
				ctx.clearRect(0, 0, width + 1, height + 1);
		} else {
			canvas.width = width;
			canvas.height = height;
		}
		ctx.save();
		return canvas;
	},

	getContext: function(width, height) {
		var canvas = this.getCanvas(width, height);
		return canvas ? canvas.getContext('2d') : null;
	},

	release: function(obj) {
		var canvas = obj && obj.canvas ? obj.canvas : obj;
		if (canvas && canvas.getContext) {
			canvas.getContext('2d').restore();
			this.canvases.push(canvas);
		}
	}
};

var BlendMode = new function() {
	var min = Math.min,
		max = Math.max,
		abs = Math.abs,
		sr, sg, sb, sa,
		br, bg, bb, ba,
		dr, dg, db;

	function getLum(r, g, b) {
		return 0.2989 * r + 0.587 * g + 0.114 * b;
	}

	function setLum(r, g, b, l) {
		var d = l - getLum(r, g, b);
		dr = r + d;
		dg = g + d;
		db = b + d;
		var l = getLum(dr, dg, db),
			mn = min(dr, dg, db),
			mx = max(dr, dg, db);
		if (mn < 0) {
			var lmn = l - mn;
			dr = l + (dr - l) * l / lmn;
			dg = l + (dg - l) * l / lmn;
			db = l + (db - l) * l / lmn;
		}
		if (mx > 255) {
			var ln = 255 - l,
				mxl = mx - l;
			dr = l + (dr - l) * ln / mxl;
			dg = l + (dg - l) * ln / mxl;
			db = l + (db - l) * ln / mxl;
		}
	}

	function getSat(r, g, b) {
		return max(r, g, b) - min(r, g, b);
	}

	function setSat(r, g, b, s) {
		var col = [r, g, b],
			mx = max(r, g, b),
			mn = min(r, g, b),
			md;
		mn = mn === r ? 0 : mn === g ? 1 : 2;
		mx = mx === r ? 0 : mx === g ? 1 : 2;
		md = min(mn, mx) === 0 ? max(mn, mx) === 1 ? 2 : 1 : 0;
		if (col[mx] > col[mn]) {
			col[md] = (col[md] - col[mn]) * s / (col[mx] - col[mn]);
			col[mx] = s;
		} else {
			col[md] = col[mx] = 0;
		}
		col[mn] = 0;
		dr = col[0];
		dg = col[1];
		db = col[2];
	}

	var modes = {
		multiply: function() {
			dr = br * sr / 255;
			dg = bg * sg / 255;
			db = bb * sb / 255;
		},

		screen: function() {
			dr = br + sr - (br * sr / 255);
			dg = bg + sg - (bg * sg / 255);
			db = bb + sb - (bb * sb / 255);
		},

		overlay: function() {
			dr = br < 128 ? 2 * br * sr / 255 : 255 - 2 * (255 - br) * (255 - sr) / 255;
			dg = bg < 128 ? 2 * bg * sg / 255 : 255 - 2 * (255 - bg) * (255 - sg) / 255;
			db = bb < 128 ? 2 * bb * sb / 255 : 255 - 2 * (255 - bb) * (255 - sb) / 255;
		},

		'soft-light': function() {
			var t = sr * br / 255;
			dr = t + br * (255 - (255 - br) * (255 - sr) / 255 - t) / 255;
			t = sg * bg / 255;
			dg = t + bg * (255 - (255 - bg) * (255 - sg) / 255 - t) / 255;
			t = sb * bb / 255;
			db = t + bb * (255 - (255 - bb) * (255 - sb) / 255 - t) / 255;
		},

		'hard-light': function() {
			dr = sr < 128 ? 2 * sr * br / 255 : 255 - 2 * (255 - sr) * (255 - br) / 255;
			dg = sg < 128 ? 2 * sg * bg / 255 : 255 - 2 * (255 - sg) * (255 - bg) / 255;
			db = sb < 128 ? 2 * sb * bb / 255 : 255 - 2 * (255 - sb) * (255 - bb) / 255;
		},

		'color-dodge': function() {
			dr = br === 0 ? 0 : sr === 255 ? 255 : min(255, 255 * br / (255 - sr));
			dg = bg === 0 ? 0 : sg === 255 ? 255 : min(255, 255 * bg / (255 - sg));
			db = bb === 0 ? 0 : sb === 255 ? 255 : min(255, 255 * bb / (255 - sb));
		},

		'color-burn': function() {
			dr = br === 255 ? 255 : sr === 0 ? 0 : max(0, 255 - (255 - br) * 255 / sr);
			dg = bg === 255 ? 255 : sg === 0 ? 0 : max(0, 255 - (255 - bg) * 255 / sg);
			db = bb === 255 ? 255 : sb === 0 ? 0 : max(0, 255 - (255 - bb) * 255 / sb);
		},

		darken: function() {
			dr = br < sr ? br : sr;
			dg = bg < sg ? bg : sg;
			db = bb < sb ? bb : sb;
		},

		lighten: function() {
			dr = br > sr ? br : sr;
			dg = bg > sg ? bg : sg;
			db = bb > sb ? bb : sb;
		},

		difference: function() {
			dr = br - sr;
			if (dr < 0)
				dr = -dr;
			dg = bg - sg;
			if (dg < 0)
				dg = -dg;
			db = bb - sb;
			if (db < 0)
				db = -db;
		},

		exclusion: function() {
			dr = br + sr * (255 - br - br) / 255;
			dg = bg + sg * (255 - bg - bg) / 255;
			db = bb + sb * (255 - bb - bb) / 255;
		},

		hue: function() {
			setSat(sr, sg, sb, getSat(br, bg, bb));
			setLum(dr, dg, db, getLum(br, bg, bb));
		},

		saturation: function() {
			setSat(br, bg, bb, getSat(sr, sg, sb));
			setLum(dr, dg, db, getLum(br, bg, bb));
		},

		luminosity: function() {
			setLum(br, bg, bb, getLum(sr, sg, sb));
		},

		color: function() {
			setLum(sr, sg, sb, getLum(br, bg, bb));
		},

		add: function() {
			dr = min(br + sr, 255);
			dg = min(bg + sg, 255);
			db = min(bb + sb, 255);
		},

		subtract: function() {
			dr = max(br - sr, 0);
			dg = max(bg - sg, 0);
			db = max(bb - sb, 0);
		},

		average: function() {
			dr = (br + sr) / 2;
			dg = (bg + sg) / 2;
			db = (bb + sb) / 2;
		},

		negation: function() {
			dr = 255 - abs(255 - sr - br);
			dg = 255 - abs(255 - sg - bg);
			db = 255 - abs(255 - sb - bb);
		}
	};

	var nativeModes = this.nativeModes = Base.each([
		'source-over', 'source-in', 'source-out', 'source-atop',
		'destination-over', 'destination-in', 'destination-out',
		'destination-atop', 'lighter', 'darker', 'copy', 'xor'
	], function(mode) {
		this[mode] = true;
	}, {});

	var ctx = CanvasProvider.getContext(1, 1);
	if (ctx) {
		Base.each(modes, function(func, mode) {
			var darken = mode === 'darken',
				ok = false;
			ctx.save();
			try {
				ctx.fillStyle = darken ? '#300' : '#a00';
				ctx.fillRect(0, 0, 1, 1);
				ctx.globalCompositeOperation = mode;
				if (ctx.globalCompositeOperation === mode) {
					ctx.fillStyle = darken ? '#a00' : '#300';
					ctx.fillRect(0, 0, 1, 1);
					ok = ctx.getImageData(0, 0, 1, 1).data[0] !== darken
							? 170 : 51;
				}
			} catch (e) {}
			ctx.restore();
			nativeModes[mode] = ok;
		});
		CanvasProvider.release(ctx);
	}

	this.process = function(mode, srcContext, dstContext, alpha, offset) {
		var srcCanvas = srcContext.canvas,
			normal = mode === 'normal';
		if (normal || nativeModes[mode]) {
			dstContext.save();
			dstContext.setTransform(1, 0, 0, 1, 0, 0);
			dstContext.globalAlpha = alpha;
			if (!normal)
				dstContext.globalCompositeOperation = mode;
			dstContext.drawImage(srcCanvas, offset.x, offset.y);
			dstContext.restore();
		} else {
			var process = modes[mode];
			if (!process)
				return;
			var dstData = dstContext.getImageData(offset.x, offset.y,
					srcCanvas.width, srcCanvas.height),
				dst = dstData.data,
				src = srcContext.getImageData(0, 0,
					srcCanvas.width, srcCanvas.height).data;
			for (var i = 0, l = dst.length; i < l; i += 4) {
				sr = src[i];
				br = dst[i];
				sg = src[i + 1];
				bg = dst[i + 1];
				sb = src[i + 2];
				bb = dst[i + 2];
				sa = src[i + 3];
				ba = dst[i + 3];
				process();
				var a1 = sa * alpha / 255,
					a2 = 1 - a1;
				dst[i] = a1 * dr + a2 * br;
				dst[i + 1] = a1 * dg + a2 * bg;
				dst[i + 2] = a1 * db + a2 * bb;
				dst[i + 3] = sa * alpha + a2 * ba;
			}
			dstContext.putImageData(dstData, offset.x, offset.y);
		}
	};
};

var SvgElement = new function() {
	var svg = 'http://www.w3.org/2000/svg',
		xmlns = 'http://www.w3.org/2000/xmlns',
		xlink = 'http://www.w3.org/1999/xlink',
		attributeNamespace = {
			href: xlink,
			xlink: xmlns,
			xmlns: xmlns + '/',
			'xmlns:xlink': xmlns + '/'
		};

	function create(tag, attributes, formatter) {
		return set(document.createElementNS(svg, tag), attributes, formatter);
	}

	function get(node, name) {
		var namespace = attributeNamespace[name],
			value = namespace
				? node.getAttributeNS(namespace, name)
				: node.getAttribute(name);
		return value === 'null' ? null : value;
	}

	function set(node, attributes, formatter) {
		for (var name in attributes) {
			var value = attributes[name],
				namespace = attributeNamespace[name];
			if (typeof value === 'number' && formatter)
				value = formatter.number(value);
			if (namespace) {
				node.setAttributeNS(namespace, name, value);
			} else {
				node.setAttribute(name, value);
			}
		}
		return node;
	}

	return {
		svg: svg,
		xmlns: xmlns,
		xlink: xlink,

		create: create,
		get: get,
		set: set
	};
};

var SvgStyles = Base.each({
	fillColor: ['fill', 'color'],
	fillRule: ['fill-rule', 'string'],
	strokeColor: ['stroke', 'color'],
	strokeWidth: ['stroke-width', 'number'],
	strokeCap: ['stroke-linecap', 'string'],
	strokeJoin: ['stroke-linejoin', 'string'],
	strokeScaling: ['vector-effect', 'lookup', {
		true: 'none',
		false: 'non-scaling-stroke'
	}, function(item, value) {
		return !value
				&& (item instanceof PathItem
					|| item instanceof Shape
					|| item instanceof TextItem);
	}],
	miterLimit: ['stroke-miterlimit', 'number'],
	dashArray: ['stroke-dasharray', 'array'],
	dashOffset: ['stroke-dashoffset', 'number'],
	fontFamily: ['font-family', 'string'],
	fontWeight: ['font-weight', 'string'],
	fontSize: ['font-size', 'number'],
	justification: ['text-anchor', 'lookup', {
		left: 'start',
		center: 'middle',
		right: 'end'
	}],
	opacity: ['opacity', 'number'],
	blendMode: ['mix-blend-mode', 'style']
}, function(entry, key) {
	var part = Base.capitalize(key),
		lookup = entry[2];
	this[key] = {
		type: entry[1],
		property: key,
		attribute: entry[0],
		toSVG: lookup,
		fromSVG: lookup && Base.each(lookup, function(value, name) {
			this[value] = name;
		}, {}),
		exportFilter: entry[3],
		get: 'get' + part,
		set: 'set' + part
	};
}, {});

new function() {
	var formatter;

	function getTransform(matrix, coordinates, center) {
		var attrs = new Base(),
			trans = matrix.getTranslation();
		if (coordinates) {
			matrix = matrix._shiftless();
			var point = matrix._inverseTransform(trans);
			attrs[center ? 'cx' : 'x'] = point.x;
			attrs[center ? 'cy' : 'y'] = point.y;
			trans = null;
		}
		if (!matrix.isIdentity()) {
			var decomposed = matrix.decompose();
			if (decomposed) {
				var parts = [],
					angle = decomposed.rotation,
					scale = decomposed.scaling,
					skew = decomposed.skewing;
				if (trans && !trans.isZero())
					parts.push('translate(' + formatter.point(trans) + ')');
				if (angle)
					parts.push('rotate(' + formatter.number(angle) + ')');
				if (!Numerical.isZero(scale.x - 1)
						|| !Numerical.isZero(scale.y - 1))
					parts.push('scale(' + formatter.point(scale) +')');
				if (skew.x)
					parts.push('skewX(' + formatter.number(skew.x) + ')');
				if (skew.y)
					parts.push('skewY(' + formatter.number(skew.y) + ')');
				attrs.transform = parts.join(' ');
			} else {
				attrs.transform = 'matrix(' + matrix.getValues().join(',') + ')';
			}
		}
		return attrs;
	}

	function exportGroup(item, options) {
		var attrs = getTransform(item._matrix),
			children = item._children;
		var node = SvgElement.create('g', attrs, formatter);
		for (var i = 0, l = children.length; i < l; i++) {
			var child = children[i];
			var childNode = exportSVG(child, options);
			if (childNode) {
				if (child.isClipMask()) {
					var clip = SvgElement.create('clipPath');
					clip.appendChild(childNode);
					setDefinition(child, clip, 'clip');
					SvgElement.set(node, {
						'clip-path': 'url(#' + clip.id + ')'
					});
				} else {
					node.appendChild(childNode);
				}
			}
		}
		return node;
	}

	function exportRaster(item, options) {
		var attrs = getTransform(item._matrix, true),
			size = item.getSize(),
			image = item.getImage();
		attrs.x -= size.width / 2;
		attrs.y -= size.height / 2;
		attrs.width = size.width;
		attrs.height = size.height;
		attrs.href = options.embedImages == false && image && image.src
				|| item.toDataURL();
		return SvgElement.create('image', attrs, formatter);
	}

	function exportPath(item, options) {
		var matchShapes = options.matchShapes;
		if (matchShapes) {
			var shape = item.toShape(false);
			if (shape)
				return exportShape(shape, options);
		}
		var segments = item._segments,
			length = segments.length,
			type,
			attrs = getTransform(item._matrix);
		if (matchShapes && length >= 2 && !item.hasHandles()) {
			if (length > 2) {
				type = item._closed ? 'polygon' : 'polyline';
				var parts = [];
				for (var i = 0; i < length; i++) {
					parts.push(formatter.point(segments[i]._point));
				}
				attrs.points = parts.join(' ');
			} else {
				type = 'line';
				var start = segments[0]._point,
					end = segments[1]._point;
				attrs.set({
					x1: start.x,
					y1: start.y,
					x2: end.x,
					y2: end.y
				});
			}
		} else {
			type = 'path';
			attrs.d = item.getPathData(null, options.precision);
		}
		return SvgElement.create(type, attrs, formatter);
	}

	function exportShape(item) {
		var type = item._type,
			radius = item._radius,
			attrs = getTransform(item._matrix, true, type !== 'rectangle');
		if (type === 'rectangle') {
			type = 'rect';
			var size = item._size,
				width = size.width,
				height = size.height;
			attrs.x -= width / 2;
			attrs.y -= height / 2;
			attrs.width = width;
			attrs.height = height;
			if (radius.isZero())
				radius = null;
		}
		if (radius) {
			if (type === 'circle') {
				attrs.r = radius;
			} else {
				attrs.rx = radius.width;
				attrs.ry = radius.height;
			}
		}
		return SvgElement.create(type, attrs, formatter);
	}

	function exportCompoundPath(item, options) {
		var attrs = getTransform(item._matrix);
		var data = item.getPathData(null, options.precision);
		if (data)
			attrs.d = data;
		return SvgElement.create('path', attrs, formatter);
	}

	function exportSymbolItem(item, options) {
		var attrs = getTransform(item._matrix, true),
			definition = item._definition,
			node = getDefinition(definition, 'symbol'),
			definitionItem = definition._item,
			bounds = definitionItem.getBounds();
		if (!node) {
			node = SvgElement.create('symbol', {
				viewBox: formatter.rectangle(bounds)
			});
			node.appendChild(exportSVG(definitionItem, options));
			setDefinition(definition, node, 'symbol');
		}
		attrs.href = '#' + node.id;
		attrs.x += bounds.x;
		attrs.y += bounds.y;
		attrs.width = bounds.width;
		attrs.height = bounds.height;
		attrs.overflow = 'visible';
		return SvgElement.create('use', attrs, formatter);
	}

	function exportGradient(color) {
		var gradientNode = getDefinition(color, 'color');
		if (!gradientNode) {
			var gradient = color.getGradient(),
				radial = gradient._radial,
				origin = color.getOrigin(),
				destination = color.getDestination(),
				attrs;
			if (radial) {
				attrs = {
					cx: origin.x,
					cy: origin.y,
					r: origin.getDistance(destination)
				};
				var highlight = color.getHighlight();
				if (highlight) {
					attrs.fx = highlight.x;
					attrs.fy = highlight.y;
				}
			} else {
				attrs = {
					x1: origin.x,
					y1: origin.y,
					x2: destination.x,
					y2: destination.y
				};
			}
			attrs.gradientUnits = 'userSpaceOnUse';
			gradientNode = SvgElement.create((radial ? 'radial' : 'linear')
					+ 'Gradient', attrs, formatter);
			var stops = gradient._stops;
			for (var i = 0, l = stops.length; i < l; i++) {
				var stop = stops[i],
					stopColor = stop._color,
					alpha = stopColor.getAlpha(),
					offset = stop._offset;
				attrs = {
					offset: offset == null ? i / (l - 1) : offset
				};
				if (stopColor)
					attrs['stop-color'] = stopColor.toCSS(true);
				if (alpha < 1)
					attrs['stop-opacity'] = alpha;
				gradientNode.appendChild(
						SvgElement.create('stop', attrs, formatter));
			}
			setDefinition(color, gradientNode, 'color');
		}
		return 'url(#' + gradientNode.id + ')';
	}

	function exportText(item) {
		var node = SvgElement.create('text', getTransform(item._matrix, true),
				formatter);
		node.textContent = item._content;
		return node;
	}

	var exporters = {
		Group: exportGroup,
		Layer: exportGroup,
		Raster: exportRaster,
		Path: exportPath,
		Shape: exportShape,
		CompoundPath: exportCompoundPath,
		SymbolItem: exportSymbolItem,
		PointText: exportText
	};

	function applyStyle(item, node, isRoot) {
		var attrs = {},
			parent = !isRoot && item.getParent(),
			style = [];

		if (item._name != null)
			attrs.id = item._name;

		Base.each(SvgStyles, function(entry) {
			var get = entry.get,
				type = entry.type,
				value = item[get]();
			if (entry.exportFilter
					? entry.exportFilter(item, value)
					: !parent || !Base.equals(parent[get](), value)) {
				if (type === 'color' && value != null) {
					var alpha = value.getAlpha();
					if (alpha < 1)
						attrs[entry.attribute + '-opacity'] = alpha;
				}
				if (type === 'style') {
					style.push(entry.attribute + ': ' + value);
				} else {
					attrs[entry.attribute] = value == null ? 'none'
							: type === 'color' ? value.gradient
								? exportGradient(value, item)
								: value.toCSS(true)
							: type === 'array' ? value.join(',')
							: type === 'lookup' ? entry.toSVG[value]
							: value;
				}
			}
		});

		if (style.length)
			attrs.style = style.join(';');

		if (attrs.opacity === 1)
			delete attrs.opacity;

		if (!item._visible)
			attrs.visibility = 'hidden';

		return SvgElement.set(node, attrs, formatter);
	}

	var definitions;
	function getDefinition(item, type) {
		if (!definitions)
			definitions = { ids: {}, svgs: {} };
		return item && definitions.svgs[type + '-'
				+ (item._id || item.__id || (item.__id = UID.get('svg')))];
	}

	function setDefinition(item, node, type) {
		if (!definitions)
			getDefinition();
		var typeId = definitions.ids[type] = (definitions.ids[type] || 0) + 1;
		node.id = type + '-' + typeId;
		definitions.svgs[type + '-' + (item._id || item.__id)] = node;
	}

	function exportDefinitions(node, options) {
		var svg = node,
			defs = null;
		if (definitions) {
			svg = node.nodeName.toLowerCase() === 'svg' && node;
			for (var i in definitions.svgs) {
				if (!defs) {
					if (!svg) {
						svg = SvgElement.create('svg');
						svg.appendChild(node);
					}
					defs = svg.insertBefore(SvgElement.create('defs'),
							svg.firstChild);
				}
				defs.appendChild(definitions.svgs[i]);
			}
			definitions = null;
		}
		return options.asString
				? new self.XMLSerializer().serializeToString(svg)
				: svg;
	}

	function exportSVG(item, options, isRoot) {
		var exporter = exporters[item._class],
			node = exporter && exporter(item, options);
		if (node) {
			var onExport = options.onExport;
			if (onExport)
				node = onExport(item, node, options) || node;
			var data = JSON.stringify(item._data);
			if (data && data !== '{}' && data !== 'null')
				node.setAttribute('data-paper-data', data);
		}
		return node && applyStyle(item, node, isRoot);
	}

	function setOptions(options) {
		if (!options)
			options = {};
		formatter = new Formatter(options.precision);
		return options;
	}

	Item.inject({
		exportSVG: function(options) {
			options = setOptions(options);
			return exportDefinitions(exportSVG(this, options, true), options);
		}
	});

	Project.inject({
		exportSVG: function(options) {
			options = setOptions(options);
			var children = this._children,
				view = this.getView(),
				bounds = Base.pick(options.bounds, 'view'),
				mx = options.matrix || bounds === 'view' && view._matrix,
				matrix = mx && Matrix.read([mx]),
				rect = bounds === 'view'
					? new Rectangle([0, 0], view.getViewSize())
					: bounds === 'content'
						? Item._getBounds(children, matrix, { stroke: true })
							.rect
						: Rectangle.read([bounds], 0, { readNull: true }),
				attrs = {
					version: '1.1',
					xmlns: SvgElement.svg,
					'xmlns:xlink': SvgElement.xlink,
				};
			if (rect) {
				attrs.width = rect.width;
				attrs.height = rect.height;
				if (rect.x || rect.y)
					attrs.viewBox = formatter.rectangle(rect);
			}
			var node = SvgElement.create('svg', attrs, formatter),
				parent = node;
			if (matrix && !matrix.isIdentity()) {
				parent = node.appendChild(SvgElement.create('g',
						getTransform(matrix), formatter));
			}
			for (var i = 0, l = children.length; i < l; i++) {
				parent.appendChild(exportSVG(children[i], options, true));
			}
			return exportDefinitions(node, options);
		}
	});
};

new function() {

	var definitions = {},
		rootSize;

	function getValue(node, name, isString, allowNull, allowPercent) {
		var value = SvgElement.get(node, name),
			res = value == null
				? allowNull
					? null
					: isString ? '' : 0
				: isString
					? value
					: parseFloat(value);
		return /%\s*$/.test(value)
			? (res / 100) * (allowPercent ? 1
				: rootSize[/x|^width/.test(name) ? 'width' : 'height'])
			: res;
	}

	function getPoint(node, x, y, allowNull, allowPercent) {
		x = getValue(node, x || 'x', false, allowNull, allowPercent);
		y = getValue(node, y || 'y', false, allowNull, allowPercent);
		return allowNull && (x == null || y == null) ? null
				: new Point(x, y);
	}

	function getSize(node, w, h, allowNull, allowPercent) {
		w = getValue(node, w || 'width', false, allowNull, allowPercent);
		h = getValue(node, h || 'height', false, allowNull, allowPercent);
		return allowNull && (w == null || h == null) ? null
				: new Size(w, h);
	}

	function convertValue(value, type, lookup) {
		return value === 'none' ? null
				: type === 'number' ? parseFloat(value)
				: type === 'array' ?
					value ? value.split(/[\s,]+/g).map(parseFloat) : []
				: type === 'color' ? getDefinition(value) || value
				: type === 'lookup' ? lookup[value]
				: value;
	}

	function importGroup(node, type, options, isRoot) {
		var nodes = node.childNodes,
			isClip = type === 'clippath',
			isDefs = type === 'defs',
			item = new Group(),
			project = item._project,
			currentStyle = project._currentStyle,
			children = [];
		if (!isClip && !isDefs) {
			item = applyAttributes(item, node, isRoot);
			project._currentStyle = item._style.clone();
		}
		if (isRoot) {
			var defs = node.querySelectorAll('defs');
			for (var i = 0, l = defs.length; i < l; i++) {
				importNode(defs[i], options, false);
			}
		}
		for (var i = 0, l = nodes.length; i < l; i++) {
			var childNode = nodes[i],
				child;
			if (childNode.nodeType === 1
					&& !/^defs$/i.test(childNode.nodeName)
					&& (child = importNode(childNode, options, false))
					&& !(child instanceof SymbolDefinition))
				children.push(child);
		}
		item.addChildren(children);
		if (isClip)
			item = applyAttributes(item.reduce(), node, isRoot);
		project._currentStyle = currentStyle;
		if (isClip || isDefs) {
			item.remove();
			item = null;
		}
		return item;
	}

	function importPoly(node, type) {
		var coords = node.getAttribute('points').match(
					/[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g),
			points = [];
		for (var i = 0, l = coords.length; i < l; i += 2)
			points.push(new Point(
					parseFloat(coords[i]),
					parseFloat(coords[i + 1])));
		var path = new Path(points);
		if (type === 'polygon')
			path.closePath();
		return path;
	}

	function importPath(node) {
		return PathItem.create(node.getAttribute('d'));
	}

	function importGradient(node, type) {
		var id = (getValue(node, 'href', true) || '').substring(1),
			radial = type === 'radialgradient',
			gradient;
		if (id) {
			gradient = definitions[id].getGradient();
			if (gradient._radial ^ radial) {
				gradient = gradient.clone();
				gradient._radial = radial;
			}
		} else {
			var nodes = node.childNodes,
				stops = [];
			for (var i = 0, l = nodes.length; i < l; i++) {
				var child = nodes[i];
				if (child.nodeType === 1)
					stops.push(applyAttributes(new GradientStop(), child));
			}
			gradient = new Gradient(stops, radial);
		}
		var origin, destination, highlight,
			scaleToBounds = getValue(node, 'gradientUnits', true) !==
				'userSpaceOnUse';
		if (radial) {
			origin = getPoint(node, 'cx', 'cy', false, scaleToBounds);
			destination = origin.add(
					getValue(node, 'r', false, false, scaleToBounds), 0);
			highlight = getPoint(node, 'fx', 'fy', true, scaleToBounds);
		} else {
			origin = getPoint(node, 'x1', 'y1', false, scaleToBounds);
			destination = getPoint(node, 'x2', 'y2', false, scaleToBounds);
		}
		var color = applyAttributes(
				new Color(gradient, origin, destination, highlight), node);
		color._scaleToBounds = scaleToBounds;
		return null;
	}

	var importers = {
		'#document': function (node, type, options, isRoot) {
			var nodes = node.childNodes;
			for (var i = 0, l = nodes.length; i < l; i++) {
				var child = nodes[i];
				if (child.nodeType === 1)
					return importNode(child, options, isRoot);
			}
		},
		g: importGroup,
		svg: importGroup,
		clippath: importGroup,
		polygon: importPoly,
		polyline: importPoly,
		path: importPath,
		lineargradient: importGradient,
		radialgradient: importGradient,

		image: function (node) {
			var raster = new Raster(getValue(node, 'href', true));
			raster.on('load', function() {
				var size = getSize(node);
				this.setSize(size);
				var center = this._matrix._transformPoint(
						getPoint(node).add(size.divide(2)));
				this.translate(center);
			});
			return raster;
		},

		symbol: function(node, type, options, isRoot) {
			return new SymbolDefinition(
					importGroup(node, type, options, isRoot), true);
		},

		defs: importGroup,

		use: function(node) {
			var id = (getValue(node, 'href', true) || '').substring(1),
				definition = definitions[id],
				point = getPoint(node);
			return definition
					? definition instanceof SymbolDefinition
						? definition.place(point)
						: definition.clone().translate(point)
					: null;
		},

		circle: function(node) {
			return new Shape.Circle(
					getPoint(node, 'cx', 'cy'),
					getValue(node, 'r'));
		},

		ellipse: function(node) {
			return new Shape.Ellipse({
				center: getPoint(node, 'cx', 'cy'),
				radius: getSize(node, 'rx', 'ry')
			});
		},

		rect: function(node) {
			return new Shape.Rectangle(new Rectangle(
						getPoint(node),
						getSize(node)
					), getSize(node, 'rx', 'ry'));
			},

		line: function(node) {
			return new Path.Line(
					getPoint(node, 'x1', 'y1'),
					getPoint(node, 'x2', 'y2'));
		},

		text: function(node) {
			var text = new PointText(getPoint(node).add(
					getPoint(node, 'dx', 'dy')));
			text.setContent(node.textContent.trim() || '');
			return text;
		}
	};

	function applyTransform(item, value, name, node) {
		if (item.transform) {
			var transforms = (node.getAttribute(name) || '').split(/\)\s*/g),
				matrix = new Matrix();
			for (var i = 0, l = transforms.length; i < l; i++) {
				var transform = transforms[i];
				if (!transform)
					break;
				var parts = transform.split(/\(\s*/),
					command = parts[0],
					v = parts[1].split(/[\s,]+/g);
				for (var j = 0, m = v.length; j < m; j++)
					v[j] = parseFloat(v[j]);
				switch (command) {
				case 'matrix':
					matrix.append(
							new Matrix(v[0], v[1], v[2], v[3], v[4], v[5]));
					break;
				case 'rotate':
					matrix.rotate(v[0], v[1], v[2]);
					break;
				case 'translate':
					matrix.translate(v[0], v[1]);
					break;
				case 'scale':
					matrix.scale(v);
					break;
				case 'skewX':
					matrix.skew(v[0], 0);
					break;
				case 'skewY':
					matrix.skew(0, v[0]);
					break;
				}
			}
			item.transform(matrix);
		}
	}

	function applyOpacity(item, value, name) {
		var key = name === 'fill-opacity' ? 'getFillColor' : 'getStrokeColor',
			color = item[key] && item[key]();
		if (color)
			color.setAlpha(parseFloat(value));
	}

	var attributes = Base.set(Base.each(SvgStyles, function(entry) {
		this[entry.attribute] = function(item, value) {
			if (item[entry.set]) {
				item[entry.set](convertValue(value, entry.type, entry.fromSVG));
				if (entry.type === 'color') {
					var color = item[entry.get]();
					if (color) {
						if (color._scaleToBounds) {
							var bounds = item.getBounds();
							color.transform(new Matrix()
								.translate(bounds.getPoint())
								.scale(bounds.getSize()));
						}
					}
				}
			}
		};
	}, {}), {
		id: function(item, value) {
			definitions[value] = item;
			if (item.setName)
				item.setName(value);
		},

		'clip-path': function(item, value) {
			var clip = getDefinition(value);
			if (clip) {
				clip = clip.clone();
				clip.setClipMask(true);
				if (item instanceof Group) {
					item.insertChild(0, clip);
				} else {
					return new Group(clip, item);
				}
			}
		},

		gradientTransform: applyTransform,
		transform: applyTransform,

		'fill-opacity': applyOpacity,
		'stroke-opacity': applyOpacity,

		visibility: function(item, value) {
			if (item.setVisible)
				item.setVisible(value === 'visible');
		},

		display: function(item, value) {
			if (item.setVisible)
				item.setVisible(value !== null);
		},

		'stop-color': function(item, value) {
			if (item.setColor)
				item.setColor(value);
		},

		'stop-opacity': function(item, value) {
			if (item._color)
				item._color.setAlpha(parseFloat(value));
		},

		offset: function(item, value) {
			if (item.setOffset) {
				var percent = value.match(/(.*)%$/);
				item.setOffset(percent ? percent[1] / 100 : parseFloat(value));
			}
		},

		viewBox: function(item, value, name, node, styles) {
			var rect = new Rectangle(convertValue(value, 'array')),
				size = getSize(node, null, null, true),
				group,
				matrix;
			if (item instanceof Group) {
				var scale = size ? size.divide(rect.getSize()) : 1,
				matrix = new Matrix().scale(scale)
						.translate(rect.getPoint().negate());
				group = item;
			} else if (item instanceof SymbolDefinition) {
				if (size)
					rect.setSize(size);
				group = item._item;
			}
			if (group)  {
				if (getAttribute(node, 'overflow', styles) !== 'visible') {
					var clip = new Shape.Rectangle(rect);
					clip.setClipMask(true);
					group.addChild(clip);
				}
				if (matrix)
					group.transform(matrix);
			}
		}
	});

	function getAttribute(node, name, styles) {
		var attr = node.attributes[name],
			value = attr && attr.value;
		if (!value) {
			var style = Base.camelize(name);
			value = node.style[style];
			if (!value && styles.node[style] !== styles.parent[style])
				value = styles.node[style];
		}
		return !value ? undefined
				: value === 'none' ? null
				: value;
	}

	function applyAttributes(item, node, isRoot) {
		if (node.style) {
			var parent = node.parentNode,
				styles = {
					node: DomElement.getStyles(node) || {},
					parent: !isRoot && !/^defs$/i.test(parent.tagName)
							&& DomElement.getStyles(parent) || {}
				};
			Base.each(attributes, function(apply, name) {
				var value = getAttribute(node, name, styles);
				item = value !== undefined
						&& apply(item, value, name, node, styles) || item;
			});
		}
		return item;
	}

	function getDefinition(value) {
		var match = value && value.match(/\((?:["'#]*)([^"')]+)/),
			name = match && match[1],
			res = name && definitions[window
					? name.replace(window.location.href.split('#')[0] + '#', '')
					: name];
		if (res && res._scaleToBounds) {
			res = res.clone();
			res._scaleToBounds = true;
		}
		return res;
	}

	function importNode(node, options, isRoot) {
		var type = node.nodeName.toLowerCase(),
			isElement = type !== '#document',
			body = document.body,
			container,
			parent,
			next;
		if (isRoot && isElement) {
			rootSize = paper.getView().getSize();
			rootSize = getSize(node, null, null, true) || rootSize;
			container = SvgElement.create('svg', {
				style: 'stroke-width: 1px; stroke-miterlimit: 10'
			});
			parent = node.parentNode;
			next = node.nextSibling;
			container.appendChild(node);
			body.appendChild(container);
		}
		var settings = paper.settings,
			applyMatrix = settings.applyMatrix,
			insertItems = settings.insertItems;
		settings.applyMatrix = false;
		settings.insertItems = false;
		var importer = importers[type],
			item = importer && importer(node, type, options, isRoot) || null;
		settings.insertItems = insertItems;
		settings.applyMatrix = applyMatrix;
		if (item) {
			if (isElement && !(item instanceof Group))
				item = applyAttributes(item, node, isRoot);
			var onImport = options.onImport,
				data = isElement && node.getAttribute('data-paper-data');
			if (onImport)
				item = onImport(node, item, options) || item;
			if (options.expandShapes && item instanceof Shape) {
				item.remove();
				item = item.toPath();
			}
			if (data)
				item._data = JSON.parse(data);
		}
		if (container) {
			body.removeChild(container);
			if (parent) {
				if (next) {
					parent.insertBefore(node, next);
				} else {
					parent.appendChild(node);
				}
			}
		}
		if (isRoot) {
			definitions = {};
			if (item && Base.pick(options.applyMatrix, applyMatrix))
				item.matrix.apply(true, true);
		}
		return item;
	}

	function importSVG(source, options, owner) {
		if (!source)
			return null;
		options = typeof options === 'function' ? { onLoad: options }
				: options || {};
		var scope = paper,
			item = null;

		function onLoad(svg) {
			try {
				var node = typeof svg === 'object' ? svg : new self.DOMParser()
						.parseFromString(svg, 'image/svg+xml');
				if (!node.nodeName) {
					node = null;
					throw new Error('Unsupported SVG source: ' + source);
				}
				paper = scope;
				item = importNode(node, options, true);
				if (!options || options.insert !== false) {
					owner._insertItem(undefined, item);
				}
				var onLoad = options.onLoad;
				if (onLoad)
					onLoad(item, svg);
			} catch (e) {
				onError(e);
			}
		}

		function onError(message, status) {
			var onError = options.onError;
			if (onError) {
				onError(message, status);
			} else {
				throw new Error(message);
			}
		}

		if (typeof source === 'string' && !/^.*</.test(source)) {
			var node = document.getElementById(source);
			if (node) {
				onLoad(node);
			} else {
				Http.request({
					url: source,
					async: true,
					onLoad: onLoad,
					onError: onError
				});
			}
		} else if (typeof File !== 'undefined' && source instanceof File) {
			var reader = new FileReader();
			reader.onload = function() {
				onLoad(reader.result);
			};
			reader.onerror = function() {
				onError(reader.error);
			};
			return reader.readAsText(source);
		} else {
			onLoad(source);
		}

		return item;
	}

	Item.inject({
		importSVG: function(node, options) {
			return importSVG(node, options, this);
		}
	});

	Project.inject({
		importSVG: function(node, options) {
			this.activate();
			return importSVG(node, options, this);
		}
	});
};

Base.exports.PaperScript = function() {
	var global = this,
		acorn = global.acorn;
	if (!acorn && typeof require !== 'undefined') {
		try { acorn = require('acorn'); } catch(e) {}
	}
	if (!acorn) {
		var exports, module;
		acorn = exports = module = {};

(function(root, mod) {
  if (typeof exports == "object" && typeof module == "object") return mod(exports);
  if (typeof define == "function" && define.amd) return define(["exports"], mod);
  mod(root.acorn || (root.acorn = {}));
})(this, function(exports) {
  "use strict";

  exports.version = "0.5.0";

  var options, input, inputLen, sourceFile;

  exports.parse = function(inpt, opts) {
	input = String(inpt); inputLen = input.length;
	setOptions(opts);
	initTokenState();
	return parseTopLevel(options.program);
  };

  var defaultOptions = exports.defaultOptions = {
	ecmaVersion: 5,
	strictSemicolons: false,
	allowTrailingCommas: true,
	forbidReserved: false,
	allowReturnOutsideFunction: false,
	locations: false,
	onComment: null,
	ranges: false,
	program: null,
	sourceFile: null,
	directSourceFile: null
  };

  function setOptions(opts) {
	options = opts || {};
	for (var opt in defaultOptions) if (!Object.prototype.hasOwnProperty.call(options, opt))
	  options[opt] = defaultOptions[opt];
	sourceFile = options.sourceFile || null;
  }

  var getLineInfo = exports.getLineInfo = function(input, offset) {
	for (var line = 1, cur = 0;;) {
	  lineBreak.lastIndex = cur;
	  var match = lineBreak.exec(input);
	  if (match && match.index < offset) {
		++line;
		cur = match.index + match[0].length;
	  } else break;
	}
	return {line: line, column: offset - cur};
  };

  exports.tokenize = function(inpt, opts) {
	input = String(inpt); inputLen = input.length;
	setOptions(opts);
	initTokenState();

	var t = {};
	function getToken(forceRegexp) {
	  lastEnd = tokEnd;
	  readToken(forceRegexp);
	  t.start = tokStart; t.end = tokEnd;
	  t.startLoc = tokStartLoc; t.endLoc = tokEndLoc;
	  t.type = tokType; t.value = tokVal;
	  return t;
	}
	getToken.jumpTo = function(pos, reAllowed) {
	  tokPos = pos;
	  if (options.locations) {
		tokCurLine = 1;
		tokLineStart = lineBreak.lastIndex = 0;
		var match;
		while ((match = lineBreak.exec(input)) && match.index < pos) {
		  ++tokCurLine;
		  tokLineStart = match.index + match[0].length;
		}
	  }
	  tokRegexpAllowed = reAllowed;
	  skipSpace();
	};
	return getToken;
  };

  var tokPos;

  var tokStart, tokEnd;

  var tokStartLoc, tokEndLoc;

  var tokType, tokVal;

  var tokRegexpAllowed;

  var tokCurLine, tokLineStart;

  var lastStart, lastEnd, lastEndLoc;

  var inFunction, labels, strict;

  function raise(pos, message) {
	var loc = getLineInfo(input, pos);
	message += " (" + loc.line + ":" + loc.column + ")";
	var err = new SyntaxError(message);
	err.pos = pos; err.loc = loc; err.raisedAt = tokPos;
	throw err;
  }

  var empty = [];

  var _num = {type: "num"}, _regexp = {type: "regexp"}, _string = {type: "string"};
  var _name = {type: "name"}, _eof = {type: "eof"};

  var _break = {keyword: "break"}, _case = {keyword: "case", beforeExpr: true}, _catch = {keyword: "catch"};
  var _continue = {keyword: "continue"}, _debugger = {keyword: "debugger"}, _default = {keyword: "default"};
  var _do = {keyword: "do", isLoop: true}, _else = {keyword: "else", beforeExpr: true};
  var _finally = {keyword: "finally"}, _for = {keyword: "for", isLoop: true}, _function = {keyword: "function"};
  var _if = {keyword: "if"}, _return = {keyword: "return", beforeExpr: true}, _switch = {keyword: "switch"};
  var _throw = {keyword: "throw", beforeExpr: true}, _try = {keyword: "try"}, _var = {keyword: "var"};
  var _while = {keyword: "while", isLoop: true}, _with = {keyword: "with"}, _new = {keyword: "new", beforeExpr: true};
  var _this = {keyword: "this"};

  var _null = {keyword: "null", atomValue: null}, _true = {keyword: "true", atomValue: true};
  var _false = {keyword: "false", atomValue: false};

  var _in = {keyword: "in", binop: 7, beforeExpr: true};

  var keywordTypes = {"break": _break, "case": _case, "catch": _catch,
					  "continue": _continue, "debugger": _debugger, "default": _default,
					  "do": _do, "else": _else, "finally": _finally, "for": _for,
					  "function": _function, "if": _if, "return": _return, "switch": _switch,
					  "throw": _throw, "try": _try, "var": _var, "while": _while, "with": _with,
					  "null": _null, "true": _true, "false": _false, "new": _new, "in": _in,
					  "instanceof": {keyword: "instanceof", binop: 7, beforeExpr: true}, "this": _this,
					  "typeof": {keyword: "typeof", prefix: true, beforeExpr: true},
					  "void": {keyword: "void", prefix: true, beforeExpr: true},
					  "delete": {keyword: "delete", prefix: true, beforeExpr: true}};

  var _bracketL = {type: "[", beforeExpr: true}, _bracketR = {type: "]"}, _braceL = {type: "{", beforeExpr: true};
  var _braceR = {type: "}"}, _parenL = {type: "(", beforeExpr: true}, _parenR = {type: ")"};
  var _comma = {type: ",", beforeExpr: true}, _semi = {type: ";", beforeExpr: true};
  var _colon = {type: ":", beforeExpr: true}, _dot = {type: "."}, _question = {type: "?", beforeExpr: true};

  var _slash = {binop: 10, beforeExpr: true}, _eq = {isAssign: true, beforeExpr: true};
  var _assign = {isAssign: true, beforeExpr: true};
  var _incDec = {postfix: true, prefix: true, isUpdate: true}, _prefix = {prefix: true, beforeExpr: true};
  var _logicalOR = {binop: 1, beforeExpr: true};
  var _logicalAND = {binop: 2, beforeExpr: true};
  var _bitwiseOR = {binop: 3, beforeExpr: true};
  var _bitwiseXOR = {binop: 4, beforeExpr: true};
  var _bitwiseAND = {binop: 5, beforeExpr: true};
  var _equality = {binop: 6, beforeExpr: true};
  var _relational = {binop: 7, beforeExpr: true};
  var _bitShift = {binop: 8, beforeExpr: true};
  var _plusMin = {binop: 9, prefix: true, beforeExpr: true};
  var _multiplyModulo = {binop: 10, beforeExpr: true};

  exports.tokTypes = {bracketL: _bracketL, bracketR: _bracketR, braceL: _braceL, braceR: _braceR,
					  parenL: _parenL, parenR: _parenR, comma: _comma, semi: _semi, colon: _colon,
					  dot: _dot, question: _question, slash: _slash, eq: _eq, name: _name, eof: _eof,
					  num: _num, regexp: _regexp, string: _string};
  for (var kw in keywordTypes) exports.tokTypes["_" + kw] = keywordTypes[kw];

  function makePredicate(words) {
	words = words.split(" ");
	var f = "", cats = [];
	out: for (var i = 0; i < words.length; ++i) {
	  for (var j = 0; j < cats.length; ++j)
		if (cats[j][0].length == words[i].length) {
		  cats[j].push(words[i]);
		  continue out;
		}
	  cats.push([words[i]]);
	}
	function compareTo(arr) {
	  if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";";
	  f += "switch(str){";
	  for (var i = 0; i < arr.length; ++i) f += "case " + JSON.stringify(arr[i]) + ":";
	  f += "return true}return false;";
	}

	if (cats.length > 3) {
	  cats.sort(function(a, b) {return b.length - a.length;});
	  f += "switch(str.length){";
	  for (var i = 0; i < cats.length; ++i) {
		var cat = cats[i];
		f += "case " + cat[0].length + ":";
		compareTo(cat);
	  }
	  f += "}";

	} else {
	  compareTo(words);
	}
	return new Function("str", f);
  }

  var isReservedWord3 = makePredicate("abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile");

  var isReservedWord5 = makePredicate("class enum extends super const export import");

  var isStrictReservedWord = makePredicate("implements interface let package private protected public static yield");

  var isStrictBadIdWord = makePredicate("eval arguments");

  var isKeyword = makePredicate("break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this");

  var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
  var nonASCIIidentifierStartChars = "\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc";
  var nonASCIIidentifierChars = "\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u0620-\u0649\u0672-\u06d3\u06e7-\u06e8\u06fb-\u06fc\u0730-\u074a\u0800-\u0814\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0840-\u0857\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962-\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09d7\u09df-\u09e0\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5f-\u0b60\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2-\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d46-\u0d48\u0d57\u0d62-\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e34-\u0e3a\u0e40-\u0e45\u0e50-\u0e59\u0eb4-\u0eb9\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f41-\u0f47\u0f71-\u0f84\u0f86-\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1029\u1040-\u1049\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u170e-\u1710\u1720-\u1730\u1740-\u1750\u1772\u1773\u1780-\u17b2\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1920-\u192b\u1930-\u193b\u1951-\u196d\u19b0-\u19c0\u19c8-\u19c9\u19d0-\u19d9\u1a00-\u1a15\u1a20-\u1a53\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b46-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1bb0-\u1bb9\u1be6-\u1bf3\u1c00-\u1c22\u1c40-\u1c49\u1c5b-\u1c7d\u1cd0-\u1cd2\u1d00-\u1dbe\u1e01-\u1f15\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2d81-\u2d96\u2de0-\u2dff\u3021-\u3028\u3099\u309a\ua640-\ua66d\ua674-\ua67d\ua69f\ua6f0-\ua6f1\ua7f8-\ua800\ua806\ua80b\ua823-\ua827\ua880-\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8f3-\ua8f7\ua900-\ua909\ua926-\ua92d\ua930-\ua945\ua980-\ua983\ua9b3-\ua9c0\uaa00-\uaa27\uaa40-\uaa41\uaa4c-\uaa4d\uaa50-\uaa59\uaa7b\uaae0-\uaae9\uaaf2-\uaaf3\uabc0-\uabe1\uabec\uabed\uabf0-\uabf9\ufb20-\ufb28\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f";
  var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
  var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

  var newline = /[\n\r\u2028\u2029]/;

  var lineBreak = /\r\n|[\n\r\u2028\u2029]/g;

  var isIdentifierStart = exports.isIdentifierStart = function(code) {
	if (code < 65) return code === 36;
	if (code < 91) return true;
	if (code < 97) return code === 95;
	if (code < 123)return true;
	return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
  };

  var isIdentifierChar = exports.isIdentifierChar = function(code) {
	if (code < 48) return code === 36;
	if (code < 58) return true;
	if (code < 65) return false;
	if (code < 91) return true;
	if (code < 97) return code === 95;
	if (code < 123)return true;
	return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
  };

  function line_loc_t() {
	this.line = tokCurLine;
	this.column = tokPos - tokLineStart;
  }

  function initTokenState() {
	tokCurLine = 1;
	tokPos = tokLineStart = 0;
	tokRegexpAllowed = true;
	skipSpace();
  }

  function finishToken(type, val) {
	tokEnd = tokPos;
	if (options.locations) tokEndLoc = new line_loc_t;
	tokType = type;
	skipSpace();
	tokVal = val;
	tokRegexpAllowed = type.beforeExpr;
  }

  function skipBlockComment() {
	var startLoc = options.onComment && options.locations && new line_loc_t;
	var start = tokPos, end = input.indexOf("*/", tokPos += 2);
	if (end === -1) raise(tokPos - 2, "Unterminated comment");
	tokPos = end + 2;
	if (options.locations) {
	  lineBreak.lastIndex = start;
	  var match;
	  while ((match = lineBreak.exec(input)) && match.index < tokPos) {
		++tokCurLine;
		tokLineStart = match.index + match[0].length;
	  }
	}
	if (options.onComment)
	  options.onComment(true, input.slice(start + 2, end), start, tokPos,
						startLoc, options.locations && new line_loc_t);
  }

  function skipLineComment() {
	var start = tokPos;
	var startLoc = options.onComment && options.locations && new line_loc_t;
	var ch = input.charCodeAt(tokPos+=2);
	while (tokPos < inputLen && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
	  ++tokPos;
	  ch = input.charCodeAt(tokPos);
	}
	if (options.onComment)
	  options.onComment(false, input.slice(start + 2, tokPos), start, tokPos,
						startLoc, options.locations && new line_loc_t);
  }

  function skipSpace() {
	while (tokPos < inputLen) {
	  var ch = input.charCodeAt(tokPos);
	  if (ch === 32) {
		++tokPos;
	  } else if (ch === 13) {
		++tokPos;
		var next = input.charCodeAt(tokPos);
		if (next === 10) {
		  ++tokPos;
		}
		if (options.locations) {
		  ++tokCurLine;
		  tokLineStart = tokPos;
		}
	  } else if (ch === 10 || ch === 8232 || ch === 8233) {
		++tokPos;
		if (options.locations) {
		  ++tokCurLine;
		  tokLineStart = tokPos;
		}
	  } else if (ch > 8 && ch < 14) {
		++tokPos;
	  } else if (ch === 47) {
		var next = input.charCodeAt(tokPos + 1);
		if (next === 42) {
		  skipBlockComment();
		} else if (next === 47) {
		  skipLineComment();
		} else break;
	  } else if (ch === 160) {
		++tokPos;
	  } else if (ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
		++tokPos;
	  } else {
		break;
	  }
	}
  }

  function readToken_dot() {
	var next = input.charCodeAt(tokPos + 1);
	if (next >= 48 && next <= 57) return readNumber(true);
	++tokPos;
	return finishToken(_dot);
  }

  function readToken_slash() {
	var next = input.charCodeAt(tokPos + 1);
	if (tokRegexpAllowed) {++tokPos; return readRegexp();}
	if (next === 61) return finishOp(_assign, 2);
	return finishOp(_slash, 1);
  }

  function readToken_mult_modulo() {
	var next = input.charCodeAt(tokPos + 1);
	if (next === 61) return finishOp(_assign, 2);
	return finishOp(_multiplyModulo, 1);
  }

  function readToken_pipe_amp(code) {
	var next = input.charCodeAt(tokPos + 1);
	if (next === code) return finishOp(code === 124 ? _logicalOR : _logicalAND, 2);
	if (next === 61) return finishOp(_assign, 2);
	return finishOp(code === 124 ? _bitwiseOR : _bitwiseAND, 1);
  }

  function readToken_caret() {
	var next = input.charCodeAt(tokPos + 1);
	if (next === 61) return finishOp(_assign, 2);
	return finishOp(_bitwiseXOR, 1);
  }

  function readToken_plus_min(code) {
	var next = input.charCodeAt(tokPos + 1);
	if (next === code) {
	  if (next == 45 && input.charCodeAt(tokPos + 2) == 62 &&
		  newline.test(input.slice(lastEnd, tokPos))) {
		tokPos += 3;
		skipLineComment();
		skipSpace();
		return readToken();
	  }
	  return finishOp(_incDec, 2);
	}
	if (next === 61) return finishOp(_assign, 2);
	return finishOp(_plusMin, 1);
  }

  function readToken_lt_gt(code) {
	var next = input.charCodeAt(tokPos + 1);
	var size = 1;
	if (next === code) {
	  size = code === 62 && input.charCodeAt(tokPos + 2) === 62 ? 3 : 2;
	  if (input.charCodeAt(tokPos + size) === 61) return finishOp(_assign, size + 1);
	  return finishOp(_bitShift, size);
	}
	if (next == 33 && code == 60 && input.charCodeAt(tokPos + 2) == 45 &&
		input.charCodeAt(tokPos + 3) == 45) {
	  tokPos += 4;
	  skipLineComment();
	  skipSpace();
	  return readToken();
	}
	if (next === 61)
	  size = input.charCodeAt(tokPos + 2) === 61 ? 3 : 2;
	return finishOp(_relational, size);
  }

  function readToken_eq_excl(code) {
	var next = input.charCodeAt(tokPos + 1);
	if (next === 61) return finishOp(_equality, input.charCodeAt(tokPos + 2) === 61 ? 3 : 2);
	return finishOp(code === 61 ? _eq : _prefix, 1);
  }

  function getTokenFromCode(code) {
	switch(code) {
	case 46:
	  return readToken_dot();

	case 40: ++tokPos; return finishToken(_parenL);
	case 41: ++tokPos; return finishToken(_parenR);
	case 59: ++tokPos; return finishToken(_semi);
	case 44: ++tokPos; return finishToken(_comma);
	case 91: ++tokPos; return finishToken(_bracketL);
	case 93: ++tokPos; return finishToken(_bracketR);
	case 123: ++tokPos; return finishToken(_braceL);
	case 125: ++tokPos; return finishToken(_braceR);
	case 58: ++tokPos; return finishToken(_colon);
	case 63: ++tokPos; return finishToken(_question);

	case 48:
	  var next = input.charCodeAt(tokPos + 1);
	  if (next === 120 || next === 88) return readHexNumber();
	case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57:
	  return readNumber(false);

	case 34: case 39:
	  return readString(code);

	case 47:
	  return readToken_slash(code);

	case 37: case 42:
	  return readToken_mult_modulo();

	case 124: case 38:
	  return readToken_pipe_amp(code);

	case 94:
	  return readToken_caret();

	case 43: case 45:
	  return readToken_plus_min(code);

	case 60: case 62:
	  return readToken_lt_gt(code);

	case 61: case 33:
	  return readToken_eq_excl(code);

	case 126:
	  return finishOp(_prefix, 1);
	}

	return false;
  }

  function readToken(forceRegexp) {
	if (!forceRegexp) tokStart = tokPos;
	else tokPos = tokStart + 1;
	if (options.locations) tokStartLoc = new line_loc_t;
	if (forceRegexp) return readRegexp();
	if (tokPos >= inputLen) return finishToken(_eof);

	var code = input.charCodeAt(tokPos);
	if (isIdentifierStart(code) || code === 92 ) return readWord();

	var tok = getTokenFromCode(code);

	if (tok === false) {
	  var ch = String.fromCharCode(code);
	  if (ch === "\\" || nonASCIIidentifierStart.test(ch)) return readWord();
	  raise(tokPos, "Unexpected character '" + ch + "'");
	}
	return tok;
  }

  function finishOp(type, size) {
	var str = input.slice(tokPos, tokPos + size);
	tokPos += size;
	finishToken(type, str);
  }

  function readRegexp() {
	var content = "", escaped, inClass, start = tokPos;
	for (;;) {
	  if (tokPos >= inputLen) raise(start, "Unterminated regular expression");
	  var ch = input.charAt(tokPos);
	  if (newline.test(ch)) raise(start, "Unterminated regular expression");
	  if (!escaped) {
		if (ch === "[") inClass = true;
		else if (ch === "]" && inClass) inClass = false;
		else if (ch === "/" && !inClass) break;
		escaped = ch === "\\";
	  } else escaped = false;
	  ++tokPos;
	}
	var content = input.slice(start, tokPos);
	++tokPos;
	var mods = readWord1();
	if (mods && !/^[gmsiy]*$/.test(mods)) raise(start, "Invalid regexp flag");
	try {
	  var value = new RegExp(content, mods);
	} catch (e) {
	  if (e instanceof SyntaxError) raise(start, e.message);
	  raise(e);
	}
	return finishToken(_regexp, value);
  }

  function readInt(radix, len) {
	var start = tokPos, total = 0;
	for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
	  var code = input.charCodeAt(tokPos), val;
	  if (code >= 97) val = code - 97 + 10;
	  else if (code >= 65) val = code - 65 + 10;
	  else if (code >= 48 && code <= 57) val = code - 48;
	  else val = Infinity;
	  if (val >= radix) break;
	  ++tokPos;
	  total = total * radix + val;
	}
	if (tokPos === start || len != null && tokPos - start !== len) return null;

	return total;
  }

  function readHexNumber() {
	tokPos += 2;
	var val = readInt(16);
	if (val == null) raise(tokStart + 2, "Expected hexadecimal number");
	if (isIdentifierStart(input.charCodeAt(tokPos))) raise(tokPos, "Identifier directly after number");
	return finishToken(_num, val);
  }

  function readNumber(startsWithDot) {
	var start = tokPos, isFloat = false, octal = input.charCodeAt(tokPos) === 48;
	if (!startsWithDot && readInt(10) === null) raise(start, "Invalid number");
	if (input.charCodeAt(tokPos) === 46) {
	  ++tokPos;
	  readInt(10);
	  isFloat = true;
	}
	var next = input.charCodeAt(tokPos);
	if (next === 69 || next === 101) {
	  next = input.charCodeAt(++tokPos);
	  if (next === 43 || next === 45) ++tokPos;
	  if (readInt(10) === null) raise(start, "Invalid number");
	  isFloat = true;
	}
	if (isIdentifierStart(input.charCodeAt(tokPos))) raise(tokPos, "Identifier directly after number");

	var str = input.slice(start, tokPos), val;
	if (isFloat) val = parseFloat(str);
	else if (!octal || str.length === 1) val = parseInt(str, 10);
	else if (/[89]/.test(str) || strict) raise(start, "Invalid number");
	else val = parseInt(str, 8);
	return finishToken(_num, val);
  }

  function readString(quote) {
	tokPos++;
	var out = "";
	for (;;) {
	  if (tokPos >= inputLen) raise(tokStart, "Unterminated string constant");
	  var ch = input.charCodeAt(tokPos);
	  if (ch === quote) {
		++tokPos;
		return finishToken(_string, out);
	  }
	  if (ch === 92) {
		ch = input.charCodeAt(++tokPos);
		var octal = /^[0-7]+/.exec(input.slice(tokPos, tokPos + 3));
		if (octal) octal = octal[0];
		while (octal && parseInt(octal, 8) > 255) octal = octal.slice(0, -1);
		if (octal === "0") octal = null;
		++tokPos;
		if (octal) {
		  if (strict) raise(tokPos - 2, "Octal literal in strict mode");
		  out += String.fromCharCode(parseInt(octal, 8));
		  tokPos += octal.length - 1;
		} else {
		  switch (ch) {
		  case 110: out += "\n"; break;
		  case 114: out += "\r"; break;
		  case 120: out += String.fromCharCode(readHexChar(2)); break;
		  case 117: out += String.fromCharCode(readHexChar(4)); break;
		  case 85: out += String.fromCharCode(readHexChar(8)); break;
		  case 116: out += "\t"; break;
		  case 98: out += "\b"; break;
		  case 118: out += "\u000b"; break;
		  case 102: out += "\f"; break;
		  case 48: out += "\0"; break;
		  case 13: if (input.charCodeAt(tokPos) === 10) ++tokPos;
		  case 10:
			if (options.locations) { tokLineStart = tokPos; ++tokCurLine; }
			break;
		  default: out += String.fromCharCode(ch); break;
		  }
		}
	  } else {
		if (ch === 13 || ch === 10 || ch === 8232 || ch === 8233) raise(tokStart, "Unterminated string constant");
		out += String.fromCharCode(ch);
		++tokPos;
	  }
	}
  }

  function readHexChar(len) {
	var n = readInt(16, len);
	if (n === null) raise(tokStart, "Bad character escape sequence");
	return n;
  }

  var containsEsc;

  function readWord1() {
	containsEsc = false;
	var word, first = true, start = tokPos;
	for (;;) {
	  var ch = input.charCodeAt(tokPos);
	  if (isIdentifierChar(ch)) {
		if (containsEsc) word += input.charAt(tokPos);
		++tokPos;
	  } else if (ch === 92) {
		if (!containsEsc) word = input.slice(start, tokPos);
		containsEsc = true;
		if (input.charCodeAt(++tokPos) != 117)
		  raise(tokPos, "Expecting Unicode escape sequence \\uXXXX");
		++tokPos;
		var esc = readHexChar(4);
		var escStr = String.fromCharCode(esc);
		if (!escStr) raise(tokPos - 1, "Invalid Unicode escape");
		if (!(first ? isIdentifierStart(esc) : isIdentifierChar(esc)))
		  raise(tokPos - 4, "Invalid Unicode escape");
		word += escStr;
	  } else {
		break;
	  }
	  first = false;
	}
	return containsEsc ? word : input.slice(start, tokPos);
  }

  function readWord() {
	var word = readWord1();
	var type = _name;
	if (!containsEsc && isKeyword(word))
	  type = keywordTypes[word];
	return finishToken(type, word);
  }

  function next() {
	lastStart = tokStart;
	lastEnd = tokEnd;
	lastEndLoc = tokEndLoc;
	readToken();
  }

  function setStrict(strct) {
	strict = strct;
	tokPos = tokStart;
	if (options.locations) {
	  while (tokPos < tokLineStart) {
		tokLineStart = input.lastIndexOf("\n", tokLineStart - 2) + 1;
		--tokCurLine;
	  }
	}
	skipSpace();
	readToken();
  }

  function node_t() {
	this.type = null;
	this.start = tokStart;
	this.end = null;
  }

  function node_loc_t() {
	this.start = tokStartLoc;
	this.end = null;
	if (sourceFile !== null) this.source = sourceFile;
  }

  function startNode() {
	var node = new node_t();
	if (options.locations)
	  node.loc = new node_loc_t();
	if (options.directSourceFile)
	  node.sourceFile = options.directSourceFile;
	if (options.ranges)
	  node.range = [tokStart, 0];
	return node;
  }

  function startNodeFrom(other) {
	var node = new node_t();
	node.start = other.start;
	if (options.locations) {
	  node.loc = new node_loc_t();
	  node.loc.start = other.loc.start;
	}
	if (options.ranges)
	  node.range = [other.range[0], 0];

	return node;
  }

  function finishNode(node, type) {
	node.type = type;
	node.end = lastEnd;
	if (options.locations)
	  node.loc.end = lastEndLoc;
	if (options.ranges)
	  node.range[1] = lastEnd;
	return node;
  }

  function isUseStrict(stmt) {
	return options.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" &&
	  stmt.expression.type === "Literal" && stmt.expression.value === "use strict";
  }

  function eat(type) {
	if (tokType === type) {
	  next();
	  return true;
	}
  }

  function canInsertSemicolon() {
	return !options.strictSemicolons &&
	  (tokType === _eof || tokType === _braceR || newline.test(input.slice(lastEnd, tokStart)));
  }

  function semicolon() {
	if (!eat(_semi) && !canInsertSemicolon()) unexpected();
  }

  function expect(type) {
	if (tokType === type) next();
	else unexpected();
  }

  function unexpected() {
	raise(tokStart, "Unexpected token");
  }

  function checkLVal(expr) {
	if (expr.type !== "Identifier" && expr.type !== "MemberExpression")
	  raise(expr.start, "Assigning to rvalue");
	if (strict && expr.type === "Identifier" && isStrictBadIdWord(expr.name))
	  raise(expr.start, "Assigning to " + expr.name + " in strict mode");
  }

  function parseTopLevel(program) {
	lastStart = lastEnd = tokPos;
	if (options.locations) lastEndLoc = new line_loc_t;
	inFunction = strict = null;
	labels = [];
	readToken();

	var node = program || startNode(), first = true;
	if (!program) node.body = [];
	while (tokType !== _eof) {
	  var stmt = parseStatement();
	  node.body.push(stmt);
	  if (first && isUseStrict(stmt)) setStrict(true);
	  first = false;
	}
	return finishNode(node, "Program");
  }

  var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

  function parseStatement() {
	if (tokType === _slash || tokType === _assign && tokVal == "/=")
	  readToken(true);

	var starttype = tokType, node = startNode();

	switch (starttype) {
	case _break: case _continue:
	  next();
	  var isBreak = starttype === _break;
	  if (eat(_semi) || canInsertSemicolon()) node.label = null;
	  else if (tokType !== _name) unexpected();
	  else {
		node.label = parseIdent();
		semicolon();
	  }

	  for (var i = 0; i < labels.length; ++i) {
		var lab = labels[i];
		if (node.label == null || lab.name === node.label.name) {
		  if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
		  if (node.label && isBreak) break;
		}
	  }
	  if (i === labels.length) raise(node.start, "Unsyntactic " + starttype.keyword);
	  return finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");

	case _debugger:
	  next();
	  semicolon();
	  return finishNode(node, "DebuggerStatement");

	case _do:
	  next();
	  labels.push(loopLabel);
	  node.body = parseStatement();
	  labels.pop();
	  expect(_while);
	  node.test = parseParenExpression();
	  semicolon();
	  return finishNode(node, "DoWhileStatement");

	case _for:
	  next();
	  labels.push(loopLabel);
	  expect(_parenL);
	  if (tokType === _semi) return parseFor(node, null);
	  if (tokType === _var) {
		var init = startNode();
		next();
		parseVar(init, true);
		finishNode(init, "VariableDeclaration");
		if (init.declarations.length === 1 && eat(_in))
		  return parseForIn(node, init);
		return parseFor(node, init);
	  }
	  var init = parseExpression(false, true);
	  if (eat(_in)) {checkLVal(init); return parseForIn(node, init);}
	  return parseFor(node, init);

	case _function:
	  next();
	  return parseFunction(node, true);

	case _if:
	  next();
	  node.test = parseParenExpression();
	  node.consequent = parseStatement();
	  node.alternate = eat(_else) ? parseStatement() : null;
	  return finishNode(node, "IfStatement");

	case _return:
	  if (!inFunction && !options.allowReturnOutsideFunction)
		raise(tokStart, "'return' outside of function");
	  next();

	  if (eat(_semi) || canInsertSemicolon()) node.argument = null;
	  else { node.argument = parseExpression(); semicolon(); }
	  return finishNode(node, "ReturnStatement");

	case _switch:
	  next();
	  node.discriminant = parseParenExpression();
	  node.cases = [];
	  expect(_braceL);
	  labels.push(switchLabel);

	  for (var cur, sawDefault; tokType != _braceR;) {
		if (tokType === _case || tokType === _default) {
		  var isCase = tokType === _case;
		  if (cur) finishNode(cur, "SwitchCase");
		  node.cases.push(cur = startNode());
		  cur.consequent = [];
		  next();
		  if (isCase) cur.test = parseExpression();
		  else {
			if (sawDefault) raise(lastStart, "Multiple default clauses"); sawDefault = true;
			cur.test = null;
		  }
		  expect(_colon);
		} else {
		  if (!cur) unexpected();
		  cur.consequent.push(parseStatement());
		}
	  }
	  if (cur) finishNode(cur, "SwitchCase");
	  next();
	  labels.pop();
	  return finishNode(node, "SwitchStatement");

	case _throw:
	  next();
	  if (newline.test(input.slice(lastEnd, tokStart)))
		raise(lastEnd, "Illegal newline after throw");
	  node.argument = parseExpression();
	  semicolon();
	  return finishNode(node, "ThrowStatement");

	case _try:
	  next();
	  node.block = parseBlock();
	  node.handler = null;
	  if (tokType === _catch) {
		var clause = startNode();
		next();
		expect(_parenL);
		clause.param = parseIdent();
		if (strict && isStrictBadIdWord(clause.param.name))
		  raise(clause.param.start, "Binding " + clause.param.name + " in strict mode");
		expect(_parenR);
		clause.guard = null;
		clause.body = parseBlock();
		node.handler = finishNode(clause, "CatchClause");
	  }
	  node.guardedHandlers = empty;
	  node.finalizer = eat(_finally) ? parseBlock() : null;
	  if (!node.handler && !node.finalizer)
		raise(node.start, "Missing catch or finally clause");
	  return finishNode(node, "TryStatement");

	case _var:
	  next();
	  parseVar(node);
	  semicolon();
	  return finishNode(node, "VariableDeclaration");

	case _while:
	  next();
	  node.test = parseParenExpression();
	  labels.push(loopLabel);
	  node.body = parseStatement();
	  labels.pop();
	  return finishNode(node, "WhileStatement");

	case _with:
	  if (strict) raise(tokStart, "'with' in strict mode");
	  next();
	  node.object = parseParenExpression();
	  node.body = parseStatement();
	  return finishNode(node, "WithStatement");

	case _braceL:
	  return parseBlock();

	case _semi:
	  next();
	  return finishNode(node, "EmptyStatement");

	default:
	  var maybeName = tokVal, expr = parseExpression();
	  if (starttype === _name && expr.type === "Identifier" && eat(_colon)) {
		for (var i = 0; i < labels.length; ++i)
		  if (labels[i].name === maybeName) raise(expr.start, "Label '" + maybeName + "' is already declared");
		var kind = tokType.isLoop ? "loop" : tokType === _switch ? "switch" : null;
		labels.push({name: maybeName, kind: kind});
		node.body = parseStatement();
		labels.pop();
		node.label = expr;
		return finishNode(node, "LabeledStatement");
	  } else {
		node.expression = expr;
		semicolon();
		return finishNode(node, "ExpressionStatement");
	  }
	}
  }

  function parseParenExpression() {
	expect(_parenL);
	var val = parseExpression();
	expect(_parenR);
	return val;
  }

  function parseBlock(allowStrict) {
	var node = startNode(), first = true, strict = false, oldStrict;
	node.body = [];
	expect(_braceL);
	while (!eat(_braceR)) {
	  var stmt = parseStatement();
	  node.body.push(stmt);
	  if (first && allowStrict && isUseStrict(stmt)) {
		oldStrict = strict;
		setStrict(strict = true);
	  }
	  first = false;
	}
	if (strict && !oldStrict) setStrict(false);
	return finishNode(node, "BlockStatement");
  }

  function parseFor(node, init) {
	node.init = init;
	expect(_semi);
	node.test = tokType === _semi ? null : parseExpression();
	expect(_semi);
	node.update = tokType === _parenR ? null : parseExpression();
	expect(_parenR);
	node.body = parseStatement();
	labels.pop();
	return finishNode(node, "ForStatement");
  }

  function parseForIn(node, init) {
	node.left = init;
	node.right = parseExpression();
	expect(_parenR);
	node.body = parseStatement();
	labels.pop();
	return finishNode(node, "ForInStatement");
  }

  function parseVar(node, noIn) {
	node.declarations = [];
	node.kind = "var";
	for (;;) {
	  var decl = startNode();
	  decl.id = parseIdent();
	  if (strict && isStrictBadIdWord(decl.id.name))
		raise(decl.id.start, "Binding " + decl.id.name + " in strict mode");
	  decl.init = eat(_eq) ? parseExpression(true, noIn) : null;
	  node.declarations.push(finishNode(decl, "VariableDeclarator"));
	  if (!eat(_comma)) break;
	}
	return node;
  }

  function parseExpression(noComma, noIn) {
	var expr = parseMaybeAssign(noIn);
	if (!noComma && tokType === _comma) {
	  var node = startNodeFrom(expr);
	  node.expressions = [expr];
	  while (eat(_comma)) node.expressions.push(parseMaybeAssign(noIn));
	  return finishNode(node, "SequenceExpression");
	}
	return expr;
  }

  function parseMaybeAssign(noIn) {
	var left = parseMaybeConditional(noIn);
	if (tokType.isAssign) {
	  var node = startNodeFrom(left);
	  node.operator = tokVal;
	  node.left = left;
	  next();
	  node.right = parseMaybeAssign(noIn);
	  checkLVal(left);
	  return finishNode(node, "AssignmentExpression");
	}
	return left;
  }

  function parseMaybeConditional(noIn) {
	var expr = parseExprOps(noIn);
	if (eat(_question)) {
	  var node = startNodeFrom(expr);
	  node.test = expr;
	  node.consequent = parseExpression(true);
	  expect(_colon);
	  node.alternate = parseExpression(true, noIn);
	  return finishNode(node, "ConditionalExpression");
	}
	return expr;
  }

  function parseExprOps(noIn) {
	return parseExprOp(parseMaybeUnary(), -1, noIn);
  }

  function parseExprOp(left, minPrec, noIn) {
	var prec = tokType.binop;
	if (prec != null && (!noIn || tokType !== _in)) {
	  if (prec > minPrec) {
		var node = startNodeFrom(left);
		node.left = left;
		node.operator = tokVal;
		var op = tokType;
		next();
		node.right = parseExprOp(parseMaybeUnary(), prec, noIn);
		var exprNode = finishNode(node, (op === _logicalOR || op === _logicalAND) ? "LogicalExpression" : "BinaryExpression");
		return parseExprOp(exprNode, minPrec, noIn);
	  }
	}
	return left;
  }

  function parseMaybeUnary() {
	if (tokType.prefix) {
	  var node = startNode(), update = tokType.isUpdate;
	  node.operator = tokVal;
	  node.prefix = true;
	  tokRegexpAllowed = true;
	  next();
	  node.argument = parseMaybeUnary();
	  if (update) checkLVal(node.argument);
	  else if (strict && node.operator === "delete" &&
			   node.argument.type === "Identifier")
		raise(node.start, "Deleting local variable in strict mode");
	  return finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
	}
	var expr = parseExprSubscripts();
	while (tokType.postfix && !canInsertSemicolon()) {
	  var node = startNodeFrom(expr);
	  node.operator = tokVal;
	  node.prefix = false;
	  node.argument = expr;
	  checkLVal(expr);
	  next();
	  expr = finishNode(node, "UpdateExpression");
	}
	return expr;
  }

  function parseExprSubscripts() {
	return parseSubscripts(parseExprAtom());
  }

  function parseSubscripts(base, noCalls) {
	if (eat(_dot)) {
	  var node = startNodeFrom(base);
	  node.object = base;
	  node.property = parseIdent(true);
	  node.computed = false;
	  return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
	} else if (eat(_bracketL)) {
	  var node = startNodeFrom(base);
	  node.object = base;
	  node.property = parseExpression();
	  node.computed = true;
	  expect(_bracketR);
	  return parseSubscripts(finishNode(node, "MemberExpression"), noCalls);
	} else if (!noCalls && eat(_parenL)) {
	  var node = startNodeFrom(base);
	  node.callee = base;
	  node.arguments = parseExprList(_parenR, false);
	  return parseSubscripts(finishNode(node, "CallExpression"), noCalls);
	} else return base;
  }

  function parseExprAtom() {
	switch (tokType) {
	case _this:
	  var node = startNode();
	  next();
	  return finishNode(node, "ThisExpression");
	case _name:
	  return parseIdent();
	case _num: case _string: case _regexp:
	  var node = startNode();
	  node.value = tokVal;
	  node.raw = input.slice(tokStart, tokEnd);
	  next();
	  return finishNode(node, "Literal");

	case _null: case _true: case _false:
	  var node = startNode();
	  node.value = tokType.atomValue;
	  node.raw = tokType.keyword;
	  next();
	  return finishNode(node, "Literal");

	case _parenL:
	  var tokStartLoc1 = tokStartLoc, tokStart1 = tokStart;
	  next();
	  var val = parseExpression();
	  val.start = tokStart1;
	  val.end = tokEnd;
	  if (options.locations) {
		val.loc.start = tokStartLoc1;
		val.loc.end = tokEndLoc;
	  }
	  if (options.ranges)
		val.range = [tokStart1, tokEnd];
	  expect(_parenR);
	  return val;

	case _bracketL:
	  var node = startNode();
	  next();
	  node.elements = parseExprList(_bracketR, true, true);
	  return finishNode(node, "ArrayExpression");

	case _braceL:
	  return parseObj();

	case _function:
	  var node = startNode();
	  next();
	  return parseFunction(node, false);

	case _new:
	  return parseNew();

	default:
	  unexpected();
	}
  }

  function parseNew() {
	var node = startNode();
	next();
	node.callee = parseSubscripts(parseExprAtom(), true);
	if (eat(_parenL)) node.arguments = parseExprList(_parenR, false);
	else node.arguments = empty;
	return finishNode(node, "NewExpression");
  }

  function parseObj() {
	var node = startNode(), first = true, sawGetSet = false;
	node.properties = [];
	next();
	while (!eat(_braceR)) {
	  if (!first) {
		expect(_comma);
		if (options.allowTrailingCommas && eat(_braceR)) break;
	  } else first = false;

	  var prop = {key: parsePropertyName()}, isGetSet = false, kind;
	  if (eat(_colon)) {
		prop.value = parseExpression(true);
		kind = prop.kind = "init";
	  } else if (options.ecmaVersion >= 5 && prop.key.type === "Identifier" &&
				 (prop.key.name === "get" || prop.key.name === "set")) {
		isGetSet = sawGetSet = true;
		kind = prop.kind = prop.key.name;
		prop.key = parsePropertyName();
		if (tokType !== _parenL) unexpected();
		prop.value = parseFunction(startNode(), false);
	  } else unexpected();

	  if (prop.key.type === "Identifier" && (strict || sawGetSet)) {
		for (var i = 0; i < node.properties.length; ++i) {
		  var other = node.properties[i];
		  if (other.key.name === prop.key.name) {
			var conflict = kind == other.kind || isGetSet && other.kind === "init" ||
			  kind === "init" && (other.kind === "get" || other.kind === "set");
			if (conflict && !strict && kind === "init" && other.kind === "init") conflict = false;
			if (conflict) raise(prop.key.start, "Redefinition of property");
		  }
		}
	  }
	  node.properties.push(prop);
	}
	return finishNode(node, "ObjectExpression");
  }

  function parsePropertyName() {
	if (tokType === _num || tokType === _string) return parseExprAtom();
	return parseIdent(true);
  }

  function parseFunction(node, isStatement) {
	if (tokType === _name) node.id = parseIdent();
	else if (isStatement) unexpected();
	else node.id = null;
	node.params = [];
	var first = true;
	expect(_parenL);
	while (!eat(_parenR)) {
	  if (!first) expect(_comma); else first = false;
	  node.params.push(parseIdent());
	}

	var oldInFunc = inFunction, oldLabels = labels;
	inFunction = true; labels = [];
	node.body = parseBlock(true);
	inFunction = oldInFunc; labels = oldLabels;

	if (strict || node.body.body.length && isUseStrict(node.body.body[0])) {
	  for (var i = node.id ? -1 : 0; i < node.params.length; ++i) {
		var id = i < 0 ? node.id : node.params[i];
		if (isStrictReservedWord(id.name) || isStrictBadIdWord(id.name))
		  raise(id.start, "Defining '" + id.name + "' in strict mode");
		if (i >= 0) for (var j = 0; j < i; ++j) if (id.name === node.params[j].name)
		  raise(id.start, "Argument name clash in strict mode");
	  }
	}

	return finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
  }

  function parseExprList(close, allowTrailingComma, allowEmpty) {
	var elts = [], first = true;
	while (!eat(close)) {
	  if (!first) {
		expect(_comma);
		if (allowTrailingComma && options.allowTrailingCommas && eat(close)) break;
	  } else first = false;

	  if (allowEmpty && tokType === _comma) elts.push(null);
	  else elts.push(parseExpression(true));
	}
	return elts;
  }

  function parseIdent(liberal) {
	var node = startNode();
	if (liberal && options.forbidReserved == "everywhere") liberal = false;
	if (tokType === _name) {
	  if (!liberal &&
		  (options.forbidReserved &&
		   (options.ecmaVersion === 3 ? isReservedWord3 : isReservedWord5)(tokVal) ||
		   strict && isStrictReservedWord(tokVal)) &&
		  input.slice(tokStart, tokEnd).indexOf("\\") == -1)
		raise(tokStart, "The keyword '" + tokVal + "' is reserved");
	  node.name = tokVal;
	} else if (liberal && tokType.keyword) {
	  node.name = tokType.keyword;
	} else {
	  unexpected();
	}
	tokRegexpAllowed = false;
	next();
	return finishNode(node, "Identifier");
  }

});

		if (!acorn.version)
			acorn = null;
	}

	function parse(code, options) {
		return (global.acorn || acorn).parse(code, options);
	}

	var binaryOperators = {
		'+': '__add',
		'-': '__subtract',
		'*': '__multiply',
		'/': '__divide',
		'%': '__modulo',
		'==': '__equals',
		'!=': '__equals'
	};

	var unaryOperators = {
		'-': '__negate',
		'+': '__self'
	};

	var fields = Base.each(
		['add', 'subtract', 'multiply', 'divide', 'modulo', 'equals', 'negate'],
		function(name) {
			this['__' + name] = '#' + name;
		},
		{
			__self: function() {
				return this;
			}
		}
	);
	Point.inject(fields);
	Size.inject(fields);
	Color.inject(fields);

	function __$__(left, operator, right) {
		var handler = binaryOperators[operator];
		if (left && left[handler]) {
			var res = left[handler](right);
			return operator === '!=' ? !res : res;
		}
		switch (operator) {
		case '+': return left + right;
		case '-': return left - right;
		case '*': return left * right;
		case '/': return left / right;
		case '%': return left % right;
		case '==': return left == right;
		case '!=': return left != right;
		}
	}

	function $__(operator, value) {
		var handler = unaryOperators[operator];
		if (value && value[handler])
			return value[handler]();
		switch (operator) {
		case '+': return +value;
		case '-': return -value;
		}
	}

	function compile(code, options) {
		if (!code)
			return '';
		options = options || {};

		var insertions = [];

		function getOffset(offset) {
			for (var i = 0, l = insertions.length; i < l; i++) {
				var insertion = insertions[i];
				if (insertion[0] >= offset)
					break;
				offset += insertion[1];
			}
			return offset;
		}

		function getCode(node) {
			return code.substring(getOffset(node.range[0]),
					getOffset(node.range[1]));
		}

		function getBetween(left, right) {
			return code.substring(getOffset(left.range[1]),
					getOffset(right.range[0]));
		}

		function replaceCode(node, str) {
			var start = getOffset(node.range[0]),
				end = getOffset(node.range[1]),
				insert = 0;
			for (var i = insertions.length - 1; i >= 0; i--) {
				if (start > insertions[i][0]) {
					insert = i + 1;
					break;
				}
			}
			insertions.splice(insert, 0, [start, str.length - end + start]);
			code = code.substring(0, start) + str + code.substring(end);
		}

		function walkAST(node, parent) {
			if (!node)
				return;
			for (var key in node) {
				if (key === 'range' || key === 'loc')
					continue;
				var value = node[key];
				if (Array.isArray(value)) {
					for (var i = 0, l = value.length; i < l; i++)
						walkAST(value[i], node);
				} else if (value && typeof value === 'object') {
					walkAST(value, node);
				}
			}
			switch (node.type) {
			case 'UnaryExpression':
				if (node.operator in unaryOperators
						&& node.argument.type !== 'Literal') {
					var arg = getCode(node.argument);
					replaceCode(node, '$__("' + node.operator + '", '
							+ arg + ')');
				}
				break;
			case 'BinaryExpression':
				if (node.operator in binaryOperators
						&& node.left.type !== 'Literal') {
					var left = getCode(node.left),
						right = getCode(node.right),
						between = getBetween(node.left, node.right),
						operator = node.operator;
					replaceCode(node, '__$__(' + left + ','
							+ between.replace(new RegExp('\\' + operator),
								'"' + operator + '"')
							+ ', ' + right + ')');
				}
				break;
			case 'UpdateExpression':
			case 'AssignmentExpression':
				var parentType = parent && parent.type;
				if (!(
						parentType === 'ForStatement'
						|| parentType === 'BinaryExpression'
							&& /^[=!<>]/.test(parent.operator)
						|| parentType === 'MemberExpression' && parent.computed
				)) {
					if (node.type === 'UpdateExpression') {
						var arg = getCode(node.argument),
							exp = '__$__(' + arg + ', "' + node.operator[0]
									+ '", 1)',
							str = arg + ' = ' + exp;
						if (!node.prefix
								&& (parentType === 'AssignmentExpression'
									|| parentType === 'VariableDeclarator')) {
							if (getCode(parent.left || parent.id) === arg)
								str = exp;
							str = arg + '; ' + str;
						}
						replaceCode(node, str);
					} else {
						if (/^.=$/.test(node.operator)
								&& node.left.type !== 'Literal') {
							var left = getCode(node.left),
								right = getCode(node.right),
								exp = left + ' = __$__(' + left + ', "'
									+ node.operator[0] + '", ' + right + ')';
							replaceCode(node, /^\(.*\)$/.test(getCode(node))
									? '(' + exp + ')' : exp);
						}
					}
				}
				break;
			}
		}

		function encodeVLQ(value) {
			var res = '',
				base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
			value = (Math.abs(value) << 1) + (value < 0 ? 1 : 0);
			while (value || !res) {
				var next = value & (32 - 1);
				value >>= 5;
				if (value)
					next |= 32;
				res += base64[next];
			}
			return res;
		}

		var url = options.url || '',
			agent = paper.agent,
			version = agent.versionNumber,
			offsetCode = false,
			sourceMaps = options.sourceMaps,
			source = options.source || code,
			lineBreaks = /\r\n|\n|\r/mg,
			offset = options.offset || 0,
			map;
		if (sourceMaps && (agent.chrome && version >= 30
				|| agent.webkit && version >= 537.76
				|| agent.firefox && version >= 23
				|| agent.node)) {
			if (agent.node) {
				offset -= 2;
			} else if (window && url && !window.location.href.indexOf(url)) {
				var html = document.getElementsByTagName('html')[0].innerHTML;
				offset = html.substr(0, html.indexOf(code) + 1).match(
						lineBreaks).length + 1;
			}
			offsetCode = offset > 0 && !(
					agent.chrome && version >= 36 ||
					agent.safari && version >= 600 ||
					agent.firefox && version >= 40 ||
					agent.node);
			var mappings = ['AA' + encodeVLQ(offsetCode ? 0 : offset) + 'A'];
			mappings.length = (code.match(lineBreaks) || []).length + 1
					+ (offsetCode ? offset : 0);
			map = {
				version: 3,
				file: url,
				names:[],
				mappings: mappings.join(';AACA'),
				sourceRoot: '',
				sources: [url],
				sourcesContent: [source]
			};
		}
		walkAST(parse(code, { ranges: true, preserveParens: true }));
		if (map) {
			if (offsetCode) {
				code = new Array(offset + 1).join('\n') + code;
			}
			if (/^(inline|both)$/.test(sourceMaps)) {
				code += "\n//# sourceMappingURL=data:application/json;base64,"
						+ self.btoa(unescape(encodeURIComponent(
							JSON.stringify(map))));
			}
			code += "\n//# sourceURL=" + (url || 'paperscript');
		}
		return {
			url: url,
			source: source,
			code: code,
			map: map
		};
	}

	function execute(code, scope, options) {
		paper = scope;
		var view = scope.getView(),
			tool = /\btool\.\w+|\s+on(?:Key|Mouse)(?:Up|Down|Move|Drag)\b/
					.test(code) && !/\bnew\s+Tool\b/.test(code)
						? new Tool() : null,
			toolHandlers = tool ? tool._events : [],
			handlers = ['onFrame', 'onResize'].concat(toolHandlers),
			params = [],
			args = [],
			func,
			compiled = typeof code === 'object' ? code : compile(code, options);
		code = compiled.code;
		function expose(scope, hidden) {
			for (var key in scope) {
				if ((hidden || !/^_/.test(key)) && new RegExp('([\\b\\s\\W]|^)'
						+ key.replace(/\$/g, '\\$') + '\\b').test(code)) {
					params.push(key);
					args.push(scope[key]);
				}
			}
		}
		expose({ __$__: __$__, $__: $__, paper: scope, view: view, tool: tool },
				true);
		expose(scope);
		handlers = Base.each(handlers, function(key) {
			if (new RegExp('\\s+' + key + '\\b').test(code)) {
				params.push(key);
				this.push(key + ': ' + key);
			}
		}, []).join(', ');
		if (handlers)
			code += '\nreturn { ' + handlers + ' };';
		var agent = paper.agent;
		if (document && (agent.chrome
				|| agent.firefox && agent.versionNumber < 40)) {
			var script = document.createElement('script'),
				head = document.head || document.getElementsByTagName('head')[0];
			if (agent.firefox)
				code = '\n' + code;
			script.appendChild(document.createTextNode(
				'paper._execute = function(' + params + ') {' + code + '\n}'
			));
			head.appendChild(script);
			func = paper._execute;
			delete paper._execute;
			head.removeChild(script);
		} else {
			func = Function(params, code);
		}
		var res = func.apply(scope, args) || {};
		Base.each(toolHandlers, function(key) {
			var value = res[key];
			if (value)
				tool[key] = value;
		});
		if (view) {
			if (res.onResize)
				view.setOnResize(res.onResize);
			view.emit('resize', {
				size: view.size,
				delta: new Point()
			});
			if (res.onFrame)
				view.setOnFrame(res.onFrame);
			view.requestUpdate();
		}
		return compiled;
	}

	function loadScript(script) {
		if (/^text\/(?:x-|)paperscript$/.test(script.type)
				&& PaperScope.getAttribute(script, 'ignore') !== 'true') {
			var canvasId = PaperScope.getAttribute(script, 'canvas'),
				canvas = document.getElementById(canvasId),
				src = script.src || script.getAttribute('data-src'),
				async = PaperScope.hasAttribute(script, 'async'),
				scopeAttribute = 'data-paper-scope';
			if (!canvas)
				throw new Error('Unable to find canvas with id "'
						+ canvasId + '"');
			var scope = PaperScope.get(canvas.getAttribute(scopeAttribute))
						|| new PaperScope().setup(canvas);
			canvas.setAttribute(scopeAttribute, scope._id);
			if (src) {
				Http.request({
					url: src,
					async: async,
					mimeType: 'text/plain',
					onLoad: function(code) {
						execute(code, scope, src);
					}
				});
			} else {
				execute(script.innerHTML, scope, script.baseURI);
			}
			script.setAttribute('data-paper-ignore', 'true');
			return scope;
		}
	}

	function loadAll() {
		Base.each(document && document.getElementsByTagName('script'),
				loadScript);
	}

	function load(script) {
		return script ? loadScript(script) : loadAll();
	}

	if (window) {
		if (document.readyState === 'complete') {
			setTimeout(loadAll);
		} else {
			DomEvent.add(window, { load: loadAll });
		}
	}

	return {
		compile: compile,
		execute: execute,
		load: load,
		parse: parse
	};

}.call(this);

paper = new (PaperScope.inject(Base.exports, {
	Base: Base,
	Numerical: Numerical,
	Key: Key,
	DomEvent: DomEvent,
	DomElement: DomElement,
	document: document,
	window: window,
	Symbol: SymbolDefinition,
	PlacedSymbol: SymbolItem
}))();

if (paper.agent.node) {
	require('./node/extend.js')(paper);
}

if (typeof define === 'function' && define.amd) {
	define('paper', paper);
} else if (typeof module === 'object' && module) {
	module.exports = paper;
}

return paper;
}.call(this, typeof self === 'object' ? self : null);

},{"./node/extend.js":11,"./node/self.js":11,"acorn":10}],16:[function(require,module,exports){
;(function (root, factory) {

    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.popupS = factory();
    }

}(this, function () {
    'use strict';

    var isOpen = false,
        queue  = [];

    // Match image file
    var R_IMG = new RegExp( /([^\/\\]+)\.(jpg|jpeg|png|gif)$/i );

    var _defaults = {
        additionalBaseClass: '',
        additionalButtonHolderClass: '',
        additionalButtonOkClass: '',
        additionalButtonCancelClass: '',
        additionalCloseBtnClass: '',
        additionalFormClass: '',
        additionalOverlayClass: '',
        additionalPopupClass: '',
        appendLocation: (document.body || document.documentElement),
        baseClassName: 'popupS',
        closeBtn: '&times;',
        flagBodyScroll: false,
        flagButtonReverse: false,
        flagCloseByEsc: true,
        flagCloseByOverlay: true,
        flagShowCloseBtn: true,
        labelOk: 'OK',
        labelCancel: 'Cancel',
        loader: 'spinner',
        zIndex: 10000
    }

    var transition = (function() {
        var t, type;
        var supported = false;
        var el = document.createElement("fakeelement");
        var transitions = {
            "WebkitTransition": "webkitTransitionEnd",
            "MozTransition": "transitionend",
            "OTransition": "otransitionend",
            "transition": "transitionend"
        };

        for(t in transitions) {
            if (transitions.hasOwnProperty(t) && el.style[t] !== undefined) {
                type = transitions[t];
                supported = true;
                break;
            }
        }

        return {
            type: type,
            supported: supported
        };
    })()

    /**
     * @class   PopupS
     */
    function PopupS() {}

    PopupS.prototype = {
        constructor: PopupS,

        _open: function(options) {
            //error catching
            if (typeof options.mode !== "string") throw new Error("mode must be a string");
            if (typeof options.title !== "undefined" && typeof options.title !== "string") throw new Error("title must be a string");
            if (typeof options.placeholder !== "undefined" && typeof options.placeholder !== "string") throw new Error("placeholder must be a string");

            this.options = options = _extend({}, options);

            // Set default options
            for (var name in _defaults) {
                !(name in options) && (options[name] = _defaults[name]);
            }

            // trail all classes divided by periods
            _each(['additionalBaseClass', 'additionalButtonHolderClass', 'additionalButtonOkClass', 'additionalButtonCancelClass', 'additionalCloseBtnClass', 'additionalFormClass', 'additionalOverlayClass', 'additionalPopupClass'], function(option) {
                var string = options[option].split(' ').join('.');
                options[option] = '.' + string;
            });

            // Bind all private methods
            for (var fn in this) {
                if (fn.charAt(0) === '_') {
                    this[fn] = _bind(this, this[fn]);
                }
            }

            //initialize if it hasn't already been done
            this._init();

            // if it is forced, close all others
            if(options.force === true) {
                while (queue.length > 0) queue.pop();
            }
            queue.push(options);

            if(!isOpen || options.force === true) this._create();
        },
        _init: function() {
            // if i passed a opacity attribute to the layer onClose, remove it on initialization
            if(this.$layerEl && this.$layerEl.style.opacity) this.$layerEl.style.opacity = "";
            if(!this.$wrapEl){
                this.$wrapEl = _buildDOM({
                    tag: 'div.' + this.options.baseClassName + '-base' + (this.options.additionalBaseClass ? this.options.additionalBaseClass : ''),
                    css: {
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        position: 'fixed',
                        textAlign: 'center',
                        overflowX: 'auto',
                        overflowY: 'auto',
                        outline: 0,
                        whiteSpace: 'nowrap',
                        zIndex: this.options.zIndex
                    },
                    children: {
                        css: {
                            height: '100%',
                            display: 'inline-block',
                            verticalAlign: 'middle'
                        }
                    }
                });
                _appendChild(this.$wrapEl, this._getOverlay());
                _appendChild(this.$wrapEl, this._getLayer());
            }
        },
        _getOverlay: function () {
            if (!this.$overlayEl) {
                this.$overlayEl = _buildDOM({
                    tag: '#popupS-overlay.' + this.options.baseClassName + '-overlay' + (this.options.additionalOverlayClass ? this.options.additionalOverlayClass : ''),
                    css: {
                        top: 0,
                        right: 0,
                        bottom: 0,
                        left: 0,
                        position: 'fixed',
                        overflowX: 'hidden',
                        userSelect: 'none',
                        webkitUserSelect: 'none',
                        MozUserSelect: 'none'
                    }
                });
            }
            this.$overlayEl.setAttribute("unselectable", "on");
            return this.$overlayEl;
        },
        _getLayer: function () {
            if(!this.$layerEl){
                this.$layerEl = _buildDOM({
                    css: {
                        display: 'inline-block',
                        position: 'relative',
                        textAlign: 'left',
                        whiteSpace: 'normal',
                        verticalAlign: 'middle',
                        maxWidth: '100%',
                        overflowX: 'hidden',
                        transform: 'translate3d(0,0,0)'
                    },
                    children: {
                        tag: '.' + this.options.baseClassName + '-layer' + (this.options.additionalPopupClass ? this.options.additionalPopupClass : '')
                    }
                });
            }
            return this.$layerEl;
        },
        _resetLayer: function(){
            this.$layerEl.childNodes[0].innerHTML = '';
        },
        /**
         * Takes the first item from the queue
         * creates or overwrites the Overlay and adds Events.
         */
        _create: function () {
            var self = this;
            var item = queue[0];
            var mode = item.mode;
            isOpen = true;
            // Creates the Popup. Overwrites the old one if one exists.
            if (mode != 'modal-ajax') {
                this._createPopup(item);
            } else {
                this._loadContents(item);
            }
            // this is very important for the callback function.
            // these lines make sure callbacks on the same function object will be displayed.
            var transitionDone = function(event) {
                event.stopPropagation();
                _unbind(self.$layerEl, transition.type, transitionDone);
            };
            if(transition.supported){
                _bind(self.$layerEl, transition.type, transitionDone);
            }
        },
        _createPopup: function(item) {
            var btnOk, btnCancel, htmlObj;
            var mode        = item.mode;
            var title       = item.title;
            var content     = item.content;
            var className   = (item.className ? '.' + item.className : '');
            var contentObj  = ((content instanceof Object) ? true : false);

            this.callbacks = {
                onOpen: item.onOpen,
                onSubmit: item.onSubmit,
                onClose: item.onClose
            };

            btnOk = {
                tag:  'button#popupS-button-ok.' + this.options.baseClassName + '-button-ok' + (this.options.additionalButtonOkClass ? this.options.additionalButtonOkClass : ''),
                text: this.options.labelOk };
            btnCancel = {
                tag:  'button#popupS-button-cancel.' + this.options.baseClassName + '-button-ok' + (this.options.additionalButtonCancelClass ? this.options.additionalButtonCancelClass : ''),
                text: this.options.labelCancel };

            htmlObj = [
                { html: content },
                mode != 'modal' && mode != 'modal-ajax' && mode == 'prompt' && {
                    tag: 'form.' + this.options.baseClassName + '-form' + (this.options.additionalFormClass ? this.options.additionalFormClass : ''),
                    children: [
                        item.placeholder && { tag:     'label',
                          htmlFor: 'popupS-input',
                          text:    item.placeholder },
                        { tag:  'input#popupS-input',
                          type: 'text' }
                    ]
                },
                mode != 'modal' && mode != 'modal-ajax' && { tag: 'nav.' + this.options.baseClassName + '-buttons' + (this.options.additionalButtonHolderClass ? this.options.additionalButtonHolderClass : ''),
                  children:
                    (
                        (mode == 'prompt' || mode == 'confirm')
                            ? (!this.options.flagButtonReverse ? [btnCancel, btnOk] : [btnOk, btnCancel] )
                            : [btnOk]
                    )
                }
            ];

            content = _buildDOM({
                children:[
                    { tag: 'a#popupS-resetFocusBack.' + this.options.baseClassName + '-resetFocus',
                      href:'#',
                      text:'Reset Focus' },
                    (this.options.flagShowCloseBtn && {
                        tag: 'span#popupS-close.' + this.options.baseClassName + '-close' + (this.options.additionalCloseBtnClass ? this.options.additionalCloseBtnClass : ''),
                        html: this.options.closeBtn
                    }),
                    (title && {
                        tag:  'h5.' + this.options.baseClassName + '-title' + className,
                        text: title }),
                    { tag:      '.' + this.options.baseClassName + '-content' + className,
                      children: (contentObj && content || htmlObj) },
                    { tag:'a#popupS-resetFocus.' + this.options.baseClassName + '-resetFocus',
                      href:'#',
                      text:'Reset Focus'}
                ]
            });

            this._resetLayer();
            _appendChild(this.$layerEl.childNodes[0], content);
            this._appendPopup();
            this.$contentEl = this.$layerEl.getElementsByClassName(this.options.baseClassName + '-content')[0];

            this.$btnReset     = document.getElementById('popupS-resetFocus');
            this.$btnResetBack = document.getElementById('popupS-resetFocusBack');

            // handle reset focus link
            // this ensures that the keyboard focus does not
            // ever leave the dialog box until an action has
            // been taken
            _on(this.$btnReset, 'focus', this._resetEvent);
            _on(this.$btnResetBack, 'focus', this._resetEvent);

            // focus the first input in the layer Element
            _autoFocus(this.$layerEl);

            // make sure which buttons or input fields are defined for the EventListeners
            this.$btnOK = document.getElementById('popupS-button-ok') || undefined;
            this.$btnCancel = document.getElementById('popupS-button-cancel') || undefined;
            this.$input = document.getElementById('popupS-input') || undefined;
            if(typeof this.$btnOK !== "undefined")     _on(this.$btnOK, "click", this._okEvent);
            if(typeof this.$btnCancel !== "undefined") _on(this.$btnCancel, "click", this._cancelEvent);


            // eventlisteners for overlay and x
            if (this.options.flagShowCloseBtn)   _on(document.getElementById('popupS-close'), "click", this._cancelEvent);
            if (this.options.flagCloseByOverlay) _on(this.$overlayEl, "click", this._cancelEvent);

            // listen for keys
            if (this.options.flagCloseByEsc) _on(document.body, "keyup", this._keyEvent);

            // callback onOpen
            if(typeof this.callbacks.onOpen === "function") this.callbacks.onOpen.call(this);

        },
        _appendPopup : function(){
            // Determine the target Element and add the Element to the DOM
            this.$targetEl = this.options.appendLocation;
            _appendChild(this.$targetEl, this.$wrapEl);
            // append the element level style for overflow if the option was set.
            if ((this.$targetEl === (document.body || document.documentElement)) && this.options.flagBodyScroll === false) {
                _css(this.$targetEl, {
                    overflow: 'hidden'
                });
            }
            // after adding elements to the DOM, use computedStyle
            // to force the browser to recalc and recognize the elements
            // that we just added. This is so that our CSS Animation has a start point.
            if(window.getComputedStyle) window.getComputedStyle(this.$wrapEl, null).height;
            var classReg = function (className) {
                return new RegExp("(|\\s+)" + className + "(\\s+|$)");
            };
            // if the class *-open doesn't exists in the wrap Element append it.
            if (!(classReg(' ' + this.options.baseClassName + '-open').test(this.$wrapEl.className))) {
                this.$wrapEl.className += ' ' + this.options.baseClassName + '-open';
            }
            if (!(classReg(' ' + this.options.baseClassName + '-open').test(this.$layerEl.childNodes[0].className))) {
                this.$layerEl.childNodes[0].className += ' ' + this.options.baseClassName + '-open';
            }
        },
        _hide: function () {
            var self = this;
            // remove item from queue
            queue.splice(0,1);
            // check if last item in queue
            if (queue.length > 0) this._create();
            else{
                isOpen = false;

                var removeWrap = function() {
                    // remove the wrap element from the DOM
                    _removeElement(self.$wrapEl);
                    // remove the element level style for overflow if the option was set.
                    if ((self.$targetEl === (document.body || document.documentElement)) && self.options.flagBodyScroll === false) {
                        if (self.$targetEl.style.removeProperty) {
                            self.$targetEl.style.removeProperty('overflow');
                        } else {
                            self.$targetEl.style.removeAttribute('overflow');
                        }
                    }
                };

                var transitionDone = function(event) {
                    event.stopPropagation();
                    // unbind event so function only gets called once
                    _off(self.$wrapEl, transition.type, transitionDone);
                    // remove the Element from the DOM after Transition is Done
                    removeWrap();
                };

                var transitionDoneLayer = function(event) {
                    event.stopPropagation();
                    // unbind event so function only gets called once
                    _off(self.$layerEl, transition.type, transitionDone);
                };

                // removes the open class from the wrap & layer Element
                // and adds an EventListener to this Element
                // which removes it from the DOM after the Transition is done.

                this.$wrapEl.className = this.$wrapEl.className.replace(' ' + this.options.baseClassName + '-open', '');
                if (transition.supported){
                    _on(self.$wrapEl, transition.type, transitionDone);
                } else {
                    removeWrap();
                }
                this.$layerEl.childNodes[0].className = this.$layerEl.childNodes[0].className.replace(' ' + this.options.baseClassName + '-open', '');
                if (transition.supported) _on(self.$layerEl, transition.type, transitionDoneLayer);

            }
        },



        ///////////////
        //// Async ////
        ///////////////


        /**
         * sets the state of the loading Layer
         * and appends it to the Dom
         *
         * @param   {Bool}  state
         */
        _loading: function(state) {
            this.$loadingEl = _buildDOM({
                tag: 'div.' + this.options.baseClassName + '-loading.' + this.options.loader
            });
            if (state){
                this._resetLayer();
                _css(this.$layerEl.childNodes[0],{
                    height: '60px',
                    width: '60px',
                    borderRadius: '30px'
                });
                _appendChild(this.$layerEl.childNodes[0], this.$loadingEl);
                this._appendPopup();
            } else {
                _css(this.$layerEl.childNodes[0],{
                    height: null,
                    width: null,
                    borderRadius: null
                });
            }
        },
        /**
         * load Asynchronous Files
         * can be Images or Files via Ajax
         *
         * @param   {Object}    item
         */
        _loadContents: function(item) {
            var url = item.ajax.url,
                str = (typeof item.ajax.str != "undefined")? item.ajax.str : '',
                post = (typeof item.ajax.post != "undefined")? item.ajax.post : true,
                self = this;

            // Match image file
            if (url.match(R_IMG)) {//.exec(url) !== null
                // Create the image Element, not visible
                var imgElement = _buildDOM({
                    children: {
                        tag :   'img',
                        src :   url
                    }
                });
                this._loading(true);
                this._preLoadImage(imgElement, function(){
                    self._loading(false);
                    item.content = imgElement;
                    self._createPopup(item);
                });
            } else {
                // get url via ajax
                this._ajax(url, str, post, function(e){
                    // turn the result in a HTMLElement
                    var ajaxElement = _buildDOM({
                        html: this
                    });
                    // check if the newly created HTMLElement got any Images within it.
                    self._preLoadImage(ajaxElement, function(){
                        self._loading(false);
                        item.content = ajaxElement;
                        self._createPopup(item);
                    });
                }, function(){
                    //before Sending
                    self._loading(true);
                });
            }
        },
        _preLoadImage : function(parentNode, callback) {
            var items = _getElementsByTagName(parentNode, 'img');
            var i = items.length;
            var queue = i;
            var img;
            var self = this;

            while (i--){
                img = items[i];
                //in case the're already cached by the browser decrement queue
                if(img.complete) {
                    queue--;
                } else {
                    _on(img, 'load', complete);
                    _on(img, 'error', complete);
                }
            }
            //in case the're already cached by the browser
            !queue && complete();

            var complete = function(){
                if(--queue <= 0){
                    i = items.length;
                    while(i--){
                        img = items[i];
                        _off(img, 'load', complete);
                        _off(img, 'error', complete);
                    }
                    callback();
                }
            };
        },
        /**
         * ajax request
         * with callback and beforeSend
         *
         * @param   {String}    filename
         * @param   {String}    str
         * @param   {Bool}      post
         * @param   {Function}  callback
         * @param   {Function}  beforeSend
         */
        _ajax: function(filename, str, post, callback, beforeSend) {
            var ajax;
            if (window.XMLHttpRequest){
                ajax = new XMLHttpRequest();//IE7+, Firefox, Chrome, Opera, Safari
            } else if (ActiveXObject("Microsoft.XMLHTTP")){
                ajax = new ActiveXObject("Microsoft.XMLHTTP");//IE6/5
            }else if (ActiveXObject("Msxml2.XMLHTTP")){
                ajax = new ActiveXObject("Msxml2.XMLHTTP");//other
            }else{
                alert("Error: Your browser does not support AJAX.");
                return false;
            }
            ajax.onreadystatechange=function(){
                if (ajax.readyState == 4 && ajax.status == 200){
                    if (callback) callback.call(ajax.responseText);
                }
            };
            if(post === false) {
                ajax.open("GET", filename + str, true);
                ajax.send(null);
            } else {
                ajax.open("POST", filename, true);
                ajax.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                ajax.send(str);
            }
            if(beforeSend) beforeSend.call();
            return ajax;
        },



        ////////////////
        //// Events ////
        ////////////////



        //ok event handler
        _okEvent: function(event) {
            // preventDefault
            if (typeof event.preventDefault !== "undefined") event.preventDefault();
            // call the callback onSubmit if one is defined. this references to _popupS
            if(typeof this.callbacks.onSubmit === "function") {
                if(typeof this.$input !== "undefined") {
                    this.callbacks.onSubmit.call(this, this.$input.value);
                } else {
                    this.callbacks.onSubmit.call(this);
                }
            }
            // hide popup and detach event handlers
            this._commonEvent();
        },
        // cancel event handler
        _cancelEvent: function(event) {
            if (typeof event.preventDefault !== "undefined") event.preventDefault();
            // call the callback onClose if one is defined. this references to _popupS
            if(typeof this.callbacks.onClose === "function") {
                this.callbacks.onClose.call(this);
            }
            this._commonEvent();
        },
        // common event handler (keyup, ok and cancel)
        _commonEvent: function() {
            // remove event handlers
            if(typeof this.$btnOK !== "undefined")     _off(this.$btnOK, "click", this._okEvent);
            if(typeof this.$btnCancel !== "undefined") _off(this.$btnCancel, "click", this._cancelEvent);
            if (this.options.flagShowCloseBtn)   _off(document.getElementById('popupS-close'), "click", this._cancelEvent);
            if (this.options.flagCloseByOverlay) _off(this.$overlayEl, "click", this._cancelEvent);
            if (this.options.flagCloseByEsc)     _off(document.body, "keyup", this._keyEvent);

            this._hide();
        },
        // reset focus to first item in the popup
        _resetEvent: function(event) {
            _autoFocus(this.$layerEl);
        },
        // keyEvent Listener for Enter and Escape
        _keyEvent: function(event) {
            var keyCode = event.keyCode;
            if(typeof this.$input !== "undefined" && keyCode === 13) this._okEvent(event);
            if(keyCode === 27) this._cancelEvent(event);
        },

    }

    /**
     * context binding
     * @param   {Function}  ctx     context
     * @param   {Function}  fn      function
     */
    function _bind(ctx, fn) {
        var args = [].slice.call(arguments, 2);
        return  fn.bind ? fn.bind.apply(fn, [ctx].concat(args)) : function () {
            return fn.apply(ctx, args.concat([].slice.call(arguments)));
        };
    }
    /**
     * Object iterator
     *
     * @param  {Object|Array}  obj
     * @param  {Function}      iterator
     */
    function _each(obj, iterator) {
        if (obj) {
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    iterator(obj[key], key, obj);
                }
            }
        }
    }
    /**
     * Copy all of the properties in the source objects over to the destination object
     *
     * @param   {...Object}     out
     *
     * @return  {Object}
     */
    function _extend(out) {
        out = out || {};

        for (var i = 1; i < arguments.length; i++) {
            if (!arguments[i])
                continue;

            for (var key in arguments[i]) {
                if (arguments[i].hasOwnProperty(key))
                    out[key] = arguments[i][key];
            }
        }

        return out;
    }
    /**
     * Bind events to elements
     *
     * @param  {HTMLElement}    el
     * @param  {Event}          event
     * @param  {Function}       fn
     */
    function _on(el, event, fn) {
        if (typeof el.addEventListener === "function") {
            el.addEventListener(event, fn, false);
        } else if (el.attachEvent) {
            el.attachEvent("on" + event, fn);
        }
    }
    /**
     * Unbind events from element
     *
     * @param  {HTMLElement}    el
     * @param  {Event}          event
     * @param  {Function}       fn
     */
    function _off(el, event, fn) {
        if (typeof el.removeEventListener === "function") {
            el.removeEventListener(event, fn, false);
        } else if (el.detachEvent) {
            el.detachEvent("on" + event, fn);
        }
    }
    /**
     * css recursion
     *
     * @param   {HTMLElement}   el
     * @param   {Object|String} prop
     * @param   {String}        [val]
     */
    function _css(el, prop, val) {
        if (el && el.style && prop) {
            if (prop instanceof Object) {
                for (var name in prop) {
                    _css(el, name, prop[name]);
                }
            } else {
                el.style[prop] = val;
            }
        }
    }
    /**
     * Selector RegExp
     *
     * @const   {RegExp}
     */
    // orig: /^(\w+)?(#\w+)?((?:\.[\w_-]+)*)/i;
    var R_SELECTOR = /^(\w+)?(#[\w_-]+)?((?:\.[\w_-]+)*)/i;

    /**
     * build DOM Nodes
     *
     * @example
     *  _buildDOM({
     *      tag:'div#id.class.class2',
     *      css:{
     *          opacity:'1',
     *          width:'100px'
     *      },
     *      text:'test',
     *      html:'<p>Hello</p>',
     *      children:[{
     *          tag:'div#id_child.class.class2',
     *          css:{opacity:'1', height:'200px'},
     *          text:'test',
     *          html:'<p>World</p>'
     *      }]
     *  });
     *
     * @param   {String|Object} spec
     *
     * @return  {HTMLElement}
     */
    function _buildDOM(spec) {
        // Spec Defaults
        if (spec === null) {
            spec = 'div';
        }
        if (typeof spec === 'string') {
            spec = {
                tag: spec
            };
        }
        var el, classSelector;
        var fragment = document.createDocumentFragment();
        var children = spec.children;
        var selector = R_SELECTOR.exec(spec.tag || '');

        delete spec.children;

        spec.tag = selector[1] || 'div';
        spec.id = spec.id || (selector[2] || '').substr(1);
        // split ClassNames
        classSelector = (selector[3] || '').split('.');
        classSelector[0] = (spec.className || '');
        spec.className = classSelector.join(' ');


        el = document.createElement(spec.tag);
        _appendChild(fragment, el);
        delete spec.tag;

        // For every
        // key => spec[key];
        _each(spec, function(value, key) {
            if (key === 'css') {
                _css(el, spec.css);
            } else if (key === 'text') {
                (value !== null) && _appendChild(el, document.createTextNode(value));
            } else if (key === 'html') {
                (value !== null) && (el.innerHTML = value);
            } else if (key in el) {
                try {
                    el[key] = value;
                } catch (e) {
                    el.setAttribute(key, value);
                }
            } else if (/^data-/.test(key)) {
                el.setAttribute(key, value);
            }
        });
        // if the children is already an HTML Element, append it to el
        if (children && children.appendChild) {
            _appendChild(el, children);
        } else if (children) {
            if (children instanceof Array) {
                _each(children, function(value, key) {
                    if(value instanceof Object) {
                        _appendChild(el, _buildDOM(value));
                    }
                });
            } else if (children instanceof Object) {
                _appendChild(el, _buildDOM(children));
            }
        }
        return el;
    }
    /**
     * appendChild
     *
     * @param   {HTMLElement}   parent
     * @param   {HTMLElement}   el
     */
    function _appendChild(parent, el) {
        try {
            parent && el && parent.appendChild(el);
        } catch (e) {}
    }
    /**
     * Focus First Item in Parent Node
     * submit > text,password > button
     *
     * @param  {HTMLElement}    parentNode
     */
    function _autoFocus(parentNode) {
        var items = _getElementsByTagName(parentNode, 'input');
        var i = 0;
        var n = items.length;
        var el, element;

        for (; i < n; i++) {
            el = items[i];

            if (el.type === 'submit') {
                !element && (element = el);
            } else if (!/hidden|check|radio/.test(el.type) && el.value === '') {
                element = el;
                break;
            }
        }

        if (!element) {
            element = _getElementsByTagName(parentNode, 'button')[0];
        }

        try {
            element.focus();
        } catch (err) {}
    }
    /**
     * get Elements with Tag () from Parent
     *
     * @param   {HTMLElement}  el
     * @param   {String}       name
     *
     * @return  {NodeList}
     */
    function _getElementsByTagName(el, name) {
        return el.getElementsByTagName(name);
    }
    /**
     * remove Element from Parent
     *
     * @param   {HTMLElement}   el
     */
    function _removeElement(el) {
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }
    }

    // Instantiate a PopupS Object
    var popupS = new PopupS();

    // Public methods
    popupS.window = function(params) {
        this._open(params);
    };
    popupS.alert = function(params) {
        params = _extend(params, {mode: 'alert'});
        this._open(params);
    };
    popupS.confirm = function(params) {
        params = _extend(params, {mode: 'confirm'});
        this._open(params);
    };
    popupS.prompt = function(params) {
        params = _extend(params, {mode: 'prompt'});
        this._open(params);
    };
    popupS.modal = function(params) {
        params = _extend(params, {mode: 'modal'});
        this._open(params);
    };
    popupS.ajax = function(params) {
        params = _extend(params, {mode: 'modal-ajax'});
        this._open(params);
    };

    // Export
    return popupS;
}));
},{}],17:[function(require,module,exports){
/**
 * # ResurrectJS
 * @version 1.0.3
 * @license Public Domain
 *
 * ResurrectJS preserves object behavior (prototypes) and reference
 * circularity with a special JSON encoding. Unlike regular JSON,
 * Date, RegExp, DOM objects, and `undefined` are also properly
 * preserved.
 *
 * ## Examples
 *
 * function Foo() {}
 * Foo.prototype.greet = function() { return "hello"; };
 *
 * // Behavior is preserved:
 * var necromancer = new Resurrect();
 * var json = necromancer.stringify(new Foo());
 * var foo = necromancer.resurrect(json);
 * foo.greet();  // => "hello"
 *
 * // References to the same object are preserved:
 * json = necromancer.stringify([foo, foo]);
 * var array = necromancer.resurrect(json);
 * array[0] === array[1];  // => true
 * array[1].greet();  // => "hello"
 *
 * // Dates are restored properly
 * json = necromancer.stringify(new Date());
 * var date = necromancer.resurrect(json);
 * Object.prototype.toString.call(date);  // => "[object Date]"
 *
 * ## Options
 *
 * Options are provided to the constructor as an object with these
 * properties:
 *
 *   prefix ('#'): A prefix string used for temporary properties added
 *     to objects during serialization and deserialization. It is
 *     important that you don't use any properties beginning with this
 *     string. This option must be consistent between both
 *     serialization and deserialization.
 *
 *   cleanup (false): Perform full property cleanup after both
 *     serialization and deserialization using the `delete`
 *     operator. This may cause performance penalties (breaking hidden
 *     classes in V8) on objects that ResurrectJS touches, so enable
 *     with care.
 *
 *   revive (true): Restore behavior (__proto__) to objects that have
 *     been resurrected. If this is set to false during serialization,
 *     resurrection information will not be encoded. You still get
 *     circularity and Date support.
 *
 *   resolver (Resurrect.NamespaceResolver(window)): Converts between
 *     a name and a prototype. Create a custom resolver if your
 *     constructors are not stored in global variables. The resolver
 *     has two methods: getName(object) and getPrototype(string).
 *
 * For example,
 *
 * var necromancer = new Resurrect({
 *     prefix: '__#',
 *     cleanup: true
 * });
 *
 * ## Caveats
 *
 *   * With the default resolver, all constructors must be named and
 *   stored in the global variable under that name. This is required
 *   so that the prototypes can be looked up and reconnected at
 *   resurrection time.
 *
 *   * The wrapper objects Boolean, String, and Number will be
 *   unwrapped. This means extra properties added to these objects
 *   will not be preserved.
 *
 *   * Functions cannot ever be serialized. Resurrect will throw an
 *   error if a function is found when traversing a data structure.
 *
 * @see http://nullprogram.com/blog/2013/03/28/
 */

/**
 * @param {Object} [options] See options documentation.
 * @namespace
 * @constructor
 */
function Resurrect(options) {
    this.table = null;
    this.prefix = '#';
    this.cleanup = false;
    this.revive = true;
    for (var option in options) {
        if (options.hasOwnProperty(option)) {
            this[option] = options[option];
        }
    }
    this.refcode = this.prefix + 'id';
    this.origcode = this.prefix + 'original';
    this.buildcode = this.prefix + '.';
    this.valuecode = this.prefix + 'v';
}

/**
 * Portable access to the global object (window, global).
 * Uses indirect eval.
 * @constant
 */
Resurrect.GLOBAL = (0, eval)('this');

/**
 * Escape special regular expression characters in a string.
 * @param {string} string
 * @returns {string} The string escaped for exact matches.
 * @see http://stackoverflow.com/a/6969486
 */
Resurrect.escapeRegExp = function (string) {
    return string.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
};

/* Helper Objects */

/**
 * @param {string} [message]
 * @constructor
 */
Resurrect.prototype.Error = function ResurrectError(message) {
    this.message = message || '';
    this.stack = new Error().stack;
};
Resurrect.prototype.Error.prototype = Object.create(Error.prototype);
Resurrect.prototype.Error.prototype.name = 'ResurrectError';

/**
 * Resolves prototypes through the properties on an object and
 * constructor names.
 * @param {Object} scope
 * @constructor
 */
Resurrect.NamespaceResolver = function(scope) {
    this.scope = scope;
};

/**
 * Gets the prototype of the given property name from an object. If
 * not found, it throws an error.
 * @param {string} name
 * @returns {Object}
 * @method
 */
Resurrect.NamespaceResolver.prototype.getPrototype = function(name) {
    var constructor = this.scope[name];
    if (constructor) {
        return constructor.prototype;
    } else {
        throw new Resurrect.prototype.Error('Unknown constructor: ' + name);
    }
};

/**
 * Get the prototype name for an object, to be fetched later with getPrototype.
 * @param {Object} object
 * @returns {?string} Null if the constructor is Object.
 * @method
 */
Resurrect.NamespaceResolver.prototype.getName = function(object) {
    var constructor = object.constructor.name;
    if (constructor == null) { // IE
        var funcPattern = /^\s*function\s*([A-Za-z0-9_$]*)/;
        constructor = funcPattern.exec(object.constructor)[1];
    }

    if (constructor === '') {
        var msg = "Can't serialize objects with anonymous constructors.";
        throw new Resurrect.prototype.Error(msg);
    } else if (constructor === 'Object' || constructor === 'Array') {
        return null;
    } else {
        return constructor;
    }
};

/* Set the default resolver searches the global object. */
Resurrect.prototype.resolver =
    new Resurrect.NamespaceResolver(Resurrect.GLOBAL);

/**
 * Create a DOM node from HTML source; behaves like a constructor.
 * @param {string} html
 * @constructor
 */
Resurrect.Node = function(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return div.firstChild;
};

/* Type Tests */

/**
 * @param {string} type
 * @returns {Function} A function that tests for type.
 */
Resurrect.is = function(type) {
    var string = '[object ' + type + ']';
    return function(object) {
        return Object.prototype.toString.call(object) === string;
    };
};

Resurrect.isArray = Resurrect.is('Array');
Resurrect.isString = Resurrect.is('String');
Resurrect.isBoolean = Resurrect.is('Boolean');
Resurrect.isNumber = Resurrect.is('Number');
Resurrect.isFunction = Resurrect.is('Function');
Resurrect.isDate = Resurrect.is('Date');
Resurrect.isRegExp = Resurrect.is('RegExp');
Resurrect.isObject = Resurrect.is('Object');

Resurrect.isAtom = function(object) {
    return !Resurrect.isObject(object) && !Resurrect.isArray(object);
};

/**
 * @param {*} object
 * @returns {boolean} True if object is a primitive or a primitive wrapper.
 */
Resurrect.isPrimitive = function(object) {
    return object == null ||
        Resurrect.isNumber(object) ||
        Resurrect.isString(object) ||
        Resurrect.isBoolean(object);
};

/* Methods */

/**
 * Create a reference (encoding) to an object.
 * @param {(Object|undefined)} object
 * @returns {Object}
 * @method
 */
Resurrect.prototype.ref = function(object) {
    var ref = {};
    if (object === undefined) {
        ref[this.prefix] = -1;
    } else {
        ref[this.prefix] = object[this.refcode];
    }
    return ref;
};

/**
 * Lookup an object in the table by reference object.
 * @param {Object} ref
 * @returns {(Object|undefined)}
 * @method
 */
Resurrect.prototype.deref = function(ref) {
    return this.table[ref[this.prefix]];
};

/**
 * Put a temporary identifier on an object and store it in the table.
 * @param {Object} object
 * @returns {number} The unique identifier number.
 * @method
 */
Resurrect.prototype.tag = function(object) {
    if (this.revive) {
        var constructor = this.resolver.getName(object);
        if (constructor) {
            var proto = Object.getPrototypeOf(object);
            if (this.resolver.getPrototype(constructor) !== proto) {
                throw new this.Error('Constructor mismatch!');
            } else {
                object[this.prefix] = constructor;
            }
        }
    }
    object[this.refcode] = this.table.length;
    this.table.push(object);
    return object[this.refcode];
};

/**
 * Create a builder object (encoding) for serialization.
 * @param {string} name The name of the constructor.
 * @param value The value to pass to the constructor.
 * @returns {Object}
 * @method
 */
Resurrect.prototype.builder = function(name, value) {
    var builder = {};
    builder[this.buildcode] = name;
    builder[this.valuecode] = value;
    return builder;
};

/**
 * Build a value from a deserialized builder.
 * @param {Object} ref
 * @returns {Object}
 * @method
 * @see http://stackoverflow.com/a/14378462
 * @see http://nullprogram.com/blog/2013/03/24/
 */
Resurrect.prototype.build = function(ref) {
    var type = ref[this.buildcode].split(/\./).reduce(function(object, name) {
        return object[name];
    }, Resurrect.GLOBAL);
    /* Brilliant hack by kybernetikos: */
    var args = [null].concat(ref[this.valuecode]);
    var factory = type.bind.apply(type, args);
    var result = new factory();
    if (Resurrect.isPrimitive(result)) {
        return result.valueOf(); // unwrap
    } else {
        return result;
    }
};

/**
 * Dereference or build an object or value from an encoding.
 * @param {Object} ref
 * @returns {(Object|undefined)}
 * @method
 */
Resurrect.prototype.decode = function(ref) {
    if (this.prefix in ref) {
        return this.deref(ref);
    } else if (this.buildcode in ref) {
        return this.build(ref);
    } else {
        throw new this.Error('Unknown encoding.');
    }
};

/**
 * @param {Object} object
 * @returns {boolean} True if the provided object is tagged for serialization.
 * @method
 */
Resurrect.prototype.isTagged = function(object) {
    return (this.refcode in object) && (object[this.refcode] != null);
};

/**
 * Visit root and all its ancestors, visiting atoms with f.
 * @param {*} root
 * @param {Function} f
 * @param {Function} replacer
 * @returns {*} A fresh copy of root to be serialized.
 * @method
 */
Resurrect.prototype.visit = function(root, f, replacer) {
    if (Resurrect.isAtom(root)) {
        return f(root);
    } else if (!this.isTagged(root)) {
        var copy = null;
        if (Resurrect.isArray(root)) {
            copy = [];
            root[this.refcode] = this.tag(copy);
            for (var i = 0; i < root.length; i++) {
                copy.push(this.visit(root[i], f, replacer));
            }
        } else { /* Object */
            copy = Object.create(Object.getPrototypeOf(root));
            root[this.refcode] = this.tag(copy);
            for (var key in root) {
                var value = root[key];
                if (root.hasOwnProperty(key)) {
                    if (replacer && value !== undefined) {
                        // Call replacer like JSON.stringify's replacer
                        value = replacer.call(root, key, root[key]);
                        if (value === undefined) {
                            continue; // Omit from result
                        }
                    }
                    copy[key] = this.visit(value, f, replacer);
                }
            }
        }
        copy[this.origcode] = root;
        return this.ref(copy);
    } else {
        return this.ref(root);
    }
};

/**
 * Manage special atom values, possibly returning an encoding.
 * @param {*} atom
 * @returns {*}
 * @method
 */
Resurrect.prototype.handleAtom = function(atom) {
    var Node = Resurrect.GLOBAL.Node || function() {};
    if (Resurrect.isFunction(atom)) {
        throw new this.Error("Can't serialize functions.");
    } else if (atom instanceof Node) {
        var xmls = new XMLSerializer();
        return this.builder('Resurrect.Node', [xmls.serializeToString(atom)]);
    } else if (Resurrect.isDate(atom)) {
        return this.builder('Date', [atom.toISOString()]);
    } else if (Resurrect.isRegExp(atom)) {
        var args = atom.toString().match(/\/(.+)\/([gimy]*)/).slice(1);
        return this.builder('RegExp', args);
    } else if (atom === undefined) {
        return this.ref(undefined);
    } else if (Resurrect.isNumber(atom) && (isNaN(atom) || !isFinite(atom))) {
        return this.builder('Number', [atom.toString()]);
    } else {
        return atom;
    }
};

/**
 * Hides intrusive keys from a user-supplied replacer.
 * @param {Function} replacer function of two arguments (key, value)
 * @returns {Function} A function that skips the replacer for intrusive keys.
 * @method
 */
Resurrect.prototype.replacerWrapper = function(replacer) {
    var skip = new RegExp('^' + Resurrect.escapeRegExp(this.prefix));
    return function(k, v) {
        if (skip.test(k)) {
            return v;
        } else {
            return replacer(k, v);
        }
    };
};

/**
 * Serialize an arbitrary JavaScript object, carefully preserving it.
 * @param {*} object
 * @param {(Function|Array)} replacer
 * @param {string} space
 * @method
 */
Resurrect.prototype.stringify = function(object, replacer, space) {
    if (Resurrect.isFunction(replacer)) {
        replacer = this.replacerWrapper(replacer);
    } else if (Resurrect.isArray(replacer)) {
        var acceptKeys = replacer;
        replacer = function(k, v) {
            return acceptKeys.indexOf(k) >= 0 ? v : undefined;
        };
    }
    if (Resurrect.isAtom(object)) {
        return JSON.stringify(this.handleAtom(object), replacer, space);
    } else {
        this.table = [];
        this.visit(object, this.handleAtom.bind(this), replacer);
        for (var i = 0; i < this.table.length; i++) {
            if (this.cleanup) {
                delete this.table[i][this.origcode][this.refcode];
            } else {
                this.table[i][this.origcode][this.refcode] = null;
            }
            delete this.table[i][this.refcode];
            delete this.table[i][this.origcode];
        }
        var table = this.table;
        this.table = null;
        return JSON.stringify(table, null, space);
    }
};

/**
 * Restore the __proto__ of the given object to the proper value.
 * @param {Object} object
 * @returns {Object} Its argument, or a copy, with the prototype restored.
 * @method
 */
Resurrect.prototype.fixPrototype = function(object) {
    if (this.prefix in object) {
        var name = object[this.prefix];
        var prototype = this.resolver.getPrototype(name);
        if ('__proto__' in object) {
            object.__proto__ = prototype;
            if (this.cleanup) {
                delete object[this.prefix];
            }
            return object;
        } else { // IE
            var copy = Object.create(prototype);
            for (var key in object) {
                if (object.hasOwnProperty(key) && key !== this.prefix) {
                    copy[key] = object[key];
                }
            }
            return copy;
        }
    } else {
        return object;
    }
};

/**
 * Deserialize an encoded object, restoring circularity and behavior.
 * @param {string} string
 * @returns {*} The decoded object or value.
 * @method
 */
Resurrect.prototype.resurrect = function(string) {
    var result = null;
    var data = JSON.parse(string);
    if (Resurrect.isArray(data)) {
        this.table = data;
        /* Restore __proto__. */
        if (this.revive) {
            for (var i = 0; i < this.table.length; i++) {
                this.table[i] = this.fixPrototype(this.table[i]);
            }
        }
        /* Re-establish object references and construct atoms. */
        for (i = 0; i < this.table.length; i++) {
            var object = this.table[i];
            for (var key in object) {
                if (object.hasOwnProperty(key)) {
                    if (!(Resurrect.isAtom(object[key]))) {
                        object[key] = this.decode(object[key]);
                    }
                }
            }
        }
        result = this.table[0];
    } else if (Resurrect.isObject(data)) {
        this.table = [];
        result = this.decode(data);
    } else {
        result = data;
    }
    this.table = null;
    return result;
};

module.exports = Resurrect;

},{}]},{},[4]);
