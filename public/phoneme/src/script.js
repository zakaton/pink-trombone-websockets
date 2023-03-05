/* global FormantAnalyzer */

function Configure_FormantAnalyzer() {
  const BOX_HEIGHT = 300;
  const BOX_WIDTH = window.screen.availWidth - 50;
  document.getElementById("SpectrumCanvas").width = BOX_WIDTH; //reset the size of canvas element
  document.getElementById("SpectrumCanvas").height = BOX_HEIGHT;

  let launch_config = {
    plot_enable: true,
    spec_type: 1, //see below
    output_level: 2, //see below
    plot_len: 200,
    f_min: 50,
    f_max: 4000,
    N_fft_bins: 256,
    N_mel_bins: 128,
    window_width: 25,
    window_step: 15,
    pause_length: 200,
    min_seg_length: 50,
    auto_noise_gate: true,
    voiced_min_dB: 10,
    voiced_max_dB: 100,
    plot_lag: 1,
    pre_norm_gain: 1000,
    high_f_emph: 0.0,
    plot_canvas: document.querySelector("#SpectrumCanvas").getContext("2d"),
    canvas_width: BOX_WIDTH,
    canvas_height: BOX_HEIGHT,
  };

  FormantAnalyzer.configure(launch_config);
}

/*Parameters:*/
const context_source = 3; //1: Local file binary, 2: play from a web Audio, 3: mic
const test_mode = false; //plots only, it does not return callback
const offline = false; //play on speakers, set true to play silently
const file_labels = []; //array of labels that will be passed to callback after feature extraction

let launch_config = {
  plot_enable: true,
  spec_type: 1,
  output_level: 4,
  plot_len: 200,
  f_min: 50,
  f_max: 4000,
  N_fft_bins: 256,
  N_mel_bins: 128,
  window_width: 25,
  window_step: 15,
  pause_length: 200,
  min_seg_length: 50,
  auto_noise_gate: true,
  voiced_min_dB: 10,
  voiced_max_dB: 100,
  plot_lag: 1,
  pre_norm_gain: 1000,
  high_f_emph: 0.0,
  plot_canvas: document.querySelector("#SpectrumCanvas").getContext("2d"),
  canvas_width: 900,
  canvas_height: 300,
};
FormantAnalyzer.configure(launch_config);

document.addEventListener(
  "click",
  (e) => {
    FormantAnalyzer.LaunchAudioNodes(
      context_source,
      null,
      callback,
      file_labels,
      offline,
      test_mode
    )
      .then(function () {
        console.log("Done");
      })
      .catch((err) => {
        console.log(err);
      });
  },
  { once: true }
);

function callback(seg_index, file_labels, seg_time, features) {
  //callback function to which extracted features are passed
  console.log(seg_index, file_labels, seg_time, features);
}
