# Basic Starter Scene for Virtual Land Manager

This **Basic Starter Scene** serves as an entry point for building a new **Decentraland SDK7** scene with **Virtual Land Manager** installed. This scene provides a simple, foundational template that you can build upon when creating your own Decentraland experiences.

## Getting Started

### Prerequisites

Ensure you have the following tools ready:

- **Visual Studio Code (VS Code)**  
  Download and install VS Code from [here](https://code.visualstudio.com/).

- **Decentraland SDK7 Extension for VS Code**  
  The Decentraland SDK7 extension will help you set up your scene. It also handles the installation of **Node.js** and other necessary dependencies for you. 

  Follow the steps in the [Decentraland SDK7 Installation Guide](https://docs.decentraland.org/creator/development-guide/sdk7/installation-guide/) for detailed instructions on installing the extension and setting up your environment.

### Setting Up the Scene

1. **Open Visual Studio Code**  
   After you’ve installed VS Code, launch it on your machine.

2. **Install the Decentraland SDK7 Extension**  
   To install the Decentraland SDK7 extension, follow these steps:
   - Open the **Extensions** view (`Ctrl+Shift+X` or `Cmd+Shift+X` on Mac).
   - Search for **Decentraland SDK7** and install it.

3. **Create a New Scene via the Decentraland SDK7 Extension**  
   Once the extension is installed:
   - Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac).
   - Search for `Decentraland: Create Project` and select it.

4. **Choose "From Github Repository" Option**  
   When prompted, choose **From Github Repository**. This will let you initialize a new scene from a GitHub repository.

5. **Enter the Repository URL**  
   Copy the following URL and paste it into the text field provided by the Decentraland SDK7 extension:
   ```
   https://github.com/virtuallandmanager/vlm-scenes/tree/main/dcl-sdk7/starter-template
   ```
   Press `Enter` to confirm.

### Customizing the Scene

After setting up the **Basic Starter Scene**, you can begin customizing it by modifying the code in the scene's files. Here are key files to explore:
- `index.ts`: Main logic for your scene.
- `scene.json`: Scene configuration.

Add new assets, interactions, and additional content to personalize the experience.

### Learn More

For more detailed documentation about the Decentraland SDK7 and the Virtual Land Manager, visit:
- [Decentraland SDK Documentation](https://docs.decentraland.org/)
- [Virtual Land Manager](https://docs.vlm.gg)

---