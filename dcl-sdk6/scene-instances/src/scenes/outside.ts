import VLM from "vlm-dcl";
import {
  SceneEnum,
  setCurrentScene,
} from "src/sceneSwitcher";

export const loadOutside = () => {
  //  render scene glb
  setCurrentScene(SceneEnum.NONE);

  // add the vlm video instance
  VLM.storage.video.instances["outsideVideo"]?.add(); // <== adds video instance with custom id of "outsideVideo"
  VLM.storage.images.instances["outsideImage"]?.add(); // <== image instance

  //check if the video is stopped. if so, start playing video
  // this prevents the video from restarting when switching scenes
  if (VLM.storage.video.systems["videoSource1"]?.stopped) {
    VLM.storage.video.systems["videoSource1"]?.start();
  }
};

export const unloadOutside = () => {
  // add the vlm video instance
  VLM.storage.video.instances["outsideVideo"]?.remove();
  VLM.storage.images.instances["outsideImage"]?.remove();

  // uncomment to stop the video when you go outside
  // videoSystems["videoSource1"].stop();
};
