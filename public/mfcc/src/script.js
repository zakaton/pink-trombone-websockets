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
  "mfcc",
  (message) => {
    if (message.from == "pink-trombone") {
      Object.assign(constrictions, message.constrictions);
      if ("voiceness" in message) {
        voiceness = message.voiceness;
      }
      //console.log(constrictions.getData(), voiceness);
      if (addDataButton.disabled) {
        addDataButton.disabled = false;
        predictButton.disabled = false;
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
autoResumeAudioContext(audioContext);

const numberOfMFCCCoefficients = 12;

let analyzer;
navigator.mediaDevices
  .getUserMedia({
    audio: {
      noiseSuppression: false,
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
      featureExtractors: ["mfcc", "rms"],
      bufferSize: 2 ** 10,
      //hopSize: 2 ** 8,
      numberOfMFCCCoefficients,
      callback: ({ mfcc, rms }) => {
        drawMFCC(mfcc);
        if (rms > rmsThreshold) {
          if (collectDataFlag) {
            addData(mfcc);
            collectDataFlag = false;
          }
          if (predictFlag) {
            predictThrottled(mfcc);
          }
        }
      },
    });

    // Start the analyzer to begin processing audio data
    analyzer.start();
  });

let predictFlag = false;
const predictButton = document.getElementById("predict");
predictButton.addEventListener("click", (event) => {
  predictFlag = !predictFlag;
  predictButton.innerText = predictFlag ? "stop predicting" : "predict";
});

let rmsThreshold = 0.01;

const addDataButton = document.getElementById("addData");
let collectDataFlag = false;
addDataButton.addEventListener("click", (event) => {
  collectDataFlag = true;
});

function addData(mfcc) {
  const inputs = mfcc;
  const outputs = constrictions.getData();
  Object.assign(outputs, { voiceness });
  appendData({ inputs, outputs });
  localStorage[localStorage.length] = JSON.stringify({ inputs, outputs });
  if (clearLocalStorageButton.disabled) {
    clearLocalStorageButton.disabled = false;
  }
}
window.addEventListener("load", (event) => {
  if (localStorage.length > 0) {
    clearLocalStorageButton.disabled = false;
    loadDataFromLocalStorageButton.disabled = false;
  }
});

function predict(mfcc) {
  mfcc = normalizeArray(mfcc);
  const dotProducts = data.map((datum) => {
    const _mfcc = datum.inputs;
    let dotProduct = 0;
    _mfcc.forEach((value, index) => {
      dotProduct += value * mfcc[index];
    });
    return dotProduct;
  });

  const angles = dotProducts.map((dotProduct) => {
    return Math.abs(Math.acos(dotProduct));
  });

  const sortedData = data.toSorted((a, b) => {
    return angles[a.index] - angles[b.index];
  });

  const sortedAngles = sortedData.map((datum) => angles[datum.index]);
  const interpolation = sortedAngles[0] / (sortedAngles[0] + sortedAngles[1]);
  const message = interpolateConstrictions(
    sortedData[0],
    sortedData[1],
    interpolation
  );
  throttledSend(message);
}
const predictThrottled = throttle(predict, 100);

function interpolateConstrictions(a, b, interpolation) {
  //interpolation = 0;
  const constriction = {};
  for (const type in a.outputs) {
    const aValue = a.outputs[type];
    const bValue = b.outputs[type];
    const value = interpolate(aValue, bValue, interpolation);
    constriction[type] = value;
  }
  return constriction;
}

function interpolate(from, to, interpolation) {
  return (1 - interpolation) * from + interpolation * to;
}

const throttledSend = throttle((message) => {
  send({ to: ["pink-trombone"], type: "message", ...message });
}, 100);

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
    appendData({ inputs, outputs });
  }
  loadDataFromLocalStorageButton.disabled = true;
});

let data = [];
function appendData({ inputs, outputs }) {
  inputs = normalizeArray(inputs);
  data.push({ inputs, outputs, index: data.length });
}

function getMagntude(array) {
  let sum = 0;
  array.forEach((value) => {
    sum += value ** 2;
  });
  const magnitude = Math.sqrt(sum);
  return magnitude;
}
function normalizeArray(array) {
  const magnitude = getMagntude(array);
  const normalizedArray = array.map((value) => value / magnitude);
  return normalizedArray;
}
