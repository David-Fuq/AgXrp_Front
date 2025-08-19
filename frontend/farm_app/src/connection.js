import React, { useState, useEffect, useRef } from 'react';
import { faSignal, faFile, faFlag, faDroplet, faWater, faUpRightAndDownLeftFromCenter, faFileImport, faChevronDown, faChevronUp, faArrowUpFromGroundWater, faArrowUpFromWaterPump, faGasPump } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import './connection.css';
import FileTransferReceiver from './FileTransferReciever';



function ConnectivityComponent({ robotCmd, datatoSend, setFarmData, setRobotPos, onSendCommand }) {
    //console.log(robotCmd);
    const [showModal, setShowModal] = useState(false);
    const [pumpDuration, setPumpDuration] = useState(0); 
    const pingIntervalRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [message, setMessage] = useState('');
    const [logs, setLogs] = useState([]);
    const [busy, setBusy] = useState(false);
    const [showFileTransferModal, setShowFileTransferModal] = useState(false);
    const [transferProgress, setTransferProgress] = useState({ current: 0, total: 0 });
    const [showLogs, setShowLogs] = useState(false);
    const messageBufferRef = useRef(""); // Buffer to store incomplete messages

    

    const portRef = useRef(null);
    const writerRef = useRef(null);
    const readerRef = useRef(null);
    const disconnectFlagRef = useRef(true);
    const logContainerRef = useRef(null);
    const fileTransferRef = useRef(null);

    // Constants for USB device identification
    const USB_VENDOR_ID_BETA = 11914;
    const USB_PRODUCT_ID_BETA = 5;
    const USB_VENDOR_ID = 6991;
    const USB_PRODUCT_ID = 70;

    // Control commands
    const CTRL_CMD_RAWMODE = "\x01";     // ctrl-A
    const CTRL_CMD_NORMALMODE = "\x02";  // ctrl-B
    const CTRL_CMD_KINTERRUPT = "\x03";  // ctrl-C
    const CTRL_CMD_SOFTRESET = "\x04";   // ctrl-D

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    // Initialize FileTransferReceiver
    useEffect(() => {
        fileTransferRef.current = new FileTransferReceiver(handleFileTransferComplete);
    }, []);

    const handleFileTransferComplete = (result) => {
        setShowFileTransferModal(false);
        console.log('File transfer complete:', result);
        
        if (result.fileType === 'JSON') {
            // Update the farm data if we received JSON data
            setFarmData(result.data);
            console.log(result.data);
        }
        
        // Trigger a download for the file
        downloadFile(result.data, result.fileName, result.fileType);
    };

    // Function to download the file
    const downloadFile = (data, fileName, fileType) => {
        let blob;
        let downloadName = fileName || 'downloaded_file';
        
        if (fileType === 'JSON') {
            blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            if (!downloadName.endsWith('.json')) downloadName += '.json';
        } else if (fileType === 'CSV') {
            blob = new Blob([data], { type: 'text/csv' });
            if (!downloadName.endsWith('.csv')) downloadName += '.csv';
        } else {
            blob = new Blob([data], { type: 'application/octet-stream' });
        }
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };


    const sendPing = async () => {
      if (connected && writerRef.current) {
          var year = new Date().getFullYear();
          var month = new Date().getMonth() + 1; // Months are zero-based
          var day = new Date().getDate();
          var weekday = new Date().getDay();
          var hours = new Date().getHours();
          var minutes = new Date().getMinutes();
          var seconds = new Date().getSeconds();
          var miliseconds = new Date().getMilliseconds();
          var localDateTime = `${year},${month},${day},${weekday},${hours},${minutes},${seconds},${miliseconds}`;
          console.log(`Sending ping at ${localDateTime}`);
          await sendCommandWithNewline("ping," + localDateTime);
      }
    };

    // Add a log entry
    useEffect(() => {
      if (robotCmd != null)                     
      {
          //console.log("Robot Command: ", robotCmd); 
          const sendCmdStr = robotCmd.toString();
          sendCommandWithNewline(sendCmdStr);
          addLog(`Sending command: ${sendCmdStr}`, 'sent');
      }
    }, [robotCmd]);

    useEffect(() => {
        if (connected) {
            // Send a ping every 5 seconds
            pingIntervalRef.current = setInterval(sendPing, 5000);
        } else {
            // Clear interval on disconnect
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
        }
        
        return () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
        };
    }, [connected]);

    const addLog = (message, type = 'system') => {
      setLogs(prevLogs => [...prevLogs, { message, type, timestamp: new Date() }]);
      
      // Auto-scroll to bottom
      setTimeout(() => {
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      }, 10);
      
      // Auto-show logs for errors and important messages
      if (type === 'error') {
        setShowLogs(true);
      }
    };

    // Check if a port matches our XRP devices

    const connectManually = async () => {
      try {
        setBusy(true);
        addLog('Requesting USB device...', 'system');
        
        const filters = [
          { usbVendorId: USB_VENDOR_ID_BETA, usbProductId: USB_PRODUCT_ID_BETA },
          { usbVendorId: USB_VENDOR_ID, usbProductId: USB_PRODUCT_ID }
        ];
        
        const port = await navigator.serial.requestPort({ filters });
        await connectToPort(port);
        return true;
      } catch (err) {
        addLog(`Connection error: ${err.name} - ${err.message}`, 'error');
        return false;
      } finally {
        setBusy(false);
      }
    };

      const connectToPort = async (port) => {
          try {
          portRef.current = port;
          
          addLog('Opening connection at 115200 baud...', 'system');
          await port.open({ baudRate: 115200 });
          
          writerRef.current = port.writable.getWriter();
          disconnectFlagRef.current = false;
          setConnected(true);
          
          addLog('Connected successfully!', 'system');
          
          // Start reading from the device
          startReadLoop();
          
          return true;
          } catch (err) {
          addLog(`Port connection error: ${err.name} - ${err.message}`, 'error');
          return false;
          }
      };

