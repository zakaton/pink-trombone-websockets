/* global setupWebsocket */

const pinkTromboneElement = document.querySelector("pink-trombone");
let frontConstriction, rearConstriction;

pinkTromboneElement.addEventListener("load", (event) => {
  pinkTromboneElement.setAudioContext().then((pinkTrombone) => {
    pinkTromboneElement.enableUI();
    pinkTromboneElement.startUI();
    pinkTromboneElement.connect(pinkTromboneElement.audioContext.destination);
    pinkTromboneElement.start();
    frontConstriction = pinkTromboneElement.newConstriction(0, 1.8);
    rearConstriction = pinkTromboneElement.newConstriction(43, 1.8);
  });
});

function setVoiceness(voiceness) {
  const tenseness = 1 - Math.cos(voiceness * Math.PI * 0.5);
  const loudness = Math.pow(tenseness, 0.25);

  pinkTromboneElement.tenseness.value = tenseness;
  pinkTromboneElement.loudness.value = loudness;
}

const { send } = setupWebsocket("pinkTrombone", (message) => {
  let didSetVoiceness = false;
  let canSetVoiceness = true;
  for (const key in message) {
    const value = Number(message[key]);
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
      //node.value = value;
      node.linearRampToValueAtTime(
        value,
        pinkTromboneElement.audioContext.currentTime + 0.01
      );
    }
  }
});
