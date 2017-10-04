var Graph = require('./shared/Graph.js');
var Gui = require('./shared/Gui.js');
module.exports = function () {
    this.time = 0;
    this.serverTick = 0;

    this.getServerTime = function(){
        var timeSent = new date().getTime();
        //ping server and recieve server timestamp (time received from server's prespective)
        //take time when recieved on client, this is the round-trip time
        //half this for the one-way time
        //subtract travel time from servers timestamp
        //now you can calculate differnce in server and client time
    }
}
