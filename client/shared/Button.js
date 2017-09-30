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
        strokeWidth: 2
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
            this.callBack();
            return true;
        }
        return false;
    }
}//end Button Class
