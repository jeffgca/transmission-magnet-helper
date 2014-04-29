const { data, loadReason } = require('sdk/self');
const { notify } = require('sdk/notifications');
const { Request } = require('sdk/request');
const cm = require('sdk/context-menu');
const sp = require('sdk/simple-prefs');
const tabs = require('sdk/tabs');
const windows = require('sdk/windows').browserWindows;
const system = require('sdk/system');


var rpc_url = sp.prefs.transmissionUrl,
	paused = sp.prefs.transmissionAutostart,
	DEBUG = sp.prefs.transmissionDebug,
	iconURL = data.url('favicon.png');

var web_url = rpc_url.split('/rpc').shift() + '/web/';
var transmission_current_tab = false;
var transmission_current_win = false;
var sess_id = false;

var D = function(s) {
	if (DEBUG)
		console.log(s);
};

function hasAustralis() {
	let version = parseInt(system.platformVersion.split('.').shift());

	if (version >= 29) 
		return true;
	return false;
}

console.log(hasAustralis());

function errorNotify(message) {
	notify({
		title: 'Transmission Helper: Error!',
		text: message,
		iconURL: iconURL
	});
}

// handle prefs changes
sp.on("transmissionUrl", function() {
	rpc_url = sp.prefs.transmissionUrl;
	web_url = rpc_url.split('/rpc').shift() + '/web/';
	D('Url changed: '+rpc_url);
});

sp.on("transmissionAutostart", function() {
	paused = sp.prefs.transmissionAutostart;
	D('Autostart changed: '+paused);
});

sp.on("transmissionDebug", function() {
	DEBUG = sp.prefs.transmissionDebug;
	D('DEBUG changed: '+DEBUG);
});

// get the session cookie to use for subsequent requests...

function getSessionCookie(callback) {
	Request({
        url: rpc_url,
				content: '{"method":"session-get"}',
				onComplete: function(response) {
					D('Requesting session.')
					sess_id = response.headers['X-Transmission-Session-Id'];
					D("Session: "+sess_id);
					callback();
				}
	}).post();
}

getSessionCookie(function() {
	D('Initialized session cookie: '+sess_id);
});

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

var { setTimeout } = require('sdk/timers');

function activateOrOpen(uri) {
	D('In activateOrOpen');
	setTimeout(function() {
		tab_is_opening = false;
	}, 2000);

	if (tab_is_opening) {
		setTimeout(function() {
			activateOrOpen(uri);
		}, 150);
	}

	if (transmission_current_tab !== false) {
		transmission_current_tab.activate();
		transmission_current_win.activate();
	}
	else {
		tabs.open(uri);
		tab_is_opening = true;
		D('Starting to open Transmission');
	}
}

var req_counter = 0, req_limit = 5;

function makeRequest(data) {

	if (sess_id !== false) {
		// POST to the transmission RPC api
				Request({
				url: rpc_url,
				contentType: 'application/json',
				content: JSON.stringify(data),
				headers: {
					'X-Transmission-Session-Id': sess_id,
				},
				onComplete: function(response) {

					D(response.status, response.statusText);
					// D(response.text);

					if (response.status == '409') {
						D('session problem: '+response.status)
						// session conflict!
						if (req_counter < req_limit) {
							getSessionCookie(function() {
								req_counter++;
								makeRequest(data);
							});
						} else {
							// permanent fail.
							D('Total failure setting session cookie!');
							notify('Total failure setting session cookie!');
							sess_id = false;
						}
					}
					else if (response.status === 200) {
						notify({
							title: 'Transmission Helper',
							text: 'Torrent queued',
							onClick: function() {
								activateOrOpen(web_url);
							}
						});
						
					}
					else {
						D('Error: '+response.status +' '+response.statusText);
						errorNotify('Error: '+response.status +' '+response.statusText);
					}
				}
		}).post();
	}
	else {
		errorNotify('Error: cannot set transmission session. Is transmission running at '+rpc_url+'?');
	}

}

function handleClick(message) {
	let data = {
		"method": "torrent-add",
		"arguments": {
			"paused": !paused,
			"filename": message
		}
	};
	makeRequest(data);
}

// XXX REMOVE after Firefox 29 ships
if (!hasAustralis()) {
	// create the navigation toolbar button
	var tbb = require("./toolbarbutton").ToolbarButton({
		id: "transmission-button",
		label: "Open Transmission",
		image: iconURL,
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
}
else {
	let { ActionButton } = require("sdk/ui/button/action");
	let action_button = ActionButton({
	  id: "transmission-button",
	  label: "Transmission Web UI",
	  icon: {
	    "16": "./icon16.png",
	    "32": "./icon32.png",
	    "64": "./icon64.png"
	  },
	  onClick: function(state) {
	    activateOrOpen(web_url);
	  }
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

const { Hotkey } = require("sdk/hotkeys");
 
var showHotKey = Hotkey({
	combo: "alt-meta-t",
	onPress: function() {
		activateOrOpen(web_url);
	}
});
