var express = require("express");
var https = require("https");
var http = require("http");
var fs = require("fs");
var app = express();
var WebSocket = require("ws");

var options = {
  key: fs.readFileSync("./sec/key.pem"),
  cert: fs.readFileSync("./sec/cert.pem"),
};

app.use(express.static("public"));

const httpServer = http.createServer(app);
httpServer.listen(80);
const httpsServer = https.createServer(options, app);
httpsServer.listen(443);

const wss = new WebSocket.Server({ server: httpsServer });
wss.on("connection", (ws) => {
  console.log("new ws connection");
  ws.on("message", (data) => {
    console.log("ws message received");
    const json = data.toJSON();
    // FILL
  });
  ws.on("close", () => {
    console.log("ws disconnected");
  });
});
