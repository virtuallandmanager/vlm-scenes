import VLM, { WidgetConfig } from "vlm-dcl";

const message = new Entity("Message");
const ball = new Entity("ball");
ball.addComponent(new OnPointerDown(() => {
    VLM.sendMessage('custom_message_id', { id: "test", value: "test", number: 0, madeUpValue: true })
}))
engine.addEntity(ball);
const messageText = new TextShape("Loading data from VLM...");
messageText.fontSize = 6;
message.addComponent(messageText);
message.addComponent(new Transform({ position: new Vector3(8, 4, 8) }));
engine.addEntity(message);

const llamaMessage = new Entity("llamaMessage");
llamaMessage.addComponent(new Transform({ position: new Vector3(8, 2, 8) }));
const llamaSound = new AudioClip("sounds/llama.mp3");
const llamaSource = new AudioSource(llamaSound);
llamaMessage.addComponent(llamaSource);
llamaSource.loop = false;
llamaSource.volume = 1;
engine.addEntity(llamaMessage);

const bgMusic = new Entity("bgMusic");
bgMusic.addComponent(new Transform({ position: new Vector3(8, 8, 8) }));
engine.addEntity(bgMusic);

let musicEnabled = false;
let musicVolume = 1;
let songPlaying = "";

let widgets = [
    {
        id: "welcome-message",
        update: (config: WidgetConfig) => {
            log(config)
            if (config?.value) {
                messageText.value = `${config.value}`;
            }
        }
    },
    {
        id: "welcome-message-position",
        update: (config: WidgetConfig) => {
            log(config)
            if (config.value && typeof config.value == "string") {
                const position = config.value.split(","),
                    x = Number(position[0]),
                    y = Number(position[1]),
                    z = Number(position[2]);

                message.addComponentOrReplace(new Transform({ position: new Vector3(x, y, z) }));
            }
        }
    },
    {
        id: "welcome-message-color",
        update: (config: WidgetConfig) => {
            log(config)
            switch (config.value) {
                case "red":
                    messageText.color = Color3.Red();
                    break;
                case "green":
                    messageText.color = Color3.Green();
                    break;
                case "blue":
                    messageText.color = Color3.Blue();
                    break;
                case "yellow":
                    messageText.color = Color3.Yellow();
                    break;
                case "purple":
                    messageText.color = Color3.Purple();
                    break;
                case "black":
                    messageText.color = Color3.Black();
                    break;
                case "white":
                    messageText.color = Color3.White();
                    break;
                default:
                    messageText.color = Color3.White();
            }
        }
    },
    {
        id: "song-playing",
        order: 1,
        update: async (config: WidgetConfig) => {
            if (config.value) {
                songPlaying = `sounds/${config.value}.mp3`;
                const music = new AudioClip(songPlaying);
                const musicSource = new AudioSource(music);
                musicSource.loop = true;
                musicSource.volume = 1;
                bgMusic.addComponentOrReplace(musicSource);
                musicSource.playing = true;
            }
        }
    },
    {
        id: "music",
        order: 2,
        update: async (config: WidgetConfig) => {
            log(config)
            musicEnabled = config.value as boolean;
            if (musicEnabled) {
                const music = new AudioClip(songPlaying);
                const musicSource = new AudioSource(music);
                musicSource.loop = true;
                musicSource.volume = musicVolume;
                bgMusic.addComponentOrReplace(musicSource);
                musicSource.playing = true;
            } else {
                bgMusic.removeComponent(AudioSource);
            }
        }
    },
    {
        id: "music-volume",
        order: 3,
        update: async (config: WidgetConfig) => {
            log(config)
            musicVolume = config.value as number;
            if (bgMusic.getComponentOrNull(AudioSource)) {
                bgMusic.getComponent(AudioSource).volume = musicVolume;
            }
        }
    },
    {
        id: "llama",
        update: async (config: WidgetConfig) => {
            log(config)

            llamaSource.playOnce();
            messageText.value = `${config.user?.displayName || 'Someone'} hit the Llama button!`;
        }
    }
];

executeTask(async () => {
    await VLM.init({ env: "dev", widgets });
    log("VLM initialized")
    log(VLM.storage)
    VLM.onMessage("custom_message_id", (messageConfig: { some: string, anything: any, number: number, isTrue: boolean }) => {
        log(messageConfig.anything)
    })
});