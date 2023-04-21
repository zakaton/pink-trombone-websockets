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
let voiceness = 0.7;
const { send } = setupWebsocket(
  "machine-learning",
  (message) => {
    if (message.from == "pink-trombone") {
      Object.assign(constrictions, message.constrictions);
      if ("voiceness" in message) {
        voiceness = message.voiceness;
      }
      //console.log(constrictions.getData(), voiceness);
      if (addDataButton.disabled) {
        addDataButton.disabled = false;
        trainButton.disabled = false;
      }
    }
  },
  () => {
    send({
      to: ["pink-trombone"],
      type: "message",
      command: "getConstrictions",
    });
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
const gainNode = audioContext.createGain();
autoResumeAudioContext(audioContext);

const numberOfMFCCCoefficients = 21;
let numberOfMFCCsToAverage = 3;
const lastNMFCCs = [];

let analyzer;
let _mfcc;
const audio = new Audio();
navigator.mediaDevices
  .getUserMedia({
    audio: {
      noiseSuppression: false,
      autoGainControl: false,
      echoCancellation: false,
    },
  })
  .then((stream) => {
    window.stream = stream;
    const sourceNode = audioContext.createMediaStreamSource(stream);
    sourceNode.connect(gainNode);
    audio.srcObject = stream;

    // Create a Meyda analyzer node to calculate MFCCs
    analyzer = Meyda.createMeydaAnalyzer({
      audioContext: audioContext,
      source: gainNode,
      featureExtractors: ["mfcc", "rms"],
      bufferSize: 2 ** 10,
      //hopSize: 2 ** 8,
      numberOfMFCCCoefficients,
      callback: ({ mfcc, rms }) => {
        lastNMFCCs.push(mfcc);
        while (lastNMFCCs.length > numberOfMFCCsToAverage) {
          lastNMFCCs.shift();
        }
        mfcc = mfcc.map((_, index) => {
          let sum = 0;
          lastNMFCCs.forEach((_mfcc) => {
            sum += _mfcc[index];
          });
          return sum / lastNMFCCs.length;
        });
        _mfcc = mfcc;

        drawMFCC(mfcc);
        if (rms > rmsThreshold) {
          if (isCollectingData) {
            addData(mfcc);
            numberOfSamplesCollected++;
            if (numberOfSamplesCollected >= numberOfSamplesToCollect) {
              toggleDataCollection();
            }
          }
          if (finishedTraining) {
            predictThrottled(mfcc);
          }
        }
      },
    });

    // Start the analyzer to begin processing audio data
    analyzer.start();
  });

let rmsThreshold = 0.01;

let includeBackConstriction = false;
let includeFrontConstriction = false;
let includeVoiceness = false;
const outputs = ["tongue.index", "tongue.diameter"];
if (includeFrontConstriction) {
  outputs.push("frontConstriction.diameter", "frontConstriction.index");
}
if (includeBackConstriction) {
  outputs.push("backConstriction.diameter", "backConstriction.index");
}
if (includeVoiceness) {
  outputs.push("voiceness");
}

const neuralNetwork = ml5.neuralNetwork({
  inputs: numberOfMFCCCoefficients,
  outputs,

  task: "regression",
  debug: "true",
  //learningRate: 0.1,
  //hiddenUnity: 16,
});

const addDataButton = document.getElementById("addData");
addDataButton.addEventListener("click", (event) => {
  toggleDataCollection();
});

let isCollectingData = false;
let numberOfSamplesCollected = 0;
let numberOfSamplesToCollect = 30;
function toggleDataCollection() {
  numberOfSamplesCollected = 0;
  isCollectingData = !isCollectingData;
  addDataButton.innerText = isCollectingData ? "stop adding data" : "add data";
}

function _addData(mfcc) {
  const inputs = mfcc;
  const outputs = constrictions.getData();
  if (includeVoiceness) {
    Object.assign(outputs, { voiceness });
  }
  if (!includeBackConstriction) {
    delete outputs["backConstriction.index"];
    delete outputs["backConstriction.diameter"];
  }
  if (!includeFrontConstriction) {
    delete outputs["frontConstriction.index"];
    delete outputs["frontConstriction.diameter"];
  }
  neuralNetwork.addData(inputs, outputs);
  localStorage[localStorage.length] = JSON.stringify({ inputs, outputs });
  if (clearLocalStorageButton.disabled) {
    clearLocalStorageButton.disabled = false;
  }
}
const addData = throttle((mfcc) => _addData(mfcc), 50);
window.addEventListener("load", (event) => {
  if (localStorage.length > 0) {
    clearLocalStorageButton.disabled = false;
    loadDataFromLocalStorageButton.disabled = false;
  }
});

const trainButton = document.getElementById("train");
trainButton.addEventListener("click", (event) => {
  train();
});

function train() {
  addDataButton.disabled = true;
  trainButton.disabled = true;
  neuralNetwork.normalizeData();
  neuralNetwork.train(
    {
      epochs: 50,
      batchSize: 50,
    },
    whileTraining,
    onFinishedTraining
  );
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
    const message = {};
    results.forEach(({ label, value }) => {
      message[label] = value;
    });
    throttledSend(message);
  }
}

const throttledSend = throttle((message) => {
  send({ to: ["pink-trombone"], type: "message", ...message });
}, 100);

const downloadButton = document.getElementById("download");
downloadButton.addEventListener("click", (event) => {
  console.log("download");
  neuralNetwork.save("model", () => {
    console.log("saved");
    downloadButton.disabled = true;
  });
});

const uploadInput = document.getElementById("upload");
uploadInput.addEventListener("input", (event) => {
  neuralNetwork.load(event.target.files, () => {
    console.log("loaded");
    event.target.disabled = true;
    trainButton.disabled = true;
    addDataButton.disabled = true;
    finishedTraining = true;
  });
});

const clearLocalStorageButton = document.getElementById("clearLocalstorage");
clearLocalStorageButton.addEventListener("click", (event) => {
  localStorage.clear();
  clearLocalStorageButton.disabled = true;
  loadDataFromLocalStorageButton.disabled = true;
});

const loadDataFromLocalStorageButton = document.getElementById(
  "loadDataFromLocalstorage"
);
loadDataFromLocalStorageButton.addEventListener("click", (event) => {
  for (let index = 0; index < localStorage.length; index++) {
    const { inputs, outputs } = JSON.parse(localStorage[index]);
    if (!includeBackConstriction) {
      delete outputs["backConstriction.index"];
      delete outputs["backConstriction.diameter"];
    }
    if (!includeVoiceness) {
      delete outputs["voiceness"];
    }
    if (!includeFrontConstriction) {
      delete outputs["frontConstriction.index"];
      delete outputs["frontConstriction.diameter"];
    }
    neuralNetwork.addData(inputs, outputs);
  }
  loadDataFromLocalStorageButton.disabled = true;
  trainButton.disabled = false;
});
