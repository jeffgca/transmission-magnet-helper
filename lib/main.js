var data = require('self').data;
var { Request } = require("request");
var rpc_url = 'http://10.0.0.99:9091/transmission/rpc';
var pp = function(o) { return JSON.stringify(o,null,'  ')};
var sess_id = false;

// fetch the session Id
Request({
    url: rpc_url,
    content: '{"method":"session-get"}',
    onComplete: function(response) {
        sess_id = response.headers['X-Transmission-Session-Id'];
    }
}).post();

var cm = require("context-menu");
var item = cm.Item({
    label: "Download via Transmission",
    context: [
                cm.SelectorContext('a[href ^="magnet:"]')
                //cm.SelectorContext('a[href $=".torrent"]')
             ],
    contentScript: 'self.on("click", function (node, data) {' +
                 '  self.postMessage(node.href);' +
                 '});',
    onMessage: function(message) {
        console.log(pp(message));
        // request body:
        let req = request_tpl;
        req.arguments.filename = message;
        
        console.log(pp(req));
        
        Request({
            url: rpc_url,
            contentType: 'application/json',
            content: JSON.stringify(req),
            headers: {
                'X-Transmission-Session-Id': sess_id,
            },
            onComplete: function(response) {
                console.log('done?');
                console.log(response.text);
            }
        }).post();
    }
});
