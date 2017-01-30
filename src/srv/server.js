var fs = require("fs");

var cfg = {
	ssl: false,
	port: 1337,
	ssl_key: "...",
	ssl_cert: "..."
}

function processRequest(request, response) {
	response.writeHead(200);
	response.end("All glory to WebSockets!\n");
}

console.log((new Date()) + ": Initialising server on port: " + cfg.port);

var httpServ = (cfg.ssl) ? require("https") : require("http");
var WebSocketServer = require("websocket").server;

if(cfg.ssl) {
	server = httpServ.createServer({
		key: fs.readFileSync(cfg.ssl_key),
		cert: fs.readFileSync(cfg.ssl_cert)
	}, processRequest).listen(cfg.port);
} else {
	server = httpServ.createServer(processRequest).listen(cfg.port);
}

var clients = [];
var paths = [];
var latest = 0;

resetCanvas();

wsServer = new WebSocketServer({httpServer: server});
wsServer.on("request", function(request) {
	
	var connection = request.accept(null, request.origin);
	var id = clients.push(connection) - 1;
	
	console.log((new Date()) + ": User connected (" + request.remoteAddress + ")");
	
	if(paths.length > 0) {
		for(var i = 0; i < paths.length; i++) {
			connection.sendUTF(JSON.stringify({
				type: "path",
				path: paths[i]
			}));
		}
	}
	
	connection.on("message", function(message) {
		if(message.type === "utf8") {
			try {
				var json = JSON.parse(message.utf8Data, false);
				if(json.type === "path") {
					if(json.path === undefined || json.path.points === undefined || json.path.points.length == 0) {
						return;
					}
					if(json.path.colour === undefined || json.path.radius === undefined) {
						return;
					}
					var points = [];
					for(var i = 0; i < json.path.points.length; i++) {
						var point = json.path.points[i];
						if(point.x == undefined || point.y == undefined) {
							continue;
						}
						points.push({
							x: point.x,
							y: point.y
						});
					}
					if(points.length == 0) {
						return;
					}
					var path = {
						id: latest++,
						client: id,
						colour: json.path.colour,
						radius: json.path.radius,
						points: points
					};
					paths.push(path);
					for(var i = 0; i < clients.length; i++) {
						var client = clients[i];
						client.sendUTF(JSON.stringify({
							type: "path",
							path: path
						}));
					}
				} else if(json.type === "point") {
					if(json.point == undefined) {
						return;
					}
					var path = undefined;
					for(var i = paths.length - 1; i >= 0; i--) {
						var path2 = paths[i];
						if(path2.client == id) {
							path = path2;
							break;
						}
					}
					if(path != undefined) {
						path.points.push(json.point);
						for(var i = 0; i < clients.length; i++) {
							var client = clients[i];
							client.sendUTF(JSON.stringify({
								type: "point",
								path: path.id,
								point: json.point,
							}));
						}
					}
				}
			} catch(e) {
				console.log((new Date()) + ": Invalid packet from client " + id + ": " + e.message, e.stack);
				return;
			}
		}
	});
	
	connection.on("close", function(connection) {
		clients.splice(id, 1);
		console.log((new Date()) + ": User disconnected");
	});
});

function resetCanvas() {
	if(paths.length > 0) {
		paths.splice(0, paths.length);
		for(var i = 0; i < clients.length; i++) {
			var client = clients[i];
			client.sendUTF(JSON.stringify({
				type: "reset"
			}));
		}
		console.log((new Date()) + ": Canvas reset");
	}
	setTimeout(function() {
		resetCanvas();
	}, 2 * 60 * 1000);
}
