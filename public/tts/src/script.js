/* global setupWebsocket, TextToIPA, phonemes */

const { send } = setupWebsocket("tts", (message) => {});

let speed = 1;
const speedInput = document.getElementById("speed");
speedInput.addEventListener("input", (event) => {
  speed = Number(event.target.value);
  //console.log("speed", speed);
});

const downloadButton = document.getElementById("download");
downloadButton.addEventListener("click", () => {
  const utterance = getUtterance();
  utterance.keyframes.forEach((keyframe) => {
    if (!("frequency" in keyframe)) {
      keyframe.frequency = 140;
    }
  });
  downloadJSON([utterance]);
});

const downloadLink = document.getElementById("downloadLink");
function downloadJSON(json) {
  console.log("downloading", json);
  var dataString =
    "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json));
  downloadLink.setAttribute("href", dataString);
  downloadLink.setAttribute(
    "download",
    `tts-${new Date().toLocaleString()}.json`
  );
  downloadLink.click();
}

const playButton = document.getElementById("play");
playButton.addEventListener("click", () => {
  const utterance = getUtterance();
  throttledSend({ utterance });
});

const getUtterance = () => {
  const utterance = { name: finalString, keyframes: renderKeyframes() };
  console.log("utterance", utterance);
  return utterance;
};

const renderKeyframes = (time = 0, frequency = 140) => {
  const keyframes = [];
  resultsContainer.querySelectorAll(".result").forEach((resultContainer) => {
    const _keyframes = resultContainer.renderKeyframes(time, frequency);
    time = _keyframes[_keyframes.length - 1].time;
    frequency = _keyframes[_keyframes.length - 1].frequency;
    keyframes.push(..._keyframes);
  });
  keyframes.push({
    name: ".",
    time: time + releaseTime / speed,
    frequency,
    intensity: 0,
  });
  return keyframes;
};

const inputTypes = ["word", "ipa"];
let inputType = inputTypes[0];
const inputTypeSelect = document.getElementById("inputType");
const inputTypeSelectOptgroup = inputTypeSelect.querySelector("optgroup");
inputTypes.forEach((inputType) => {
  const option = new Option(inputType);
  inputTypeSelectOptgroup.appendChild(option);
});
inputTypeSelect.addEventListener("input", (event) => {
  inputType = event.target.value;
  console.log("new input type", inputType);
});
const validTextSpan = document.getElementById("validText");
const textInput = document.getElementById("text");
const results = [];
let finalString = "";
textInput.addEventListener("input", (event) => {
  const strings = event.target.value.split(" ");
  results.length = 0;
  resultsContainer.innerHTML = "";

  const validTextStrings = [];
  strings.forEach((string) => {
    if (string.length > 0) {
      if (inputType == "word") {
        const ipas = TextToIPA._IPADict[string];
        if (ipas) {
          validTextStrings.push(string);
          results.push(ipas);
          //console.log("ipas", index, ipas);
        }
      } else {
        string = string.replace("'", "ˈ");
        const words = TextToIPA._WordDict[string];
        if (words) {
          validTextStrings.push(string);
          results.push(words);
          //console.log("words", index, words);
        }
      }
    }
  });

  //console.log("results", results);

  if (results.length > 0 && validTextStrings.length > 0) {
    finalString = validTextStrings.join(" ");
    validTextSpan.innerText = finalString;
    playButton.disabled = false;
    downloadButton.disabled = false;
  } else {
    validTextSpan.innerText = "";
    playButton.disabled = true;
    downloadButton.disabled = true;
  }

  clearResultContainers();
  if (results.length > 0) {
    results.forEach((alternatives) => {
      if (alternatives.length > 0) {
        const resultContainer = getResultContainer(alternatives);
      }
    });
  }
});

