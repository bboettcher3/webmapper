//++++++++++++++++++++++++++++++++++++++//
//          Graph View Class            //
//++++++++++++++++++++++++++++++++++++++//

'use strict';

class GraphView extends View {
    constructor(frame, tables, canvas, model) {
        super('graph', frame, null, canvas, model);

        // hide tables
        tables.left.adjust(0, 0, 0, frame.height, 0, 1000);
        tables.right.adjust(frame.width, 0, 0, frame.height, 0, 1000);

        // remove associated svg elements for devices
        this.model.devices.each(remove_object_svg);

        this.pan = this.canvasPan;
        this.zoom = this.canvasZoom;

        this.resize();
    }

    update() {
        let elements;
        let self = this;
        switch (arguments.length) {
            case 0:
                elements = ['devices', 'signals', 'maps'];
                break;
            case 1:
                elements = [arguments[0]];
                break;
            default:
                elements = arguments;
                break;
        }
        if (elements.indexOf('signals') >= 0) {
            this.updateSignals(function(sig) {
                if (!sig.position)
                    sig.position = position(null, null, self.frame);
            });
        }
        if (elements.indexOf('maps') >= 0)
            this.updateMaps();
        this.draw(1000);
    }

    mapPath(map) {
        if (!map.view)
            return;

        let src = map.src.position;
        let dst = map.dst.position;
        if (!src || !dst) {
            console.log('missing signal positions for drawing map', map);
            return null;
        }

        let path;

        // calculate midpoint
        let mpx = (src.x + dst.x) * 0.5;
        let mpy = (src.y + dst.y) * 0.5;

        // inflate midpoint around origin to create a curve
        mpx += (mpx - this.origin[0]) * 0.2;
        mpy += (mpy - this.origin[1]) * 0.2;
        path = [['M', src.x, src.y],
                ['S', mpx, mpy, dst.x, dst.y]];

        // shorten path so it doesn't draw over signals
        let len = Raphael.getTotalLength(path);
        return Raphael.getSubpath(path, 10, len - 10);
    }

    draw(duration) {
        this.drawSignals(duration);
        this.drawMaps(duration);
    }
}