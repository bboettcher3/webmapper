#!/usr/bin/env python

import webmapper_http_server as server
import mapper
import mapperstorage
import netifaces # a library to find available network interfaces
import sys, os, os.path, threading, json, re, pdb
from random import randint

networkInterfaces = {'active': '', 'available': []}

dirname = os.path.dirname(__file__)
if dirname:
   os.chdir(os.path.dirname(__file__))

if 'tracing' in sys.argv[1:]:
    server.tracing = True

def open_gui(port):
    url = 'http://localhost:%d'%port
    apps = ['~\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe --app=%s',
            '/usr/bin/chromium-browser --app=%s',
            ]
    if 'darwin' in sys.platform:
        # Dangerous to run 'open' on platforms other than OS X, so
        # check for OS explicitly in this case.
        apps = ['open -n -a "Google Chrome" --args --app=%s']
    def launch():
        try:
            import webbrowser, time
            time.sleep(0.2)
            for a in apps:
                a = os.path.expanduser(a)
                a = a.replace('\\','\\\\')
                if webbrowser.get(a).open(url):
                    return
            webbrowser.open(url)
        except:
            print 'Error opening web browser, continuing anyway.'
    launcher = threading.Thread(target=launch)
    launcher.start()

db = mapper.database(subscribe_flags=mapper.OBJ_DEVICES | mapper.OBJ_LINKS)

def dev_props(dev):
    props = dev.properties.copy()
    if 'synced' in props:
        props['synced'] = props['synced'].get_double()
    return props

def link_props(link):
    return {'src' : link.device(0).name, 'dst' : link.device(1).name}

def sig_props(sig):
    props = sig.properties.copy()
#    props['device_id'] = sig.device().id
    props['device'] = sig.device().name
    return props

def full_signame(sig):
    return sig.device().name + '/' + sig.name

def map_props(map):
    props = map.properties.copy()
    props['src'] = full_signame(map.source().signal())
    props['dst'] = full_signame(map.destination().signal())
    # translate some other properties
    if props['mode'] == mapper.MODE_LINEAR:
        props['mode'] = 'linear'
    elif props['mode'] == mapper.MODE_EXPRESSION:
        props['mode'] = 'expression'
    slotprops = map.source().properties
    if slotprops.has_key('min'):
        props['src_min'] = slotprops['min']
    if slotprops.has_key('max'):
        props['src_max'] = slotprops['max']
    slotprops = map.destination().properties
    if slotprops.has_key('min'):
        props['dst_min'] = slotprops['min']
    if slotprops.has_key('max'):
        props['dst_max'] = slotprops['max']
    return props

def on_device(dev, action):
    if action == mapper.ADDED:
        server.send_command("new_device", dev_props(dev))
    elif action == mapper.MODIFIED:
        server.send_command("mod_device", dev_props(dev))
    elif action == mapper.REMOVED:
        server.send_command("del_device", dev_props(dev))

def on_link(link, action):
    if action == mapper.ADDED:
        server.send_command("new_link", link_props(link))
    elif action == mapper.MODIFIED:
        server.send_command("mod_link", link_props(link))
    elif action == mapper.REMOVED:
        server.send_command("del_link", link_props(link))

def on_signal(sig, action):
    if action == mapper.ADDED:
        server.send_command("new_signal", sig_props(sig))
    elif action == mapper.MODIFIED:
        server.send_command("mod_signal", sig_props(sig))
    elif action == mapper.REMOVED:
        server.send_command("del_signal", sig_props(sig))

def on_map(map, action):
    if action == mapper.ADDED:
        server.send_command("new_connection", map_props(map))
    elif action == mapper.MODIFIED:
        server.send_command("mod_connection", map_props(map))
    elif action == mapper.REMOVED:
        server.send_command("del_connection", map_props(map))

def set_map_properties(props):
    # todo: check for convergent maps, only release selected
    maps = find_sig(props['src']).maps().intersect(find_sig(props['dst']).maps())
    map = maps.next()
    if not map:
        print "error: couldn't retrieve map ", props['src'], " -> ", props['dst']
        return
    if props.has_key('mode'):
        if props['mode'] == 'linear':
            map.mode = mapper.MODE_LINEAR
        elif props['mode'] == 'expression':
            map.mode = mapper.MODE_EXPRESSION
        else:
            print 'error: unknown mode ', props['mode']
    if props.has_key('expression'):
        map.expression = props['expression']
    if props.has_key('src_min'):
        if type(props['src_min']) is int or type(props['src_min']) is float:
            map.source().minimum = float(props['src_min'])
        else:
            if type(props['src_min']) is str:
                props['src_min'] = props['src_min'].replace(',',' ').split()
            numargs = len(props['src_max'])
            for i in range(numargs):
                props['src_min'][i] = float(props['src_min'][i])
            if numargs == 1:
                props['src_min'] = props['src_min'][0]
            map.source().minimum = props['src_min']
    if props.has_key('src_max'):
        if type(props['src_max']) is int or type(props['src_max']) is float:
            map.source().maximum = float(props['src_max'])
        else:
            if type(props['src_max']) is str:
                props['src_max'] = props['src_max'].replace(',',' ').split()
            numargs = len(props['src_max'])
            for i in range(numargs):
                props['src_max'][i] = float(props['src_max'][i])
            if numargs == 1:
                props['src_max'] = props['src_max'][0]
            map.source().maximum = props['src_max']
    if props.has_key('dst_min'):
        if type(props['dst_min']) is int or type(props['dst_min']) is float:
            map.destination().minimum = float(props['dst_min'])
        else:
            if type(props['dst_min']) is str:
                props['dst_min'] = props['dst_min'].replace(',',' ').split()
            numargs = len(props['dst_min'])
            for i in range(numargs):
                props['dst_min'][i] = float(props['dst_min'][i])
            if numargs == 1:
                props['dst_min'] = props['dst_min'][0]
            map.destination().minimum = props['dst_min']
    if props.has_key('dst_max'):
        if type(props['dst_max']) is int or type(props['dst_max']) is float:
            map.destination().maximum = float(props['dst_max'])
        else:
            if type(props['dst_max']) is str:
                props['dst_max'] = props['dst_max'].replace(',',' ').split()
            numargs = len(props['dst_max'])
            for i in range(numargs):
                props['dst_max'][i] = float(props['dst_max'][i])
            if numargs == 1:
                props['dst_max'] = props['dst_max'][0]
            map.destination().maximum = props['dst_max']
    if props.has_key('calibrating'):
        map.destination().calibrating = props['calibrating']
    if props.has_key('muted'):
        map.muted = props['muted']
    map.push()

