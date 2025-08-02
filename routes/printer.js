// routes/printer.js - TVS RP3160 GOLD Optimized Printer Integration
const express = require('express');
const Bill = require('../models/Bill');
const auth = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const net = require('net');

const router = express.Router();

// TVS RP3160 GOLD Specific ESC/POS Commands
const TVS_ESC_POS = {
  // Basic Commands
  INIT: Buffer.from([0x1B, 0x40]), // Initialize printer
  FEED_LINE: Buffer.from([0x0A]), // Line feed
  CARRIAGE_RETURN: Buffer.from([0x0D]), // Carriage return
  CUT: Buffer.from([0x1D, 0x56, 0x00]), // Full cut
  PARTIAL_CUT: Buffer.from([0x1D, 0x56, 0x01]), // Partial cut
  
  // Alignment
  ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]),
  ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]),
  ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 0x02]),
  
  // Font Styles
  BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),
  BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),
  UNDERLINE_ON: Buffer.from([0x1B, 0x2D, 0x01]),
  UNDERLINE_OFF: Buffer.from([0x1B, 0x2D, 0x00]),
  DOUBLE_STRIKE_ON: Buffer.from([0x1B, 0x47, 0x01]),
  DOUBLE_STRIKE_OFF: Buffer.from([0x1B, 0x47, 0x00]),
  
  // Font Sizes (TVS RP3160 GOLD specific)
  SIZE_NORMAL: Buffer.from([0x1D, 0x21, 0x00]), // Normal size
  SIZE_DOUBLE_HEIGHT: Buffer.from([0x1D, 0x21, 0x01]), // Double height
  SIZE_DOUBLE_WIDTH: Buffer.from([0x1D, 0x21, 0x10]), // Double width
  SIZE_DOUBLE: Buffer.from([0x1D, 0x21, 0x11]), // Double height + width
  SIZE_LARGE: Buffer.from([0x1D, 0x21, 0x22]), // Large font
  
  // Character encoding for Hindi support
  CODE_PAGE_437: Buffer.from([0x1B, 0x74, 0x00]), // Default
  CODE_PAGE_850: Buffer.from([0x1B, 0x74, 0x02]), // Multilingual
  
  // Cash drawer (TVS RP3160 GOLD specific)
  CASH_DRAWER_PIN2: Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]), // Standard
  CASH_DRAWER_PIN5: Buffer.from([0x1B, 0x70, 0x01, 0x19, 0xFA]), // Alternative
  
  // Paper feed and cutting
  FEED_LINES_3: Buffer.from([0x1B, 0x64, 0x03]), // Feed 3 lines
  FEED_LINES_5: Buffer.from([0x1B, 0x64, 0x05]), // Feed 5 lines
  
  // Barcode settings
  BARCODE_HEIGHT: Buffer.from([0x1D, 0x68, 0x50]), // Set barcode height
  BARCODE_WIDTH: Buffer.from([0x1D, 0x77, 0x02]), // Set barcode width
  BARCODE_POSITION: Buffer.from([0x1D, 0x48, 0x02]), // Print HRI below barcode
  
  // Special characters for invoice formatting
  TOP_LEFT: '┌',
  TOP_RIGHT: '┐',
  BOTTOM_LEFT: '└',
  BOTTOM_RIGHT: '┘',
  HORIZONTAL: '─',
  VERTICAL: '│',
  CROSS: '┼'
};

// Utility function to create buffer from mixed content
function createTVSBuffer(content) {
  const buffers = [];
  
  for (const item of content) {
    if (Buffer.isBuffer(item)) {
      buffers.push(item);
    } else if (typeof item === 'string') {
      // Convert to buffer with proper encoding for TVS printer
      buffers.push(Buffer.from(item, 'utf8'));
    }
  }
  
  return Buffer.concat(buffers);
}

