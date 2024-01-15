const fs = require('fs');
const uuid = require('uuid');
const axios = require('axios');
const path = require('path');
const Jimp = require('jimp');
const yargs = require('yargs');
const { Readable } = require('stream');
const csv = require('csv-parser');
const bwipjs = require('bwip-js');

//Sample Command
// npm start -- --start=0 --count=20 --generate=image
// npm start -- --generate=text

// Define the output folder path
const outputFolderPath = path.join(__dirname, 'barcodes');
const csvFilePath = path.join(__dirname, 'transpay_barcodes.csv');

// Function to delete a folder and its contents
function deleteFolderRecursive(folderPath) {
    if (fs.existsSync(folderPath)) {
        fs.readdirSync(folderPath).forEach((file) => {
            const curPath = path.join(folderPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                // Recursive call for directories
                deleteFolderRecursive(curPath);
            } else {
                // Delete file
                fs.unlinkSync(curPath);
            }
        });
        // Delete the folder itself
        fs.rmdirSync(folderPath);
    }
}

const guid = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        let r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const generateOrderId = (length = 14) => {
  const timestamp = Date.now().toString();
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  let result = '';

  // Include characters from the timestamp
  for (let i = 0; i < timestamp.length; i++) {
      result += timestamp.charAt(i);
  }

  // Include random characters for additional randomness
  for (let i = result.length; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
};

const addTextToBarcodeImage = async (image) => {
    var fileName = image;
    var imageCaption = image.split('/').pop().split('_')[0];
    console.log(imageCaption);
    var loadedImage;

    // Load the barcode image
    Jimp.read(fileName)
    .then(function (image) {
        loadedImage = image;
        return Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    })
    .then(function (font) {
        // Calculate the position to place the text at the bottom right
        var x = (loadedImage.bitmap.width - Jimp.measureText(font, imageCaption)) / 2;
        var y = loadedImage.bitmap.height - 30; // You can adjust the value for vertical positioning

        loadedImage.print(font, x, y, imageCaption)
                   .write(fileName);
    })
    .catch(function (err) {
        console.error(err);
    });
}

// const getQRCode = (text) => {
//     const baseUrl = 'https://chart.googleapis.com/chart';
//     const chartType = 'qr';
//     const width = 250;
//     const height = 250;

//     // Customize the barcode parameters as needed
//     const params = {
//         cht: chartType,
//         chs: `${width}x${height}`,
//         chl: text, // Text to encode as a barcode
//         choe: 'UTF-8',
//     };

//     const queryParams = Object.entries(params)
//         .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
//         .join('&');

//     return `${baseUrl}?${queryParams}`;
// }

const getQRCode = async (text) => {
  const width = 250;
    const height = 250;
  // Customize the barcode parameters as needed
  const options = {
      bcid: 'qrcode',  // Barcode type: qr code
      text: text,      // Text to encode as a barcode
      scale: 3,        // Scale factor
      width: width, //Width of the barcode
      height: height,     // Height of the barcode
      includetext: false, // Whether to include text in the barcode
  };

  const img = await bwipjs.toDataURL(options);
  return img.uri;
};

function listFilesInFolderStream(folderPath) {
    const readStream = new Readable({
      objectMode: true,
      read() {},
    });
  
    // Read the contents of the folder and push file names to the stream
    fs.readdir(folderPath, (err, files) => {
      if (err) {
        console.error('Error reading folder:', err);
        return readStream.push(null);
      }
  
      files.forEach(file => {
        readStream.push(file);
      });
  
      readStream.push(null); // Signal the end of the stream
    });
  
    readStream.on('data', file => {
      addTextToBarcodeImage(`${folderPath}/${file}`); 
    });
  
    readStream.on('end', () => {
      console.log('Finished listing files in the folder.');
    });
  }

// Function to generate UUIDs and barcodes
// Function to generate UUIDs and barcodes
async function generateUUIDsAndBarcodes(start = 0, count = 1000) {
    const uuidData = [];

    const end = start + count;
    for (let i = start; i <= end; i++) {
        const code_id = generateOrderId(8);
        const num = (start > 0) ? i : i + 1;
        //const code_url = `https://rider.transpay.com/${code_id}?q=${num}`;
        const code_url = `https://transpaytms.com/v/status/${code_id}`;
        const qrCodeUrl = await getQRCode(code_url);
        console.log(qrCodeUrl);

        if(i < end) uuidData.push({
            id: num,
            code_id,
            code_url,
        });

        // Download the QR code image
        const qrCodeResponse = await axios.get(qrCodeUrl, { responseType: 'stream' });
        const qrCodeFilePath = path.join(outputFolderPath, `${code_id}_qr.png`);

        qrCodeResponse.data.pipe(fs.createWriteStream(qrCodeFilePath));
    }

    return uuidData;
}

function csvToSqlInsert(csvFilePath, tableName) {
    const inserts = [];
  
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        const values = Object.values(row)
          .map(value => typeof value === 'string' ? `'${value}'` : value)
          .join(', ');
  
        inserts.push(`INSERT INTO ${tableName} VALUES (${values});`);
      })
      .on('end', () => {
        // Save the SQL inserts to a file or do something else with them
        fs.writeFileSync('output.sql', inserts.join('\n'));
        console.log('Conversion completed. Check output.sql for SQL inserts.');
      });
  }

// Generate and write UUIDs and barcodes to CSV
async function main() {
    // Delete the "barcodes" folder and CSV file if they exist
    deleteFolderRecursive(outputFolderPath);
    if (fs.existsSync(csvFilePath)) {
        fs.unlinkSync(csvFilePath);
    }

    // Create the output folder if it doesn't exist
    if (!fs.existsSync(outputFolderPath)) {
        fs.mkdirSync(outputFolderPath);
    }

    const uuidCount = 2;
    const start = parseInt(argv.start) || 0;
    const count = parseInt(argv.count) || 1000;
    const uuidData = await generateUUIDsAndBarcodes(start, count);

    // Write UUID data to a CSV file
    const csvData = uuidData.map((item) => `${item.id},${item.code_id},${item.code_url}`).join('\n');

    fs.writeFileSync(csvFilePath, `id,code_id,barcode_url\n${csvData}`);

    console.log(`Generated ${uuidData.length} UUIDs and barcodes.`);
    process.exit();
}

// Define command line options
const argv = yargs
  .option('start', {
    alias: 's',
    description: 'Number to start generating barcodes from',
    type: 'number',
  })
  .option('count', {
    alias: 'c',
    description: 'Number of barcodes to generate',
    type: 'number',
  })
  .option('generate', {
    alias: 'g',
    description: 'Generate barcode. use values image or text or both e.g image,text',
    type: 'string',
  })
  .help()
  .argv;

const generate = argv.generate.split(',');

if(generate.length > 1) {
  console.error('Cannot run more than one command at a time');
}

if(generate.includes('image')){
    main().catch((err) => console.error(err));
}

if(generate.includes('text')) listFilesInFolderStream('barcodes');

if(generate.includes('sql')){
    // Example usage:
    const filepath = csvFilePath; // Replace with your CSV file path
    const tableName = 'transpay_barcodes'; // Replace with your table name

    csvToSqlInsert(filepath, tableName);
}