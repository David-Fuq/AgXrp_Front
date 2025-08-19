# Farm Automation Control Application

This documentation provides a comprehensive overview of the Farm Automation Control Application, its structure, components, and functionality.

## Table of Contents

- [Project Overview](#project-overview)
- [Directory Structure](#directory-structure)
- [Core Files](#core-files)
  - [index.js](#indexjs)
  - [connection.js](#connectionjs)
  - [FileTransferReciever.js](#filetransferrecieverjs)
- [UI Components](#ui-components)
  - [movmentControlPanel.js](#movmentcontrolpaneljs)
  - [optionsView.js](#optionsviewjs)
  - [PlantPanel.js](#plantpaneljs)
  - [SettingsPanel.js](#settingspaneljs)
  - [threeView.js](#threeviewjs)
  - [videoView.js](#videoviewjs)
- [Utilities](#utilities)
  - [reportWebVitals.js](#reportwebvitalsjs)
- [Assets](#assets)
  - [sample_json.json](#sample_jsonjson)
- [Contributing](#contributing)

## Project Overview

This project is a React-based control interface for a farm automation system. It provides a web interface to monitor and control a farming robot/gantry system, manage plants and missions, and visualize the farm environment in 3D.

To start the application, go to ../frontend/farm_app and execute `npm i` to download the dependencies. Once this is done, execute `npm start` to run the application. It should automatically open in your default web browser as `localhost:3000`.

## Directory Structure

```
└── src/
    ├── connection.js
    ├── FileTransferReciever.js
    ├── index.js
    ├── movmentControlPanel.js
    ├── optionsView.js
    ├── PlantPanel.js
    ├── reportWebVitals.js
    ├── SettingsPanel.js
    ├── threeView.js
    ├── videoView.js
    └── assets/
        └── sample_json.json
```

## Core Files

### index.js

The main entry point and core component of the application. This file sets up the React application and defines the main `App` component with the following features:

#### State Management
- `robotPos` - Tracks the current position of the robot [x, y, z]. For reference, this dictates the position of the orange square within the gantry and the "Current Position" segment of the lower-left Position element.
- `desiredPos` - Stores the target position for the robot [x, y, z]. For reference, this dicatates the position of the blue square within the gantry, the "Desired Position" segment of the lower-lef Position element, and the x-y coordinates of Absolute Positioning in the lower-right side of the app.
- `robotCmd` - Holds commands to be sent to the robot
- `farmData` - Contains all farm-related data including plants and missions. Initially, this comes directly from the sample_json.json file.
- `farmSize` - Stores the dimensions of the farm/gantry system
- `plantView` - Toggles between "plants" and "missions" views.

#### Key Functions
- `sendCommand` - Sends commands to the robot via a ref pattern for stable reference
- `deleteMission` - Removes a mission and updates both the backend (robot) and local state
- `deletePlant` - Removes a plant and updates both the backend (robot) and local state

#### Layout Components
1. **Top Navigation Bar**
   - Accordion Log
       - Allows us to see every single command sent from the frontend to the robot and vice versa. 
   - Emergency stop button
       - Stops the robot in any movement scenario.
   - Connect Robot
        - Enables connection with the robot. Once clicke, the robot must be selected from the available usb devices. Once the robot is connnected, it may be clicked again (Disconnect Robot) to disconnect the robot from the webpage. This is important, as it must be done for the robot to start its autonomous tasks.
    - Reload data from robot
        - When clicked, it extracts the `agbot_data.json` file from the robot as a downloadable file. It also updates the whole frontend with the missions, plants and location from the robot's `agbot_data.json`
    - Download moisture data
        - When clicked, it extracts the `moisture_readings.csv` file from the robot as a downloadable file.
    - Download mission data
        - When clicked, it extracts the `mission_history.csv` file from the robot as a downloadable file.
    - Download watering data
        - When clicked, it extracts the `water_log.csv` file from the robot as a downloadable file.
    - Calibrate gantry size
        -When clicked, it sends the robot a "6" command to manually calibrate the gantry size. That is, making the robot move through all the gantry to get its size.
    - JSON gantry size
        - When clicked, it sends the robot a "11" command to get the gantry size from the `agbot_data.json` file. That is, instead of having to move all throughout the gantry, it can just read the size from memory.
    - Get moisture reading
        - When clicked, it sends the robot a "2" command to lower the z-axis and get the moisture reading.
    - Pump water manually
        - When clicked, a modal appears prompting the user for the amount of water to pump. Once the amount is selected, it sends a command "12" to the robot to pump the specified amount of water.

2. **Main Visualization**
   - View of the farm environment
   - Displays robot position, desired position, and plant locations

3. **Control Panels**
   - Plant/Mission panel (top left) - Switches between plant management and mission settings
   - Position information panel (bottom left) - Shows current and desired robot positions
   - Movement control panel (bottom right) - Directional controls for robot movement

#### Data Flow
- Communicates with backend systems via the `ConnectivityComponent`
- Maintains real-time synchronization of robot position and farm data
- Provides user interface for controlling robot movement and managing farm elements

### connection.js

A critical component that manages communication with the farm robot hardware using the WebSerial API. This module provides the interface between the web application and the physical robot system.

#### Key Features

- **USB Serial Connection Management**
  - Establishes and maintains WebSerial connections to the robot hardware
  - Supports specific USB vendor and product IDs for compatible hardware detection
  - Provides manual connection and disconnection capabilities
  - Implements automatic reconnection and connection health monitoring
  - Sends periodic ping commands to keep the connection alive

- **Command Processing System**
  - Sends formatted commands to the robot with proper termination characters
  - Includes special control commands for mode switching, interrupts, and resets
  - Maintains a command buffer to ensure reliable transmission

- **Data Reception and Parsing**
  - Implements a continuous read loop for incoming data
  - Uses a buffer system to handle incomplete or fragmented messages
  - Parses robot position updates using regular expressions
  - Detects and processes special messages like moisture readings
  - Supports JSON data reception for complex data structures

- **File Transfer Capabilities**
  - Integrates with `FileTransferReceiver` for handling file downloads from the robot
  - Supports different file types including JSON and CSV
  - Provides progress tracking during file transfers
  - Processes downloaded data and updates application state

- **User Interface**
  - Displays connection status and activity logs
  - Offers expandable/collapsible log view
  - Provides buttons for various robot functions:
    - Connect/disconnect robot
    - Reload data from robot
    - Download moisture, mission, and watering data
    - Calibrate gantry size
    - Get moisture readings
    - Manual water pump control

- **Alert System**
  - Displays alerts for critical readings (e.g., moisture data)
  - Logs system events, errors, and communication activity
  - Auto-shows logs for critical error conditions

#### Technical Implementation

- Uses React hooks (`useState`, `useEffect`, `useRef`) for state management
- Implements the WebSerial API with TextEncoder/TextDecoder for data conversion
- Uses references for maintaining stable access to serial port objects
- Includes specialized error handling for USB communication issues
- Supports both text-based and binary data transfer protocols

### FileTransferReciever.js

A specialized class responsible for handling the complex process of receiving and reconstructing files transferred from the robot system over a serial connection.

#### File Transfer Protocol Implementation

The class implements a custom protocol for transferring files over serial connections with the following message types:

- **Header Messages (`H`)** - Contain metadata about the file:
  - File type (JSON, CSV, or binary)
  - Number of expected chunks
  - Total file size
  - File checksum for integrity verification

- **Payload Messages (`P`)** - Contain actual file data chunks:
  - Chunk index
  - Total chunks count
  - Hexadecimal-encoded chunk data
  - Per-chunk markers and verification

- **Last/End Messages (`L`)** - Mark completion of the transfer:
  - End marker
  - Optional filename information
  - Final verification signal

- **Error Messages (`ERR`)** - Indicate transfer problems

#### Key Features

- **Robust Message Handling**
  - Buffering mechanism for incomplete or fragmented messages
  - Sequential processing to ensure correct chunk assembly
  - Recursive message extraction for handling multiple messages in a single data packet

- **Data Processing and Conversion**
  - Hexadecimal string to byte array conversion
  - Binary data handling and reassembly
  - Automatic format detection and parsing (JSON, CSV, binary)
  - Text decoding for different data formats

- **Error Handling and Validation**
  - Checksum calculation and verification
  - Missing chunk detection
  - Invalid data format handling
  - Transfer error reporting

- **State Management**
  - Tracks received chunks and file metadata
  - Maintains transfer state across multiple serial data packets
  - Provides reset capability for handling new transfers

#### Implementation Details

The class uses a sophisticated approach to reassemble files:

1. Buffers incoming serial data until complete protocol messages are detected
2. Processes message headers to establish transfer parameters
3. Stores payload chunks in the correct sequence
4. Verifies the complete transfer when the end message is received
5. Assembles and converts the data to the appropriate format (JSON, CSV, raw binary)
6. Provides the completed file data to the calling component

This implementation ensures reliable file transfers even over potentially unreliable or fragmented serial connections, making it essential for retrieving data from the robot system.

## UI Components

### movmentControlPanel.js

A comprehensive user interface for controlling the movement and positioning of the farm robot. This component provides two different control modes and additional action buttons.

#### Control Modes

1. **Relative Movement Mode**
   - Directional control pad with arrow buttons for X/Y movement
   - Adjustable movement increments (1mm, 10mm, 100mm, 1000mm)
   - Visual feedback of current increment setting
   - Intuitive interface for fine or coarse movements

2. **Absolute Movement Mode**
   - Direct coordinate input fields for X and Y positions
   - "Go To Location" button to send robot to specific coordinates
   - Input fields sync with current desired position

#### Action Buttons

- **Home Button** (`faHome`)
  - Sends robot to home position (0,0,0)
  - Updates both physical robot position and UI state
  - Sends command code `[3, 0, 0, 0, 0]` to the robot

- **Anchor Button** (`faAnchor`) TO-DO
  - Intended for manually lowering the Z-axis (partially implemented)
  - Prepared for future implementation

#### Implementation Details

- Implements a tabbed interface to switch between relative and absolute control modes
- Uses React state hooks to manage movement mode and increment settings
- Communicates with the parent component through props for position updates
- Sends formatted command arrays to the robot system
- Employs FontAwesome icons for intuitive button representations
- Uses Bootstrap components (Button, ButtonGroup) for consistent styling
- Includes custom CSS for specialized button layouts and styling
- Monitors robot position changes via useEffect hooks

#### Communication Protocol

- Relative/absolute movements: `[1, x, y, 0, 0]`
- Home position command: `[3, 0, 0, 0, 0]`

This component provides an intuitive interface for operators to precisely control the farm robot's position, whether for maintenance, plant inspection, or other tasks requiring manual positioning.

### optionsView.js

A flexible UI container component that provides consistent positioning and styling for various panels throughout the application.

#### Key Features

- **Customizable Positioning**
  - Accepts positioning props (top, bottom, left, right) to place panels anywhere on the screen
  - Uses fixed positioning to ensure panels stay in place regardless of scrolling
  - High z-index (1000) ensures panels appear above other content

- **Consistent Visual Styling**
  - Semi-transparent black background (90% opacity) for visibility without obscuring content
  - White outline border to clearly define panel boundaries
  - Rounded corners (10px border radius) for a modern appearance

- **Content Flexibility**
  - Acts as a wrapper for any content passed through the `props.content` property
  - No restrictions on the type of content that can be displayed
  - Maintains consistent appearance across different panel types

#### Implementation

The component is implemented as a simple functional React component that:
- Takes position and content as props
- Applies consistent styling to the container
- Renders the provided content within the styled container

This component is used throughout the application to create UI panels for plant management, mission settings, movement controls, and position information, providing a consistent look and feel across the interface.

### PlantPanel.js

A comprehensive component for managing plants in the farm automation system. This component provides a rich interface for viewing, adding, and managing plants with their associated parameters and locations.

#### Plant Management Features

- **Plant List Display**
  - Uses React Bootstrap Accordion for expandable/collapsible plant entries
  - Shows all plants in the system with their key parameters
  - Provides a scrollable interface for handling many plants

- **Plant Information Display**
  - Shows sensor location coordinates (where moisture is measured)
  - Shows plant location coordinates (where watering occurs)
  - Displays water amount settings in milliliters
  - Shows moisture threshold percentage for triggering watering

- **Navigation Controls**
  - LocationButton component to navigate the robot to plant or sensor positions
  - Clear visualization of X/Y coordinates for each location

- **Plant Deletion**
  - Delete button for each plant with confirmation dialog
  - Updates both local state and sends deletion commands to the robot

#### Add Plant Interface

- **Input Form**
  - Plant name field with character limit validation (9 characters max)
  - Separate X/Y coordinate inputs for sensor and plant locations
  - Water amount input (in milliliters)
  - Moisture threshold input (percentage)

- **Location Helper**
  - "Use current position" buttons that fill coordinate fields with the robot's current position
  - Allows easy positioning by moving the robot to the desired location first

- **Comprehensive Validation**
  - Checks for empty fields
  - Validates numeric values in appropriate fields
  - Ensures water amount is within range (0-255 ml)
  - Ensures moisture threshold is within range (0-100%)
  - Verifies coordinates are within farm boundaries
  - Validates integer values for certain fields

#### Technical Implementation

- Uses React memo for performance optimization
- Implements a unique plant ID generation system
- Sends formatted command strings to the robot (`CHA,4,...`)
- Updates local state synchronously with robot commands
- Provides immediate UI feedback for actions
- Uses custom CSS for styling and layout
- Features responsive design elements for various screen sizes

#### Communication Protocol

- Add plant: `CHA,4,name,sense_x,sense_y,plant_x,plant_y,moisture_threshold,ml_response,plant_id`
- The plant ID is randomly generated between 1-1500 and checked for uniqueness

This component serves as the primary interface for managing individual plants in the farm automation system, enabling operators to define plant parameters, locations, and watering conditions.

### SettingsPanel.js

A sophisticated mission management component that allows users to create, configure, and execute automated tasks for the farm robot. This panel serves as the automation hub for the farming system.

#### Mission Management Features

- **Mission List Display**
  - Uses React Bootstrap Accordion for expandable/collapsible mission entries
  - Shows all configured missions with their key parameters
  - Provides a scrollable interface for handling multiple missions

- **Mission Information Display**
  - Shows scheduled execution time (hour and minute)
  - Displays action type (e.g., "Sense")
  - Lists all plants included in each mission
  - Supports plant selection/deselection for each mission

- **Mission Control**
  - "Run Mission" button for immediate execution of any mission
  - Delete button for removing missions with confirmation dialog
  - Plant selection modal for associating plants with missions

- **Plant Selection Interface**
  - Modal dialog for selecting plants to include in a mission
  - Checkbox interface for easy selection/deselection
  - Updates both local state and sends changes to the robot
  - Real-time synchronization with mission data

#### Add Mission Interface

- **Input Form**
  - Mission name input field
  - Hour and minute inputs for scheduling
  - Action type selection (currently supports "Sense")
  - Validation for required fields

- **Unique Mission ID Generation**
  - Automatically generates random mission IDs (1-1500)
  - Ensures uniqueness across all missions
  - Ties plants to missions through ID references

#### Technical Implementation

- Uses React memo for performance optimization
- Implements nested component architecture (`PlantSelectionPanel` within `SettingsPanel`)
- Manages complex state for plant selections across missions
- Sends formatted command strings to the robot
- Updates local state synchronously with robot commands
- Features responsive design elements with custom styling
- Uses modal dialogs for complex interactions

#### Communication Protocol

- Add mission: `CHA,12,name,hour,minute,action,mission_id`
- Associate/disassociate plant with mission: `CHA,10,plant_id,mission_id,target_checked`
- Run mission: Command array `[5, mission_id, 0, 0, 0]`
- Delete mission: Handled through the parent component's `deleteMission` function

This component serves as the automation control center for the farm system, allowing operators to create scheduled tasks that can automatically monitor and maintain plants based on various conditions and timings.

### threeView.js

Visualization component that provides a spatial representation of the farm environment using Three.js and React Three Fiber. This component serves as the main visual interface for monitoring and interacting with the farm robot system.

#### Visualization Features

- **Farm Environment Rendering**
  - Displays the farm area as a semi-transparent plane with accurate dimensions
  - Shows a coordinate grid for spatial reference
  - Renders plants as yellow spheres at their actual positions
  - Highlights the origin point (0,0,0) with a red sphere
  - Supports dynamic resizing based on actual farm dimensions

- **Robot Representation**
  - Shows the current robot position as an orange sphere
  - Displays the target/desired position as a blue sphere
  - Provides visual feedback of both positions in real-time
  - Automatically updates when robot position changes

- **Interactive Positioning**
  - Supports direct manipulation of the desired position through drag-and-drop
  - Allows users to visually set target positions by dragging the blue sphere
  - Converts between 3D world coordinates and robot coordinate system (mm)
  - Provides immediate feedback as positions are updated

#### Component Architecture

- **Sphere Component** - Generic draggable sphere implementation
- **Farm Component** - Visualizes the farm area boundaries
- **Plant Component** - Renders individual plants
- **Plants Component** - Container for managing multiple plant visualizations
- **SpudBuddy Components** - Represents the farm robot with interactive capabilities


#### Technical Implementation

- Uses React Three Fiber to integrate Three.js with React
- Implements sophisticated state management for position tracking
- Uses refs to directly manipulate 3D objects when needed
- Converts between different coordinate systems (mm to world units)
- Handles user interactions like dragging, clicking, and camera control
- Provides visual distinction between current and target states
- Updates 3D visuals in response to state changes from other components

This component provides an intuitive spatial interface that allows users to:
- Visualize the entire farm layout in 3D space
- See exact positions of plants and the robot
- Interact with the system through direct manipulation
- Set target positions visually rather than just numerically
- Understand spatial relationships between farm elements

The 3D visualization acts as a digital twin of the physical farm environment, making it easier for operators to understand and control the system without having to think solely in terms of coordinates and numbers.

### videoView.js 

*Currently not used

Handles video streaming or camera feeds that may:

- Display live video from cameras mounted on the robot
- Show multiple camera angles or perspectives
- Provide controls for camera selection or adjustment
- Support image capture or recording functionality

## Utilities

### reportWebVitals.js

A utility for measuring and reporting web performance metrics, which:

- Collects Core Web Vitals and other performance measurements
- May send metrics to an analytics service
- Helps monitor application performance in production
- Is included as part of the React application created with Create React App

## Assets

### sample_json.json

A sample data file that provides:

- Example farm data structure including plants and missions
- Gantry size and configuration information
- Test data for development and testing
- Template for expected data formats from the backend system

The structure includes plants with positions, types, and IDs, as well as missions with sequences of actions for the robot to perform.

## Contributing

To contribute to this project:

1. Clone the repository
2. Install dependencies with `npm install`
3. Make your changes
4. Test thoroughly
5. Submit a pull request with a clear description of your changes

For questions or support, please open an issue in the repository.