var data = require('self').data;
var { Request } = require("request");
var rpc_url = 'http://10.0.0.99:9091/transmission/rpc';
var pp = function(o) { return JSON.stringify(o,null,'  ')};
var sess_id = false;
var cm = require("context-menu");

require('simple-prefs').prefs.transmission_url;

// get the session cookie to use for subsequent requests...
Request({
    url: rpc_url,
    content: '{"method":"session-get"}',
    onComplete: function(response) {
        sess_id = response.headers['X-Transmission-Session-Id'];
    }
}).post();

function activateOrOpen(url) {
	for each (var tab in tabs) {
		if (tab.url.indexOf(url) !== -1) {
			tab.activate();
			return;
		}
	}
	tabs.open(url);
}

var item = cm.Item({
    label: "Download via Transmission",
    image: data.url('favicon.png'),
    context: [ cm.SelectorContext('a[href ^="magnet:"]'), 
    		   cm.SelectorContext('a[href $=".torrent"]') 
    ],
    contentScript: 'self.on("click", function (node, data) {' +
                 '  self.postMessage(node.href);' +
                 '});',

    onMessage: function(message) {
        let req = request_tpl;
        req.arguments.filename = message;
        
        if (sess_id !== false) {
	        Request({
	            url: rpc_url,
	            contentType: 'application/json',
	            content: JSON.stringify(req),
	            headers: {
	                'X-Transmission-Session-Id': sess_id,
	            },
	            onComplete: function(response) {
	                activateOrOpen()
	            }
	        }).post();
        }
    }
});
