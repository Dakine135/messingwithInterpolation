var Cookies = require('cookies-js');
module.exports = function () {
    this.socket = io();
    this.client = {};

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
                        GUI.nameText.content = that.client.name;
                        that.updateClientData();
                    } else {
                        console.log("no val");
                    }
                }
            });
        } else {
            console.log("Name: ", this.client.name);
            GUI.nameText.content = this.client.name;
            this.updateClientData();
        }
    }

    this.updateClientData = function(){
        this.socket.emit('clientData',this.client);
    }
}
