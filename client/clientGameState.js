var Graph = require('./shared/Graph.js');
var Gui = require('./shared/Gui.js');
module.exports = function () {
    this.timeDiffernce = null;
    this.serverTick = 0;

    var that = this

    this.timeDiffernceArray = [];
    this.updateServerTimeDiffernce = function(){
        if(this.timeDiffernceArray.length < 5){
            this.getServerTimeDiffernce().then((timeDiffernce) => {
                if(that.timeDiffernce == null){
                    that.timeDiffernce = timeDiffernce;
                }
                that.timeDiffernceArray.push(timeDiffernce);
                console.log(timeDiffernce);
                setTimeout(function(){
                    that.updateServerTimeDiffernce();
                }, 3000);
            });

        } else {
            //calculate standard deviation and mean, then set timeDiffernce 
        }
    } //end updateServerTimeDiffernce

    this.getServerTimeDiffernce = function(){
        var timeSent = new Date().getTime();
        //ping server and recieve server timestamp (time received from server's prespective)
        var serverTimePromise = SOCKET.pingServer();
        return serverTimePromise.then((serverTime) => {
            //take time when recieved on client, this is the round-trip time
            var timeRecieved = new Date().getTime();
            var roundTripTime = timeRecieved - timeSent;
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
            console.log("timeDiffernce:      ", timeDiffernce);
            return new Promise(function(resolve){
                resolve(timeDiffernce);
            });
        });
    }//end getServerTimeDiffernce
}