def on_refresh(arg):
    global db
    del db
    net = mapper.network(networkInterfaces['active'])
    db = mapper.database(net, subscribe_flags=mapper.OBJ_DEVICES | mapper.OBJ_LINKS)
    init_database()

def on_save(arg):
    d = db.device(arg['dev'])
    fn = d.name+'.json'
    return fn, mapperstorage.serialise(db, arg['dev'])

def on_load(arg):
    # pdb.set_trace()
    mapperstorage.deserialise(db, arg['sources'], arg['destinations'], arg['loading'])

def select_network(newNetwork):
    networkInterfaces['active'] = newNetwork
    server.send_command('set_network', newNetwork)

def get_networks(arg):
    location = netifaces.AF_INET    # A computer specific integer for internet addresses
    totalInterfaces = netifaces.interfaces() # A list of all possible interfaces
    connectedInterfaces = []
    for i in totalInterfaces:
        addrs = netifaces.ifaddresses(i)
        if location in addrs:       # Test to see if the interface is actually connected
            connectedInterfaces.append(i)
    server.send_command("available_networks", connectedInterfaces)
    networkInterfaces['available'] = connectedInterfaces
    server.send_command("active_network", networkInterfaces['active'])

def get_active_network(arg):
    print networkInterfaces['active']
    server.send_command("active_network", networkInterfaces['active'])


def init_database():
    db.add_device_callback(on_device)
    db.add_link_callback(on_link)
    db.add_signal_callback(on_signal)
    db.add_map_callback(on_map)

init_database()

server.add_command_handler("all_devices",
                           lambda x: ("all_devices", map(dev_props, db.devices())))

def subscribe(device):
    # cancel current subscriptions
    db.unsubscribe()

    if device == "All Devices":
        db.subscribe(mapper.OBJ_DEVICES | mapper.OBJ_LINKS)
    else:
        # todo: only subscribe to inputs and outputs as needed
        dev = db.device(device)
        if dev:
            db.subscribe(dev, mapper.OBJ_OUTPUT_SIGNALS | mapper.OBJ_OUTGOING_MAPS)

def find_sig(fullname):
    names = fullname.split('/', 1)
    dev = db.device(names[0])
    if not dev:
        return null
    return dev.signal(names[1])

def new_map(args):
    map = mapper.map(find_sig(args[0]), find_sig(args[1]))
    if len(args) > 2 and type(args[2]) is dict:
        map.set_properties(args[2])
    map.push()

def release_map(args):
    # todo: check for convergent maps, only release selected
    find_sig(args[0]).maps().intersect(find_sig(args[1]).maps()).release()

server.add_command_handler("subscribe", lambda x: subscribe(x))

server.add_command_handler("all_signals",
                           lambda x: ("all_signals", map(sig_props, db.signals())))

server.add_command_handler("all_links",
                           lambda x: ("all_links", map(link_props, db.links())))

server.add_command_handler("all_connections",
                           lambda x: ("all_connections", map(map_props, db.maps())))

server.add_command_handler("set_connection", lambda x: set_map_properties(x))

server.add_command_handler("map", lambda x: new_map(x))

server.add_command_handler("unmap", lambda x: release_map(x))

server.add_command_handler("refresh", on_refresh)

server.add_command_handler("save", on_save)
server.add_command_handler("load", on_load)

server.add_command_handler("select_network", select_network)
server.add_command_handler("get_networks", get_networks)

get_networks(False)
if ( 'en1' in networkInterfaces['available'] ) :
    networkInterfaces['active'] = 'en1'
elif ( 'en0' in networkInterfaces['available'] ):
    networkInterfaces['active'] = 'en0'
elif ( 'lo0' in networkInterfaces['available'] ):
    networkInterfaces['active'] = 'lo0'

try:
    port = int(sys.argv[sys.argv.index('--port'):][1])
except:
    #port = randint(49152,65535)
    port = 50000

on_open = lambda: ()
if not '--no-browser' in sys.argv and not '-n' in sys.argv:
    on_open = lambda: open_gui(port)



server.serve(port=port, poll=lambda: db.poll(100), on_open=on_open,
             quit_on_disconnect=not '--stay-alive' in sys.argv)

