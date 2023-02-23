/* global setupWebsocket, setupPocketSphinx */

const { send } = setupWebsocket("phoneme", (message) => {
  // FILL
});

setupPocketSphinx((hyp) => {
  //console.log(hyp);
});
