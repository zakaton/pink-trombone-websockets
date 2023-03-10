/* global setupWebsocket, autoResumeAudioContext, Meyda, ml5, throttle*/

const constrictions = {
  getData() {
    if (this.hasAllConstrictions()) {
      const data = {};
      for (const type in this) {
        if (typeof this[type] == "object" && "index" in this[type]) {
          for (const subtype in this[type]) {
            data[`${type}.${subtype}`] = this[type][subtype];
          }
        }
      }
      return data;
    }
  },
  hasAllConstrictions() {
    return Boolean(
      this.tongue && this.backConstriction && this.frontConstriction
    );
  },
};
const { send } = setupWebsocket(
  "machine-learning",
  (message) => {
    if (message.from == "pink-trombone") {
      Object.assign(constrictions, message.constrictions);
      if (addDataButton.disabled) {
        addDataButton.disabled = false;
        trainButton.disabled = false;
      }
    }
  },
  () => {
    send({ to: ["pink-trombone"], type: "message", command: "getConstraints" });
  }
);

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
        if (isCollectingData) {
          addData(mfcc);
        }
        if (finishedTraining) {
          predictThrottled(mfcc);
        }
      },
    });

    // Start the analyzer to begin processing audio data
    analyzer.start();
  });

const neuralNetwork = ml5.neuralNetwork({
  inputs: numberOfMFCCCoefficients,
  outputs: [
    "tongue.index",
    "tongue.diameter",
    "frontConstriction.diameter",
    "frontConstriction.index",
    "backConstriction.diameter",
    "backConstriction.index",
  ],

  task: "regression",
  debug: "true",

  epochs: 80,
  batchSize: 20,
});

const addDataButton = document.getElementById("addData");
addDataButton.addEventListener("click", (event) => {
  toggleDataCollection();
});

let isCollectingData = false;
function toggleDataCollection() {
  isCollectingData = !isCollectingData;
  addDataButton.innerText = isCollectingData ? "stop adding data" : "add data";
}

function addData(mfcc) {
  neuralNetwork.addData(mfcc, constrictions.getData());
}

const trainButton = document.getElementById("train");
trainButton.addEventListener("click", (event) => {
  train();
});

function train() {
  addDataButton.disabled = true;
  trainButton.disabled = true;
  neuralNetwork.normalizeData();
  neuralNetwork.train({}, whileTraining, onFinishedTraining);
}

function whileTraining(epoch, loss) {
  console.log(`Epoch: ${epoch}, Loss: ${loss.loss}`);
}

let finishedTraining = false;
function onFinishedTraining() {
  console.log("finished training");
  finishedTraining = true;
  downloadButton.disabled = false;
}

function predict(mfcc) {
  neuralNetwork.predict(mfcc, getPrediction);
}
const predictThrottled = throttle(predict, 100);

function getPrediction(error, results) {
  if (error) {
    console.error(error);
  } else {
    console.log(results);
    // FILL - SEND
  }
}

const downloadButton = document.getElementById("download");
downloadButton.addEventListener("click", (event) => {
  console.log("download");
  neuralNetwork.save("model", () => {
    console.log("saved");
    downloadButton.disabled = true;
  });
});

const loadInput = document.getElementById("load");
loadInput.addEventListener("input", (event) => {
  neuralNetwork.load(loadInput.files, () => {
    console.log("loaded");
    loadInput.disabled = true;
    trainButton.disabled = true;
    addDataButton.disabled = true;
    finishedTraining = true;
  });
});
