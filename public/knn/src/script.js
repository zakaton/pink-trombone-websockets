/* global setupWebsocket, autoResumeAudioContext, Meyda, ml5, throttle*/

const constrictions = {
  getData() {
    if (this.hasAllConstrictions()) {
      const classifications = {};
      for (const type in this) {
        if (typeof this[type] == "object" && "index" in this[type]) {
          for (const subtype in this[type]) {
            classifications[`${type}.${subtype}`] = this[type][subtype];
          }
        }
      }
      return classifications;
    }
  },
  tongue: {
    index: 12.89,
    diameter: 2.43,
  },
  frontConstriction: {
    index: 43,
    diameter: 1.8,
  },
  backConstriction: {
    diameter: 1.8,
    index: 10.5,
  },
  hasAllConstrictions() {
    return Boolean(
      this.tongue && this.backConstriction && this.frontConstriction
    );
  },
};
let voiceness = 0.7;
const { send } = setupWebsocket(
  "knn",
  (message) => {
    if (message.from == "pink-trombone") {
      Object.assign(constrictions, message.constrictions);
      if ("voiceness" in message) {
        voiceness = message.voiceness;
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
function drawMFCC(mfcc, canvas, context, otherMMFC) {
  const { width: w, height: h } = canvas;
  context.clearRect(0, 0, w, h);
  if (otherMMFC) {
    _drawMFCC(otherMMFC, "blue", canvas, context);
  }
  if (mfcc) {
    _drawMFCC(mfcc, "black", canvas, context);
  }
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
let startedMicrophone = false;
const gainNode = audioContext.createGain();
autoResumeAudioContext(audioContext);

const numberOfMFCCCoefficients = 21;

let numberOfMFCCsToAverage = 5;
const lastNMFCCs = [];

let _mfcc, _rms;
let analyzer;
let selectedClassification, selectedClassificationContainer;
const audio = new Audio();
const startMicrophone = () =>
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
        numberOfMFCCCoefficients,
        callback: ({ mfcc, rms }) => {
          _rms = rms;
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

          drawMFCC(
            mfcc,
            mfccCanvas,
            mfccContext,
            selectedClassification?.inputs[
              selectedClassification?.selectedInputIndex
            ]
          );
          if (rms > rmsThreshold) {
            if (selectedClassificationContainer?.collectClassificationsFlag) {
              selectedClassificationContainer.addData(mfcc);
            }
            if (predictFlag) {
              predictThrottled(mfcc);
            }
            _mfcc = mfcc;
            throttledSendToVVVV({ mfcc, to: ["vvvv"] });
          }
        },
      });

      // Start the analyzer to begin processing audio classifications
      analyzer.start();
    });

audioContext.addEventListener("statechange", () => {
  if (!startedMicrophone && audioContext.state == "running") {
    startMicrophone();
    startedMicrophone = true;
  }
});

let predictFlag = false;
const predictButton = document.getElementById("predict");
predictButton.addEventListener("click", (event) => {
  predictFlag = !predictFlag;
  if (!predictFlag) {
    classificationsContainer
      .querySelectorAll(".classification")
      .forEach((div) => {
        div.classList.remove("prediction");
        div.updateSpans();
      });
  }
  predictButton.innerText = predictFlag ? "stop predicting" : "predict";
});

let rmsThreshold = 0.01;

const addClassificationButton = document.getElementById("addClassification");
let collectClassificationsFlag = false;
addClassificationButton.addEventListener("click", (event) => {
  addClassification();
});

function addClassification() {
  const inputs = [];
  const outputs = constrictions.getData();
  Object.assign(outputs, { voiceness });
  localStorage[classifications.length] = JSON.stringify({ inputs, outputs });
  appendClassification({ inputs, outputs });
  if (clearLocalStorageButton.disabled) {
    clearLocalStorageButton.disabled = false;
    downloadLocalstorageButton.disabled = false;
  }
}
window.addEventListener("load", (event) => {
  if (localStorage.length > 0) {
    clearLocalStorageButton.disabled = false;
    loadClassificationsFromLocalStorageButton.disabled = false;
    downloadLocalstorageButton.disabled = false;
  }
});

const classifier = ml5.KNNClassifier();
const trainButton = document.getElementById("train");
let shouldNormalize = false;
trainButton.addEventListener("click", (event) => {
  if (classifications.length > 0) {
    trainButton.innerText = "training...";
    trainButton.disabled = true;
    setTimeout(() => {
      classifier.clearAllLabels();
      classifications.forEach(({ inputs, name }) => {
        inputs.forEach((input) => {
          classifier.addExample(
            shouldNormalize ? normalizeArray(input) : input,
            name
          );
        });
      });
      predictButton.disabled = false;
      trainButton.innerText = "train";
      trainButton.disabled = false;
    }, 10);
  }
});

let sortedClassifications, filteredSortedClassifications, weights, results;
const topPredictionSpan = document.getElementById("topPrediction");
async function predict(mfcc) {
  let message;

  results = await classifier.classify(
    shouldNormalize ? normalizeArray(mfcc) : mfcc
  );
  const { classIndex, label, confidencesByLabel, confidences } = results;
  topPredictionSpan.innerText = label;
  sortedClassifications = classifications.toSorted(
    (a, b) => confidences[b.index] - confidences[a.index]
  );
  filteredSortedClassifications = sortedClassifications.filter(
    (classification) => confidences[classification.index] > 0
  );
  message = interpolateAllConstrictions();
  message.intensity = Math.min(getInterpolation(0, 0.2, _rms), 1);
  console.log(message.intensity);

  if (message) {
    throttledSendToPinkTrombone(message);
    throttledSendToGame();
  }

  _drawMFCC(
    sortedClassifications[0].inputs[0],
    "green",
    mfccCanvas,
    mfccContext
  );

  classificationsContainer
    .querySelectorAll(".classification")
    .forEach((div) => {
      div.updateSpans();

      const { classification } = div;
      if (sortedClassifications[0] == classification) {
        div.classList.add("prediction");
      } else {
        div.classList.remove("prediction");
      }
    });
}
const predictThrottled = throttle(predict, 100); //ms of prediction time

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
function interpolateAllConstrictions() {
  const constriction = {};
  filteredSortedClassifications.forEach((classification) => {
    const weight = results.confidences[classification.index];
    for (const type in classification.outputs) {
      const value = weight * classification.outputs[type];
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

let shouldSendToPinkTrombone = true;
let shouldSendToGame = false;
let shouldSendToVVVV = false;
const throttledSendToPinkTrombone = throttle((message) => {
  if (shouldSendToPinkTrombone) {
    send({ to: ["pink-trombone"], type: "message", ...message });
  }
}, 20);
const throttledSendToVVVV = throttle((message) => {
  if (shouldSendToVVVV) {
    send({ to: ["vvvv"], type: "message", ...message });
  }
}, 20);
const throttledSendToGame = throttle(() => {
  if (shouldSendToGame) {
    const _results = [];
    filteredSortedClassifications.forEach(({ name, index }) => {
      _results.push({ name, weight: results.confidences[index] });
    });
    send({ to: ["game"], type: "message", results: _results, rms: _rms });
  }
}, 20);

const clearLocalStorageButton = document.getElementById("clearLocalstorage");
clearLocalStorageButton.addEventListener("click", (event) => {
  localStorage.clear();
  clearLocalStorageButton.disabled = true;
  loadClassificationsFromLocalStorageButton.disabled = true;
  downloadLocalstorageButton.disabled = true;
  classificationsContainer
    .querySelectorAll(".classification")
    .forEach((div) => div.remove());
});

const loadClassificationsFromLocalStorageButton = document.getElementById(
  "loadClassificationsFromLocalstorage"
);
loadClassificationsFromLocalStorageButton.addEventListener("click", (event) => {
  for (
    let index = 0;
    index < localStorage.length && localStorage[index];
    index++
  ) {
    const { inputs, outputs, name } = JSON.parse(localStorage[index]);
    appendClassification({ inputs, outputs, name });
  }
  loadClassificationsFromLocalStorageButton.disabled = true;
});

let classifications = [];
function appendClassification({ inputs, outputs, name }) {
  const classification = {
    inputs,
    outputs,
    index: classifications.length,
    name,
  };
  appendClassificationView(classification);
  classifications.push(classification);
  trainButton.disabled = false;
  //console.log("added classification", classification);
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

let maxDataPerClassification = 100;
const classificationsContainer = document.getElementById("classifications");
const classificationsContainerTemplate =
  classificationsContainer.querySelector("template");
function appendClassificationView(classification) {
  const container = classificationsContainerTemplate.content
    .cloneNode(true)
    .querySelector("div");

  container.classification = classification;
  classification.container = container;

  const nameInput = container.querySelector(".name");
  nameInput.value = classification.name || "";
  nameInput.addEventListener("input", (event) => {
    classification.name = event.target.value;
    save();
  });
  const rankingSpan = container.querySelector(".ranking");
  const percentageSpan = container.querySelector(".percentage");
  const numberOfSamplesSpan = container.querySelector(".numberOfSamples");
  const sampleIndexSpan = container.querySelector(".sampleIndex");
  numberOfSamplesSpan.innerText = classification.inputs.length;
  container.updateSpans = () => {
    const confidence = results.confidences[classification.index];
    percentageSpan.innerText = `${Math.round(confidence * 100)}%`;
    rankingSpan.innerText = sortedClassifications.indexOf(classification) + 1;
  };
  const updateSampleSpans = () => {
    sampleIndexSpan.innerText =
      classification.inputs.length > 0 ? selectedSampleIndex + 1 : 0;
    numberOfSamplesSpan.innerText = classification.inputs.length;

    classification.selectedInputIndex = selectedSampleIndex;
  };

  const ptButton = container.querySelector(".pt");
  ptButton.addEventListener("click", () => {
    throttledSendToPinkTrombone(classification.outputs);
  });
  const canvas = container.querySelector("canvas");
  const context = canvas.getContext("2d");
  let selectedSampleIndex = 0;
  updateSampleSpans();
  const drawCanvas = () => {
    drawMFCC(classification.inputs[selectedSampleIndex], canvas, context);
  };
  drawCanvas();
  canvas.addEventListener("mousemove", (event) => {
    const x = event.offsetX / canvas.clientWidth;
    let newSampleIndex = Math.floor(x * classification.inputs.length);
    if (newSampleIndex != selectedSampleIndex) {
      selectedSampleIndex = newSampleIndex;
      updateSampleSpans();
      drawCanvas();
    }
  });
  const save = () => {
    const { inputs, outputs, name } = classification;
    localStorage[classifications.indexOf(classification)] = JSON.stringify({
      inputs,
      outputs,
      name,
    });
  };
  const addDataButton = container.querySelector(".addData");
  container.collectClassificationsFlag = false;
  addDataButton.addEventListener("click", (event) => {
    container.collectClassificationsFlag =
      !container.collectClassificationsFlag;
  });
  const addData = (mfcc) => {
    if (classification.inputs.length < maxDataPerClassification) {
      classification.inputs.push(mfcc.slice());
      save();
      selectedSampleIndex = classification.inputs.length - 1;
      updateSampleSpans();
      drawCanvas();
    }
  };
  container.addData = throttle((mfcc) => {
    addData(mfcc);
  }, 50);
  const rePTButton = container.querySelector(".rePT");
  rePTButton.addEventListener("click", () => {
    classification.outputs = constrictions.getData();
    classification.outputs.voiceness = voiceness;
    save();
  });
  const clearButton = container.querySelector(".clear");
  clearButton.addEventListener("click", (event) => {
    classification.inputs.length = 0;
    selectedSampleIndex = 0;
    updateSampleSpans();
    save();
    drawCanvas();
    refreshLocalstorage();
    event.stopPropagation();
  });
  const deleteButton = container.querySelector(".delete");
  deleteButton.addEventListener("click", (event) => {
    container.remove();
    classifications.splice(classifications.indexOf(classification), 1);
    refreshLocalstorage();
    deselect();
    event.stopPropagation();
  });

  container.addEventListener("click", (event) => {
    if (selectedClassification != classification) {
      if (selectedClassificationContainer) {
        selectedClassificationContainer.classList.remove("selected");
      }
      selectedClassification = classification;
      //console.log("selected classification", selectedClassification);
      selectedClassificationContainer = container;
      selectedClassificationContainer.classList.add("selected");
    }
    event.stopPropagation();
  });
  classificationsContainer.appendChild(container);
}

document.body.addEventListener("click", (e) => {
  deselect();
});

function refreshLocalstorage() {
  localStorage.clear();
  classifications.forEach((classification, index) => {
    const { inputs, outputs, name } = classification;
    classification.index = index;
    localStorage[index] = JSON.stringify({ inputs, outputs, name });
  });
}

function deselect() {
  if (selectedClassificationContainer) {
    selectedClassificationContainer.classList.remove("selected");
  }
  selectedClassification = selectedClassificationContainer = null;
}

const uploadClassificationsInput = document.getElementById(
  "uploadClassifications"
);
uploadClassificationsInput.addEventListener("input", (event) =>
  uploadClassifications(event)
);
function uploadClassifications(event) {
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
  jsons.forEach((classifications) => {
    console.log(classifications);
    classifications.forEach((classification) => {
      appendClassification(classification);
      localStorage[localStorage.length] = JSON.stringify(classification);
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
  for (
    let index = 0;
    index < localStorage.length && localStorage[index];
    index++
  ) {
    json.push(JSON.parse(localStorage[index]));
  }
  console.log(json);
  var dataString =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json));
  downloadLink.setAttribute("href", dataString);
  downloadLink.setAttribute(
    "download",
    `knn-${new Date().toLocaleString()}.json`
  );
  downloadLink.click();
}

document.addEventListener("keydown", (event) => {
  if (selectedClassification && classifications.length > 1) {
    const index = classifications.indexOf(selectedClassification);
    let shouldPreventDefault = true;
    let indicesToSwap;
    switch (event.key) {
      case "ArrowDown":
        const isFirst = index == 0;
        if (!isFirst) {
          indicesToSwap = [index, index - 1];
        }
        event.preventDefault();
        break;
      case "ArrowUp":
        const isLast = index == classifications.length - 1;
        if (!isLast) {
          indicesToSwap = [index, index + 1];
        }
        event.preventDefault();
        break;
      default:
        shouldPreventDefault = false;
        break;
    }
    if (shouldPreventDefault) {
      event.preventDefault();
    }
    if (indicesToSwap) {
      const [fromIndex, toIndex] = indicesToSwap;
      [classifications[fromIndex], classifications[toIndex]] = [
        classifications[toIndex],
        classifications[fromIndex],
      ];
      const fromClassification = classifications[fromIndex];
      const toClassification = classifications[toIndex];
      fromClassification.index = fromIndex;
      toClassification.index = toIndex;
      const fromContainer = fromClassification.container;
      const toContainer = toClassification.container;
      if (fromIndex < toIndex) {
        fromContainer.parentNode.insertBefore(fromContainer, toContainer);
      } else {
        toContainer.parentNode.insertBefore(toContainer, fromContainer);
      }
      refreshLocalstorage();
    }
  }
});
