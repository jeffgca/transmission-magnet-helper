const { data, loadReason } = require('self');
const { notify } = require("simple-notify");
const { Request } = require("request");
const cm = require("context-menu");
const prefs = require('simple-prefs').prefs;
const rpc_url = prefs.transmission_url;
const paused = !prefs.transmission_autostart;
const tabs = require('tabs');
const windows = require('windows').browserWindows;

var web_url = rpc_url.split('/rpc').shift() + '/web/';
var transmission_current_tab = null;
var sess_id = false;

// handle prefs changes
require("simple-prefs").on("transmission_url", function() {
	rpc_url = prefs.transmission_url;
	web_url = rpc_url.split('/rpc').shift() + '/web/';
});

require("simple-prefs").on("transmission_autostart", function() {
	paused = !prefs.transmission_autostart;
});

// get the session cookie to use for subsequent requests...
Request({
    url: rpc_url,
    content: '{"method":"session-get"}',
    onComplete: function(response) {
        sess_id = response.headers['X-Transmission-Session-Id'];
    }
}).post();


/**  
 * strawman alt implementation:
 * 1. keep references to active win and tab once transmission has been opened once
 * 2. keep a flag
 * 3. catch the open event for tab and capture that tab and window
 */

var tab_is_opening = false;
var timeout = 2000;

tabs.on('ready', function(tab) {
	if (tab.url.indexOf(web_url) !== -1) {
		tab_is_opening = false;
		transmission_current_tab = tab;
	}
	return;
});

var { setTimeout } = require('timers');

function activateOrOpen2(uri) {

	setTimeout(function() {
		tab_is_opening = false;		
	}, 2000);

	if (tab_is_opening) {
		setTimeout(function() {
			activateOrOpen2(uri);
		}, 150);
	}
	
	if (transmission_current_tab) {
		transmission_current_tab.activate();
	}
	else {
		tabs.open(uri);
		tab_is_opening = true;
	}
 	
}

function activateOrOpen(uri) {
	console.log('uri: '+uri);
	for each (let win in windows) {
		for each (let tab in win.tabs) {
			if (tab.url.indexOf(uri) !== -1) {
				if (windows.activeWindow !== win) {
					win.activate();
				}
				tab.activate();
				return;
			}
		}
	}
	tabs.open(uri);
}

function handleClick(message) {
	let req = {
		"method": "torrent-add",
		"arguments": {
		    "paused": paused,
		    "filename": message
	    }
	}

	if (sess_id !== false) {
		// POST to the transmission RPC api
	    Request({
	        url: rpc_url,
	        contentType: 'application/json',
	        content: JSON.stringify(req),
	        headers: {
	            'X-Transmission-Session-Id': sess_id,
	        },
	        onComplete: function(response) {
	            try {
	                notify('Torrent queued!');
	                activateOrOpen2(web_url);
	            } catch (e) {
	               console.log('Error: '+e);
	            }
	        }
	    }).post();
	}
	else {
		notify('Error: cannot set transmission session. Is transmission running at '+rpc_url+'?');
	}
}

// create the navigation toolbar button
var tbb = require("toolbarbutton").ToolbarButton({
	id: "transmission-button",
	label: "Open Transmission",
	image: data.url('favicon.png'),
	onCommand: function () {
		activateOrOpen2(web_url);
	}
});

if (loadReason === "install") {
	tbb.moveTo({
	  toolbarID: "nav-bar",
	  forceMove: false // only move from palette
	});
}

// create the context-menu items
var item = cm.Item({
    label: "Download via Transmission",
    image: data.url('favicon.png'),
    context: [
    	cm.SelectorContext('a[href $=".torrent"]')
    ],
    contentScript: 'self.on("click", function (node, data) {' +
                 '  self.postMessage(node.href);' +
                 '});',
	// get the signal back from the cm content script
    onMessage: handleClick
});

var item = cm.Item({
    label: "Download via Transmission",
    image: data.url('favicon.png'),
    context: [
    	cm.SelectorContext('a[href ^="magnet:"]')
    ],
    contentScript: 'self.on("click", function (node, data) {' +
                 '  self.postMessage(node.href);' +
                 '});',
	// get the signal back from the cm content script
    onMessage: handleClick
});


