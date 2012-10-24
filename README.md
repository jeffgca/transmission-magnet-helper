# Transmission / Magnet download helper

This is a simple add-on that allows you to right-click on a megnet torrent link and add it to the configured Transmission rpc url.

Why would you use this? I have Transmission-daemon running on a D-Link DNS 323 box, and I despaired at the lameness of having to manually copy and paste urls. This add-on instead adds a context-menu item wen you right-click on magnet urls and uses the Transmission RPC interface to queue the new download.

Requirements:
* Firefox
* local or remote system running Transmission with the rpc interface enabled

Reference: 

[https://trac.transmissionbt.com/browser/trunk/extras/rpc-spec.txt](https://trac.transmissionbt.com/browser/trunk/extras/rpc-spec.txt)
