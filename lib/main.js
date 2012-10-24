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

var tbb = require("toolbarbutton").ToolbarButton({
	id: "transmission-button",
	label: "Open Transmission",
	image: data.url('favicon.png'),
	onCommand: function () {
		activateOrOpen(web_url);
	}
});

console.log('loadReason: '+loadReason);

if (loadReason === "install") {
	tbb.moveTo({
	  toolbarID: "nav-bar",
	  forceMove: false // only move from palette
	});
}

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
	                activateOrOpen(web_url);
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

// define the context-menu item
var item = cm.Item({
    label: "Download via Transmission",
    image: data.url('favicon.png'),
    context: cm.SelectorContext('a[href ^="magnet:"]'),
    contentScript: 'self.on("click", function (node, data) {' +
                 '  self.postMessage(node.href);' +
                 '});',
	// get the signal back from the cm content script
    onMessage: handleClick
});
