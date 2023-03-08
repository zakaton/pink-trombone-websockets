/* global setupWebsocket, autoResumeAudioContext, Pitchy */

const { send } = setupWebsocket("microphone", (message) => {
  // FILL
});

const { PitchDetector } = Pitchy;

let pitch, clarity;
const pitchElement = document.getElementById("pitch");
const clarityElement = document.getElementById("clarity");
function updatePitch() {
  analyserNode.getFloatTimeDomainData(pitchInput);
  [pitch, clarity] = detector.findPitch(pitchInput, audioContext.sampleRate);

  pitchElement.textContent = `${Math.round(pitch * 10) / 10} Hz`;
  clarityElement.textContent = `${Math.round(clarity * 100)} %`;
}

const getInterpolation = (from, to, value) => {
  return (value - from) / (to - from);
};
const clamp = (value, min = 0, max = 1) => {
  return Math.max(min, Math.min(max, value));
};

let volume;
const volumeElement = document.getElementById("volume");
function updateVolume() {
  analyserNode.getByteFrequencyData(volumeInput);

  let sum = 0;
  for (const amplitude of volumeInput) {
    sum += amplitude * amplitude;
  }

  volume = Math.sqrt(sum / volumeInput.length);
  volume = getInterpolation(20, 100, volume);
  volume = clamp(volume, 0, 1);

  volumeElement.textContent = `${Math.round(volume * 100)}%`;
}

let updateInterval = 50;
let volumeThreshold = 0.1;
const throttledSend = throttle(() => {
  send({
    type: "message",
    from: "microphone",
    to: ["vvvv", "pinktrombone"],
    frequency: pitch,
    intensity: volume,
  });
}, updateInterval);
function update() {
  updateVolume();
  updatePitch();
  if (volume > volumeThreshold) {
    throttledSend();
  }
  window.setTimeout(() => update(), updateInterval);
}

let analyserNode, audioContext, detector, pitchInput, volumeInput, stream;
document.addEventListener("DOMContentLoaded", () => {
  audioContext = new window.AudioContext();
  analyserNode = audioContext.createAnalyser();
  audioContext.addEventListener("statechange", (event) => {
    if (audioContext.state == "running" && !stream) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            //echoCancellation: false,
            //noiseSuppression: false,
            //autoGainControl: false,
          },
        })
        .then((_stream) => {
          stream = _stream;
          audioContext.createMediaStreamSource(stream).connect(analyserNode);
          detector = PitchDetector.forFloat32Array(analyserNode.fftSize);
          pitchInput = new Float32Array(detector.inputLength);
          volumeInput = new Uint8Array(detector.inputLength);
          update();
        });
    }
  });
  autoResumeAudioContext(audioContext);
});
