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
        if (addDataButton.disabled) {
          addDataButton.disabled = false;
          predictButton.disabled = false;
        }
      }
      //console.log(constrictions.getData(), voiceness);
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
function drawMFCC(mfcc, canvas, context, otherMMFC) {
  const { width: w, height: h } = canvas;
  context.clearRect(0, 0, w, h);
  if (otherMMFC) {
    _drawMFCC(otherMMFC, "blue", canvas, context);
  }
  _drawMFCC(mfcc, "black", canvas, context);
}

function _drawMFCC(mfcc, color = "black", canvas, context) {
  const { width: w, height: h } = canvas;
  const segmentLength = w / mfcc.length;
  context.strokeStyle = color;
  mfcc.forEach((value, index) => {
    let height = 1 - value / mfccDrawRange;
    height *= h;
    height -= h / 2;
    context.beginPath();
    context.moveTo(index * segmentLength, height);
    context.lineTo((index + 1) * segmentLength, height);
    context.stroke();
  });
}

const audioContext = new AudioContext();
autoResumeAudioContext(audioContext);

const numberOfMFCCCoefficients = 12;

let numberOfMFCCsToAverage = 5;
const lastNMFCCs = [];

let _mfcc;
let analyzer;
navigator.mediaDevices
  .getUserMedia({
    audio: {
      noiseSuppression: false,
      autoGainControl: false,
      echoCancellation: false,
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

        drawMFCC(mfcc, mfccCanvas, mfccContext, selectedData?.inputs);
        if (rms > rmsThreshold) {
          if (collectDataFlag) {
            addData(mfcc);
            collectDataFlag = false;
          }
          if (predictFlag) {
            predictThrottled(mfcc);
            _drawMFCC(sortedData[0].inputs, "green", mfccCanvas, mfccContext);
            dataContainer.querySelectorAll(".datum").forEach((div) => {
              const { datum } = div;
              if (sortedData[0] == datum) {
                div.classList.add("prediction");
              } else {
                div.classList.remove("prediction");
              }
            });
          }
          _mfcc = mfcc;
          throttledSend({ mfcc, to: ["vvvv"] });
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
  if (!predictFlag) {
    dataContainer.querySelectorAll(".datum").forEach((div) => {
      div.classList.remove("prediction");
      div.updateSpans();
    });
  }
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
    downloadLocalstorageButton.disabled = false;
  }
}
window.addEventListener("load", (event) => {
  if (localStorage.length > 0) {
    clearLocalStorageButton.disabled = false;
    loadDataFromLocalStorageButton.disabled = false;
    downloadLocalstorageButton.disabled = false;
  }
});

let angleThreshold = 0.8; // was 0.3
let sortedData, filteredSortedDatum, weights;
function predict(mfcc) {
  mfcc = normalizeArray(mfcc);
  const dotProducts = data.map((datum) => {
    const _mfcc = datum.normalizedInputs;
    let dotProduct = 0;
    _mfcc.forEach((value, index) => {
      dotProduct += value * mfcc[index];
    });
    return dotProduct;
  });

  const angles = dotProducts.map((dotProduct) => {
    return Math.abs(Math.acos(dotProduct));
  });

  sortedData = data.toSorted((a, b) => {
    return angles[a.index] - angles[b.index];
  });

  const sortedAngles = sortedData.map((datum) => angles[datum.index]);

  let message;
  if (true) {
    filteredSortedDatum = sortedData.filter(
      (datum, index) => sortedAngles[index] < angleThreshold
    );
    if (filteredSortedDatum.length > 0) {
      if (filteredSortedDatum.length == 1) {
        message = interpolateAllConstrictions(filteredSortedDatum, [1]);
      } else {
        const largestAngle = sortedAngles[filteredSortedDatum.length - 1];
        const inverseAngles = filteredSortedDatum.map(
          (_, index) => largestAngle - sortedAngles[index]
        );
        let inverseAngleSum = 0;
        inverseAngles.forEach(
          (inverseAngle) => (inverseAngleSum += inverseAngle)
        );
        weights = inverseAngles.map(
          (inverseAngle) => inverseAngle / inverseAngleSum
        );

        dataContainer.querySelectorAll(".datum").forEach((div) => {
          div.updateSpans();
        });

        message = interpolateAllConstrictions(filteredSortedDatum, weights);
      }
    }
  } else {
    const interpolation = sortedAngles[0] / (sortedAngles[0] + sortedAngles[1]);
    message = interpolateConstrictions(
      sortedData[0],
      sortedData[1],
      interpolation
    );
  }
  if (message) {
    throttledSend(message);
  }
}
const predictThrottled = throttle(predict, 10); //ms of prediction time

function interpolateConstrictions(a, b, interpolation) {
  interpolation = 0;
  const constriction = {};
  for (const type in a.outputs) {
    const aValue = a.outputs[type];
    const bValue = b.outputs[type];
    const value = interpolate(aValue, bValue, interpolation);
    constriction[type] = value;
  }
  return constriction;
}
function interpolateAllConstrictions(data, weights) {
  const constriction = {};
  data.forEach((datum, index) => {
    const weight = weights[index];
    for (const type in datum.outputs) {
      const value = weight * datum.outputs[type];
      if (!(type in constriction)) {
        constriction[type] = value;
      } else {
        constriction[type] += value;
      }
    }
  });
  return constriction;
}

function interpolate(from, to, interpolation) {
  return (1 - interpolation) * from + interpolation * to;
}

const throttledSend = throttle((message) => {
  send({ to: ["pink-trombone"], type: "message", ...message });
}, 20);

const clearLocalStorageButton = document.getElementById("clearLocalstorage");
clearLocalStorageButton.addEventListener("click", (event) => {
  localStorage.clear();
  clearLocalStorageButton.disabled = true;
  loadDataFromLocalStorageButton.disabled = true;
  downloadLocalstorageButton.disabled = true;
  dataContainer.querySelectorAll(".datum").forEach((div) => div.remove());
});

const loadDataFromLocalStorageButton = document.getElementById(
  "loadDataFromLocalstorage"
);
loadDataFromLocalStorageButton.addEventListener("click", (event) => {
  for (let index = 0; index < localStorage.length; index++) {
    const { inputs, outputs, name } = JSON.parse(localStorage[index]);
    appendData({ inputs, outputs, name });
  }
  loadDataFromLocalStorageButton.disabled = true;
});

let data = [];
function appendData({ inputs, outputs, name }) {
  const normalizedInputs = normalizeArray(inputs);
  const datum = { inputs, normalizedInputs, outputs, index: data.length, name };
  appendDataView(datum);
  data.push(datum);
  //console.log("added datum", datum);
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

let selectedData, selectedDataContainer;
const dataContainer = document.getElementById("data");
const datumContainerTemplate = dataContainer.querySelector("template");
function appendDataView(datum) {
  const container = datumContainerTemplate.content
    .cloneNode(true)
    .querySelector("div");

  container.datum = datum;

  const nameInput = container.querySelector(".name");
  nameInput.value = datum.name || "";
  nameInput.addEventListener("input", (event) => {
    datum.name = event.target.value;
    save();
  });
  const rankingSpan = container.querySelector(".ranking");
  const percentageSpan = container.querySelector(".percentage");
  container.updateSpans = () => {
    if (predictFlag && filteredSortedDatum.includes(datum)) {
      const index = filteredSortedDatum.indexOf(datum);
      percentageSpan.innerText = weights[index].toFixed(3);
      rankingSpan.innerText = index;
    } else {
      percentageSpan.innerText = "";
      rankingSpan.innerText = "";
    }
  };

  const ptButton = container.querySelector(".pt");
  ptButton.addEventListener("click", () => {
    throttledSend(datum.outputs);
  });
  const canvas = container.querySelector("canvas");
  const context = canvas.getContext("2d");
  const drawCanvas = () => {
    drawMFCC(datum.inputs, canvas, context);
  };
  drawCanvas();
  const save = () => {
    const { inputs, outputs, name } = datum;
    localStorage[datum.index] = JSON.stringify({ inputs, outputs, name });
  };
  const resampleButton = container.querySelector(".resample");
  resampleButton.addEventListener("click", (event) => {
    datum.inputs = _mfcc.slice();
    datum.normalizedInputs = normalizeArray(datum.inputs);
    save();
    drawCanvas();
  });
  const rePTButton = container.querySelector(".rePT");
  rePTButton.addEventListener("click", () => {
    datum.outputs = constrictions.getData();
    datum.outputs.voiceness = voiceness;
    save();
  });
  const deleteButton = container.querySelector(".delete");
  deleteButton.addEventListener("click", (event) => {
    container.remove();
    data.splice(data.indexOf(datum), 1);
    refreshLocalstorage();
    deselect();
    event.stopPropagation();
  });

  container.addEventListener("click", (event) => {
    if (selectedData != datum) {
      if (selectedDataContainer) {
        selectedDataContainer.classList.remove("selected");
      }
      selectedData = datum;
      console.log("selected data", selectedData);
      selectedDataContainer = container;
      selectedDataContainer.classList.add("selected");
    }
    event.stopPropagation();
  });
  dataContainer.appendChild(container);
}

document.body.addEventListener("click", (e) => {
  deselect();
});

function refreshLocalstorage() {
  localStorage.clear();
  data.forEach((datum, index) => {
    const { inputs, outputs, name } = datum;
    datum.index = index;
    localStorage[index] = JSON.stringify({ inputs, outputs, name });
  });
}

function deselect() {
  if (selectedDataContainer) {
    selectedDataContainer.classList.remove("selected");
  }
  selectedData = selectedDataContainer = null;
}

const uploadDataInput = document.getElementById("uploadData");
uploadDataInput.addEventListener("input", (event) => uploadData(event));
function uploadData(event) {
  const { files } = event.target;
  const jsons = [];
  const onLoadedJSONS = () => {
    loadJSON(...jsons);
  };
  const readNextFile = (index = 0) => {
    const file = files[index];
    if (file) {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        jsons[index] = JSON.parse(event.target.result);
        readNextFile(index + 1);
      };
      fileReader.readAsText(file);
    } else {
      onLoadedJSONS();
    }
  };
  readNextFile();
}

const loadJSON = (...jsons) => {
  jsons.forEach((data) => {
    console.log(data);
    data.forEach((datum) => {
      appendData(datum);
      localStorage[localStorage.length] = JSON.stringify(datum);
      if (clearLocalStorageButton.disabled) {
        clearLocalStorageButton.disabled = false;
        downloadLocalstorageButton.disabled = false;
      }
    });
  });
};

const downloadLocalstorageButton = document.getElementById(
  "downloadLocalstorage"
);
downloadLocalstorageButton.addEventListener("click", (event) =>
  downloadLocalstorage()
);
const downloadLink = document.getElementById("downloadLink");
function downloadLocalstorage() {
  const json = [];
  for (let index = 0; index < localStorage.length; index++) {
    json.push(JSON.parse(localStorage[index]));
  }
  var dataString =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json));
  downloadLink.setAttribute("href", dataString);
  downloadLink.setAttribute(
    "download",
    `mfcc-${new Date().toLocaleString()}.json`
  );
  downloadLink.click();
}
