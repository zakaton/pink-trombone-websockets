/** @type {HTMLCanvasElement} */
const mfccCanvas = document.getElementById("mfcc");
const mfccContext = mfccCanvas.getContext("2d");
let mfccDrawRange = 255;

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
    context.beginPath();
    context.moveTo(index * segmentLength, height);
    context.lineTo((index + 1) * segmentLength, height);
    context.stroke();
  });
}

const onMFCC = (mfcc) => {
  drawMFCC(mfcc, mfccCanvas, mfccContext);
};