const startReadLoop = async () => {
  if (!portRef.current || !portRef.current.readable) {
      addLog('Cannot start read loop - no readable port', 'error');
      return;
  }
  
  addLog('Starting read loop...', 'system');
  readerRef.current = portRef.current.readable.getReader();
  
  // Reset the message buffer when starting a new read loop
  messageBufferRef.current = "";
  
  try {
      let jsonBuffer = "";
      let collectingJson = false;
      
      while (disconnectFlagRef.current === false) {
        const { value, done } = await readerRef.current.read();
        
        if (done) {
            addLog('Read stream closed', 'system');
            readerRef.current.releaseLock();
            break;
        }
        
        if (value) {
            const text = textDecoder.decode(value);
            addLog(`Raw received: ${text}`, 'debug'); // Log raw received data for debugging
            
            // Pass all incoming text to the file transfer receiver
            fileTransferRef.current.processIncomingText(text);
            
            // Append the new text to our message buffer for processing partial messages
            messageBufferRef.current += text;
            
            // Check for "Moved to (x,y)" pattern in the accumulated buffer
            checkForMovedToPattern();
            
            // Process the received text line by line for other commands
            const lines = text.split('\n');
            for (const line of lines) {
              const trimmedLine = line.trim();
              
              // Skip empty lines and FT messages (handled by FileTransferReceiver)
              if (!trimmedLine || trimmedLine.startsWith('FT,')) {
                  continue;
              }
              
              if (trimmedLine === "J") {
                  // Start collecting JSON data
                  collectingJson = true;
                  jsonBuffer = "";
                  continue;
              } 
              else if (trimmedLine === "X") {
                  // End of JSON data, process it
                  collectingJson = false;
                  
                  try {
                    // const parsedJson = JSON.parse(jsonBuffer);
                    // addLog(`Received JSON data: ${JSON.stringify(parsedJson, null, 2)}`, 'received');
                    // setJsonData(parsedJson); // Store in state if needed
                    alert(jsonBuffer);
                    console.log("JSON Data: ", jsonBuffer);
                  } catch (e) {
                    addLog(`Error parsing JSON: ${e.message}`, 'error');
                    addLog(`Raw JSON buffer: ${jsonBuffer}`, 'error');
                  }
                  continue;
              }
              
              if (collectingJson) {
                  // Collecting JSON data
                  jsonBuffer += trimmedLine;
              } else if (trimmedLine && !trimmedLine.startsWith('FT,')) {
                  // Regular text output (not FT messages)
                  addLog(`Received: ${trimmedLine}`, 'received');
                  if (trimmedLine.includes("Moisture reading")){
                    addLog(`ALERT`, 'received');
                    alert(`Moisture Data Received:\n${trimmedLine}`);
                  }
              }
            }
        }
      }
      
      // Check one more time for any partial messages at the end of each read cycle
      checkForMovedToPattern();
  } catch (err) {
      addLog(`Read error: ${err.name} - ${err.message}`, 'error');
      if (readerRef.current) {
      try {
          readerRef.current.releaseLock();
      } catch (e) {
          // Ignore release errors
      }
      }
  }
  
  addLog('Read loop ended', 'system');
};

      const sendControlCommand = async (command) => {
      switch (command) {
        case 'raw':
          return await sendCommandWithNewline(CTRL_CMD_RAWMODE);
        case 'normal':
          return await sendCommandWithNewline(CTRL_CMD_NORMALMODE);
        case 'interrupt':
          await sendCommandWithNewline(CTRL_CMD_KINTERRUPT);
          //console.log('Interrupt command sent, waiting for response...');
          // Wait for a short period to allow the device to respond
          await new Promise(resolve => setTimeout(resolve, 100));
          await sendCommandWithNewline(CTRL_CMD_KINTERRUPT);
          //console.log('Interrupt command sent again, waiting for response...');
          // Wait for a short period to allow the device to respond
          await new Promise(resolve => setTimeout(resolve, 100));
          //console.log('Befor reset')
          return await sendCommandWithNewline(CTRL_CMD_SOFTRESET);

        case 'reset':
          return await sendCommandWithNewline(CTRL_CMD_SOFTRESET);
        default:
          addLog(`Unknown control command: ${command}`, 'error');
          return false;
      }
    };

    const disconnect = async () => {
      disconnectFlagRef.current = true;
      
      // Clear the message buffer on disconnect
      messageBufferRef.current = "";
      
      try {
        if (readerRef.current) {
          await readerRef.current.cancel();
          readerRef.current.releaseLock();
          readerRef.current = null;
        }
        
        if (writerRef.current) {
          writerRef.current.releaseLock();
          writerRef.current = null;
        }
        
        if (portRef.current) {
          await portRef.current.close();
          portRef.current = null;
        }
        
        setConnected(false);
        addLog('Disconnected successfully', 'system');
        return true;
      } catch (err) {
        addLog(`Disconnect error: ${err.name} - ${err.message}`, 'error');
        return false;
      }
    };

    const handleSend = () => {
      if (message.trim()) {
        sendCommandWithNewline(message);
        setMessage('');
      }
    };

    const sendCommandWithNewline = async (cmd) => {
      if (!writerRef.current) {
          addLog('Cannot send command - no writer available', 'error');
          return false;
      }
      
      try {
          const commandWithNewline = cmd + '\r\n';
          if (!cmd.startsWith('ping,')){
          addLog(`Sending command: ${cmd}`, 'sent');
          }
          await writerRef.current.write(textEncoder.encode(commandWithNewline));
          return true;
      } catch (err) {
          addLog(`Command send error: ${err.name} - ${err.message}`, 'error');
          return false;
      }
    };

      useEffect(() => {
      if (onSendCommand && typeof onSendCommand === 'function') {
          console.log("Registering sendCommandWithNewline function", typeof sendCommandWithNewline);
          onSendCommand(sendCommandWithNewline);
      }
      }, [onSendCommand]);

      const clearLog = () => {
      setLogs([]);
    };

    // Function to check for "Moved to (x,y)" pattern in the message buffer
    const checkForMovedToPattern = () => {
      // Regular expression to match the pattern "Moved to (x,y)" where x and y are numbers
      // This regex will find the pattern even if it's split across multiple packets
      const movedToRegex = /Moved\s+to\s*\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/g;
      
      // Check for matches in the buffer
      let match;
      while ((match = movedToRegex.exec(messageBufferRef.current)) !== null) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        
        // Log the detected position
        addLog(`Robot position detected: (${x}, ${y})`, 'system');
        
        // Update the robot position using the setRobotPos function passed as prop
        // Create a completely new array to ensure React detects the change
        // The z coordinate is set to 1 to ensure the robot is visible on the canvas
        
        const newPosition = [x, y, 1, null, null];
        console.log("Setting robot position from serial:", newPosition);
        setRobotPos(newPosition);
      }
      
      // Keep a reasonable buffer size (last 200 characters) to prevent memory issues
      // while ensuring we don't cut off potential partial messages
      if (messageBufferRef.current.length > 200) {
        messageBufferRef.current = messageBufferRef.current.slice(-200);
      }
    };

    // Check for WebSerial API support
    useEffect(() => {
      if (!navigator.serial) {
        addLog('WebSerial API is not supported in this browser. Please use Chrome or Edge.', 'error');
      } else {
        addLog('WebSerial API is supported in this browser!', 'system');
      }
    }, []);




