const data = require('self').data;
const { notify } = require("./simple-notify");
const { Request } = require("request");
const cm = require("context-menu");
const prefs = require('simple-prefs').prefs;
const rpc_url = prefs.transmission_url;
const paused = !prefs.transmission_autostart;

var sess_id = false;

// handle prefs changes
require("simple-prefs").on("transmission_url", function() {
	rpc_url = prefs.transmission_url;
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
        console.log(sess_id);
    }
}).post();

function activateOrOpen() {
	let url = rpc_url.split('/rpc').shift() + '/web/';
	let tabs = require('tabs');
	for each (var tab in tabs) {
		if (tab.url.indexOf(url) !== -1) {
			console.log("matched");
			tab.activate();
			return;
		}
	}
	tabs.open(url);
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
    onMessage: function(message) {
        let req = {
			"method": "torrent-add",
			"arguments": {
			    "paused": paused,
			    "filename": message
		    }
		}
        
        if (sess_id !== false) {
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
    	                activateOrOpen();
	                } catch (e) {
	                   console.log(e);
	                }
	            }
	        }).post();
        }
        else {
        	// console.log('fatal: session Id not set.');
        	growlNotify('Error: cannot set transmission session. Is transmission running at '+rpc_url);
        }
    }
});

// info: transmission-web-helper: OK,200,{"arguments":{},"result":"gotMetadataFromURL: http error 409: Conflict"}

require('widget').Widget({
	id: "transmission-web-widget",
	label: "Open Transmission",
	contentURL: data.url('favicon.png'),
	onClick: function() {
		activateOrOpen();
	}
});
