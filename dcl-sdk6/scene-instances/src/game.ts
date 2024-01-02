import { VLM } from "vlm-dcl";
import { createSceneSwitchers } from "./sceneSwitcher";
import { loadOutside } from "./scenes/outside";

const init = async () => {
  await VLM.init(); // <== using async/await is important!
  //next functions need video objects that take time to load in.
  createSceneSwitchers();
  loadOutside();
};

init();
