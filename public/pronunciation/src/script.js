const { send } = setupWebsocket("pronunciation", (message) => {
  if (message.from == "knn") {
    const { results } = message;
    const { name, weight } = results[0];
    // FILL 3 - highlight phonemes as they're said
  }
});

const throttledSend = throttle((message) => {
  send({
    to: ["pink-trombone"],
    type: "message",
    ...message,
  });
}, 10);

const wordInput = document.getElementById("word");
let word, pronunciations;
let selectedPronunciation = 0;
wordInput.addEventListener("input", (event) => {
  word = event.target.value;
  pronunciations = TextToIPA._IPADict[word] || [];
  updatePronunciations();
  setPronunciation(pronunciations[0]);
  playButton.style.display = pronunciations.length == 0 ? "none" : "";
});

const pronunciationsContainer = document.getElementById("pronunciations");
const pronunciationTemplate = pronunciationsContainer.querySelector("template");
const updatePronunciations = () => {
  pronunciationsContainer.innerHTML = "";
  pronunciations.forEach((pronunciation, index) => {
    const pronunciationContainer = pronunciationTemplate.content
      .cloneNode(true)
      .querySelector(".pronunciation");
    pronunciationContainer.querySelector("span").innerText = pronunciation;

    const input = pronunciationContainer.querySelector("input");
    input.value = pronunciation;
    if (index == 0) {
      input.checked = true;
    }
    input.addEventListener("input", (event) => {
      setPronunciation(event.target.value);
    });
    pronunciationsContainer.appendChild(pronunciationContainer);
  });
};

let highlightedPhoneme;
let debouncedSilence = debounce(() => {
  if (!highlightedPhoneme) {
    throttledSend({ intensity: 0 });
  }
}, 50);

let playPhonemeOnHover = true;

const phonemesContainer = document.getElementById("phonemes");
const setPronunciation = (pronunciation) => {
  selectedPronunciation = pronunciation;
  console.log("selectedPronunciation", selectedPronunciation);

  phonemesContainer.innerHTML = "";
  if (pronunciation) {
    const trimmedPronunciation = trimPronunciation(pronunciation);
    Array.from(trimmedPronunciation).forEach((phoneme, index) => {
      const span = document.createElement("span");
      span.innerText = phoneme;
      span.addEventListener("mouseenter", () => {
        span.classList.add("highlighted");
        highlightedPhoneme = phoneme;
      });
      span.addEventListener("mouseleave", () => {
        span.classList.remove("highlighted");
        highlightedPhoneme = undefined;
      });
      span.addEventListener("mouseenter", () => {
        if (playPhonemeOnHover) {
          throttledSend({ phoneme, intensity: 1 });
        }
      });
      span.addEventListener("mouseleave", () => {
        if (playPhonemeOnHover) {
          debouncedSilence();
        }
      });

      span.addEventListener("mousedown", () => {
        if (!playPhonemeOnHover) {
          throttledSend({ phoneme, intensity: 1 });
        }
      });
      span.addEventListener("mouseup", () => {
        if (!playPhonemeOnHover) {
          throttledSend({ intensity: 0 });
        }
      });

      phonemesContainer.appendChild(span);
    });
  }
};

const playButton = document.getElementById("play");
playButton.addEventListener("click", () =>
  playPronunciation(selectedPronunciation)
);

const playPronunciation = (pronunciation) => {
  let keyframes = generateKeyframes(pronunciation);
  keyframes = RenderKeyframes(keyframes);
  const utterance = { name: word, keyframes };
  throttledSend({ utterance });
  // FILL 2 - send to pink trombone
};

let holdTimes = {
  ˈ: 0.05,
  ˌ: 0.05,
  ".": 0.05,
};
let consonantHoldTime = 0.05;
let timeBetweenSubResults = 0.1; // seconds
let spaceTime = 0;
let releaseTime = 0.1;
let timeBetweenPhonemes = 0.1;
let timeBetweenSubPhonemes = 0.05;
let defaultVoiceness = 0.8;
let defaultVoiceless = 0.2;