//<FileDownloadManager packet={packet} setFarmData={setFarmData} />


    return (        
        <div>
            <div className="log-wrapper">
                <Button
                    size="sm"
                    onClick={() => setShowLogs(!showLogs)}
                    variant="outline-secondary"
                    style={{ marginBottom: '5px', width: '100%', textAlign: 'left' }}
                >
                    <FontAwesomeIcon icon={showLogs ? faChevronUp : faChevronDown} />
                    <span style={{ marginLeft: '10px' }}>
                        {showLogs ? 'Hide Log ' : 'Show Log '} 
                        ({logs.length} entries)
                    </span>
                </Button>
                
                <div className={`log-container ${showLogs ? 'show-log' : 'hide-log'}`} ref={logContainerRef}>
                {logs.map((log, index) => (
                  <div key={index} className={`log-entry ${log.type}`}>
                    [{log.timestamp.toLocaleTimeString()}] {log.message}
                  </div>
                ))} 
                </div>
            </div>
            <Button 
                size="lg" 
                onClick={connected ? disconnect : connectManually} 
                variant={connected ? "warning" : "success"} 
                style={{ margin: '0 5px' }}
            >
                <FontAwesomeIcon icon={faSignal} /> 
                <span className="button-text">
                    {connected ? "Disconnect Robot" : "Connect Robot"}
                </span>
            </Button>
            <Modal
            show={showModal}
            onHide={() => setShowModal(false)}
            centered
            style={{ zIndex: 9999 }}
            dialogClassName="modal-on-top"
            >
                <Modal.Header closeButton>
                    <Modal.Title>Pump Water Manually</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <Form>
                    <Form.Group controlId="pumpDuration" style={{ marginBottom: '15px' }}>
                        <Form.Label>Amount of Water (ml)</Form.Label>
                        <Form.Control
                            type="number"
                            placeholder="Enter amount of water in ml"
                            onChange={(e) => setPumpDuration(e.target.value)}
                        />
                    </Form.Group>
                    <Button 
                        variant="primary" 
                        onClick={() => {
                            sendCommandWithNewline(`12,${pumpDuration}`);
                            setShowModal(false);
                        }}
                    >
                        Start Pump
                    </Button>
                  </Form>
                </Modal.Body>
            </Modal>
            <Button size="lg" onClick={() => sendCommandWithNewline("20,0")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faFile} /> <span className="button-label">Reload data from robot</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("20,2")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faWater} /> <span className="button-label">Download moisture data</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("20,1")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faFlag} /> <span className="button-label">Download mission data</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("20,3")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faDroplet} /> <span className="button-label">Download watering data</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("6")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} /> <span className="button-label">Calibrate gantry size</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("11")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faFileImport} /> <span className="button-label">JSON gantry size</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("2")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faArrowUpFromGroundWater} /> <span className="button-label">Get moisture reading</span>
            </Button>
            <Button size="lg" onClick={() => setShowModal(true)} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faGasPump} /> <span className="button-label">Pump Water Manually</span>
            </Button>

            
            {/* File Transfer Modal */}
            <Modal 
                show={showFileTransferModal}
                centered
                backdrop="static"
                keyboard={false}
                style={{ zIndex: 9999 }}
                dialogClassName="modal-on-top"
            >
                <Modal.Header>
                    <Modal.Title>File Transfer</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Downloading file from robot...</p>
                    <div className="progress">
                        <div 
                            className="progress-bar" 
                            role="progressbar" 
                            style={{
                                width: `${(transferProgress.current / transferProgress.total) * 100}%`
                            }}
                            aria-valuenow={transferProgress.current}
                            aria-valuemin="0"
                            aria-valuemax={transferProgress.total}
                        >
                            {transferProgress.current} / {transferProgress.total}
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </div>
    );
}

export default ConnectivityComponent;
