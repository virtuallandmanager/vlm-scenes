
/*
 _    _        _______       ______ _______ _______ ______  _______ _______
  \  /  |      |  |  |      |_____/ |______ |_____| |     \ |  |  | |______
   \/   |_____ |  |  |      |    \_ |______ |     | |_____/ |  |  | |______

----------------------------------------------------------------------------------------------------------------

_  _ _    ____ _    ____ _  _ ____ _  _ ___ ____ 
|  | |    |___ |    |___ |\/| |___ |\ |  |  [__  
|__| |    |___ |___ |___ |  | |___ | \|  |  ___] 
                                                                                                                                                                  
Whem using VLM, please update your `ReactEcsRenderer` imports to import from `vlm-dcl` instead of `@dcl/sdk/react-ecs`.
This allows VLM to extend your UI with its own components.

-- EXAMPLE --

BEFORE:
import ReactEcs, { ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'

AFTER:
import ReactEcs, { UiEntity } from '@dcl/sdk/react-ecs'
import { ReactEcsRenderer } from 'vlm-dcl'

----------------------------------------------------------------------------------------------------------------
  ____   __  __ ____ _____ __ __ _____ ___   ____ ___  ______ ____   ___ 
 / __ \ / / / //  _// ___// //_// ___// _ \ / __// _ |/_  __// __ \ / _ \
/ /_/ // /_/ /_/ / / /__ / ,<  / /__ / , _// _/ / __ | / /  / /_/ // , _/
\___\_\\____//___/ \___//_/|_| \___//_/|_|/___//_/ |_|/_/   \____//_/|_| 
                                                                         
                                                                                             
vvvv COPY THIS IMPORT TO THE TOP OF THE FILE TO USE QUICKCREATOR vvvv
import { QuickCreator } from 'vlm-dcl'

\\\\\\\\\\\\\\\\\\\\\\\\\\\//////////////////////////
+-+-+-+-+-+-+
|I|M|A|G|E|S|
+-+-+-+-+-+-+

//// -- Adding an image with QuickCreator.Image() -- \\\\
To add a GLB from your /models folder, 
you just need to add the name of the file as a string to the "path" property.

•·················• CODE EXAMPLE •·················•
new QuickCreator.Image({
  path: 'https://picsum.photos/1920/1080',
  position: { x: 5, y: 3, z: 0 },
  scale: { x: 1.92, y: 1.08, z: 1 },
  rotation: { x: 0, y: 90, z: 0 }
})
•·························•························•
///////////////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\

\\\\\\\\\\\\\\\\\\\\\\\\\\\//////////////////////////
+-+-+-+-+-+ +-+-+-+-+-+-+-+
|V|I|D|E|O| |S|C|R|E|E|N|S|
+-+-+-+-+-+ +-+-+-+-+-+-+-+

//// -- Adding a video with QuickCreator.Video() -- \\\\
- 'liveUrl' will be used when the stream is live.
- 'playlist' will be looped through when the stream is offline.

•·················• CODE EXAMPLE •·················•
new QuickCreator.VideoScreen({
  liveUrl: 'https://streams.vlm.gg/live/vlm/index.m3u8',
  playlist: ['https://api.vlm.gg/media/demo-video/1.mp4', 'https://api.vlm.gg/media/demo-video/2.mp4'],
  position: { x: 5, y: 5, z: 8 },
  scale: { x: 1.92, y: 1.08, z: 0.1 },
  rotation: { x: 0, y: 90, z: 0 }
})
•·························•························•
///////////////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\


\\\\\\\\\\\\\\\\\\\\\\\\\\\//////////////////////////
+-+-+ +-+-+-+-+-+-+
|3|D| |M|O|D|E|L|S|
+-+-+ +-+-+-+-+-+-+

-- Adding a GLB with QuickCreator.Mesh() --
- By default, looks within the /models folder for the GLB. 
- Just add file name as a string to the "path" property.

•·················• CODE EXAMPLE •·················•
new QuickCreator.Mesh({
  path: 'building.glb',
  position: { x: 8, y: 3, z: 8 }
})
•·························•························•
///////////////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\

\\\\\\\\\\\\\\\\\\\\\\\\\\\//////////////////////////
 +-+-+-+-+-+ +-+-+-+-+-+
 |D|A|N|C|E| |F|L|O|O|R|
 +-+-+-+-+-+ +-+-+-+-+-+

-- Adding an auto-dance area with QuickCreator.DanceFloor() --
- Sets up a cube where people will dance when their feet are inside it.
- Toggle the auto-dance with VLM.toggleAutoDance()
- To set a certain auto-dance state, use VLM.toggleAutoDance(true) or VLM.toggleAutoDance(false)

•·················• CODE EXAMPLE •·················•
new QuickCreator.DanceFloor({
      position: { x: 0, y: 8, z: 8 },
      scale: { x: 32, y: 26, z: 16 },
      debug: false, // optional - shows a box where the dance floor to see the position during development
      enabledOnLoad: true // optional - if false, the dance floor will be disabled when the scene loads. 
    })
•·························•························•
///////////////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\
*/