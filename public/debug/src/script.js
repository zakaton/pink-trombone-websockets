/* global setupWebsocket */

const { send } = setupWebsocket("debug", (message) => {
  if (message.from == "pinktrombone") {
    updateUI(message);
  }
});

const throttledSend = throttle((message) => {
  send({ to: ["pinktrombone"], type: "message", ...message });
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
  index: document.getElementById("frontConstrictionIndex"),
  diameter: document.getElementById("frontConstrictionDiameter"),
};
for (const type in frontConstrictionElements) {
  const element = frontConstrictionElements[type];
  element.addEventListener("input", (event) => {
    const value = Number(event.target.value);
    throttledSend({ [`frontConstriction.${type}`]: value });
  });
}
const backConstrictionElements = {
  index: document.getElementById("backConstrictionIndex"),
  diameter: document.getElementById("backConstrictionDiameter"),
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
phonemeSelect.addEventListener("input", (event) => {
  const phoneme = event.target.value;
  throttledSend({ phoneme });
});
