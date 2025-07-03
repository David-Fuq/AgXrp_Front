import React, { useState, useEffect, useRef } from 'react';
import { faSignal, faFile, faFlag, faDroplet, faWater, faUpRightAndDownLeftFromCenter, faFileImport } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import './connection.css';
import FileTransferReceiver from './FileTransferReciever';

//TODO -> Download data. Should be just missing transform json into file.
/*
function FileDownloadManager({ packet, setFarmData }) {
    const [downloadStatus, setDownloadStatus] = useState(null);
    const [buffer_data, setBufferData] = useState(new Uint8Array(0));
    const [file_type, setFileType] = useState(0);
    const [buffer_checksum, setBufferChecksum] = useState(0);
    const [message_counter, setMessageCounter] = useState(0);
    const [message_length, setMessageLength] = useState(0);

    useEffect(() => {
        if (packet != null) {
            processPacket(packet);
        }
    }, [packet]);

    const resetBuffer = () => {
        setBufferData(new Uint8Array(0));
        setFileType(0);
        setBufferChecksum(0);
        setMessageCounter(0);
        setMessageLength(0);
    };

    const calculatePacketChecksum = (payload) => {
        let checksum = 0;
        for (let i = 0; i < payload.length; i++) checksum += payload[i];
        return checksum % 256;
    };

    const processDataAsJson = () => {
        const data = new TextDecoder().decode(buffer_data);
        try {
            setFarmData(JSON.parse(data));
        } catch {
            resetBuffer();
        }
    };

    const processDataAsCsv = (file_name) => {
        const data = new TextDecoder().decode(buffer_data);
        try {
            const blob = new Blob([data], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file_name + ".csv";
            a.click();
        } catch {
            resetBuffer();
        }
    };

    const processHeader = (packet) => {
        resetBuffer();
        let message_checksum = packet.getUint8(packet.buffer.byteLength - 1);
        let packet_checksum = calculatePacketChecksum(new Uint8Array(packet.buffer.slice(0, -1)));
        if (message_checksum !== packet_checksum) return;
        setFileType(packet.getUint8(1));
        setMessageLength(packet.getUint8(2));
        setBufferChecksum(packet.getUint8(3));
        setDownloadStatus(`Downloading data 0 of ${packet.getUint8(2)}`);
    };

    const processPayload = (packet) => {
        let message_checksum = packet.getUint8(packet.buffer.byteLength - 1);
        let packet_checksum = calculatePacketChecksum(new Uint8Array(packet.buffer.slice(0, -1)));
        if (message_checksum !== packet_checksum) return;

        let packet_index = packet.getUint8(1);
        if (packet_index !== message_counter) return;

        let payload = new Uint8Array(packet.buffer.slice(2, -1));
        setBufferData(prev => new Uint8Array([...prev, ...payload]));
        setMessageCounter(prev => prev + 1);
        setDownloadStatus(`Downloading data ${packet_index + 1} of ${message_length}`);
    };

    const processFooter = (packet) => {
        setDownloadStatus("Downloading complete.");
        if (file_type === 1) processDataAsJson();
        else if (file_type === 2) {
            let file_name = new TextDecoder().decode(new Uint8Array(packet.buffer.slice(1)));
            processDataAsCsv(file_name);
        }
        resetBuffer();
        setDownloadStatus(null);
    };

    const processPacket = (packet) => {
        switch (packet.getUint8(0)) {
            case 1: processHeader(packet); break;
            case 2: processPayload(packet); break;
            case 3: processFooter(packet); break;
            default: resetBuffer();
        }
    };

    return downloadStatus ? (
        <div className="modal show" style={{ display: 'block', position: 'fixed', zIndex: 10000 }}>
            <Modal.Dialog>
                <Modal.Header closeButton>
                    <Modal.Title>File Transfer Manager</Modal.Title>
                </Modal.Header>
                <Modal.Body><p>{downloadStatus}</p></Modal.Body>
            </Modal.Dialog>
        </div>
    ) : null;
}
    */



