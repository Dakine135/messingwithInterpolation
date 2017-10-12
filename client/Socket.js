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

    this.socket.on('serverGameState', function(serverGameState){
        GAMESTATE.handleServerPackage(serverGameState);
    });

}// end socket class