const resultsContainer = document.getElementById("results");
const resultTemplate = document.getElementById("resultTemplate");
const alternativeTemplate = document.getElementById("alternativeTemplate");
const phonemeTemplate = document.getElementById("phonemeTemplate");
const getResultContainer = (alternatives) => {
  let resultContainer = Array.from(
    resultsContainer.querySelectorAll(".result")
  ).find((resultContainer) => resultContainer.style.display == "none");
  if (!resultContainer) {
    resultContainer = createResultContainer();
  }
  resultContainer.setAlternatives(alternatives);
  resultContainer.style.display = "";
  return resultContainer;
};
let holdTimes = {
  ˈ: 0.05,
  ˌ: 0.05,
};
let consonantHoldTime = 0.05;
let timeBetweenSubResults = 0.1; // seconds
let spaceTime = 0;
let releaseTime = 0.1;
let timeBetweenPhonemes = 0.1;
let timeBetweenSubPhonemes = 0.1;
let defaultVoiceness = 0.8;
let defaultVoiceless = 0.2;
const createResultContainer = () => {
  const resultContainer = resultTemplate.content
    .cloneNode(true)
    .querySelector(".result");

  let alternatives;
  let alternative;

  const resultContainerIndex = resultsContainer.childElementCount;

  const alternativesContainer = resultContainer.querySelector(".alternatives");

  const playButton = resultContainer.querySelector(".play");
  playButton.addEventListener("click", () => {
    const utterance = { name: alternative, keyframes: renderKeyframes() };
    let time = utterance.keyframes[utterance.keyframes.length - 1].time;
    utterance.keyframes.push({
      name: ".",
      time: time + releaseTime / speed,
      intensity: 0,
    });
    console.log("utterance", utterance);
    throttledSend({ utterance });
  });

  resultContainer.setAlternatives = (_alternatives) => {
    alternatives = _alternatives;
    alternativesContainer.innerHTML = "";
    alternatives.forEach((alternative, index) => {
      const alternativeContainer = alternativeTemplate.content
        .cloneNode(true)
        .querySelector(".alternative");
      const alternativeSpan = alternativeContainer.querySelector("span");
      alternativeSpan.innerText = alternative;
      const alternativeRadio = alternativeContainer.querySelector(
        "input[type='radio']"
      );
      alternativeRadio.checked = index == 0;
      alternativeRadio.name = resultContainerIndex;
      alternativeRadio.addEventListener("input", (event) => {
        setAlternative(alternative);
      });
      setAlternative(alternatives[0]);
      alternativesContainer.appendChild(alternativeContainer);
    });
  };

  const phonemesContainer = resultContainer.querySelector(".phonemes");
  const keyframes = [];
  const setAlternative = (_alternative) => {
    alternative = _alternative;
    //console.log("setting alternative", alternative);
    phonemesContainer.innerHTML = "";

    keyframes.length = 0;

    [...alternative].forEach((phoneme, index) => {
      if (phoneme == "ˈ" || phoneme == "ˌ") {
        return;
      }
      let nextPhoneme = alternative[index + 1];

      const _keyframes = [];

      let offsetTime = 0.1;
      let holdTime = 0;

      const setOffsetTime = (_offsetTime) => {
        offsetTime = _offsetTime;
        const keyframe = _keyframes[0];
        if (keyframe) {
          keyframe.timeDelta = offsetTime;
        }
      };
      const setHoldTime = (_holdTime) => {
        holdTime = _holdTime;
        const holdKeyframe = _keyframes.find((keyframe) => keyframe.isHold);
        if (holdKeyframe) {
          holdKeyframe.timeDelta = holdTime;
        }
      };

      if (phoneme in phonemes) {
        const { type, voiced, constrictions } = phonemes[phoneme];
        if (type == "consonant") {
          holdTime = consonantHoldTime;
        }
        constrictions.forEach((constriction, index) => {
          let name = phoneme;
          if (constrictions.length > 1) {
            name += `(${index})`;
          }

          const keyframe = {
            intensity: 1,
            name,
            timeDelta:
              index == constrictions.length - 1
                ? timeBetweenPhonemes
                : timeBetweenSubPhonemes,
            "frontConstriction.diameter": 5,
            "backConstriction.diameter": 5,
          };

          let voiceness = defaultVoiceness;
          if (type == "consonant") {
            voiceness = voiced ? defaultVoiceness : defaultVoiceless;
          }
          Object.assign(keyframe, deconstructVoiceness(voiceness));

          for (const key in constriction) {
            for (const subKey in constriction[key]) {
              let string = key;
              if (key != "tongue") {
                string += "Constriction";
              }
              string += `.${subKey}`;
              keyframe[string] = constriction[key][subKey];
            }
          }
          _keyframes.push(keyframe);

          const holdKeyframe = Object.assign({}, keyframe);
          holdKeyframe.isHold = true;
          holdKeyframe.timeDelta = holdTime;
          holdKeyframe.name = `${holdKeyframe.name}]`;
          _keyframes.push(holdKeyframe);

          if (type == "consonant" && !voiced) {
            // add keyframe after first to change to voiced
            Object.assign(
              _keyframes[0],
              deconstructVoiceness(defaultVoiceness)
            );
            _keyframes[0].intensity = 0;
            const voicedToVoicelessKeyframe = Object.assign({}, _keyframes[0]);
            voicedToVoicelessKeyframe.name = `{${voicedToVoicelessKeyframe.name}`;
            voicedToVoicelessKeyframe.isHold = false;
            voicedToVoicelessKeyframe.timeDelta = 0.001;
            voicedToVoicelessKeyframe.intensity = 0.8;
            Object.assign(
              voicedToVoicelessKeyframe,
              deconstructVoiceness(defaultVoiceless)
            );
            _keyframes.splice(1, 0, voicedToVoicelessKeyframe);

            // add keyframe after last to change back to voiced
            const voicelessToVoicedKeyframe = Object.assign(
              {},
              _keyframes[_keyframes.length - 1]
            );
            voicelessToVoicedKeyframe.timeDelta = 0.001;
            voicelessToVoicedKeyframe.name = `${voicelessToVoicedKeyframe.name}}`;
            voicelessToVoicedKeyframe.isHold = false;

            //voicelessToVoicedKeyframe.intensity = 0;
            Object.assign(
              voicelessToVoicedKeyframe,
              deconstructVoiceness(defaultVoiceness)
            );
            _keyframes.push(voicelessToVoicedKeyframe);
          }
        });
      }
      if (nextPhoneme == "ˈ" || nextPhoneme == "ˌ") {
        holdTime = holdTimes[nextPhoneme];
      }

      keyframes.push(..._keyframes);

      const phonemeContainer = phonemeTemplate.content
        .cloneNode(true)
        .querySelector(".phoneme");

      phonemeContainer
        .querySelectorAll("[name='pitchCurve']")
        .forEach((pitchCurveRadio) => {
          pitchCurveRadio.name = `pitchCurve-${resultContainerIndex}-${index}`;
          pitchCurveRadio.addEventListener("input", () => {
            const pitchCurve = pitchCurveRadio.value;
            const pitchedKeyframe = _keyframes[0]; // FIX?
            if (pitchedKeyframe) {
              pitchedKeyframe.pitchCurve = pitchCurve;
            }
          });
        });

      const offsetInput = phonemeContainer.querySelector(".offset");
      offsetInput.addEventListener("input", (event) => {
        setOffsetTime(Number(event.target.value));
      });
      if (offsetTime > 0) {
        offsetInput.value = offsetTime;
      }
      const holdInput = phonemeContainer.querySelector(".hold");
      holdInput.addEventListener("input", (event) => {
        setHoldTime(Number(event.target.value));
      });
      if (holdTime > 0) {
        holdInput.value = holdTime;
      }

      phonemeContainer.querySelector(".text").innerText = phoneme;
      phonemesContainer.appendChild(phonemeContainer);
    });
    //console.log("keyframes", keyframes);
  };
  const renderKeyframes = (time = 0, frequency = 140) => {
    const _keyframes = [];
    keyframes.forEach((keyframe) => {
      const _keyframe = Object.assign({}, keyframe);
      if (_keyframe.timeDelta > 0) {
        time += _keyframe.timeDelta / speed;
        _keyframe.time = time;
        if ("pitchCurve" in keyframe) {
          switch (keyframe.pitchCurve) {
            case "rising":
              frequency *= 2 ** (5 / 12); // FIX
              break;
            case "falling":
              frequency /= 2 ** (5 / 12); // FIX
              break;
          }
        }
        _keyframe.frequency = frequency;
        delete _keyframe.timeDelta;
        _keyframes.push(_keyframe);
      }
    });
    return _keyframes;
  };
  resultContainer.renderKeyframes = renderKeyframes;

  resultsContainer.appendChild(resultContainer);
  return resultContainer;
};
const removeResultContainer = (resultContainer) => {
  resultContainer.style.display = "none";
};
const clearResultContainers = () => {
  resultsContainer
    .querySelectorAll(".result")
    .forEach((resultContainer) => removeResultContainer(resultContainer));
};

const throttledSend = throttle((message) => {
  send({
    to: ["pink-trombone"],
    type: "message",
    ...message,
  });
}, 100);
