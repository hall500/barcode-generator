const fs = require('fs');
const uuid = require('uuid');
const axios = require('axios');
const path = require('path');
const Jimp = require('jimp');

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

// Delete the "barcodes" folder and CSV file if they exist
deleteFolderRecursive(outputFolderPath);
if (fs.existsSync(csvFilePath)) {
    fs.unlinkSync(csvFilePath);
}

// Create the output folder if it doesn't exist
if (!fs.existsSync(outputFolderPath)) {
    fs.mkdirSync(outputFolderPath);
}

const guid = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        let r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};

const generateOrderId = (length = 14) => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
};

const addTextToBarcodeImage = async (barcodeImage, text) => {
    // Load the barcode image
    const image = await Jimp.read(barcodeImage);
  
    // Create a text object
    const textObject = new Jimp.Text({
      text,
      alignment: Jimp.ALIGN_RIGHT,
      position: {
        x: image.bitmap.width - 10,
        y: 10,
      },
    });
  
    // Add the text to the image
    image.composite(textObject, 0, 0);
  
    // Save the image
    await image.writeAsync('output.png');
}

const getQRCode = (text) => {
    const baseUrl = 'https://chart.googleapis.com/chart';
    const chartType = 'qr';
    const width = 250;
    const height = 250;

    // Customize the barcode parameters as needed
    const params = {
        cht: chartType,
        chs: `${width}x${height}`,
        chl: text, // Text to encode as a barcode
        choe: 'UTF-8',
    };

    const queryParams = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');

    return `${baseUrl}?${queryParams}`;
}

// Function to generate UUIDs and barcodes
// Function to generate UUIDs and barcodes
async function generateUUIDsAndBarcodes(count) {
    const uuidData = [];

    for (let i = 0; i < count; i++) {
        const code_id = guid();
        const num = i + 1;
        //const code_url = `https://rider.transpay.com/${code_id}?q=${num}`;
        const code_url = `https://transpay.vercel.app/search`;
        const qrCodeUrl = getQRCode(code_url);

        uuidData.push({
            id: num,
            item_id: generateOrderId(20),
            code_id,
            code_url,
        });

        // Download the QR code image
        const qrCodeResponse = await axios.get(qrCodeUrl, { responseType: 'stream' });
        const qrCodeFilePath = path.join(outputFolderPath, `${num}_qr.png`);

        qrCodeResponse.data.pipe(fs.createWriteStream(qrCodeFilePath));

        // Add text to the QR code image
        const textToAdd = `T${num}`;
        const barcodeOutputFilePath = path.join(outputFolderPath, `${num}_barcode.png`);
        //await addTextToBarcodeImage(qrCodeFilePath, textToAdd, barcodeOutputFilePath); 

        // Save the final barcode image path in uuidData
        uuidData[num - 1].barcode_url = barcodeOutputFilePath;
    }

    return uuidData;
}


// Generate and write UUIDs and barcodes to CSV
async function main() {
    const uuidCount = 2;
    const uuidData = await generateUUIDsAndBarcodes(uuidCount);

    // Write UUID data to a CSV file
    const csvData = uuidData.map((item) => `${item.id},${item.code_id},${item.code_id},${item.code_url}`).join('\n');
    fs.writeFileSync(csvFilePath, `id,item_id,code_id,barcode_url\n${csvData}`);

    console.log(`Generated ${uuidCount} UUIDs and barcodes.`);
    process.exit();
}

main().catch((err) => console.error(err));