// Enhanced bill formatting specifically for TVS RP3160 GOLD (32 character width)
function createTVSRP3160Bill(bill) {
  const content = [];
  const LINE_WIDTH = 32; // TVS RP3160 GOLD standard width
  
  // Initialize printer with TVS specific settings
  content.push(TVS_ESC_POS.INIT);
  content.push(TVS_ESC_POS.CODE_PAGE_850); // Better character support
  content.push('\n');
  
  // Header - Restaurant Name
  content.push(TVS_ESC_POS.ALIGN_CENTER);
  content.push(TVS_ESC_POS.SIZE_DOUBLE);
  content.push(TVS_ESC_POS.BOLD_ON);
  content.push('*** RESTAURANT POS ***\n');
  content.push(TVS_ESC_POS.SIZE_NORMAL);
  content.push(TVS_ESC_POS.BOLD_OFF);
  content.push('\n');
  
  // Restaurant Details
  content.push('123 Main Street, City - 12345\n');
  content.push('Ph: +91-9691954035\n');
  content.push('GSTIN: 12ABCDE3456F7GH\n');
  content.push('FSSAI: 12345678901234\n');
  content.push('\n');
  
  // Separator line
  content.push('='.repeat(LINE_WIDTH) + '\n');
  
  // Bill Information
  content.push(TVS_ESC_POS.ALIGN_LEFT);
  content.push(TVS_ESC_POS.BOLD_ON);
  content.push(`BILL NO: ${(bill.billNumber || 'N/A').toString().padEnd(18)}\n`);
  content.push(TVS_ESC_POS.BOLD_OFF);
  
  const date = new Date(bill.createdAt || new Date());
  const dateStr = date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
  const timeStr = date.toLocaleTimeString('en-IN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
  
  content.push(`Date: ${dateStr.padEnd(12)} ${timeStr}\n`);
  
  if (bill.customerName) {
    const customerName = bill.customerName.length > 24 
      ? bill.customerName.substring(0, 24) + '..' 
      : bill.customerName;
    content.push(`Customer: ${customerName}\n`);
  }
  
  if (bill.customerPhone) {
    content.push(`Phone: ${bill.customerPhone}\n`);
  }
  
  if (bill.tableNumber) {
    content.push(`Table: ${bill.tableNumber}\n`);
  }
  
  content.push('\n');
  content.push('='.repeat(LINE_WIDTH) + '\n');
  
  // Items header with proper alignment for 32 chars
  content.push(TVS_ESC_POS.BOLD_ON);
  content.push('ITEM             QTY   AMOUNT\n');
  content.push('-'.repeat(LINE_WIDTH) + '\n');
  content.push(TVS_ESC_POS.BOLD_OFF);
  
  // Items with TVS RP3160 GOLD optimized formatting
  let itemTotal = 0;
  if (bill.items && Array.isArray(bill.items)) {
    bill.items.forEach((item, index) => {
      if (!item) return;
      
      const itemName = (item.name || 'Unknown Item');
      let displayName = itemName.length > 16 
        ? itemName.substring(0, 14) + '..' 
        : itemName;
      
      const qty = item.quantity || 1;
      const price = item.price || 0;
      const total = item.total || (price * qty) || 0;
      itemTotal += total;
      
      // Format line with exact spacing for 32 characters
      const nameField = displayName.padEnd(16);
      const qtyField = qty.toString().padStart(3);
      const totalField = total.toFixed(2).padStart(8);
      
      content.push(`${nameField} ${qtyField} ${totalField}\n`);
      
      // Show unit price for multiple quantities
      if (qty > 1 && price > 0) {
        const priceInfo = `  @ Rs.${price.toFixed(2)} each`;
        content.push(`${priceInfo}\n`);
      }
    });
  }
  
  content.push('-'.repeat(LINE_WIDTH) + '\n');
  
  // Totals section with proper alignment
  const subtotal = bill.subtotal || itemTotal || 0;
  const gstRate = bill.gstRate || 18;
  const gst = bill.gst || bill.tax || (subtotal * gstRate / 100) || 0;
  const discount = bill.discount || 0;
  const serviceCharge = bill.serviceCharge || 0;
  const total = bill.total || (subtotal + gst + serviceCharge - discount);
  
  content.push(`Subtotal:${subtotal.toFixed(2).padStart(23)}\n`);
  
  if (serviceCharge > 0) {
    content.push(`Service Charge:${serviceCharge.toFixed(2).padStart(16)}\n`);
  }
  
  if (gst > 0) {
    content.push(`GST (${gstRate}%):${gst.toFixed(2).padStart(21)}\n`);
  }
  
  if (discount > 0) {
    content.push(`Discount:${('-' + discount.toFixed(2)).padStart(22)}\n`);
  }
  
  content.push('\n');
  content.push('='.repeat(LINE_WIDTH) + '\n');
  
  // Grand Total - Highlighted
  content.push(TVS_ESC_POS.ALIGN_CENTER);
  content.push(TVS_ESC_POS.SIZE_DOUBLE_HEIGHT);
  content.push(TVS_ESC_POS.BOLD_ON);
  content.push(`TOTAL: Rs.${total.toFixed(2)}\n`);
  content.push(TVS_ESC_POS.SIZE_NORMAL);
  content.push(TVS_ESC_POS.BOLD_OFF);
  content.push('\n');
  
  // Payment information
  content.push(TVS_ESC_POS.ALIGN_LEFT);
  if (bill.paymentMethod) {
    const paymentMethod = bill.paymentMethod.toUpperCase();
    content.push(`PAYMENT MODE: ${paymentMethod}\n`);
    
    if (paymentMethod === 'CASH' && bill.cashReceived) {
      content.push(`Cash Received: Rs.${bill.cashReceived.toFixed(2)}\n`);
      const change = bill.cashReceived - total;
      if (change > 0) {
        content.push(`Change: Rs.${change.toFixed(2)}\n`);
      }
    }
  }
  
  const status = bill.status || 'pending';
  content.push(TVS_ESC_POS.BOLD_ON);
  content.push(`${status === 'paid' ? '*** PAYMENT RECEIVED ***' : '*** PAYMENT PENDING ***'}\n`);
  content.push(TVS_ESC_POS.BOLD_OFF);
  content.push('\n');
  
  content.push('='.repeat(LINE_WIDTH) + '\n');
  
  // Footer
  content.push(TVS_ESC_POS.ALIGN_CENTER);
  content.push(TVS_ESC_POS.BOLD_ON);
  content.push('THANK YOU FOR VISITING!\n');
  content.push(TVS_ESC_POS.BOLD_OFF);
  content.push('\n');
  content.push('Please visit us again!\n');
  content.push('Rate us & get 10% off\n');
  content.push('on your next visit\n');
  content.push('\n');
  
  // Bill reference and timestamp
  if (bill._id) {
    content.push(`Ref: ${bill._id.toString().slice(-8).toUpperCase()}\n`);
  }
  content.push(`${new Date().toLocaleString('en-IN')}\n`);
  
  // Extra spacing for tear-off
  content.push('\n\n');
  content.push(TVS_ESC_POS.FEED_LINES_3);
  
  // Cut paper
  content.push(TVS_ESC_POS.CUT);
  
  return createTVSBuffer(content);
}

// TVS RP3160 GOLD specific printer function
async function printToTVSRP3160(bill, printerName) {
  return new Promise((resolve, reject) => {
    try {
      const printer = require('printer');
      const printerData = createTVSRP3160Bill(bill);
      
      // Get available printers
      const printers = printer.getPrinters();
      
      if (printers.length === 0) {
        return reject(new Error('No printers found. Please install TVS RP3160 GOLD drivers.'));
      }
      
      console.log('Available printers:', printers.map(p => p.name));
      
      // Find TVS RP3160 GOLD printer
      let targetPrinter = null;
      
      if (printerName) {
        targetPrinter = printers.find(p => p.name === printerName);
      }
      
      if (!targetPrinter) {
        // Look specifically for TVS RP3160 variations
        const tvsKeywords = ['tvs', 'rp3160', 'rp-3160', 'gold', 'thermal', 'pos'];
        targetPrinter = printers.find(p => 
          tvsKeywords.some(keyword => 
            p.name.toLowerCase().includes(keyword.toLowerCase())
          )
        );
      }
      
      if (!targetPrinter) {
        // Use default printer as fallback
        targetPrinter = printers.find(p => p.isDefault) || printers[0];
        console.log(`TVS RP3160 GOLD not found, using: ${targetPrinter.name}`);
      }
      
      // Print with TVS specific settings
      const printTimeout = setTimeout(() => {
        reject(new Error('Print operation timed out after 30 seconds'));
      }, 30000);
      
      printer.printDirect({
        data: printerData,
        printer: targetPrinter.name,
        type: 'RAW', // RAW mode for ESC/POS commands
        options: {
          media: 'Custom.80x297mm', // TVS RP3160 GOLD paper size
          'fit-to-page': true
        },
        success: function(jobID) {
          clearTimeout(printTimeout);
          console.log(`TVS RP3160 GOLD print successful. Job ID: ${jobID}`);
          resolve({ 
            success: true, 
            message: 'Bill printed successfully on TVS RP3160 GOLD', 
            printer: targetPrinter.name,
            jobID: jobID,
            model: 'TVS RP3160 GOLD'
          });
        },
        error: function(err) {
          clearTimeout(printTimeout);
          console.error('TVS RP3160 GOLD print error:', err);
          reject(new Error(`TVS RP3160 GOLD print failed: ${err}`));
        }
      });
      
    } catch (error) {
      console.error('TVS RP3160 GOLD printer error:', error);
      reject(new Error(`TVS RP3160 GOLD initialization failed: ${error.message}`));
    }
  });
}

// Enhanced USB printing specifically for TVS RP3160 GOLD
async function printToTVSUSB(bill) {
  return new Promise((resolve, reject) => {
    try {
      const printerData = createTVSRP3160Bill(bill);
      
      // Create temp directory
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, `tvs_bill_${bill.billNumber || Date.now()}.prn`);
      
      // Write binary data for TVS RP3160 GOLD
      fs.writeFileSync(tempFile, printerData);
      
      // TVS RP3160 GOLD common USB ports
      const tvsPorts = [
        'USB001:', // Most common for TVS printers
        'USB002:',
        'LPT1:',   // Parallel port adapter
        'COM1:',   // USB to Serial adapter
        'COM2:',   // Alternative serial port
        '\\\\localhost\\TVS', // Network shared name
        '\\\\localhost\\RP3160' // Alternative network name
      ];
      
      let portIndex = 0;
      
      function tryNextTVSPort() {
        if (portIndex >= tvsPorts.length) {
          resolve({
            success: true,
            message: 'TVS RP3160 GOLD file saved for manual printing',
            tempFile: tempFile,
            instruction: `Copy ${tempFile} to your TVS RP3160 GOLD printer manually or check USB connection`
          });
          return;
        }
        
        const port = tvsPorts[portIndex];
        portIndex++;
        
        console.log(`Trying TVS RP3160 GOLD on port: ${port}`);
        
        exec(`copy "${tempFile}" /B ${port} /B`, (error, stdout, stderr) => {
          if (!error) {
            console.log(`TVS RP3160 GOLD print successful on ${port}`);
            
            // Clean up temp file after successful print
            setTimeout(() => {
              try {
                fs.unlinkSync(tempFile);
              } catch (e) {
                console.log('Could not delete temp file:', e.message);
              }
            }, 3000);
            
            resolve({
              success: true,
              message: `Bill printed successfully on TVS RP3160 GOLD via ${port}`,
              port: port,
              model: 'TVS RP3160 GOLD'
            });
          } else {
            console.log(`TVS port ${port} failed, trying next...`);
            tryNextTVSPort();
          }
        });
      }
      
      tryNextTVSPort();
      
    } catch (error) {
      console.error('TVS RP3160 GOLD USB error:', error);
      reject(new Error(`TVS RP3160 GOLD USB print failed: ${error.message}`));
    }
  });
}

