exports = {};

const recordButton = document.getElementById("record");

// From a series of URL to js files, get an object URL that can be loaded in an
// AudioWorklet. This is useful to be able to use multiple files (utils, data
// structure, main DSP, etc.) without either using static imports, eval, manual
// concatenation with or without a build step, etc.
function URLFromFiles(files) {
  const promises = files.map((file) =>
    fetch(file).then((response) => response.text())
  );

  return Promise.all(promises).then((texts) => {
    texts.unshift("var exports = {};"); // hack to make injected umd modules work
    const text = texts.join("");
    const blob = new Blob([text], { type: "application/javascript" });

    return URL.createObjectURL(blob);
  });
}

let AudioContext;
// global var for web audio API AudioContext
let audioCtx;
let bufferSize = 2 ** 10;
let hopSize = 2 ** 9;
let melNumBands = 30;

try {
  AudioContext = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContext();
} catch (e) {
  throw "Could not instantiate AudioContext: " + e.message;
}

// global var getUserMedia mic stream
let gumStream;
// global audio node variables
let mic;
let gain;
let melspectrogramNode;
let splitter;

// Shared data with AudioWorkletGlobalScope
let audioReader;

let animationLoopId;

// Utils:
function arraySum(total, num) {
  return total + num;
}

function onRecordClickHandler() {
  let recording = recordButton.classList.contains("recording");
  if (!recording) {
    recordButton.disabled = true;
    // start microphone stream using getUserMedia and runs the feature extraction
    startMicRecordStream();
  } else {
    stopMicRecordStream();
  }
}

// record native microphone input and do further audio processing on each audio buffer using the given callback functions
function startMicRecordStream() {
  if (navigator.mediaDevices.getUserMedia) {
    console.log("Initializing audio...");
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          noiseSuppression: false,
          //autoGainControl: false,
          //echoCancellation: false,
        },
      })
      .then(startAudioProcessing)
      .catch(function (message) {
        throw "Could not access microphone - " + message;
      });
  } else {
    throw "Could not access microphone - getUserMedia not available";
  }
}

function startAudioProcessing(stream) {
  gumStream = stream;
  if (gumStream.active) {
    // In most platforms where the sample rate is 44.1 kHz or 48 kHz,
    // and the default bufferSize will be 4096, giving 10-12 updates/sec.
    if (audioCtx.state == "closed") {
      audioCtx = new AudioContext();
    } else if (audioCtx.state == "suspended") {
      audioCtx.resume();
    }

    mic = audioCtx.createMediaStreamSource(gumStream);
    gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0, audioCtx.currentTime);

    let codeForProcessorModule = [
      "./src/essentia-wasm.umd.js",
      "./src/essentia.js-extractor.umd.js",
      "./src/melspectrogram-processor.js",
      "./src/ringbuf.js",
    ];

    // inject Essentia.js code into AudioWorkletGlobalScope context, then setup audio graph and start animation
    URLFromFiles(codeForProcessorModule)
      .then((concatenatedCode) => {
        audioCtx.audioWorklet
          .addModule(concatenatedCode)
          .then(setupAudioGraph)
          .catch(function moduleLoadRejected(msg) {
            console.log(
              `There was a problem loading the AudioWorklet module code: \n ${msg}`
            );
          });
      })
      .catch((msg) => {
        console.log(
          `There was a problem retrieving the AudioWorklet module code: \n ${msg}`
        );
      });

    // set button to stop
    recordButton.classList.add("recording");
    recordButton.innerText = "stop recording";
    recordButton.disabled = false;
  } else {
    throw "Mic stream not active";
  }
}

function setupAudioGraph() {
  // 50ms of buffer, increase in case of glitches
  let sab = exports.RingBuffer.getStorageForCapacity(
    melNumBands * 18,
    Float32Array
  );
  let rb = new exports.RingBuffer(sab, Float32Array);
  audioReader = new exports.AudioReader(rb);

  melspectrogramNode = new AudioWorkletNode(
    audioCtx,
    "melspectrogram-processor",
    {
      processorOptions: {
        bufferSize: bufferSize,
        hopSize: hopSize,
        melNumBands: melNumBands,
        sampleRate: audioCtx.sampleRate,
      },
    }
  );

  try {
    melspectrogramNode.port.postMessage({
      sab: sab,
    });
  } catch (_) {
    alert("No SharedArrayBuffer tranfer support, try another browser.");
    recordButton.removeEventListener("click", onRecordClickHandler);
    recordButton.disabled = true;
    return;
  }

  // It seems necessary to connect the stream to a sink for the pipeline to work, contrary to documentataions.
  // As a workaround, here we create a gain node with zero gain, and connect temp to the system audio output.
  mic.connect(melspectrogramNode);
  melspectrogramNode.connect(gain);
  gain.connect(audioCtx.destination);

  requestAnimationFrame(animateSpectrogram); // start plot animation
}

let animationStart;
let elapsed;
// draw melspectrogram frames
function animateSpectrogram(timestamp) {
  if (animationStart === undefined) animationStart = timestamp;
  elapsed = timestamp - animationStart;
  animationLoopId = requestAnimationFrame(animateSpectrogram);

  /* SAB method */
  let melspectrumBuffer = new Float32Array(melNumBands);
  if (audioReader.available_read() >= melNumBands) {
    let toread = audioReader.dequeue(melspectrumBuffer);
    if (toread !== 0) {
      // scale spectrum values to [0-255]
      let scaledMelspectrum = melspectrumBuffer.map((x) => x * 35.5);
      onMFCC(scaledMelspectrum);
    }
  }
}

function stopMicRecordStream() {
  if (animationLoopId) {
    cancelAnimationFrame(animationLoopId);
  }

  // stop mic stream
  gumStream.getAudioTracks().forEach(function (track) {
    track.stop();
    gumStream.removeTrack(track);
  });

  audioCtx.close().then(function () {
    // manage button state
    recordButton.classList.remove("recording");
    recordButton.innerText = "start recording";

    // disconnect nodes
    mic.disconnect();
    melspectrogramNode.disconnect();
    gain.disconnect();
    mic = undefined;
    melspectrogramNode = undefined;
    gain = undefined;

    console.log("Stopped recording ...");
  });
}

try {
  const testSAB = new SharedArrayBuffer(1);
  delete testSAB;
  // add event listeners to ui objects
  recordButton.addEventListener("click", onRecordClickHandler);
  recordButton.disabled = false;
} catch (e) {
  if (e instanceof ReferenceError && !crossOriginIsolated) {
    recordButton.disabled = true;
    // redirect to cross-origin isolated SAB-capable version on Netlify
    //window.location = "https://essentiajs-melspectrogram.netlify.app";
  }
}
