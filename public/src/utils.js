/**
 * Resumes the audiocontext when it's suspended after a user clicks
 * @param {string} webpageName the name of the webpage this is called from to identify itself
 * @param {function} onMessage is called when the webpage receives websocket messages from the server
 * @returns {object} a send function to send websocket messages to the server
 */
function setupWebsocket(webpageName, onMessage) {
  // Create WebSocket connection.
  const socket = new WebSocket("wss://localhost/");

  // Connection opened
  socket.addEventListener("open", function () {
    send({
      type: "connection",
      webpage: webpageName,
    });
  });

  function send(object) {
    object.from = webpageName;
    socket.send(JSON.stringify(object));
  }

  socket.addEventListener("message", (event) => {
    //console.log("Message from server ", event.data);
    const message = JSON.parse(event.data);
    onMessage(message);
  });

  return { send };
}

/**
 * Resumes the audiocontext when it's suspended after a user clicks
 * @param {AudioContext} audioContext
 */
function autoResumeAudioContext(audioContext) {
  window.audioContext = audioContext;
  const resumeAudioContext = () => {
    console.log(`new audio context state "${audioContext.state}"`);
    if (audioContext.state != "running") {
      document.body.addEventListener("click", () => audioContext.resume(), {
        once: true,
      });
    }
  };
  audioContext.addEventListener("statechange", (e) => {
    resumeAudioContext();
  });
  resumeAudioContext();
}

/**
 * Returns throttle function that gets called at most once every interval.
 *
 * @param {function} functionToThrottle
 * @param {number} minimumInterval - Minimal interval between calls (milliseconds).
 * @param {object} optionalContext - If given, bind function to throttle to this context.
 * @returns {function} Throttled function.
 */
function throttle(functionToThrottle, minimumInterval, optionalContext) {
  var lastTime;
  if (optionalContext) {
    functionToThrottle = module.exports.bind(
      functionToThrottle,
      optionalContext
    );
  }
  return function () {
    var time = Date.now();
    var sinceLastTime =
      typeof lastTime === "undefined" ? minimumInterval : time - lastTime;
    if (typeof lastTime === "undefined" || sinceLastTime >= minimumInterval) {
      lastTime = time;
      functionToThrottle.apply(null, arguments);
    }
  };
}

const phonemes = {
  // FILL - maps IPA to constrictions
  b: {
    voiced: true,
    tongue: {
      index: null,
      diameter: null,
    },
    front: {
      index: null,
      diameter: null,
    },
    back: {
      index: null,
      diameter: null,
    },
  },
};
