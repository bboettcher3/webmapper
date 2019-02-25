class MapPainter {
    constructor(map, canvas, frame, database) 
    {
        this.map = map;
        this.canvas = canvas;
        this.frame = frame;
        this.database = database;
        this.pathspecs = [];
        this.paths = [];
        this.attributes = [];
        this._highlight = false;
    }

    // APPEARANCE //////////////////////////////////////////////////////////////
    // Subclasses should override these methods to change the appearance of maps

    // Updates the elements of the pathspecs array based on x,y coordinates of
    // the sources and destinations referred to by the map. This function should
    // only be called if the map is in a valid state according to the
    // _mapIsValid() function. See draw().

    updatePaths()
    {
        // draw a curved line from src to dst
        let src = this.map.src.position;
        let dst = this.map.dst.position;

        let mid = {x: (src.x + dst.x) * 0.5, y: (src.y + dst.y) * 0.5};
        let origin = {x: this.frame.width * 0.5, y: this.frame.height * 0.5};

        let midpointinflation = 0.2;
        mid.x = mid.x + (mid.x - origin.x) * midpointinflation;
        mid.y = mid.y + (mid.y - origin.y) * midpointinflation;

        this.pathspecs[0] = [['M', src.x, src.y],
                             ['S', mid.x, mid.y, dst.x, dst.y]];
    }

    // Updates the properties of the attributes object
    updateAttributes()
    {
        return this._defaultAttributes();
    }

    // INTERACTION /////////////////////////////////////////////////////////////
    // These methods should be called by the main view to set the callbacks for
    // events generated by elements owned by this map view

    hover(f_in, f_out) 
    {
        this.paths.forEach(function(path)
        {
            path.unhover();
            path.hover(f_in, f_out);
        });
    }
    //click(func) { _setCallbacks('click', func); }
    //drag(func) { _setCallbacks('hover', func); }
    //cross(func) { _setCallbacks('hover', func); }

    // OTHER ///////////////////////////////////////////////////////////////////

    // Use these methods to set the state of the view
    show() { this.map.hidden = false; this.draw(); }
    hide() { this.map.hidden = true; this.draw(); }
    highlight() { this._highlight = true; this.draw(); }
    unhighlight() { this._highlight = false; this.draw(); }

    // The draw function causes the map view to be updated based on the current
    // state of the map which it refers to. This method should not be overridden
    draw(duration) 
    {
        if (!this._mapIsValid()) return;
        else if (this.stolen) return;
        this.updateAttributes();
        this.updatePaths();
        this._setPaths(duration);
    }

    edge_intersection(x1, y1, x2, y2)
    {
        let ret = false;
        for (let i in this.paths)
        {
            if (this.paths[i] === null) continue;
            ret = ret || edge_intersection(this.paths[i], x1, y1, x2, y2);
        }
        return ret;
    }

    remove()
    {
        this.paths.forEach(function(path)
        {
            path.stop();
            path.unhover();
            path.undrag();
            path.remove();
            path = null;
       });
    }

    stop() {} unhover() {} undrag() {} animate() {this.remove()} // methods that might get called if the caller doesn't know about the new MapPainter class yet and thinks map.view is a Raphael element

    // Check if this.map has the necessary properties allowing it to be drawn
    // Subclasses could override this method to define custom invariants
    _mapIsValid()
    {
        if (   !this.map
            || !this.map.src || !this.map.src.position 
            || !this.map.dst || !this.map.dst.position)
        {
            console.log('error drawing map: map missing src or dst position', this.map);
            return false;
        }
        else return true;
    }

    // Get the default attributes for the appearance of a map. Subclasses can
    // call this method in getAttributes() and then change the defaults in case
    // they wish to use most of the defaults
    _defaultAttributes(count)
    {
        if (typeof count === 'undefined') count = 1;
        for (var i = 0; i < count; ++i)
        {
            // TODO: see if these properties can be moved to CSS
            this.attributes[i] = 
            { 'stroke': (this.map.selected ? MapPainter.selectedColor : MapPainter.defaultColor )
            , 'stroke-dasharray': (this.map.muted ? MapPainter.mutedDashes : MapPainter.defaultDashes)
            , 'stroke-opacity': (this.map.status == 'staged' ? MapPainter.stagedOpacity : MapPainter.defaultOpacity)
            , 'stroke-width': (this._highlight ? MapPainter.boldStrokeWidth : MapPainter.defaultStrokeWidth)
            , 'fill': 'none'
            , 'arrow-start': 'none'
            , 'arrow-end': 'block-wide-long'
            };
        }
    }

    // Set the path and other attributes for all the path elements owned by this
    _setPaths(duration)
    {
        let count = this.pathspecs.length;
        if (this.paths.length > count) count = this.paths.length;
        for (let i = 0; i < count; ++i)
        {
            // TODO: allow animation
            let pathspec = this.pathspecs[i];
            let path = this.paths[i];
            let attributes = this.attributes[i];

            if (typeof pathspec === 'undefined' || pathspec === null)
            {
                if (typeof path !== 'undefined') 
                {
                    path.remove();
                    delete this.paths[i];
                }
                continue;
            }

            if (typeof attributes === 'undefined') 
                attributes = this.attributes[0];

            if (typeof path === 'undefined' || path[0] == null) 
            {
                this.paths[i] = this.canvas.path(pathspec);
                path = this.paths[i];
                path.attr(attributes);
            }
            else 
            {
                path.stop();
                path.attr(attributes);
                if (!duration || duration < 0) path.attr({path: pathspec});
                else path.animate({'path': pathspec}, duration, '>');
                path.toFront();
            }
            if (this.map.hidden || this.map.src.hidden || this.map.dst.hidden) path.hide();
            else path.show();
        }
    }

    // copy the paths from another painter e.g. before replacing it
    copy(otherpainter)
    {
        this.paths = otherpainter.paths;
        this._highlight = otherpainter._highlight;
    }
}

// These static properties set the default attributes of MapPainters; edit them
// to change the way default maps look globally
MapPainter.selectedColor = 'red';
MapPainter.defaultColor = 'white';
MapPainter.mutedDashes = '-';
MapPainter.defaultDashes = '';
MapPainter.stagedOpacity = 0.5;
MapPainter.defaultOpacity = 1.0;
MapPainter.boldStrokeWidth = 8;
MapPainter.defaultStrokeWidth = 4;
