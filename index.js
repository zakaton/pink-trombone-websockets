var express = require("express");
var https = require("https");
var http = require("http");
var fs = require("fs");
var app = express();
var WebSocket = require("ws");
var robot = require("robotjs");

var options = {
  key: fs.readFileSync("./sec/key.pem"),
  cert: fs.readFileSync("./sec/cert.pem"),
};

app.use(function (req, res, next) {
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  next();
});
app.use(express.static("public"));

const httpServer = http.createServer(app);
httpServer.listen(80);
const httpsServer = https.createServer(options, app);
httpsServer.listen(443, () => {
  console.log("server listening on https://localhost");
});

const clients = {};

const wss = new WebSocket.Server({ server: httpServer });
wss.on("connection", (client) => {
  console.log("new client connection");
  let webpageName;
  client.on("message", (data) => {
    //console.log("client message received");
    const string = data.toString();
    const message = JSON.parse(string);
    const { to, type, command } = message;
    switch (type) {
      case "connection":
        webpageName = message.webpage;
        client.pinkTromboneId = message.id;
        console.log(
          `received initial message from the "${webpageName}-${client.pinkTromboneId}" webpage`
        );
        if (!clients[webpageName]) {
          clients[webpageName] = new Set();
        }
        clients[webpageName].add(client);
        break;
      case "message":
        to.forEach((receiver) => {
          clients[receiver]?.forEach((_client) => {
            if (_client.pinkTromboneId == client.pinkTromboneId) {
              _client.send(string);
            }
          });
        });
        break;
      case "id":
        client.pinkTromboneId = message.id;
        console.log(`updated id "${webpageName}-${client.pinkTromboneId}"`);
        break;
      case "robot":
        const commands = Array.isArray(command) ? command : [command];
        commands.forEach((command) => {
          onRobotCommand(command);
        });
        break;
      default:
        console.log(`uncaught message type ${type}`);
        break;
    }
  });
  client.on("close", () => {
    console.log(`"${webpageName}" webpage left`);
    clients[webpageName]?.delete(client);
  });
});

robot.setMouseDelay(1);
//robot.setKeyboardDelay(1);
function onRobotCommand(command = {}) {
  const { method, args = [] } = command;
  if (method in robot) {
    //console.log("calling", method, "with args", args);
    robot[method](...args);
  } else {
    console.log("uncaught robot method", method);
  }
}
