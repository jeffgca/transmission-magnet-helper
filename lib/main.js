const { data, loadReason } = require('self');
const { notify } = require("simple-notify");
const { Request } = require("request");
const cm = require("context-menu");
const sp = require('simple-prefs');
const tabs = require('tabs');
const windows = require('windows').browserWindows;

var rpc_url = sp.prefs.transmissionUrl,
	paused = !sp.prefs.transmissionAutostart,
	DEBUG = sp.prefs.transmissionDebug;

var web_url = rpc_url.split('/rpc').shift() + '/web/';
var transmission_current_tab = false;
var transmission_current_win = false;
var sess_id = false;


var D = function(s) {
	if (DEBUG)
		console.log(s);
}

// handle prefs changes
sp.on("transmissionUrl", function() {
	rpc_url = sp.prefs.transmissionUrl;
	web_url = rpc_url.split('/rpc').shift() + '/web/';
	D('Url changed: '+rpc_url);
});

sp.on("transmissionAutostart", function() {
	paused = !sp.prefs.transmissionAutostart;
	D('Autostart changed: '+rpc_url);
});

sp.on("transmissionAutostart", function() {
	DEBUG = !sp.prefs.transmissionDebug;
	D('Autostart changed: '+rpc_url);
});

// get the session cookie to use for subsequent requests...
Request({
    url: rpc_url,
    content: '{"method":"session-get"}',
    onComplete: function(response) {
    	D('Requesting session.')
        sess_id = response.headers['X-Transmission-Session-Id'];
        D("Session: "+sess_id);
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
		transmission_current_win = windows.activeWindow;
		D('Opened Transmission Web UI');
	}
	return;
});

tabs.on('close', function(tab) {
	if (tab.url.indexOf(web_url) !== -1) {
		transmission_current_tab = false;
		transmission_current_win = false;
		D('Closed Transmission Web UI');
	}
});

var { setTimeout } = require('timers');

function activateOrOpen(uri) {
	D('In activateOrOpen')
	setTimeout(function() {
		tab_is_opening = false;		
	}, 2000);

	if (tab_is_opening) {
		setTimeout(function() {
			activateOrOpen(uri);
		}, 150);
	}

	if (transmission_current_tab) {
		transmission_current_tab.activate();
		transmission_current_win.activate();
	}
	else {
		tabs.open(uri);
		tab_is_opening = true;
		D('Starting to open Transmission');
	}
}

function handleClick(message) {
	D('Handling right-click: '+message)
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

	        	D(response.status, response.statusText);
	        	D(response.text);

	        	D('Torrent queued');

	        	if (response.status === '200') {
	                notify('Torrent queued!');
	                activateOrOpen(web_url);	        		
	        	}
	        	else {
	        		notify
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
		activateOrOpen(web_url);
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
