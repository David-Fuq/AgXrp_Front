import React, { useState, useEffect } from 'react';
import { faSignal, faFile, faFlag, faDroplet, faWater, faUpRightAndDownLeftFromCenter } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import './connection.css';

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

function getTimeStamp() {
    let time = new Date().toLocaleTimeString().split(/:| /);
    if (time[3] === "PM" && time[0] !== "12") time[0] = Number(time[0]) + 12;
    let date = new Date().toLocaleDateString().split('/');
    let day = new Date().getDay();
    return new Uint8Array([99, +time[2], +time[1], +time[0], day, +date[0], +date[1], +date[2] - 2000]);
}

function ConnectivityComponent({ robotCmd, datatoSend, setFarmData, setRobotPos }) {
    const [port, setPort] = useState(null);
    const [writer, setWriter] = useState(null);
    const [packet, setPacket] = useState(null);
    const [heartBeat, setHeartBeat] = useState(null);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (robotCmd) sendRobotCmd(robotCmd);
    }, [robotCmd]);

    useEffect(() => {
        if (datatoSend) requestData(3, datatoSend);
    }, [datatoSend]);

    const createConnection = async () => {
        if (!('serial' in navigator)) {
            alert('Web Serial not available. Use Chrome or Edge.');
            return;
        }
        try {
            const selectedPort = await navigator.serial.requestPort();
            await selectedPort.open({ baudRate: 115200 });
            setPort(selectedPort);
            setIsConnected(true);
            console.log('Connected to port:', selectedPort.getInfo());

            const textWriter = selectedPort.writable.getWriter();
            setWriter(textWriter);

            const reader = selectedPort.readable.getReader();
            listenToPort(reader);

            await new Promise(res => setTimeout(res, 500));
            await requestData(3, getTimeStamp());
            await requestData(0);
        } catch (err) {
            console.error('Connection error:', err);
        }
    };

    const listenToPort = async (reader) => {
        while (true) {
            try {
                const { value, done } = await reader.read();
                if (done || !value) break;
                const dataView = new DataView(value.buffer);
                const type = dataView.getUint8(0);
                if (type === 0) {
                    setRobotPos([
                        dataView.getUint16(2),
                        dataView.getUint16(4),
                        dataView.getUint16(0)
                    ]);
                    setHeartBeat(true);
                } else {
                    setPacket(dataView);
                }
            } catch (error) {
                console.error('Serial read error:', error);
                break;
            }
        }
    };

    const sendRobotCmd = async (robotCmd) => {
        console.log(`Sending command: ${robotCmd}`);
        if (!writer) return;
        const cmdBuffer = new Uint16Array(robotCmd);
        await writer.write(new Uint8Array([1, ...new Uint8Array(cmdBuffer.buffer)]));
    };

    const requestData = async (value, data = null) => {
        console.log(`Requesting data with value: ${value}`);
        if (!writer) return;
        const buffer = data ? new Uint8Array([2, value, ...data]) : new Uint8Array([2, value]);
        await writer.write(buffer);
    };

    return (
        <div>
            <FileDownloadManager packet={packet} setFarmData={setFarmData} />
            <Button size="lg" onClick={createConnection} variant={isConnected ? "success" : "outline-light"} style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faSignal} /> <span className="button-text">Connect Robot</span>
            </Button>
            <Button size="lg" onClick={() => requestData(0)} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faFile} /> <span className="button-label">Reload data from robot</span>
            </Button>
            <Button size="lg" onClick={() => requestData(5)} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faWater} /> <span className="button-label">Download moisture data</span>
            </Button>
            <Button size="lg" onClick={() => requestData(1)} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faFlag} /> <span className="button-label">Download mission data</span>
            </Button>
            <Button size="lg" onClick={() => requestData(2)} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faDroplet} /> <span className="button-label">Download watering data</span>
            </Button>
            <Button size="lg" onClick={() => sendRobotCmd([6, 0, 0, 0, 0])} variant="outline-light" style={{ margin: '0 5px' }}>
                <FontAwesomeIcon icon={faUpRightAndDownLeftFromCenter} /> <span className="button-label">Calibrate gantry size</span>
            </Button>
        </div>
    );
}

export default ConnectivityComponent;
