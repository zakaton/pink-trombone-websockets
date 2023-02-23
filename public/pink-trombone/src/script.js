/* global pinkTromboneElement, myConstriction */

function setVoiceness(voiceness) {
  const tenseness = 1 - Math.cos(voiceness * Math.PI * 0.5);
  const loudness = Math.pow(tenseness, 0.25);

  pinkTromboneElement.tenseness.value = tenseness;
  pinkTromboneElement.loudness.value = loudness;
}

// Create WebSocket connection.
const socket = new WebSocket("wss://localhost/");

// Connection opened
socket.addEventListener("open", function (event) {
  send({
    type: "connection",
    webpage: "pinkTrombone",
  });
});

function send(object) {
  socket.send(JSON.stringify(object));
}

// Listen for messages
socket.addEventListener("message", function (event) {
  console.log("Message from server ", event.data);
  const data = JSON.parse(event.data);
  let didSetVoiceness = false;
  let canSetVoiceness = true;
  for (const key in data) {
    const value = Number(data[key]);
    let node;
    switch (key) {
      case "tongue.index":
        node = pinkTromboneElement.tongue.index;
        break;
      case "tongue.diameter":
        node = pinkTromboneElement.tongue.diameter;
        break;
      case "tenseness":
        if (didSetVoiceness) {
          return;
        }
        node = pinkTromboneElement.tenseness;
        canSetVoiceness = false;
        break;
      case "loudness":
        if (didSetVoiceness) {
          return;
        }
        node = pinkTromboneElement.loudness;
        canSetVoiceness = false;
        break;
      case "frequency":
        node = pinkTromboneElement.frequency;
        break;
      case "vibrato.frequency":
        node = pinkTromboneElement.vibrato.frequency;
        break;
      case "vibrato.gain":
        node = pinkTromboneElement.vibrato.gain;
        break;
      case "vibrato.wobble":
        node = pinkTromboneElement.vibrato.wobble;
        break;
      case "voiceness":
        if (!canSetVoiceness) {
          return;
        }
        setVoiceness(value);
        didSetVoiceness = true;
        break;
      case "mouth":
        node = myConstriction.diameter;
        break;
      default:
        console.log("uncaught key", key);
    }
    if (node) {
      node.value = value;
    }
  }
});
