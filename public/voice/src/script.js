/* global setupWebsocket, autoResumeAudioContext, Meyda */

const { send } = setupWebsocket("voice", (message) => {
  // FILL
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
      //numberOfMFCCCoefficients: 10,
      callback: ({ mfcc }) => {
        //console.log(mfcc);
        drawMFCC(mfcc);
      },
    });

    // Start the analyzer to begin processing audio data
    analyzer.start();
  });
