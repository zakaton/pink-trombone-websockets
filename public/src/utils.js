function setupWebsocket(webpageName, onMessage) {
  // Create WebSocket connection.
  const socket = new WebSocket("wss://localhost/");

  // Connection opened
  socket.addEventListener("open", function () {
    send({
      type: "connection",
      webpage: webpageName,
    });
  });

  function send(object) {
    socket.send(JSON.stringify(object));
  }

  socket.addEventListener("message", (event) => {
    console.log("Message from server ", event.data);
    const message = JSON.parse(event.data);
    onMessage(message);
  });

  return { socket, send };
}
