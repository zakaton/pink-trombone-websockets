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
    pinkTromboneElement.frontConstriction = frontConstriction;
    frontConstriction._isEnabled = true;
    backConstriction = pinkTromboneElement.newConstriction(10.5, 1.8);
    pinkTromboneElement.backConstriction = backConstriction;
  });
});

let isMouseDown = false;
document.body.addEventListener("mousedown", (event) => {
  isMouseDown = true;
  updateConstriction();
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
const updateConstriction = throttle(() => {
  const message = {
    to: ["machine-learning", "debug", "mfcc"],
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
document.body.addEventListener("mousemove", () => {
  if (isMouseDown) {
    updateConstriction();
  }
});

let _voiceness = 0.7;
function setVoiceness(voiceness, offset) {
  _voiceness = voiceness;

  const tenseness = 1 - Math.cos(voiceness * Math.PI * 0.5);
  const loudness = Math.pow(tenseness, 0.25);

  const nodes = [
    {
      node: pinkTromboneElement.tenseness,
      value: tenseness,
    },
    {
      node: pinkTromboneElement.loudness,
      value: loudness,
    },
  ];
  nodes.forEach(({ node, value }) => {
    exponentialRampToValueAtTime(node, value, offset);
  });
}

const { send } = setupWebsocket("pink-trombone", (message) => {
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
        node = backConstriction.index;
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
        const { constrictions, voiced, type } = phonemes[message.phoneme];
        if (constrictions) {
          let voiceness = 0.8;
          if (type == "consonant") {
            voiceness = voiced ? 0.8 : 0.0;
          }
          setVoiceness(voiceness);
          constrictions.forEach((constriction, index) => {
            const { tongue, front, back } = constriction;
            const nodes = [];
            const features = ["index", "diameter"];
            if (tongue) {
              features.forEach((feature) => {
                nodes.push({
                  node: pinkTromboneElement.tongue[feature],
                  value: tongue[feature],
                });
              });
            }
            if (front) {
              features.forEach((feature) => {
                nodes.push({
                  node: frontConstriction[feature],
                  value: front[feature],
                });
              });
            } else {
              exponentialRampToValueAtTime(
                frontConstriction.diameter,
                frontConstriction.diameter.maxValue
              );
            }
            if (back) {
              features.forEach((feature) => {
                nodes.push({
                  node: backConstriction[feature],
                  value: back[feature],
                });
              });
            } else {
              exponentialRampToValueAtTime(
                backConstriction.diameter,
                backConstriction.diameter.maxValue
              );
            }
            nodes.forEach(({ node, value }) => {
              // FIX timing
              exponentialRampToValueAtTime(node, value, 0.01 + index * 0.3);
            });
          });
          setTimeout(() => {
            sendConstrictions();
          }, 10);
        }
        break;
      case "utterance":
        const { keyframes } = utterances[message.utterance];
        if (keyframes?.length > 0) {
          playKeyframes(keyframes);
        }
        break;
      default:
      //console.log("uncaught key", key);
    }

    if (node) {
      nodes.push(node);
    }
    if (nodes.length > 0) {
      nodes.forEach((node) => {
        exponentialRampToValueAtTime(node, value, 0.1);
      });
    }

    if (message.command == "getConstrictions") {
      sendConstrictions();
    }
  }
});

function sendConstrictions() {
  const message = {
    to: ["machine-learning", "debug", "mfcc"],
    type: "message",
    constrictions: {
      tongue: deconstructConstriction(pinkTromboneElement.tongue),
      frontConstriction: deconstructConstriction(frontConstriction),
      backConstriction: deconstructConstriction(backConstriction),
    },
    voiceness: _voiceness,
  };

  send(message);
}

function exponentialRampToValueAtTime(node, value, offset = 0.01) {
  if (value == 0) {
    value = 0.0001;
  }
  node.cancelAndHoldAtTime(pinkTromboneElement.audioContext.currentTime);
  node.exponentialRampToValueAtTime(
    value,
    pinkTromboneElement.audioContext.currentTime + offset
  );
}

const keyframeStrings = [
  "frequency",

  "tongue.index",
  "tongue.diameter",

  "frontConstriction.index",
  "frontConstriction.diameter",

  "tenseness",
  "loudness",

  "intensity",
];

function playKeyframes(keyframes) {
  keyframes.forEach((keyframe) => {
    keyframeStrings.forEach((keyframeString) => {
      const path = keyframeString.split(".");
      let value = pinkTromboneElement;
      while (path.length) {
        value = value[path.shift()];
      }
      const offset = keyframe.time;
      value.linearRampToValueAtTime(
        keyframe[keyframeString],
        pinkTromboneElement.audioContext.currentTime + offset
      );
    });
  });
}
