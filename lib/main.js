var data = require('self').data;
// var tabs = require('tabs');
var { Request } = require("request");
// var rpc_url = 'http://10.0.0.99:9091/transmission/rpc';
var pp = function(o) { return JSON.stringify(o,null,'  ')};
var sess_id = false;
var cm = require("context-menu");

// get some prefs
var prefs = require('simple-prefs').prefs;
var rpc_url = prefs.transmission_url;
var paused = !prefs.transmission_autostart;

var request_tpl = {
  "method": "torrent-add",
  "arguments": {
    "paused": false,
    "filename": false
  }
}

// get the session cookie to use for subsequent requests...
Request({
    url: rpc_url,
    content: '{"method":"session-get"}',
    onComplete: function(response) {
        sess_id = response.headers['X-Transmission-Session-Id'];
    }
}).post();

function activateOrOpen(url) {
	let tabs = require('tabs');
	for each (var tab in tabs) {
		console.log(tab.url, url);
		if (tab.url.indexOf(url) !== -1) {
			console.log("matched");
			tab.activate();
			return;
		}
	}
	tabs.open(url);
}

var item = cm.Item({
    label: "Download via Transmission",
    image: data.url('favicon.png'),
    context: cm.SelectorContext('a[href ^="magnet:"]'),
    contentScript: 'self.on("click", function (node, data) {' +
                 '  self.postMessage(node.href);' +
                 '});',

    onMessage: function(message) {
        let req = request_tpl;
        req.arguments.filename = message;
        req.arguments.paused = paused;
        
        if (sess_id !== false) {
	        Request({
	            url: rpc_url,
	            contentType: 'application/json',
	            content: JSON.stringify(req),
	            headers: {
	                'X-Transmission-Session-Id': sess_id,
	            },
	            onComplete: function(response) {
	            	let url = rpc_url.split('/rpc').shift() + '/web/';
	            	console.log(url);
	                activateOrOpen(url);
	            }
	        }).post();
        }
        else {
        	console.log('fatal: session Id not set.');
        }
    }
});
