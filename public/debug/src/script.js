/* global setupWebsocket */

const { send } = setupWebsocket("debug", (message) => {
  if (message.from == "pink-trombone") {
    updateUI(message);
  }
});

const throttledSend = throttle((message) => {
  send({
    to: ["pink-trombone", "machine-learning", "mfcc"],
    type: "message",
    ...message,
  });
}, 100);

const tongueElements = {
  index: document.getElementById("tongueIndex"),
  diameter: document.getElementById("tongueDiameter"),
};
for (const type in tongueElements) {
  const element = tongueElements[type];
  element.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    throttledSend({ [`tongue.${type}`]: value });
  });
}
const frontConstrictionElements = {
  index: document.getElementById("frontConstriction.index"),
  diameter: document.getElementById("frontConstriction.diameter"),
};
for (const type in frontConstrictionElements) {
  const element = frontConstrictionElements[type];
  element.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    throttledSend({ [`frontConstriction.${type}`]: value });
  });
}
const backConstrictionElements = {
  index: document.getElementById("backConstriction.index"),
  diameter: document.getElementById("backConstriction.diameter"),
};
for (const type in backConstrictionElements) {
  const element = backConstrictionElements[type];
  element.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    throttledSend({ [`backConstriction.${type}`]: value });
  });
}
function updateElements(
  { index: indexElement, diameter: diameterElement },
  { index, diameter }
) {
  indexElement.value = index;
  diameterElement.value = diameter;
}
function updateUI(message) {
  const { constrictions } = message;
  if (constrictions) {
    const { tongue, frontConstriction, backConstriction } = constrictions;
    if (tongue) {
      updateElements(tongueElements, tongue);
    }
    if (frontConstriction) {
      updateElements(frontConstrictionElements, frontConstriction);
    }
    if (backConstriction) {
      updateElements(backConstrictionElements, backConstriction);
    }
  }
}

const trackElements = {
  frequency: document.getElementById("frequency"),
  voiceness: document.getElementById("voiceness"),
  intensity: document.getElementById("intensity"),
};
for (const type in trackElements) {
  const element = trackElements[type];
  element.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    throttledSend({ [type]: value });
  });
}

const phonemeSelect = document.getElementById("phoneme");
const consonantsOptgroup = document.getElementById("consonants");
const vowelsOptgroup = document.getElementById("vowels");
for (const phoneme in phonemes) {
  const { example, type } = phonemes[phoneme];
  const option = new Option(`${phoneme} (${example})`, phoneme);
  const optgroup = type == "consonant" ? consonantsOptgroup : vowelsOptgroup;
  optgroup.appendChild(option);
}
phonemeSelect.addEventListener("input", (event) => {
  const phoneme = event.target.value;
  if (phoneme.length > 0) {
    throttledSend({ phoneme });
    event.target.value = "";
  }
});

const utteranceSelect = document.getElementById("utterance");
utterances.forEach(({ name }, index) => {
  const option = new Option(name, index);
  utteranceSelect.appendChild(option);
});
utteranceSelect.addEventListener("input", (event) => {
  const utterance = event.target.value;
  if (utterance.length > 0) {
    throttledSend({ utterance });
    event.target.value = "";
  }
});
