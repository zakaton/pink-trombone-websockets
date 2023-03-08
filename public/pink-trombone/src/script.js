/* global setupWebsocket, autoResumeAudioContext, throttle */

const audioContext = new AudioContext();
autoResumeAudioContext(audioContext);

const pinkTromboneElement = document.querySelector("pink-trombone");
let frontConstriction, backConstriction;

pinkTromboneElement.addEventListener("load", (event) => {
  pinkTromboneElement.setAudioContext(audioContext).then((pinkTrombone) => {
    pinkTromboneElement.enableUI();
    pinkTromboneElement.startUI();
    pinkTromboneElement.connect(pinkTromboneElement.audioContext.destination);
    pinkTromboneElement.start();
    frontConstriction = pinkTromboneElement.newConstriction(43, 1.8);
    frontConstriction._isEnabled = true;
    backConstriction = pinkTromboneElement.newConstriction(10.5, 1.8);
  });
});

let isMouseDown = false;
document.body.addEventListener("mousedown", (event) => {
  isMouseDown = true;
});
document.body.addEventListener("mouseup", (event) => {
  isMouseDown = false;
});

function deconstructConstriction(constriction) {
  const index = constriction.index.value;
  const diameter = constriction.diameter.value;
  return { index, diameter };
}
function setConstriction(constriction, index, diameter) {
  constriction.index.value = index;
  constriction.diameter.value = diameter;
}

let indexThreshold = 28;
const updateConstriction = throttle((event) => {
  const message = {
    to: ["voice", "debug"],
    type: "message",
    constrictions: {},
  };

  const constrictionIndex =
    pinkTromboneElement.UI._tractUI._touchConstrictionIndices[-1];
  const isTongue = constrictionIndex == -1;
  if (isTongue) {
    const { index, diameter } = deconstructConstriction(
      pinkTromboneElement.tongue
    );
    message.constrictions.tongue = {
      index,
      diameter,
    };
  } else {
    const { index, diameter } = deconstructConstriction(
      pinkTromboneElement.pinkTrombone._pinkTromboneNode._constrictions[2]
    );
    const isBackConstriction = index < indexThreshold;
    const targetConstriction = isBackConstriction
      ? backConstriction
      : frontConstriction;
    setConstriction(targetConstriction, index, diameter);
    message.constrictions[
      isBackConstriction ? "backConstriction" : "frontConstriction"
    ] = {
      index,
      diameter,
    };
  }
  send(message);
}, 100);
document.body.addEventListener("mousemove", (event) => {
  if (isMouseDown) {
    updateConstriction(event);
  }
});

function setVoiceness(voiceness) {
  const tenseness = 1 - Math.cos(voiceness * Math.PI * 0.5);
  const loudness = Math.pow(tenseness, 0.25);

  pinkTromboneElement.tenseness.value = tenseness;
  pinkTromboneElement.loudness.value = loudness;
}

const { send } = setupWebsocket("pinktrombone", (message) => {
  let didSetVoiceness = false;
  let canSetVoiceness = true;
  for (const key in message) {
    const value = Number(message[key]);
    let node;
    let nodes = [];
    switch (key) {
      case "tongue.index":
        node = pinkTromboneElement.tongue.index;
        break;
      case "tongue.diameter":
        node = pinkTromboneElement.tongue.diameter;
        break;
      case "frontConstriction.index":
        node = frontConstriction.index;
        break;
      case "frontConstriction.diameter":
        node = frontConstriction.diameter;
        break;
      case "backConstriction.index":
        node = frontConstriction.index;
        break;
      case "backConstriction.diameter":
        node = backConstriction.diameter;
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
      case "intensity":
        node = pinkTromboneElement.intensity;
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
      case "phoneme":
        // FILL - set constrictions based on phoneme

        break;
      case "mouth":
        node = myConstriction.diameter;
        break;
      default:
      //console.log("uncaught key", key);
    }

    if (node) {
      nodes.push(node);
    }
    if (nodes.length > 0) {
      nodes.forEach((node) => {
        //node.value = value;
        node.linearRampToValueAtTime(
          value,
          pinkTromboneElement.audioContext.currentTime + 0.01
        );
      });
    }
  }
});
