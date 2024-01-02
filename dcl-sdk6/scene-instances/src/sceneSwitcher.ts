import { loadOutside, unloadOutside } from "./scenes/outside";
import { loadScene1, unloadScene1 } from "./scenes/scene1";
import { loadScene2, unloadScene2 } from "./scenes/scene2";

export enum SceneEnum {
  NONE, //0
  SCENE_1, // 1
  SCENE_2, // 2
}

export const scenes = [
  // position/scale of hidden scene glbs
  {
    transform: new Transform({
      position: new Vector3(0, 0, 0),
      scale: new Vector3(0, 0, 0),
    }),
  },
  // scene 1 object
  {
    entity: new Entity("Scene 1"),
    model: new GLTFShape("models/Shop_Black.glb"),
    transform: new Transform({
      position: new Vector3(12, 0, 5),
      scale: new Vector3(1, 1, 1),
    }),
  },
  // scene 2 object
  {
    entity: new Entity("Scene 2"),
    model: new GLTFShape("models/Shop_Emissive.glb"),
    transform: new Transform({
      position: new Vector3(4, 0, 5),
      scale: new Vector3(1, 1, 1),
    }),
  },
];

// set current scene from Scene enumeration (NONE = 0)
export let currentScene = SceneEnum.NONE;

export const setCurrentScene = (sceneId: SceneEnum) => {
  currentScene = sceneId;
};

// create clickable boxes to toggle the scenes
export const createSceneSwitchers = () => {
  // switch one switch
  const switchEnt1 = new Entity("Scene Switcher - Scene 1");
  const switchTransform1 = new Transform({
    position: new Vector3(12, 1, 14),
    scale: new Vector3(1, 1, 1),
  });
  const switchModel1 = new BoxShape();
  const switchOnClick1 = new OnPointerDown(
    () => {
      if (currentScene == SceneEnum.NONE) {
        unloadOutside();
      } else if (currentScene == SceneEnum.SCENE_2) {
        unloadScene2();
      }
      loadScene1();
    },
    { hoverText: "Show Scene 1" }
  );
  switchEnt1.addComponent(switchModel1);
  switchEnt1.addComponent(switchTransform1);
  switchEnt1.addComponent(switchOnClick1);

  // scene two switch
  const switchEnt2 = new Entity("Scene Switcher - Scene 2");
  const switchTransform2 = new Transform({
    position: new Vector3(4, 1, 14),
    scale: new Vector3(1, 1, 1),
  });
  const switchOnClick2 = new OnPointerDown(
    () => {
      if (currentScene == SceneEnum.SCENE_1) {
        unloadScene1();
      } else if (currentScene == SceneEnum.NONE) {
        unloadOutside();
      }
      loadScene2();
    },
    { hoverText: "Show Scene 2" }
  );

  switchEnt2.addComponent(switchModel1);
  switchEnt2.addComponent(switchTransform2);
  switchEnt2.addComponent(switchOnClick2);

  // outside switch
  const switchEnt3 = new Entity("Scene Switcher - Outside");
  const switchTransform3 = new Transform({
    position: new Vector3(8, 1, 14),
    scale: new Vector3(1, 1, 1),
  });
  const switchOnClick3 = new OnPointerDown(
    () => {
      if (currentScene == SceneEnum.SCENE_1) {
        unloadScene1();
      } else if (currentScene == SceneEnum.SCENE_2) {
        unloadScene2();
      }
      loadOutside();
    },
    { hoverText: "Go Outside" }
  );

  switchEnt3.addComponent(switchModel1);
  switchEnt3.addComponent(switchTransform3);
  switchEnt3.addComponent(switchOnClick3);

  engine.addEntity(switchEnt1);
  engine.addEntity(switchEnt2);
  engine.addEntity(switchEnt3);
};
