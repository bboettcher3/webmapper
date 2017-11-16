//++++++++++++++++++++++++++++++++++++++//
//         ViewManager Class            //
//++++++++++++++++++++++++++++++++++++++//

function ViewManager(container, model)
{
    let frame = null;
    let canvas = null;
    let tables = { 'left': null, 'right': null, 'top': null };

    let duration = 1000;

    var canvas_zoom = 1;
    var canvas_pan = [0, 0];

    var srcregexp = null;
    var dstregexp = null;

    let view = null;

    this.draw = function() {
        //
    };

    this.parse_file = function(file) {
        if (view && view.type() == 'link')
            view.parse_file(file);
    }

    this.switch_view = function(viewType) {
        if (view) {
            if (view.type() == viewType) {
                // already on correct view
                return;
            }
            // call cleanup for previous view
            view.cleanup();
        }

        switch (viewType) {
            case 'balloon':
                view = new BalloonView(frame, canvas, model);
                break;
            case 'canvas':
                view = new CanvasView(frame, tables, canvas, model);
                break;
            case 'graph':
                view = new GraphView(frame, canvas, model);
                break;
            case 'grid':
                view = new GridView(frame, tables, canvas, model);
                break;
            case 'hive':
                view = new HiveView(frame, canvas, model);
                break;
            case 'link':
                view = new LinkView(frame, tables, canvas, model);
                break;
            case 'list':
            default:
                view = new ListView(frame, tables, canvas, model);
                break;
        }

        view.update();
    }

    resize_elements = function(duration) {
        if (view)
            view.resize(frame);

        canvas_zoom = 1;
        canvas_pan = [0, 0];
        canvas.setViewBox(0, 0, frame.width * canvas_zoom,
                          frame.height * canvas_zoom, false);
        $('#status').text('');
    }

    add_model_callbacks = function() {
        model.clear_callbacks();
        model.add_callback(function(event, type, obj) {
            if (event == 'removing') {
                remove_object_svg(obj);
                return;
            }
            switch (type) {
                case 'device':
                    update_devices(obj, event);
                    break;
                case 'signal':
                    update_signals(obj, event, true);
                    break;
                case 'map':
                    update_maps(obj, event);
                    break;
            }
        });
    };

    function add_display_tables() {
        tables.left  = new mapperTable(model, 'leftTable', 'left', true);
        tables.right = new mapperTable(model, 'rightTable', 'right', true);
        tables.top   = new mapperTable(model, 'topTable', 'top', false);

        // Put the tables in the DOM
        tables.left.create_within($('#container')[0]);
        tables.right.create_within($('#container')[0]);
        tables.top.create_within($('#container')[0]);
    }

    function add_canvas() {
        $('#container').append(
            "<div id='svgDiv' class='links'>"+
            "</div>");
        canvas = Raphael($('#svgDiv')[0], '100%', '100%');
    };

    this.init = function() {
        // remove all previous DOM elements
        $(container).empty();

        frame = fullOffset($(container)[0]);

        add_canvas();
        add_display_tables();

        this.switch_view('list');

        selection_handlers();

        add_model_callbacks();
        model.devices.each(function(dev) { update_devices(dev, 'added'); });
        model.maps.each(function(map) { update_maps(map, 'added'); });
    }

    function update_devices(dev, event) {
        if (event == 'added' && !dev.view) {
            dev.color = Raphael.getColor();
            dev.signals.each(function(sig) {
                update_signals(sig, 'added', false);
            });
            view.update('devices');
        }
        else if (event == 'removed')
            view.update('devices');
    }

    function update_signals(sig, event, repaint) {
        if (event == 'added' && !sig.view) {
            sig.position = position(null, null, frame);
            if (repaint)
                view.update('signals');
        }
        else if (event == 'modified' || event == 'removed')
            view.update('signals');
    }

    function update_links(link, event) {
        if (viewType != "link")
            return;
        view.update('links');
    }

    function update_maps(map, event) {
        switch (event) {
            case 'added':
                if (!map.view)
                    view.update('maps');
                break;
            case 'modified':
                if (map.view) {
                    if (map.view.selected)
                        $('#container').trigger("updateMapPropertiesFor", map.key);
                    view.update('maps');
                }
                break;
            case 'removed':
                view.update('maps');
                break;
        }
    }

    $('body').on('keydown.list', function(e) {
        switch (e.which) {
            case 8:
            case 46:
                // Prevent the browser from going back a page
                // but NOT if you're focus is an input and deleting text
                if (!$(':focus').is('input')) {
                    e.preventDefault();
                }
                /* delete */
                model.maps.each(function(map) {
                    if (map.view && map.view.selected)
                        $('#container').trigger('unmap', [map.src.key, map.dst.key]);
                });
                break;
            case 65:
                if (e.metaKey == true) { // Select all 'cmd+a'
                    e.preventDefault();
                    select_all_maps();
                }
                break;
            case 65:
                if (e.metaKey == true) {
                    e.preventDefault();
                    console.log('should add tab');
                }
                break;
            case 27:
                escaped = true;
                break;
        }
    });

    this.zoom = function(x, y, delta) {
        view.zoom(x, y, delta);
    }

    this.pan = function(x, y, delta_x, delta_y) {
        view.pan(x, y, delta_x, delta_y);
    }

    this.filter_signals = function(searchbar, text) {
        // need to cache regexp here so filtering works across view transitions
        if (searchbar == 'srcSearch') {
            srcregexp = text ? new RegExp(text, 'i') : null;
            view.filter_signals('src', text.length ? text : null);
        }
        else {
            dstregexp = text ? new RegExp(text, 'i') : null;
            view.filter_signals('dst', text.length ? text : null);
        }
    }

    function selection_handlers() {
        $('svg').on('mousedown', function(e) {
            if (e.shiftKey == false) {
                deselect_all_maps(tables);
            }
            escaped = false;

            // cache current mouse position
            let svgPos = fullOffset($('#svgDiv')[0]);
            let x1 = e.pageX - svgPos.left;
            let y1 = e.pageY - svgPos.top;

            // check for edge intersections around point for 'click' selection
            let updated = false;
            model.maps.each(function(map) {
                if (!map.view || map.view.selected)
                    return;
                if (   edge_intersection(map.view, x1-3, y1-3, x1+3, y1+3)
                    || edge_intersection(map.view, x1-3, y1+3, x1+3, y1-3)) {
                    updated = select_obj(map);
                }
            });
            if (updated)
                $('#container').trigger("updateMapProperties");

            let stop = false;
            // Moving about the canvas
            $('svg').on('mousemove.drawing', function(moveEvent) {
                if (stop == true || escaped == true)
                    return;

                let x2 = moveEvent.pageX - svgPos.left;
                let y2 = moveEvent.pageY - svgPos.top;

                if ((Math.abs(x1 - x2) + Math.abs(y1 - y2)) < 5)
                    return;

                // check for edge intersections for 'cross' selection
                update = false;
                model.maps.each(function(map) {
                    if (!map.view || map.view.selected)
                        return;
                    if (edge_intersection(map.view, x1, y1, x2, y2)) {
                        updated |= select_obj(map);
                    }
                });

                e.stopPropagation();

                if (updated)
                    $('#container').trigger("updateMapProperties");

                x1 = x2;
                y1 = y2;
            });
            $('svg').one('mouseup.drawing', function(mouseUpEvent) {
                stop = true;
            });
        });
    }

    this.on_resize = function() {
        frame = fullOffset($(container)[0]);
        resize_elements(0);
    }
}