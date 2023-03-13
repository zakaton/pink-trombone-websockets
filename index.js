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
  debug: new Set(),
  vvvv: new Set(),
  "pink-trombone": new Set(),
  microphone: new Set(),
  "pocket-sphinx": new Set(),
  "machine-learning": new Set(),
  mfcc: new Set(),
};

const wss = new WebSocket.Server({ server: httpsServer });
wss.on("connection", (ws) => {
  console.log("new ws connection");
  let webpageName;
  ws.on("message", (data) => {
    //console.log("ws message received");
    const string = data.toString();
    const message = JSON.parse(string);
    const { to, type } = message;
    switch (type) {
      case "connection":
        webpageName = message.webpage;
        console.log(
          `received initial message from the "${webpageName}" webpage`
        );
        clients[webpageName]?.add(ws);
        break;
      case "message":
        to.forEach((receiver) => {
          clients[receiver].forEach((client) => client.send(string));
        });
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