function ConnectivityComponent({ robotCmd, datatoSend, setFarmData, setRobotPos }) {
    //console.log(robotCmd);
    const pingIntervalRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [message, setMessage] = useState('');
    const [logs, setLogs] = useState([]);
    const [busy, setBusy] = useState(false);
    const [showFileTransferModal, setShowFileTransferModal] = useState(false);
    const [transferProgress, setTransferProgress] = useState({ current: 0, total: 0 });

    const [jsonData, setJsonData] = useState(null);
    const [isCollectingJson, setIsCollectingJson] = useState(false);
    const jsonBufferRef = useRef("");

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
    const XRP_SEND_BLOCK_SIZE = 250;

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
        
        if (result.fileType === 'JSON') {
            // Update the farm data if we received JSON data
            setFarmData(result.data);
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
          await sendCommandWithNewline("ping");
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
                
                // Process the received text line by line
                const lines = text.split('\n');
                for (const line of lines) {
                  const trimmedLine = line.trim();
                  
                  // Check for file transfer message
                  if (trimmedLine.startsWith('FT,')) {
                      // Show file transfer modal if not already shown
                      if (!showFileTransferModal) {
                          setShowFileTransferModal(true);
                          setTransferProgress({ current: 0, total: 1 });
                      }
                      
                      // Process the file transfer message
                      const parts = trimmedLine.split(',');
                      if (parts[1] === 'P' && parts.length >= 4) {
                          // Update progress for payload chunks
                          setTransferProgress({
                              current: parseInt(parts[2]) + 1,
                              total: parseInt(parts[3])
                          });
                      }
                      
                      const result = fileTransferRef.current.processMessage(trimmedLine);
                      if (result) {
                          // File transfer is complete - handled by the callback
                          addLog(`File transfer complete: ${result.fileName || 'unnamed file'}`, 'received');
                      }
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
                      } catch (e) {
                        addLog(`Error parsing JSON: ${e.message}`, 'error');
                        addLog(`Raw JSON buffer: ${jsonBuffer}`, 'error');
                      }
                      continue;
                  }
                  
                  if (collectingJson) {
                      // Collecting JSON data
                      jsonBuffer += trimmedLine;
                  } else {
                      // Regular text output
                      addLog(`Received: ${trimmedLine}`, 'received');
                      if (trimmedLine.includes("Moisture reading")){
                        addLog(`ALERT`, 'received');
                        alert(`Moisture Data Received:\n${trimmedLine}`);
                      }
                  }
                }
            }
          }
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
          addLog(`Sending command: ${cmd}`, 'sent');
          await writerRef.current.write(textEncoder.encode(commandWithNewline));
          return true;
      } catch (err) {
          addLog(`Command send error: ${err.name} - ${err.message}`, 'error');
          return false;
      }
      };

      const clearLog = () => {
      setLogs([]);
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
            <div className="log-container" ref={logContainerRef}>
            {logs.map((log, index) => (
              <div key={index} className={`log-entry ${log.type}`}>
                [{log.timestamp.toLocaleTimeString()}] {log.message}
              </div>
            ))}
            </div>
            <Button size="lg" onClick={connectManually} variant={connected ? "success" : "outline-light"} style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faSignal} /> <span className="button-text">Connect Robot</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("20,0")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faFile} /> <span className="button-label">Reload data from robot</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("2")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faWater} /> <span className="button-label">Show moisture data</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("get_sensor_data")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faFlag} /> <span className="button-label">Download mission data</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("get_sensor_data")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faDroplet} /> <span className="button-label">Download watering data</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("6")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} /> <span className="button-label">Calibrate gantry size</span>
            </Button>
            <Button size="lg" onClick={() => sendCommandWithNewline("11")} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faFileImport} /> <span className="button-label">JSON gantry size</span>
            </Button>
            
            {/* File Transfer Modal */}
            <Modal 
                show={showFileTransferModal} 
                centered
                backdrop="static"
                keyboard={false}
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
