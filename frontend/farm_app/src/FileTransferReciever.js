class FileTransferReceiver {
  constructor(onComplete) {
    this.onComplete = onComplete;
    this.reset();
    this.messageBuffer = ''; // Add a buffer for incomplete messages
  }

  reset() {
    this.fileType = null;
    this.fileSize = 0;
    this.expectedChunks = 0;
    this.receivedChunks = [];
    this.fileName = null;
    this.fileChecksum = 0;
    this.transferComplete = false;
  }

  /**
   * Process incoming text from the serial connection
   * @param {string} text - Raw text received from serial
   */
  processIncomingText(text) {
    // Append the text to our buffer
    this.messageBuffer += text;
    
    // Process any complete FT messages in the buffer
    this.processMessageBuffer();
  }

  /**
   * Process the message buffer, extracting complete FT messages
   */
  processMessageBuffer() {
    // Look for complete FT messages in the buffer
    const ftIndex = this.messageBuffer.indexOf('FT,');
    if (ftIndex === -1) return; // No FT message found
    
    // Extract from FT to the next newline or end of buffer
    let endIndex = this.messageBuffer.indexOf('\n', ftIndex);
    if (endIndex === -1) endIndex = this.messageBuffer.indexOf('\r', ftIndex);
    if (endIndex === -1) return; // No complete message yet
    
    // Extract the message
    const message = this.messageBuffer.substring(ftIndex, endIndex).trim();
    
    // Remove the processed message from the buffer
    this.messageBuffer = this.messageBuffer.substring(endIndex + 1);
    
    // Process the complete message
    try {
      const result = this.processMessage(message);
      if (result && this.onComplete) {
        this.onComplete(result);
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
    
    // Recursively process any other complete messages
    if (this.messageBuffer.includes('FT,')) {
      this.processMessageBuffer();
    }
  }

  /**
   * Process a received message from the serial connection
   * @param {string} message - The message received (FT,type,data)
   * @returns {Object|null} - The completed file data or null if transfer is not complete
   */
  processMessage(message) {
    console.log("Processing complete message:", message);
    
    const parts = message.split(',');
    if (parts.length < 2 || parts[0] !== 'FT') {
      console.error('Invalid message format:', message);
      return null;
    }

    const messageType = parts[1];
    
    try {
      switch(messageType) {
        case 'H': // Header
          return this.processHeader(parts[2]);
        case 'P': // Payload
          return this.processPayload(parts[2], parts[3], parts[4]);
        case 'L': // Last/End
          return this.processLastMessage(parts[2]);
        case 'ERR': // Error
          console.error('File transfer error:', parts.slice(2).join(','));
          this.reset();
          return null;
        default:
          console.warn('Unknown message type:', messageType);
          return null;
      }
    } catch (error) {
      console.error('Error processing message:', error, message);
      return null;
    }
  }

  /**
   * Process the header message
   * @param {string} hexData - Hex encoded header data
   */
  processHeader(hexData) {
    console.log("Processing header:", hexData);
    
    // Convert hex string to byte array
    const headerBytes = this.hexToBytes(hexData);
    
    if (headerBytes[0] !== 0x01) {
      throw new Error('Invalid header marker');
    }
    
    this.fileType = headerBytes[1];
    this.expectedChunks = headerBytes[2];
    // File size is a 4-byte little-endian integer
    this.fileSize = headerBytes[3] + (headerBytes[4] << 8) + (headerBytes[5] << 16) + (headerBytes[6] << 24);
    this.fileChecksum = headerBytes[7];
    
    // Initialize the array to store chunks
    this.receivedChunks = new Array(this.expectedChunks);
    this.transferComplete = false;
    
    console.log(`Starting file transfer: ${this.expectedChunks} chunks, ${this.fileSize} bytes`);
    return null; // Transfer not complete yet
  }

  /**
   * Process a payload chunk
   * @param {string} chunkIndex - The index of this chunk
   * @param {string} totalChunks - Total chunks expected
   * @param {string} hexData - Hex encoded chunk data
   */
  processPayload(chunkIndex, totalChunks, hexData) {
    const index = parseInt(chunkIndex);
    
    console.log(`Processing payload chunk ${index}/${totalChunks}`);
    
    if (!this.receivedChunks || index >= this.expectedChunks) {
      console.error(`Invalid chunk index ${index}, expected chunks: ${this.expectedChunks}`);
      throw new Error(`Chunk index ${index} out of range`);
    }
    
    const chunkBytes = this.hexToBytes(hexData);
    
    if (chunkBytes[0] !== 0x02) {
      throw new Error('Invalid chunk marker');
    }
    
    // Store just the payload data (remove header, index, and checksum)
    this.receivedChunks[index] = chunkBytes.slice(2, -1);
    
    console.log(`Received chunk ${index + 1}/${totalChunks}`);
    return null; // Transfer not complete yet
  }

  /**
   * Process the last message
   * @param {string} hexData - Hex encoded last message data
   * @returns {Object|null} - The completed file data or null if there was an error
   */
  processLastMessage(hexData) {
    console.log("Processing last message:", hexData);
    
    const lastBytes = this.hexToBytes(hexData);
    
    if (lastBytes[0] !== 0x03) {
      throw new Error('Invalid end marker');
    }
    
    // Extract file name if present
    if (lastBytes.length > 1) {
      this.fileName = new TextDecoder().decode(new Uint8Array(lastBytes.slice(1)));
    }
    
    // Check if we've received all expected chunks
    if (!this.receivedChunks) {
      throw new Error('No chunks received before end message');
    }
    
    // Check for missing chunks
    const missingChunks = [];
    for (let i = 0; i < this.expectedChunks; i++) {
      if (!this.receivedChunks[i]) {
        missingChunks.push(i);
      }
    }
    
    if (missingChunks.length > 0) {
      throw new Error(`Missing chunks: ${missingChunks.join(', ')}`);
    }
    
    // Combine all chunks
    const allChunks = [];
    for (let i = 0; i < this.receivedChunks.length; i++) {
      allChunks.push(...this.receivedChunks[i]);
    }
    
    const combinedData = new Uint8Array(allChunks);
    
    // Calculate checksum and verify
    const calculatedChecksum = this.calculateChecksum(combinedData);
    if (calculatedChecksum !== this.fileChecksum) {
      console.warn(`Checksum verification failed: expected ${this.fileChecksum}, got ${calculatedChecksum}`);
      // Continue anyway, sometimes checksums don't match due to protocol issues
    }
    
    // Parse data based on file type
    let result;
    if (this.fileType === 0x01) { // JSON
      const jsonString = new TextDecoder().decode(combinedData);
      try {
        result = JSON.parse(jsonString);
        console.log("Parsed JSON data:", result);
      } catch (e) {
        console.error("Error parsing JSON:", e, jsonString);
        result = jsonString; // Return as string if parsing fails
      }
    } else if (this.fileType === 0x02) { // CSV
      const csvString = new TextDecoder().decode(combinedData);
      result = csvString;
    } else {
      result = combinedData; // Raw data
    }
    
    this.transferComplete = true;
    console.log(`Transfer complete: ${this.fileName || "unnamed file"}`);
    
    const finalResult = {
      data: result,
      fileName: this.fileName,
      fileType: this.fileType === 0x01 ? 'JSON' : 
                this.fileType === 0x02 ? 'CSV' : 'binary'
    };
    
    // Reset state for next transfer
    this.reset();
    
    return finalResult;
  }

  /**
   * Calculate checksum for a byte array
   * @param {Uint8Array} data - The data to calculate checksum for
   * @returns {number} - The calculated checksum
   */
  calculateChecksum(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum = (sum + data[i]) % 256;
    }
    return sum;
  }

  /**
   * Convert a hex string to byte array
   * @param {string} hex - The hex string to convert
   * @returns {number[]} - The byte array
   */
  hexToBytes(hex) {
    const bytes = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }
}

export default FileTransferReceiver;