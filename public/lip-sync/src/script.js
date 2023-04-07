/*
  TODO
    preset mouths for phonemes
    listen for "phoneme"
    listen for "utterance"
*/

const { send } = setupWebsocket("lip-sync", (message) => {
  const { phoneme, utterance } = message;
  if (phoneme) {
    // FILL
  } else if (utterance) {
    // FILL
  }
});

let morphTargetInfluences, morphTargetDictionary;
const avatar = document.getElementById("avatar");
// avatar.components["gltf-model"].model.animations
avatar.addEventListener("model-loaded", () => {
  ({ morphTargetInfluences, morphTargetDictionary } =
    avatar.components["gltf-model"].model.children[0].children[1]);
  console.log(morphTargetInfluences, morphTargetDictionary);
});

// for reference
/*
const morphTargetDictionary = {
  mouthOpen: 0,
  viseme_sil: 1,
  viseme_PP: 2,
  viseme_FF: 3,
  viseme_TH: 4,
  viseme_DD: 5,
  viseme_kk: 6,
  viseme_CH: 7,
  viseme_SS: 8,
  viseme_nn: 9,
  viseme_RR: 10,
  viseme_aa: 11,
  viseme_E: 12,
  viseme_I: 13,
  viseme_O: 14,
  viseme_U: 15,
  mouthSmile: 16,
  browDownLeft: 17,
  browDownRight: 18,
  browInnerUp: 19,
  browOuterUpLeft: 20,
  browOuterUpRight: 21,
  eyeSquintLeft: 22,
  eyeSquintRight: 23,
  eyeWideLeft: 24,
  eyeWideRight: 25,
  jawForward: 26,
  jawLeft: 27,
  jawRight: 28,
  mouthFrownLeft: 29,
  mouthFrownRight: 30,
  mouthPucker: 31,
  mouthShrugLower: 32,
  mouthShrugUpper: 33,
  noseSneerLeft: 34,
  noseSneerRight: 35,
  mouthLowerDownLeft: 36,
  mouthLowerDownRight: 37,
  mouthLeft: 38,
  mouthRight: 39,
  eyeLookDownLeft: 40,
  eyeLookDownRight: 41,
  eyeLookUpLeft: 42,
  eyeLookUpRight: 43,
  eyeLookInLeft: 44,
  eyeLookInRight: 45,
  eyeLookOutLeft: 46,
  eyeLookOutRight: 47,
  cheekPuff: 48,
  cheekSquintLeft: 49,
  cheekSquintRight: 50,
  jawOpen: 51,
  mouthClose: 52,
  mouthFunnel: 53,
  mouthDimpleLeft: 54,
  mouthDimpleRight: 55,
  mouthStretchLeft: 56,
  mouthStretchRight: 57,
  mouthRollLower: 58,
  mouthRollUpper: 59,
  mouthPressLeft: 60,
  mouthPressRight: 61,
  mouthUpperUpLeft: 62,
  mouthUpperUpRight: 63,
  mouthSmileLeft: 64,
  mouthSmileRight: 65,
  tongueOut: 66,
  eyeBlinkLeft: 67,
  eyeBlinkRight: 68,
  eyesClosed: 69,
  eyesLookUp: 70,
  eyesLookDown: 71,
};
*/
