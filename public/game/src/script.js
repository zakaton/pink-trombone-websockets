/* global setupWebsocket, THREE */

const vectorOffset = new THREE.Vector3();
const eulerOffset = new THREE.Euler();
const cameraEuler = new THREE.Euler();
let vectorScalar = 0.05;
let eulerScalar = 0.05;
const { send } = setupWebsocket("game", (message) => {
  const { results, rms } = message;
  vectorOffset.set(0, 0, 0);
  eulerOffset.set(0, 0, 0);

  results.forEach(({ name, weight }) => {
    switch (name) {
      case "forward":
        vectorOffset.z = -weight;
        break;
      case "backward":
        vectorOffset.z = weight;
        break;
      case "left":
        eulerOffset.y = weight;
        break;
      case "right":
        eulerOffset.y = -weight;
        break;
      case "up":
        eulerOffset.x = weight;
        break;
      case "down":
        eulerOffset.x = -weight;
        break;
    }
  });

  const rmsScalar = THREE.MathUtils.inverseLerp(0.01, 0.03, rms);

  eulerOffset.x *= rmsScalar * eulerScalar;
  eulerOffset.y *= rmsScalar * eulerScalar;

  camera.object3D.rotation.x += eulerOffset.x;
  camera.object3D.rotation.y += eulerOffset.y;

  vectorOffset.multiplyScalar(rmsScalar * vectorScalar);

  cameraEuler.copy(camera.object3D.rotation);
  cameraEuler.x = cameraEuler.z = 0;
  vectorOffset.applyEuler(cameraEuler);
  camera.object3D.position.add(vectorOffset);
});

let camera;
const scene = document.querySelector("a-scene");
scene.addEventListener("loaded", (event) => {
  console.log(event);
  camera = document.querySelector("a-camera");
});
