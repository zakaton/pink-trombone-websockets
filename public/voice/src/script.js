/* global setupWebsocket, autoResumeAudioContext, Meyda, ml5, throttle*/

const { send } = setupWebsocket("voice", (message) => {
  // FILL
  console.log(message);
});

/** @type {HTMLCanvasElement} */
const mfccCanvas = document.getElementById("mfcc");
const mfccContext = mfccCanvas.getContext("2d");
let mfccDrawRange = 200;
mfccContext.strokeStyle = "black";
/**
 * @param {number[]} mfcc
 */
function drawMFCC(mfcc) {
  const { width: w, height: h } = mfccCanvas;
  mfccContext.clearRect(0, 0, w, h);
  const segmentLength = w / mfcc.length;
  mfcc.forEach((value, index) => {
    let height = 1 - value / mfccDrawRange;
    height *= h;
    height -= h / 2;
    mfccContext.beginPath();
    mfccContext.moveTo(index * segmentLength, height);
    mfccContext.lineTo((index + 1) * segmentLength, height);
    mfccContext.stroke();
  });
}

const audioContext = new AudioContext();
autoResumeAudioContext(audioContext);

const numberOfMFCCCoefficients = 13;

let analyzer;
navigator.mediaDevices
  .getUserMedia({
    audio: {
      //noiseSuppression: false,
      //autoGainControl: false,
      //echoCancellation: false,
    },
  })
  .then((stream) => {
    const sourceNode = audioContext.createMediaStreamSource(stream);

    // Create a Meyda analyzer node to calculate MFCCs
    analyzer = Meyda.createMeydaAnalyzer({
      audioContext: audioContext,
      source: sourceNode,
      featureExtractors: ["mfcc"],
      bufferSize: 2 ** 10,
      //hopSize: 2 ** 8,
      numberOfMFCCCoefficients,
      callback: ({ mfcc }) => {
        //console.log(mfcc);
        drawMFCC(mfcc);
      },
    });

    // Start the analyzer to begin processing audio data
    analyzer.start();
  });

const neuralNetwork = ml5.neuralNetwork({
  inputs: numberOfMFCCCoefficients,
  outputs: [
    "tongueIndex",
    "tongueDiameter",
    "frontConstrictionDiameter",
    "frontConstrictionIndex",
    "backConstrictionDiameter",
    "backConstrictionIndex",
  ],

  task: "regression",
  debug: "true",

  epochs: 80,
  batchSize: 20,
});

function getOutputs() {
  return {
    tongueIndex: pinkTromboneElement.tongue.index.value,
    tongueDiameter: pinkTromboneElement.tongue.diameter.value,

    frontConstrictionDiameter: constrictions.front.diameter.value,
    frontConstrictionIndex: constrictions.front.index.value,

    backConstrictionDiameter: constrictions.back.diameter.value,
    backConstrictionIndex: constrictions.back.index.value,
  };
}
function setOutputs({
  tongueIndex,
  tongueDiameter,
  //frontConstrictionIndex, frontConstrictionDiameter,
  //backConstrictionIndex, backConstrictionDiameter,
}) {
  pinkTromboneElement.tongue.index.value = tongueIndex;
  pinkTromboneElement.tongue.diameter.value = tongueDiameter;

  //constrictions.front.index.value = frontConstrictionIndex;
  //constrictions.front.diameter.value = frontConstrictionDiameter;

  //constrictions.back.index.value = backConstrictionIndex;
  //constrictions.back.diameter.value = backConstrictionDiameter;
}
