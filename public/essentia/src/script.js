/** @type {HTMLCanvasElement} */
const graphCanvas = document.getElementById("graph");
const graphContext = graphCanvas.getContext("2d");
let graphDrawRange = 255;

graphContext.strokeStyle = "black";
/**
 * @param {number[]} graph
 */
function drawGraph(graph, canvas, context, otherGraph) {
  const { width: w, height: h } = canvas;
  context.clearRect(0, 0, w, h);
  if (otherGraph) {
    _drawGraph(otherGraph, "blue", canvas, context);
  }
  if (graph) {
    _drawGraph(graph, "black", canvas, context);
  }
}

function _drawGraph(graph, color = "black", canvas, context) {
  const { width: w, height: h } = canvas;
  const segmentLength = w / graph.length;
  context.strokeStyle = color;
  graph.forEach((value, index) => {
    let height = 1 - value / graphDrawRange;
    height *= h;
    context.beginPath();
    context.moveTo(index * segmentLength, height);
    context.lineTo((index + 1) * segmentLength, height);
    context.stroke();
  });
}

const onData = ({ melSpectrum, loudness }) => {
  drawGraph(melSpectrum, graphCanvas, graphContext);
};