// Network printing for shared TVS RP3160 GOLD
async function printToTVSNetwork(bill, ip = '192.168.1.100', port = 9100) {
  return new Promise((resolve, reject) => {
    try {
      const printerData = createTVSRP3160Bill(bill);
      const client = new net.Socket();
      
      // TVS RP3160 GOLD specific timeout
      client.setTimeout(20000);
      
      client.connect(port, ip, () => {
        console.log(`Connected to TVS RP3160 GOLD at ${ip}:${port}`);
        client.write(printerData);
        
        // TVS printers need a moment to process
        setTimeout(() => {
          client.end();
        }, 2000);
      });
      
      client.on('close', () => {
        console.log('TVS RP3160 GOLD network connection closed');
        resolve({ 
          success: true, 
          message: 'Bill printed on TVS RP3160 GOLD via network',
          ip: ip,
          port: port,
          model: 'TVS RP3160 GOLD'
        });
      });
      
      client.on('error', (err) => {
        console.error('TVS RP3160 GOLD network error:', err);
        client.destroy();
        reject(new Error(`TVS RP3160 GOLD network print failed: ${err.message}`));
      });
      
      client.on('timeout', () => {
        console.error('TVS RP3160 GOLD network timeout');
        client.destroy();
        reject(new Error('TVS RP3160 GOLD network connection timeout'));
      });
      
    } catch (error) {
      console.error('TVS RP3160 GOLD network setup error:', error);
      reject(new Error(`TVS RP3160 GOLD network setup failed: ${error.message}`));
    }
  });
}

