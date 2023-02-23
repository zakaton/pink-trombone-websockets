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

const clients = {
  vvvv: new Set(),
  pinkTrombone: new Set(),
  pitch: new Set(),
  phoneme: new Set(),
};

const wss = new WebSocket.Server({ server: httpsServer });
wss.on("connection", (ws) => {
  console.log("new ws connection");
  let webpageName;
  ws.on("message", (data) => {
    console.log("ws message received");
    const json = JSON.parse(data.toString());
    switch (json.type) {
      case "connection":
        webpageName = json.webpage;
        console.log(
          `received initial message from the "${webpageName}" webpage`
        );
        clients[webpageName]?.add(ws);
        break;
      default:
        console.log(`uncaught message type ${type}`);
        break;
    }
  });
  ws.on("close", () => {
    console.log(`"${webpageName}" webpage left`);
    clients[webpageName]?.delete(ws);
  });
});