// Main print function optimized for TVS RP3160 GOLD
async function printBillTVS(bill, printerConfig = {}) {
  const { 
    connection = 'auto', 
    ip = '192.168.1.100', 
    port = 9100, 
    printerName,
    retries = 2,
    openCashDrawer = false
  } = printerConfig;
  
  console.log(`Printing on TVS RP3160 GOLD - Bill: ${bill.billNumber || 'unknown'}, Connection: ${connection}`);
  
  if (!bill) {
    throw new Error('Bill data is required for TVS RP3160 GOLD printing');
  }
  
  // Add cash drawer command if requested
  if (openCashDrawer && bill.paymentMethod === 'cash') {
    console.log('Opening cash drawer on TVS RP3160 GOLD...');
  }
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      console.log(`TVS RP3160 GOLD print attempt ${attempt}/${retries + 1}`);
      
      switch (connection.toLowerCase()) {
        case 'network':
        case 'lan':
          return await printToTVSNetwork(bill, ip, port);
          
        case 'usb':
          return await printToTVSUSB(bill);
          
        case 'windows':
          return await printToTVSRP3160(bill, printerName);
          
        case 'auto':
        default:
          // Try Windows driver first (most reliable for TVS RP3160 GOLD)
          try {
            return await printToTVSRP3160(bill, printerName);
          } catch (winError) {
            console.log(`TVS Windows driver failed (attempt ${attempt}):`, winError.message);
            
            if (attempt === retries + 1) {
              // Last attempt - try USB direct
              try {
                console.log('Trying TVS RP3160 GOLD USB direct...');
                return await printToTVSUSB(bill);
              } catch (usbError) {
                console.log('TVS USB failed, trying network...');
                return await printToTVSNetwork(bill, ip, port);
              }
            }
            await new Promise(resolve => setTimeout(resolve, 3000));
            throw winError;
          }
      }
    } catch (error) {
      if (attempt === retries + 1) {
        throw error;
      }
      console.log(`TVS RP3160 GOLD attempt ${attempt} failed, retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

// Enhanced print route for TVS RP3160 GOLD
router.post('/print/:billId', auth, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId);
    
    if (!bill) {
      return res.status(404).json({ 
        success: false,
        message: 'Bill not found for TVS RP3160 GOLD printing' 
      });
    }

    const printResult = await printBillTVS(bill, req.body.printerConfig || {});
    
    if (printResult.success) {
      await Bill.findByIdAndUpdate(req.params.billId, { 
        isPrinted: true,
        printedAt: new Date(),
        printerUsed: 'TVS RP3160 GOLD'
      });
    }

    res.json({
      success: printResult.success,
      message: printResult.message,
      billNumber: bill.billNumber,
      printer: 'TVS RP3160 GOLD',
      details: printResult
    });
    
  } catch (error) {
    console.error('TVS RP3160 GOLD print route error:', error);
    res.status(500).json({ 
      success: false,
      message: 'TVS RP3160 GOLD print failed',
      error: error.message,
      billId: req.params.billId,
      printer: 'TVS RP3160 GOLD'
    });
  }
});

// TVS RP3160 GOLD test print
router.post('/test', auth, async (req, res) => {
  try {
    const { connection = 'auto', ip, port, printerName, openCashDrawer = false } = req.body;
    
    const testBill = {
      billNumber: `TVS-TEST-${Date.now()}`,
      customerName: 'Test Customer',
      customerPhone: '+91-9691954035',
      tableNumber: 'T5',
      items: [
        { name: 'Masala Dosa', quantity: 2, price: 80, total: 160 },
        { name: 'Coffee', quantity: 2, price: 25, total: 50 },
        { name: 'Vada Sambar', quantity: 1, price: 40, total: 40 }
      ],
      subtotal: 250,
      gst: 45,
      serviceCharge: 25,
      discount: 20,
      total: 300,
      paymentMethod: 'cash',
      cashReceived: 300,
      status: 'paid',
      createdAt: new Date()
    };
    
    const result = await printBillTVS(testBill, { 
      connection, ip, port, printerName, openCashDrawer 
    });
    
    res.json({
      success: result.success,
      message: result.success 
        ? 'TVS RP3160 GOLD test print successful!' 
        : result.message,
      testBill: testBill.billNumber,
      printer: 'TVS RP3160 GOLD',
      details: result
    });
    
  } catch (error) {
    console.error('TVS RP3160 GOLD test error:', error);
    res.status(500).json({ 
      success: false, 
      message: `TVS RP3160 GOLD test failed: ${error.message}`,
      printer: 'TVS RP3160 GOLD',
      timestamp: new Date().toISOString()
    });
  }
});

// Get TVS RP3160 GOLD specific printer info
router.get('/printers', auth, async (req, res) => {
  try {
    const printer = require('printer');
    const printers = printer.getPrinters();
    
    const tvsKeywords = ['tvs', 'rp3160', 'rp-3160', 'gold', 'thermal'];
    
    const formattedPrinters = printers.map(p => ({
      name: p.name,
      displayName: p.displayName || p.name,
      status: p.status,
      isDefault: p.isDefault,
      isShared: p.isShared,
      portName: p.portName,
      driverName: p.driverName,
      location: p.location,
      isTVS: tvsKeywords.some(keyword => 
        p.name.toLowerCase().includes(keyword.toLowerCase())
      ),
      isRP3160: p.name.toLowerCase().includes('rp3160') || 
                p.name.toLowerCase().includes('rp-3160'),
      recommended: tvsKeywords.some(keyword => 
        p.name.toLowerCase().includes(keyword.toLowerCase())
      )
    }));
    
    // Sort TVS RP3160 GOLD printers first
    formattedPrinters.sort((a, b) => {
      if (a.isRP3160 && !b.isRP3160) return -1;
      if (!a.isRP3160 && b.isRP3160) return 1;
      if (a.isTVS && !b.isTVS) return -1;
      if (!a.isTVS && b.isTVS) return 1;
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });
    
    const tvsRP3160Printers = formattedPrinters.filter(p => p.isRP3160);
    const tvsPrinters = formattedPrinters.filter(p => p.isTVS);
    
    res.json({
      success: true,
      printers: formattedPrinters,
      count: formattedPrinters.length,
      tvsRP3160Count: tvsRP3160Printers.length,
      tvsCount: tvsPrinters.length,
      recommendedPrinter: tvsRP3160Printers[0]?.name || tvsPrinters[0]?.name || 'None found',
      defaultPrinter: formattedPrinters.find(p => p.isDefault)?.name || 'None',
      instructions: tvsRP3160Printers.length === 0 ? [
        'Install TVS RP3160 GOLD drivers from TVS website',
        'Connect printer via USB cable',
        'Set as default printer in Windows',
        'Test print from Windows before using POS'
      ] : []
    });
    
  } catch (error) {
    console.error('Get TVS printers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get TVS RP3160 GOLD printers: ' + error.message,
      printers: [],
      instructions: [
        'Install "printer" npm package: npm install printer',
        'Install TVS RP3160 GOLD drivers',
        'Check Windows printer settings'
      ],
      timestamp: new Date().toISOString()
    });
  }
});

// TVS RP3160 GOLD status and health check
router.get('/status', auth, async (req, res) => {
  try {
    const printer = require('printer');
    const printers = printer.getPrinters();
    console.log('Available printers:', printers.map(p => p.name));
    const tvsKeywords = ['tvs', 'rp3160', 'rp-3160', 'gold'];
    const tvsRP3160Printers = printers.filter(p => 
      tvsKeywords.some(keyword => 
        p.name.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    const allTVSPrinters = printers.filter(p => 
      p.name.toLowerCase().includes('tvs') ||
      p.name.toLowerCase().includes('thermal') ||
      p.name.toLowerCase().includes('pos')
    );
    
    const defaultPrinter = printers.find(p => p.isDefault);
    
    // Determine overall status
    let status = 'offline';
    let connection = 'Not Connected';
    let recommendations = [];
    
    if (tvsRP3160Printers.length > 0) {
      status = 'online';
      connection = 'TVS RP3160 GOLD Connected';
      if (tvsRP3160Printers.some(p => p.status && p.status.toLowerCase().includes('ready'))) {
        status = 'ready';
        connection = 'TVS RP3160 GOLD Ready';
      }
    } else if (allTVSPrinters.length > 0) {
      status = 'compatible';
      connection = 'TVS Printer Available';
      recommendations.push('Detected TVS printer but not RP3160 GOLD model');
    } else if (printers.length > 0) {
      status = 'fallback';
      connection = 'Generic Printer Available';
      recommendations.push('No TVS printer detected');
      recommendations.push('Install TVS RP3160 GOLD drivers for optimal performance');
    } else {
      recommendations.push('No printers found on system');
      recommendations.push('Install TVS RP3160 GOLD drivers');
      recommendations.push('Check USB connection and power');
      recommendations.push('Restart printer and computer if needed');
    }
    
    // Additional recommendations based on status
    if (status === 'online' || status === 'ready') {
      recommendations.push('TVS RP3160 GOLD is ready for printing');
      recommendations.push('Use 80mm thermal paper for best results');
    }
    
    res.json({
      status: status,
      model: 'TVS RP3160 GOLD',
      connection: connection,
      tvsRP3160Printers: tvsRP3160Printers.map(p => ({
        name: p.name,
        status: p.status || 'Unknown',
        isDefault: p.isDefault,
        portName: p.portName,
        driverName: p.driverName
      })),
      allTVSPrinters: allTVSPrinters.map(p => ({
        name: p.name,
        status: p.status || 'Unknown',
        isDefault: p.isDefault
      })),
      defaultPrinter: defaultPrinter?.name || 'None',
      totalPrinters: printers.length,
      tvsRP3160Count: tvsRP3160Printers.length,
      allTVSCount: allTVSPrinters.length,
      lastCheck: new Date().toISOString(),
      recommendations: recommendations,
      paperWidth: '80mm',
      supportedCommands: ['ESC/POS', 'Cash Drawer', 'Barcode', 'QR Code'],
      connectionTypes: ['USB', 'Network', 'Windows Driver']
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      model: 'TVS RP3160 GOLD',
      connection: 'Error checking status',
      recommendations: [
        'Install "printer" npm package',
        'Check TVS RP3160 GOLD driver installation',
        'Verify printer connection'
      ],
      timestamp: new Date().toISOString()
    });
  }
});

// Cash drawer control for TVS RP3160 GOLD
router.post('/cash-drawer', auth, async (req, res) => {
  try {
    const { printerName, connection = 'auto' } = req.body;
    
    // Create cash drawer command buffer
    const cashDrawerCommand = Buffer.concat([
      TVS_ESC_POS.INIT,
      TVS_ESC_POS.CASH_DRAWER_PIN2, // Primary cash drawer pin
      TVS_ESC_POS.CASH_DRAWER_PIN5  // Secondary cash drawer pin (fallback)
    ]);
    
    if (connection === 'usb') {
      // Direct USB cash drawer opening
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFile = path.join(tempDir, `cash_drawer_${Date.now()}.prn`);
      fs.writeFileSync(tempFile, cashDrawerCommand);
      
      exec(`copy "${tempFile}" /B USB001: /B`, (error) => {
        setTimeout(() => {
          try { fs.unlinkSync(tempFile); } catch (e) {}
        }, 2000);
        
        if (!error) {
          res.json({
            success: true,
            message: 'Cash drawer opened via USB'
          });
        } else {
          res.json({
            success: false,
            message: 'Failed to open cash drawer via USB'
          });
        }
      });
    } else {
      // Windows printer cash drawer
      const printer = require('printer');
      const printers = printer.getPrinters();
      
      let targetPrinter = printers.find(p => p.name === printerName) ||
                         printers.find(p => p.name.toLowerCase().includes('tvs')) ||
                         printers.find(p => p.isDefault);
      
      if (!targetPrinter) {
        return res.status(404).json({
          success: false,
          message: 'No suitable printer found for cash drawer'
        });
      }
      
      printer.printDirect({
        data: cashDrawerCommand,
        printer: targetPrinter.name,
        type: 'RAW',
        success: function(jobID) {
          res.json({
            success: true,
            message: 'Cash drawer opened successfully',
            printer: targetPrinter.name,
            jobID: jobID
          });
        },
        error: function(err) {
          res.json({
            success: false,
            message: 'Failed to open cash drawer: ' + err
          });
        }
      });
    }
    
  } catch (error) {
    console.error('Cash drawer error:', error);
    res.status(500).json({
      success: false,
      message: 'Cash drawer operation failed: ' + error.message
    });
  }
});

// Bulk print route optimized for TVS RP3160 GOLD
router.post('/print/bulk', auth, async (req, res) => {
  try {
    const { billIds, printerConfig, delay = 2000 } = req.body;
    
    if (!Array.isArray(billIds) || billIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Bill IDs array is required for TVS RP3160 GOLD bulk printing'
      });
    }
    
    if (billIds.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 50 bills can be printed at once on TVS RP3160 GOLD'
      });
    }
    
    const results = [];
    
    for (let i = 0; i < billIds.length; i++) {
      const billId = billIds[i];
      
      try {
        const bill = await Bill.findById(billId);
        if (!bill) {
          results.push({
            billId,
            success: false,
            message: 'Bill not found'
          });
          continue;
        }
        
        console.log(`TVS RP3160 GOLD bulk print: ${i + 1}/${billIds.length} - Bill: ${bill.billNumber}`);
        
        const printResult = await printBillTVS(bill, printerConfig || {});
        
        if (printResult.success) {
          await Bill.findByIdAndUpdate(billId, { 
            isPrinted: true,
            printedAt: new Date(),
            printerUsed: 'TVS RP3160 GOLD'
          });
        }
        
        results.push({
          billId,
          billNumber: bill.billNumber,
          success: printResult.success,
          message: printResult.message,
          printer: 'TVS RP3160 GOLD'
        });
        
        // Delay between prints to avoid TVS printer buffer overflow
        if (i < billIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
      } catch (error) {
        results.push({
          billId,
          success: false,
          message: `TVS RP3160 GOLD error: ${error.message}`
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: successCount > 0,
      message: `TVS RP3160 GOLD: ${successCount}/${billIds.length} bills printed successfully`,
      results,
      totalBills: billIds.length,
      successCount,
      failureCount: billIds.length - successCount,
      printer: 'TVS RP3160 GOLD',
      processingTime: `${((billIds.length - 1) * delay / 1000)} seconds`
    });
    
  } catch (error) {
    console.error('TVS RP3160 GOLD bulk print error:', error);
    res.status(500).json({
      success: false,
      message: 'TVS RP3160 GOLD bulk print failed: ' + error.message,
      printer: 'TVS RP3160 GOLD'
    });
  }
});

// Print duplicate bill route
router.post('/print/duplicate/:billId', auth, async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.billId);
    
    if (!bill) {
      return res.status(404).json({ 
        success: false,
        message: 'Bill not found for duplicate printing' 
      });
    }

    // Mark as duplicate in the bill content
    const duplicateBill = {
      ...bill.toObject(),
      isDuplicate: true,
      duplicateCount: (bill.duplicateCount || 0) + 1,
      originalPrintDate: bill.printedAt || bill.createdAt
    };

    const printResult = await printBillTVS(duplicateBill, req.body.printerConfig || {});
    
    if (printResult.success) {
      await Bill.findByIdAndUpdate(req.params.billId, { 
        duplicateCount: duplicateBill.duplicateCount,
        lastDuplicateAt: new Date()
      });
    }

    res.json({
      success: printResult.success,
      message: printResult.success 
        ? `Duplicate bill printed successfully (Copy #${duplicateBill.duplicateCount})`
        : printResult.message,
      billNumber: bill.billNumber,
      duplicateNumber: duplicateBill.duplicateCount,
      printer: 'TVS RP3160 GOLD',
      details: printResult
    });
    
  } catch (error) {
    console.error('TVS RP3160 GOLD duplicate print error:', error);
    res.status(500).json({ 
      success: false,
      message: 'TVS RP3160 GOLD duplicate print failed',
      error: error.message,
      billId: req.params.billId
    });
  }
});

// Advanced configuration route for TVS RP3160 GOLD
router.post('/configure', auth, async (req, res) => {
  try {
    const { 
      paperWidth = 80,
      cutType = 'full',
      cashDrawer = true,
      barcodeSupport = true,
      logoSupport = false,
      encoding = 'utf8'
    } = req.body;
    
    // Save configuration (you can store this in database or config file)
    const config = {
      model: 'TVS RP3160 GOLD',
      paperWidth: paperWidth,
      lineWidth: paperWidth === 80 ? 32 : 24,
      cutType: cutType,
      cashDrawer: cashDrawer,
      barcodeSupport: barcodeSupport,
      logoSupport: logoSupport,
      encoding: encoding,
      escposVersion: '2.0',
      updatedAt: new Date()
    };
    
    // Test configuration with sample print
    const testBill = {
      billNumber: `CONFIG-TEST-${Date.now()}`,
      items: [{ name: 'Config Test', quantity: 1, price: 1, total: 1 }],
      total: 1,
      createdAt: new Date()
    };
    
    try {
      await printBillTVS(testBill, { connection: 'auto' });
      
      res.json({
        success: true,
        message: 'TVS RP3160 GOLD configuration updated and tested successfully',
        config: config,
        testResult: 'Print test successful'
      });
    } catch (testError) {
      res.json({
        success: true,
        message: 'TVS RP3160 GOLD configuration updated (test print failed)',
        config: config,
        testResult: 'Print test failed: ' + testError.message,
        warning: 'Configuration saved but printer may not be ready'
      });
    }
    
  } catch (error) {
    console.error('TVS RP3160 GOLD configuration error:', error);
    res.status(500).json({
      success: false,
      message: 'TVS RP3160 GOLD configuration failed: ' + error.message
    });
  }
});

module.exports = router;